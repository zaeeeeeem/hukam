// Hukam: command your coding agents from WhatsApp.
// WhatsApp message -> Gemma 4 decides the action -> Superset runs the agent -> result back on WhatsApp.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as wa from "./whatsapp.mjs";
import * as gemma from "./gemma.mjs";
import * as superset from "./superset.mjs";
import * as bus from "./bus.mjs";
import * as voice from "./voice.mjs";

const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);
const ALLOW = list(process.env.WA_ALLOW);
// Groups where any member may command Hukam. Approvals and stop stay owner-only.
const GROUPS = list(process.env.WA_GROUPS);
const OWNER = process.env.WA_OWNER || "923124487312";
const OWNER_LID = (process.env.WA_OWNER_LID || "237077966905376@lid").split("@")[0];
const POLL_MS = Number(process.env.WA_POLL_MS || 2000);
const STATE_FILE = new URL("../.hukam-state.json", import.meta.url);
const AGENTS = new Set(["claude", "codex", "opencode"]);
const ACKS = ["👀", "🫡", "⚡", "🔥", "🚀", "🧠", "🛠️", "👍", "✨", "🤝"];

if (!ALLOW.length && !GROUPS.length) throw new Error("WA_ALLOW and WA_GROUPS are empty: set at least one allowed phone number or group");
if (!process.env.HUKAM_WORKSPACE) throw new Error("HUKAM_WORKSPACE is not set");

// name -> { name, agent, terminal, prompt, status, owner } (owner = chat that started it: phone or group JID)
const sessions = new Map(existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : []);
const pending = new Map(); // approval code -> { intent, chat, sender }
const groupInfo = new Map(); // group JID -> { name, members: [{ jid, phone, lid }] }
let groupsAt = 0;
const seen = new Set();

const save = () => writeFileSync(STATE_FILE, JSON.stringify([...sessions], null, 2));
const code = () => Math.random().toString(36).slice(2, 6);

function uniqueName(base) {
  const clean = (base || "task").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "task";
  let name = clean;
  for (let i = 2; sessions.has(name); i++) name = `${clean}-${i}`;
  return name;
}

// `chat` is where we answer: a 1:1 phone number or a group JID.
async function reply(chat, text) {
  bus.emit("reply", { text, chat: chatLabel(chat) });
  await wa.send(chat, text);
}

const chatLabel = (chat) => (wa.isGroup(chat) ? groupInfo.get(chat)?.name || "group" : "DM");

async function refreshGroups(force = false) {
  if (!GROUPS.length || (!force && Date.now() - groupsAt < 30_000)) return;
  groupsAt = Date.now();
  try {
    for (const [j, g] of await wa.groups()) if (GROUPS.includes(j)) groupInfo.set(j, g);
  } catch (err) {
    console.error("[groups]", err.message);
  }
}

// The owner may show up as a phone number or (in "lid" groups) as a LID; both resolve through the member list.
const isOwner = (sender) => sender.phone === OWNER || (!!sender.lid && sender.lid === OWNER_LID);

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

async function watch(session, chat) {
  session.status = "working";
  save();
  bus.emit("status", { name: session.name, status: "working" });
  const state = await superset.waitSettled(session.terminal);
  if (session.status === "stopped") return;
  session.status = state === "timeout" ? "working" : state;
  save();
  bus.emit("status", { name: session.name, status: session.status });
  if (state === "timeout") return watch(session, chat);
  if (state === "exited") return reply(chat, `⛔ *${session.name}* exited.`);

  let summary;
  let screen = "";
  try {
    screen = await superset.read(session.terminal);
    summary = await gemma.summarize(session.name, screen);
  } catch (err) {
    console.error("[summarize]", err.message);
    summary = screenTail(screen);
  }
  bus.emit("done", { name: session.name, state, summary });
  if (state === "blocked") {
    await reply(chat, `🔐 *${session.name}* needs you:\n${summary}\n\nReply \`@${session.name} <answer>\` or \`stop ${session.name}\`.`);
  } else {
    await reply(chat, `✅ *${session.name}* finished:\n${summary}\n\nFollow up with \`@${session.name} <message>\`.`);
  }
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
    case "stop": {
      const s = sessions.get(intent.session);
      if (!s) return reply(chat, `No session named ${intent.session}.\n\n${listText()}`);
      s.status = "stopped";
      save();
      await superset.close(s.terminal).catch(() => {});
      bus.emit("status", { name: s.name, status: "stopped" });
      return reply(chat, `⏹️ Stopped *${s.name}*.`);
    }
    case "send": {
      const s = sessions.get(intent.session);
      if (!s) return reply(chat, `No session named ${intent.session}.\n\n${listText()}`);
      await superset.sendText(s.terminal, intent.prompt);
      await superset.sendKeys(s.terminal, "enter").catch(() => {});
      bus.emit("send", { name: s.name, prompt: intent.prompt });
      await reply(chat, `➡️ Sent to *${s.name}*.`);
      return watch(s, chat);
    }
    case "spawn": {
      const agent = AGENTS.has(intent.agent) ? intent.agent : "claude";
      const name = uniqueName(intent.name || intent.prompt?.split(/\s+/).slice(0, 3).join("-"));
      const terminal = await superset.spawn(agent, `${intent.prompt}

(Sent from WhatsApp through Hukam. Work only inside this workspace. Do not git push, deploy, or delete anything outside it. Never read, print or send .env files, keys, tokens or other secrets. Finish with a two-line summary of what you changed.)`);
      const s = { name, agent, terminal, prompt: intent.prompt, status: "working", owner: chat };
      sessions.set(name, s);
      save();
      bus.emit("spawn", { name, agent, prompt: intent.prompt });
      const hi = wa.isGroup(chat) && sender.name ? `${sender.name}, started` : "Started";
      await reply(chat, `🚀 ${hi} *${name}* on ${agent}.\nI'll message ${wa.isGroup(chat) ? "here" : "you"} when it's done.`);
      return watch(s, chat);
    }
    default:
      return reply(chat, HELP);
  }
}

// sender: { jid, phone, lid, name } of whoever wrote msg. jid is only needed (and set) in groups.
async function handle(chat, msg, sender = { phone: chat }) {
  const owner = isOwner(sender);
  if (msg.media === "audio") {
    wa.markRead(chat, msg.id, sender.jid);
    wa.react(chat, msg.id, "🎙️", sender.jid);
    const started = Date.now();
    msg.body = await voice.transcribe(await wa.downloadMedia(chat, msg.id));
    bus.emit("voice", { text: msg.body, ms: Date.now() - started });
    if (!msg.body) return reply(chat, "🎙️ Couldn't hear anything in that voice note.");
    await wa.send(chat, `🎙️ _${msg.body}_`);
  } else if (msg.media) {
    return reply(chat, `I can read text and voice notes. ${msg.media} isn't supported yet.`);
  }
  bus.emit("inbound", {
    from: sender.name || (sender.phone || sender.lid || "?").slice(-4),
    chat: chatLabel(chat),
    owner,
    text: msg.body,
    voice: msg.media === "audio",
  });
  // Instant acknowledgement: blue ticks plus a random emoji reaction (or a short text if the message has no ID).
  wa.markRead(chat, msg.id, sender.jid);
  const ack = ACKS[Math.floor(Math.random() * ACKS.length)];
  if (msg.id) wa.react(chat, msg.id, ack, sender.jid);
  else wa.send(chat, `${ack} on it`).catch(() => {});
  wa.typing(chat, true);

  let intent = fastPath(msg.body);
  if (intent?.action === "approval") {
    if (!owner) return reply(chat, "🔒 Only the owner can approve or cancel risky tasks.");
    const p = pending.get(intent.code);
    if (!p) return reply(chat, `No pending approval with code ${intent.code}.`);
    pending.delete(intent.code);
    bus.emit("approval", { code: intent.code, ok: intent.ok, prompt: p.intent.prompt });
    if (!intent.ok) return reply(p.chat, "❌ Cancelled.");
    wa.react(chat, msg.id, "✅", sender.jid);
    return execute(p.intent, p.chat, p.sender);
  }

  if (!intent) {
    try {
      intent = await gemma.route(msg.body, [...sessions.values()]);
      bus.emit("intent", { model: gemma.model, intent });
    } catch (err) {
      console.error("[gemma]", err.message);
      intent = fallbackRoute(msg.body);
      bus.emit("intent", { model: "regex-fallback", intent });
    }
  }

  if (intent.action === "stop" && !owner) return reply(chat, "🔒 Only the owner can stop agents.");

  if (intent.risk === "high" && ["spawn", "send"].includes(intent.action)) {
    const c = code();
    pending.set(c, { intent, chat, sender });
    bus.emit("gate", { code: c, reason: intent.reason, prompt: intent.prompt });
    const ask = owner ? `Reply \`yes ${c}\` to run or \`no ${c}\` to cancel.` : `The owner must approve: \`yes ${c}\` to run or \`no ${c}\` to cancel.`;
    return reply(chat, `⚠️ Gemma flagged this as risky: ${intent.reason}\n\n"${intent.prompt}"\n\n${ask}`);
  }
  return execute(intent, chat, sender);
}

let polling = false;
async function poll() {
  if (polling) return;
  polling = true;
  try {
    await pollOnce();
  } finally {
    polling = false;
  }
}

const keyOf = (m) => m.id || `${m.ts}|${m.body}`;

function dispatch(chat, m, sender) {
  handle(chat, m, sender).catch(async (err) => {
    console.error("[handle]", err);
    bus.emit("error", { message: err.message });
    await wa.send(chat, `⚠️ ${err.message}`).catch(() => {});
  });
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

async function pollOnce() {
  for (const phone of ALLOW) {
    let messages;
    try {
      messages = await wa.recent(phone);
    } catch (err) {
      console.error("[poll]", err.message);
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
  for (const group of GROUPS) {
    try {
      await pollGroup(group);
    } catch (err) {
      console.error("[poll group]", err.message);
    }
  }
}

// Seed: never replay history from before startup.
for (const chat of [...ALLOW, ...GROUPS]) {
  for (const m of await wa.recent(chat, 30)) seen.add(keyOf(m));
}
await refreshGroups(true);
await bus.start();
for (const s of sessions.values()) if (s.status === "working") watch(s, s.owner);
bus.emit("ready", {
  allow: ALLOW.map((p) => `…${p.slice(-4)}`),
  groups: GROUPS.map((g) => `${groupInfo.get(g)?.name || "?"} (${groupInfo.get(g)?.members.length ?? 0} members)`),
  model: gemma.model,
});
console.log(`Hukam listening for ${ALLOW.length} number(s) and ${GROUPS.length} group(s), polling every ${POLL_MS} ms`);
setInterval(poll, POLL_MS);
