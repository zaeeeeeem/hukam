// Hukam: command your coding agents from WhatsApp.
// WhatsApp message -> Gemma 4 decides the action -> Superset runs the agent -> result back on WhatsApp.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { basename } from "node:path";
import * as wa from "./whatsapp.mjs";
import * as gemma from "./gemma.mjs";
import * as superset from "./superset.mjs";
import * as bus from "./bus.mjs";
import * as voice from "./voice.mjs";
import * as preview from "./preview.mjs";
import * as artifacts from "./artifacts.mjs";
import * as settings from "./settings.mjs";
import { createApi } from "./api.mjs";

// Owner settings (portal-editable, .hukam-settings.json over .env), read on every use so changes apply live.
// allow: 1:1 numbers. groups: group JIDs where any member may command Hukam; approvals and stop stay owner-only.
const cfg = () => settings.get();
const STATE_FILE = new URL("../.hukam-state.json", import.meta.url);
// Per-chat memory: recent images (user photos and agent artifacts) and a pending "I'll send the image next" instruction.
const CHATS_FILE = new URL("../.hukam-chats.json", import.meta.url);
const AWAIT_MS = 10 * 60_000;
const AGENTS = new Set(settings.AGENTS);
const APPROVALS_FILE = new URL("../.hukam-approvals.json", import.meta.url);
// Photos and PDFs are copied into the agent workspace (the playground) so agents can open them.
const WORKDIR = process.env.HUKAM_WORKSPACE_DIR || fileURLToPath(new URL("../../demo/playground", import.meta.url));
const INBOX = `${WORKDIR}/inbox`;

if (!cfg().allow.length && !cfg().groups.length) throw new Error("WA_ALLOW and WA_GROUPS are empty: set at least one allowed phone number or group");
if (!process.env.HUKAM_WORKSPACE) throw new Error("HUKAM_WORKSPACE is not set");

// name -> { name, agent, terminal, prompt, status, owner, createdAt, updatedAt, from, summary, artifacts, previews }
// (owner = chat that started it: phone or group JID)
const sessions = new Map(existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : []);
// Risky tasks waiting for the owner (code -> { code, intent, chat, sender, at }) and the decisions already made.
// Persisted, so a restart no longer drops a pending approval.
let approvals = { pending: [], history: [] };
try {
  if (existsSync(APPROVALS_FILE)) approvals = { ...approvals, ...JSON.parse(readFileSync(APPROVALS_FILE, "utf8")) };
} catch (err) {
  console.error("[approvals]", err.message);
}
const pending = new Map(approvals.pending.map((p) => [p.code, p]));
const decisions = approvals.history;
const saveApprovals = () => {
  try {
    writeFileSync(APPROVALS_FILE, JSON.stringify({ pending: [...pending.values()], history: decisions.slice(0, 100) }, null, 2));
  } catch (err) {
    console.error("[approvals]", err.message);
  }
};
const groupInfo = new Map(); // group JID -> { name, members: [{ jid, phone, lid }] }
let groupsAt = 0;
const seen = new Set();

const save = () => writeFileSync(STATE_FILE, JSON.stringify([...sessions], null, 2));
// Status change: stamp it, persist it, tell the portal.
function setStatus(s, status) {
  s.status = status;
  s.updatedAt = Date.now();
  save();
  bus.emit("status", { name: s.name, status, chatId: s.owner });
}

let chatMem = new Map();
try {
  if (existsSync(CHATS_FILE)) chatMem = new Map(JSON.parse(readFileSync(CHATS_FILE, "utf8")));
} catch (err) {
  console.error("[chats]", err.message);
}
const saveChats = () => {
  try {
    writeFileSync(CHATS_FILE, JSON.stringify([...chatMem], null, 2));
  } catch (err) {
    console.error("[chats]", err.message);
  }
};
const memOf = (chat) => {
  if (!chatMem.has(chat)) chatMem.set(chat, { images: [] });
  return chatMem.get(chat);
};

// image: { path (relative to the workspace), source: "user" | "agent", session? }
function rememberImage(chat, image) {
  const m = memOf(chat);
  m.images = [{ ...image, at: Date.now() }, ...m.images.filter((i) => i.path !== image.path)].slice(0, 5);
  m.lastImage = m.images[0];
  saveChats();
}

function imageContext(chat) {
  const images = chatMem.get(chat)?.images || [];
  if (!images.length) return "";
  const ago = (t) => `${Math.max(0, Math.round((Date.now() - t) / 60_000))} min ago`;
  return `Recent images in this chat (newest first):\n${images
    .map((i) => `- ${i.path} ${i.source === "agent" ? `made by session ${i.session}` : "sent by the user"}, ${ago(i.at)}`)
    .join("\n")}`;
}

// A pending instruction for the next photo/PDF in this chat, or null when absent or expired. Consumes it.
function takeAwaiting(chat) {
  const m = chatMem.get(chat);
  const a = m?.awaiting;
  if (!a) return null;
  delete m.awaiting;
  saveChats();
  return Date.now() - a.at < AWAIT_MS ? a.prompt : null;
}
const code = () => Math.random().toString(36).slice(2, 6);

function uniqueName(base) {
  const clean = (base || "task").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "task";
  let name = clean;
  for (let i = 2; sessions.has(name); i++) name = `${clean}-${i}`;
  return name;
}

// `chat` is where we answer: a 1:1 phone number or a group JID.
async function reply(chat, text) {
  bus.emit("reply", { text, chat: chatLabel(chat), chatId: chat });
  await wa.send(chat, text);
}

const chatLabel = (chat) => (wa.isGroup(chat) ? groupInfo.get(chat)?.name || "group" : "DM");

// Group metadata is a WhatsApp server query with a strict rate limit: cache it on disk, never ask more than
// every 20 s even when forced, and back off for 2 minutes after a 429.
const GROUPS_FILE = new URL("../.hukam-groups.json", import.meta.url);
let groupsBackoffUntil = 0;
if (existsSync(GROUPS_FILE)) for (const [j, g] of JSON.parse(readFileSync(GROUPS_FILE, "utf8"))) groupInfo.set(j, g);

async function refreshGroups(force = false) {
  const now = Date.now();
  const GROUPS = cfg().groups;
  if (!GROUPS.length || now < groupsBackoffUntil || now - groupsAt < (force ? 20_000 : 30_000)) return;
  groupsAt = now;
  try {
    for (const [j, g] of await wa.groups()) if (GROUPS.includes(j)) groupInfo.set(j, g);
    writeFileSync(GROUPS_FILE, JSON.stringify([...groupInfo]));
  } catch (err) {
    if (/429|rate/i.test(err.message)) groupsBackoffUntil = now + 120_000;
    console.error("[groups]", err.message.slice(0, 120));
  }
}

// The owner may show up as a phone number or (in "lid" groups) as a LID; both resolve through the member list.
const isOwner = (sender) => sender.phone === cfg().owner || (!!sender.lid && sender.lid === cfg().ownerLid);

// Commands that never need the model: approvals, list, help, and "@name message".
function fastPath(text) {
  let m;
  if ((m = text.match(/^(yes|y|no|n)\s+([a-z0-9]{4})$/i))) return { action: "approval", ok: /^y/i.test(m[1]), code: m[2].toLowerCase() };
  if (/^(list|ls|sessions)$/i.test(text)) return { action: "list" };
  if (/^(help|\?)$/i.test(text)) return { action: "help" };
  if ((m = text.match(/^stop\s+@?([\w-]+)$/i)) && sessions.has(m[1])) return { action: "stop", session: m[1], risk: "low" };
  return null;
}

// Regex fallback so the demo survives a Gemma outage.
function fallbackRoute(text) {
  let m;
  if ((m = text.match(/^@([\w-]+)\s+([\s\S]+)$/)) && sessions.has(m[1])) return { action: "send", session: m[1], prompt: m[2], risk: "low" };
  if ((m = text.match(/^(claude|codex|opencode)\s*:\s*([\s\S]+)$/i))) return { action: "spawn", agent: m[1].toLowerCase(), prompt: m[2], risk: "low" };
  return { action: "chat", reply: "Gemma is unreachable right now. Use `claude: <task>`, `@name <message>`, `list`, or `help`." };
}

function listText() {
  if (!sessions.size) return "No agents yet. Try: \"claude: add a dark mode toggle to the landing page\"";
  const icon = { working: "⏳", idle: "✅", blocked: "🔐", exited: "⛔", stopped: "⏹️" };
  return [...sessions.values()].map((s) => `${icon[s.status] || "•"} *${s.name}* (${s.agent}) ${s.status}\n   ${s.prompt.slice(0, 70)}`).join("\n");
}

const HELP = `*Hukam* — command your agents from WhatsApp
• Just say what you want: "codex se tests likhwao auth module ke"
• \`claude: <task>\` start an agent
• \`@name <message>\` follow up with a session
• \`list\` see all agents
• \`stop name\` stop one
Risky tasks (push, deploy, delete) wait for your "yes <code>".`;

// No-model fallback: the agent's own closing lines, minus the TUI chrome (prompt box, status bar).
function screenTail(screen) {
  const lines = screen.split("\n").map((l) => l.trim());
  const end = lines.findLastIndex((l) => /^[─━]{10,}/.test(l));
  const body = (end > 0 ? lines.slice(0, end) : lines).filter((l) => l && !/^[─━❯>]/.test(l) && !/^✻|weekly limit|bypass permissions/i.test(l));
  return body.slice(-4).join("\n").slice(0, 500) || "Done. Open the dashboard for details.";
}

async function watch(session, chat, startedAt = Date.now()) {
  setStatus(session, "working");
  const state = await superset.waitSettled(session.terminal);
  if (session.status === "stopped") return;
  setStatus(session, state === "timeout" ? "working" : state);
  if (state === "timeout") return watch(session, chat, startedAt);
  if (state === "exited") return reply(chat, `⛔ *${session.name}* exited.`);

  let summary;
  let screen = "";
  const summarizeStarted = Date.now();
  try {
    screen = await superset.read(session.terminal);
    summary = await gemma.summarize(session.name, screen);
  } catch (err) {
    console.error("[summarize]", err.message);
    summary = screenTail(screen);
  }
  session.summary = summary;
  session.finishedAt = Date.now();
  save();
  bus.emit("done", { name: session.name, state, summary, chatId: session.owner, model: gemma.served()?.key, ms: Date.now() - summarizeStarted });
  if (state === "blocked") {
    await reply(chat, `🔐 *${session.name}* needs you:\n${summary}\n\nReply \`@${session.name} <answer>\` or \`stop ${session.name}\`.`);
  } else {
    await reply(chat, `✅ *${session.name}* finished:\n${summary}\n\nFollow up with \`@${session.name} <message>\`.`);
    // Images the agent created go back to the chat that started the session.
    const target = session.owner || chat;
    if (cfg().artifacts.enabled) {
      try {
        for (const a of await artifacts.send(target, session.name, startedAt, WORKDIR)) {
          rememberImage(target, { path: a.rel, source: "agent", session: session.name });
          const file = basename(a.media);
          session.artifacts = [{ path: a.rel, url: `/outputs/${file}`, at: Date.now() }, ...(session.artifacts || [])].slice(0, 12);
          save();
          bus.emit("reply", { text: `🎨 ${session.name}: ${a.rel}`, chat: chatLabel(target), chatId: target, attachment: { kind: "image", url: `/outputs/${file}`, name: file } });
          bus.emit("artifact", { name: session.name, path: a.rel, url: `/outputs/${file}`, chatId: target });
        }
      } catch (err) {
        console.error("[artifacts]", err.message);
      }
    }
    // Show, don't tell: if the agent changed the page, send a screenshot of it.
    if (cfg().preview.enabled) {
      try {
        const shot = await preview.send(chat, session.name, startedAt);
        if (shot) {
          const url = `/outputs/${basename(shot)}`;
          session.previews = [{ url, at: Date.now() }, ...(session.previews || [])].slice(0, 12);
          save();
          bus.emit("preview", { name: session.name, url, chatId: chat });
        }
      } catch (err) {
        console.error("[preview]", err.message);
      }
    }
  }
}

// The owner's yes/no on a risky task, from WhatsApp ("yes k3f9") or the portal. Runs inside the trace of the
// message that asked, so the portal shows the task's whole journey in one place.
async function decide(code, ok, via = "whatsapp") {
  const p = pending.get(code);
  if (!p) return null;
  if (p.trace && bus.currentTrace() !== p.trace) return bus.withTrace(p.trace, () => decide(code, ok, via));
  pending.delete(code);
  decisions.unshift({ code, ok, via, at: Date.now(), askedAt: p.at, prompt: p.intent.prompt, reason: p.intent.reason, category: p.intent.category || null,
    chatId: p.chat, chat: chatLabel(p.chat), from: p.sender?.name || null });
  saveApprovals();
  bus.emit("approval", { code, ok, via, prompt: p.intent.prompt, chatId: p.chat });
  if (!ok) {
    await reply(p.chat, "❌ Cancelled.");
    return p;
  }
  execute(p.intent, p.chat, p.sender).catch((err) => {
    console.error("[approval]", err.message);
    bus.emit("error", { message: err.message, chatId: p.chat });
    wa.send(p.chat, `⚠️ ${err.message}`).catch(() => {});
  });
  return p;
}

async function stopSession(s, chat) {
  s.status = "stopped";
  s.updatedAt = Date.now();
  save();
  await superset.close(s.terminal).catch(() => {});
  bus.emit("status", { name: s.name, status: "stopped", chatId: s.owner });
  return reply(chat, `⏹️ Stopped *${s.name}*.`);
}

async function execute(intent, chat, sender = {}) {
  switch (intent.action) {
    case "list":
    case "status":
      return reply(chat, listText());
    case "help":
      return reply(chat, HELP);
    case "chat":
      return reply(chat, intent.reply || HELP);
    case "await_attachment": {
      memOf(chat).awaiting = { prompt: intent.prompt || "Build what this shows.", at: Date.now() };
      saveChats();
      bus.emit("awaiting", { prompt: memOf(chat).awaiting.prompt, chatId: chat });
      return reply(chat, "📎 Send the image when ready.");
    }
    case "stop": {
      const s = sessions.get(intent.session);
      if (!s) return reply(chat, `No session named ${intent.session}.\n\n${listText()}`);
      return stopSession(s, chat);
    }
    case "send": {
      const s = sessions.get(intent.session);
      if (!s) return reply(chat, `No session named ${intent.session}.\n\n${listText()}`);
      await superset.sendText(s.terminal, intent.prompt);
      await superset.sendKeys(s.terminal, "enter").catch(() => {});
      s.followUps = [{ prompt: intent.prompt, at: Date.now(), from: sender.name || null }, ...(s.followUps || [])].slice(0, 20);
      bus.emit("send", { name: s.name, prompt: intent.prompt, chatId: chat });
      await reply(chat, `➡️ Sent to *${s.name}*.`);
      return watch(s, chat);
    }
    case "spawn": {
      const agent = AGENTS.has(intent.agent) ? intent.agent : cfg().defaultAgent;
      const name = uniqueName(intent.name || intent.prompt?.split(/\s+/).slice(0, 3).join("-"));
      const terminal = await superset.spawn(agent, `${intent.prompt}

(Sent from WhatsApp through Hukam. Work only inside this workspace. Do not git push, deploy, or delete anything outside it. Save any images or other visual files you create under outputs/ in this workspace. Never read, print or send .env files, keys, tokens or other secrets. Finish with a two-line summary of what you changed.)`, cfg().models[agent]);
      const now = Date.now();
      const s = { name, agent, terminal, prompt: intent.prompt, status: "working", owner: chat, createdAt: now, updatedAt: now,
        from: sender.name || (isOwner(sender) ? "Owner" : null), model: cfg().models[agent] || null };
      sessions.set(name, s);
      save();
      bus.emit("spawn", { name, agent, prompt: intent.prompt, chatId: chat, chat: chatLabel(chat) });
      const hi = wa.isGroup(chat) && sender.name ? `${sender.name}, started` : "Started";
      await reply(chat, `🚀 ${hi} *${name}* on ${agent}.\nI'll message ${wa.isGroup(chat) ? "here" : "you"} when it's done.`);
      return watch(s, chat);
    }
    default:
      return reply(chat, HELP);
  }
}

// Magic bytes decide the type; WhatsApp's own label is only a hint.
function sniff(path) {
  const head = readFileSync(path).subarray(0, 12);
  const hex = head.toString("hex");
  if (hex.startsWith("89504e47")) return { kind: "image", ext: "png", mime: "image/png" };
  if (hex.startsWith("ffd8ff")) return { kind: "image", ext: "jpg", mime: "image/jpeg" };
  if (head.subarray(0, 4).toString() === "RIFF" && head.subarray(8, 12).toString() === "WEBP") return { kind: "image", ext: "webp", mime: "image/webp" };
  if (head.subarray(0, 4).toString() === "%PDF") return { kind: "pdf", ext: "pdf", mime: "application/pdf" };
  return null;
}

// Download a photo / document, copy it to <workspace>/inbox/<msgId>.<ext> and prepare it for Gemma. Returns null after
// telling the user why when the file is too big or of a type we can't read.
async function saveAttachment(chat, msg) {
  let src;
  try {
    src = await wa.downloadMedia(chat, msg.id);
  } catch (err) {
    console.error("[download]", err.message);
    await reply(chat, `Couldn't download that ${msg.media === "image" ? "photo" : "file"} from WhatsApp. Please send it again.`);
    return null;
  }
  const size = statSync(src).size;
  const maxMb = cfg().attachments.maxMb;
  if (size > maxMb * 1024 * 1024) {
    await reply(chat, `That file is ${(size / 1048576).toFixed(1)} MB. I can read photos and PDFs up to ${maxMb} MB.`);
    return null;
  }
  const type = sniff(src);
  if (!type) {
    await reply(chat, `I can read photos, PDFs, text and voice notes. That ${msg.media} isn't supported yet.`);
    return null;
  }
  mkdirSync(INBOX, { recursive: true });
  const file = `${msg.id}.${type.ext}`;
  copyFileSync(src, `${INBOX}/${file}`);
  const att = { ...type, file, path: `inbox/${file}`, url: `/inbox/${file}`, size };
  if (type.kind === "image") att.base64 = readFileSync(src).toString("base64");
  else {
    await promisify(execFile)("pdftotext", ["-layout", src, `${INBOX}/${msg.id}.txt`], { timeout: 30_000 }).catch((err) => console.error("[pdftotext]", err.message));
    att.text = existsSync(`${INBOX}/${msg.id}.txt`) ? readFileSync(`${INBOX}/${msg.id}.txt`, "utf8") : "";
    if (att.text.trim()) att.textPath = `inbox/${msg.id}.txt`;
  }
  return att;
}

// Gemma down (or the backend can't see images): still start the work, pointing the agent at the saved file.
function attachmentFallback(caption, att) {
  const ask = caption || (att.kind === "pdf" ? "Build what this document describes." : "Build what this image shows.");
  const textNote = att.textPath ? ` Its extracted text is at ${att.textPath}.` : "";
  return { action: "spawn", agent: "claude", name: `from-${att.kind}`, risk: "low", reason: "Gemma unreachable; attachment fallback.",
    prompt: `${ask}\n\nThe user's reference ${att.kind === "pdf" ? "document" : "image"} is at ${att.path} — open it and use it.${textNote}` };
}

// sender: { jid, phone, lid, name } of whoever wrote msg. jid is only needed (and set) in groups.
// msg.source === "portal": typed by the owner in the portal. Same path, minus the WhatsApp read receipt/reaction.
async function handle(chat, msg, sender = { phone: chat }) {
  const owner = isOwner(sender);
  const portal = msg.source === "portal";
  let attachment = null;
  if (msg.media === "audio") {
    if (!cfg().voice.enabled) return reply(chat, "🎙️ Voice notes are turned off right now. Please type the message.");
    wa.markRead(chat, msg.id, sender.jid);
    wa.react(chat, msg.id, "🎙️", sender.jid);
    const started = Date.now();
    msg.body = await voice.transcribe(await wa.downloadMedia(chat, msg.id));
    bus.emit("voice", { text: msg.body, ms: Date.now() - started, chatId: chat, chat: chatLabel(chat), from: sender.name || null });
    if (!msg.body) return reply(chat, "🎙️ Couldn't hear anything in that voice note.");
    await wa.send(chat, `🎙️ _${msg.body}_`);
  } else if (["image", "document"].includes(msg.media) && msg.id) {
    if (!cfg().attachments.enabled) return reply(chat, "Photos and PDFs are turned off right now. Please describe the task in text.");
    wa.markRead(chat, msg.id, sender.jid);
    wa.react(chat, msg.id, msg.media === "image" ? "🖼️" : "📄", sender.jid);
    attachment = await saveAttachment(chat, msg);
    if (!attachment) return;
    if (attachment.kind === "image") rememberImage(chat, { path: attachment.path, source: "user" });
    // "I'll send the photo next, build X from it": the stored instruction becomes the caption.
    const waiting = takeAwaiting(chat);
    if (waiting && (msg.body || "").trim().length < 25) msg.body = `${waiting}${msg.body?.trim() ? ` (${msg.body.trim()})` : ""}`;
  } else if (msg.media) {
    return reply(chat, `I can read text, voice notes, photos and PDFs. ${msg.media} isn't supported yet.`);
  }
  // A WhatsApp reply ("tagging" a message) beats every guess: a quoted photo/PDF becomes the attachment,
  // quoted text becomes context, and a quoted agent result points at that agent's session.
  if (msg.replyTo && !portal) {
    const quoted = await wa.findMessage(chat, msg.replyTo).catch(() => null);
    if (quoted) {
      const session = [...sessions.keys()].find((name) => quoted.body.includes(`*${name}*`) || quoted.body.includes(`${name}:`));
      if (!attachment && ["image", "document"].includes(quoted.media) && cfg().attachments.enabled) {
        attachment = await saveAttachment(chat, quoted);
        if (!attachment) return;
        if (attachment.kind === "image") rememberImage(chat, { path: attachment.path, source: quoted.fromMe ? "agent" : "user", ...(session && { session }) });
      }
      msg.rawBody = msg.body; // fixed commands ("yes k3f9" as a reply to the gate) still match on what was typed
      const said = quoted.body.trim() ? `: "${quoted.body.trim().slice(0, 600)}"` : "";
      const what = quoted.media ? `${quoted.fromMe ? "Hukam's" : "the user's"} ${quoted.media === "document" ? "file" : quoted.media}` : `${quoted.fromMe ? "Hukam's" : "an earlier"} message`;
      msg.body = `${msg.body}\n\n(This is a reply to ${what}${said}.${attachment ? ` The file it refers to is ${attachment.path}.` : ""}${session ? ` It belongs to session "${session}"; prefer sending the follow-up to that session.` : ""})`;
    }
  }
  bus.emit("inbound", {
    from: sender.name || (sender.phone || sender.lid || "?").slice(-4),
    chat: chatLabel(chat),
    chatId: chat,
    owner,
    text: msg.rawBody ?? msg.body,
    ...(msg.replyTo && { replyTo: msg.replyTo }),
    voice: msg.media === "audio",
    ...(portal && { source: "portal" }),
    ...(sender.phone && { phone: sender.phone }),
    ...(attachment && { attachment: { kind: attachment.kind, url: attachment.url, name: attachment.file, size: attachment.size } }),
  });
  // Instant acknowledgement: blue ticks plus a random emoji reaction (or a short text if the message has no ID).
  // A portal command has no WhatsApp message to tick, and the owner is looking at the portal: no ack text.
  if (!portal) {
    wa.markRead(chat, msg.id, sender.jid);
    const acks = cfg().acks;
    const ack = acks[Math.floor(Math.random() * acks.length)];
    if (msg.id && !attachment) wa.react(chat, msg.id, ack, sender.jid);
    else wa.send(chat, `${ack} on it`).catch(() => {});
    wa.typing(chat, true);
  }

  let intent = attachment ? null : fastPath(msg.rawBody ?? msg.body);
  if (intent?.action === "approval") {
    if (!owner) return reply(chat, "🔒 Only the owner can approve or cancel risky tasks.");
    if (!pending.has(intent.code)) return reply(chat, `No pending approval with code ${intent.code}.`);
    if (intent.ok && msg.id) wa.react(chat, msg.id, "✅", sender.jid);
    bus.emit("intent", { model: "fast-path", ms: 0, intent, chatId: chat });
    await decide(intent.code, intent.ok, portal ? "portal" : "whatsapp");
    return;
  }

  const routeStarted = Date.now();
  if (attachment) {
    try {
      intent = await gemma.routeWithAttachment(msg.body, [...sessions.values()], attachment, imageContext(chat));
      bus.emit("intent", { model: gemma.served()?.key || gemma.chain(), ms: Date.now() - routeStarted, intent, attachment: attachment.url, chatId: chat });
      if (intent.description) await reply(chat, `👀 Gemma sees: ${intent.description}`);
    } catch (err) {
      console.error("[gemma attachment]", err.message);
      intent = attachmentFallback(msg.body, attachment);
      bus.emit("intent", { model: "attachment-fallback", ms: Date.now() - routeStarted, intent, chatId: chat });
    }
  } else if (!intent) {
    try {
      intent = await gemma.route(msg.body, [...sessions.values()], imageContext(chat));
      bus.emit("intent", { model: gemma.served()?.key || gemma.chain(), ms: Date.now() - routeStarted, intent, chatId: chat });
    } catch (err) {
      console.error("[gemma]", err.message);
      intent = fallbackRoute(msg.body);
      bus.emit("intent", { model: "regex-fallback", ms: Date.now() - routeStarted, intent, chatId: chat });
    }
  } else {
    bus.emit("intent", { model: "fast-path", ms: 0, intent, chatId: chat });
  }

  if (intent.action === "stop" && !owner) return reply(chat, "🔒 Only the owner can stop agents.");

  if (intent.risk === "high" && ["spawn", "send"].includes(intent.action) && gated(intent)) {
    const c = code();
    pending.set(c, { code: c, intent, chat, sender, at: Date.now(), chatLabel: chatLabel(chat), trace: bus.currentTrace() });
    saveApprovals();
    bus.emit("gate", { code: c, reason: intent.reason, prompt: intent.prompt, category: intent.category || null, chatId: chat, chat: chatLabel(chat), from: sender.name || null });
    const ask = owner ? `Reply \`yes ${c}\` to run or \`no ${c}\` to cancel.` : `The owner must approve: \`yes ${c}\` to run or \`no ${c}\` to cancel.`;
    return reply(chat, `⚠️ Gemma flagged this as risky: ${intent.reason}\n\n"${intent.prompt}"\n\n${ask}`);
  }
  return execute(intent, chat, sender);
}

// Risk gate: on unless the owner turned it off. A category the owner allowed through skips the gate;
// an unknown or missing category is always gated.
function gated(intent) {
  const { gate, categories } = cfg().risk;
  if (!gate) return false;
  return categories[intent.category] !== false;
}

let polling = false;
const pollStats = { lastOkAt: null, lastErrorAt: null, lastError: null, polls: 0 };
async function poll() {
  if (polling) return;
  polling = true;
  try {
    await pollOnce();
    pollStats.polls++;
  } finally {
    polling = false;
  }
}

const keyOf = (m) => m.id || `${m.ts}|${m.body}`;

let traceSeq = 0;
function dispatch(chat, m, sender) {
  const trace = `t${Date.now().toString(36)}${(++traceSeq).toString(36)}`;
  bus.withTrace(trace, () =>
    handle(chat, m, sender).catch(async (err) => {
      console.error("[handle]", err);
      bus.emit("error", { message: err.message, chatId: chat });
      await wa.send(chat, `⚠️ ${err.message}`).catch(() => {});
    }),
  );
  return trace;
}

// The daemon's text lines show a sender's display name, not their JID. To react / mark read in a group we need the
// participant JID, so new message IDs are attributed by re-querying the group filtered by each member's phone and LID.
async function attribute(group, ids) {
  const found = new Map();
  for (const member of groupInfo.get(group)?.members || []) {
    for (const who of new Set([member.phone, member.lid].filter(Boolean))) {
      for (const m of await wa.recent(group, 20, who)) if (ids.has(keyOf(m))) found.set(keyOf(m), member);
    }
  }
  return found;
}

async function pollGroup(group) {
  const fresh = (await wa.recent(group)).filter((m) => !seen.has(keyOf(m)));
  if (!fresh.length) return;
  for (const m of fresh) if (m.fromMe) seen.add(keyOf(m));
  const theirs = fresh.filter((m) => !m.fromMe);
  if (!theirs.length) return;
  const ids = new Set(theirs.map(keyOf));
  let found = await attribute(group, ids);
  if (found.size < ids.size) {
    // The daemon may not have linked a brand-new message to the sender's number yet: give it a moment.
    await new Promise((r) => setTimeout(r, 1500));
    found = await attribute(group, ids);
  }
  if (found.size < ids.size) {
    await refreshGroups(true); // someone new (e.g. just added) is not in the cached member list yet
    found = await attribute(group, ids);
  }
  for (const m of theirs) {
    seen.add(keyOf(m));
    const member = found.get(keyOf(m));
    const name = m.from && !/^\d+(@|$)/.test(m.from) ? m.from : null;
    const sender = member ? { ...member, name } : { name, phone: null, lid: null, jid: null };
    dispatch(group, m, sender);
  }
}

// A chat added in settings while running: mark its existing history as seen first, so nothing old is replayed.
const seeded = new Set();
async function seed(chat) {
  for (const m of await wa.recent(chat, 30)) seen.add(keyOf(m));
  seeded.add(chat);
}

async function pollOnce() {
  let failed = null;
  for (const phone of cfg().allow) {
    let messages;
    try {
      if (!seeded.has(phone)) await seed(phone);
      messages = await wa.recent(phone);
    } catch (err) {
      console.error("[poll]", err.message);
      failed = err;
      continue;
    }
    for (const m of messages) {
      const key = keyOf(m);
      if (seen.has(key)) continue;
      seen.add(key);
      if (m.fromMe) continue;
      dispatch(phone, m, { phone, name: null });
    }
  }
  await refreshGroups();
  for (const group of cfg().groups) {
    try {
      if (!seeded.has(group)) await seed(group);
      await pollGroup(group);
    } catch (err) {
      console.error("[poll group]", err.message);
      failed = err;
    }
  }
  if (failed) Object.assign(pollStats, { lastErrorAt: Date.now(), lastError: failed.message.slice(0, 200) });
  else pollStats.lastOkAt = Date.now();
}

// Portal controller: what the JSON API (src/api.mjs) may read and do. Everything runs through the same paths
// WhatsApp messages take.
const controller = {
  sessions,
  pending,
  decisions,
  chatMem,
  groupInfo,
  pollStats,
  workdir: WORKDIR,
  inbox: INBOX,
  chatLabel,
  // Owner command typed in the portal. Replies go to `chat` (default: the owner's DM).
  command(text, chat = cfg().owner) {
    return dispatch(chat, { id: null, body: text, media: null, source: "portal" }, { phone: cfg().owner, lid: cfg().ownerLid, name: null });
  },
  followUp(s, text) {
    const trace = `t${Date.now().toString(36)}${(++traceSeq).toString(36)}`;
    bus.withTrace(trace, () =>
      execute({ action: "send", session: s.name, prompt: text }, s.owner || cfg().owner, { name: "Owner (portal)" }).catch((err) => {
        console.error("[follow-up]", err.message);
        bus.emit("error", { message: err.message, chatId: s.owner });
      }),
    );
    return trace;
  },
  stop: (s) => stopSession(s, s.owner || cfg().owner),
  decide: (code, ok) => decide(code, ok, "portal"),
};

// Seed: never replay history from before startup.
for (const chat of [...cfg().allow, ...cfg().groups]) await seed(chat);
await refreshGroups(true);
await bus.start({ inbox: INBOX, outputs: artifacts.MEDIA_ROOT, workdir: WORKDIR, api: createApi(controller) });
for (const s of sessions.values()) if (s.status === "working") watch(s, s.owner);
bus.emit("ready", {
  allow: cfg().allow.map((p) => `…${p.slice(-4)}`),
  groups: cfg().groups.map((g) => `${groupInfo.get(g)?.name || "?"} (${groupInfo.get(g)?.members.length ?? 0} members)`),
  model: gemma.chain(),
});
console.log(`Hukam listening for ${cfg().allow.length} number(s) and ${cfg().groups.length} group(s), polling every ${cfg().pollMs} ms`);
// Re-read the interval each tick: the owner can change it from the portal.
(function loop() {
  setTimeout(() => poll().catch((err) => console.error("[poll]", err.message)).finally(loop), cfg().pollMs);
})();
