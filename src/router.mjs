// Hukam: command your coding agents from WhatsApp.
// WhatsApp message -> Gemma 4 decides the action -> Superset runs the agent -> result back on WhatsApp.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as wa from "./whatsapp.mjs";
import * as gemma from "./gemma.mjs";
import * as superset from "./superset.mjs";
import * as bus from "./bus.mjs";
import * as voice from "./voice.mjs";

const ALLOW = (process.env.WA_ALLOW || "").split(",").map((s) => s.trim()).filter(Boolean);
const POLL_MS = Number(process.env.WA_POLL_MS || 2000);
const STATE_FILE = new URL("../.hukam-state.json", import.meta.url);
const AGENTS = new Set(["claude", "codex", "opencode"]);
const ACKS = ["👀", "🫡", "⚡", "🔥", "🚀", "🧠", "🛠️", "👍", "✨", "🤝"];

if (!ALLOW.length) throw new Error("WA_ALLOW is empty: set at least one allowed phone number");
if (!process.env.HUKAM_WORKSPACE) throw new Error("HUKAM_WORKSPACE is not set");

// name -> { name, agent, terminal, prompt, status, owner }
const sessions = new Map(existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : []);
const pending = new Map(); // approval code -> { intent, phone }
const seen = new Set();

const save = () => writeFileSync(STATE_FILE, JSON.stringify([...sessions], null, 2));
const code = () => Math.random().toString(36).slice(2, 6);

function uniqueName(base) {
  const clean = (base || "task").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "task";
  let name = clean;
  for (let i = 2; sessions.has(name); i++) name = `${clean}-${i}`;
  return name;
}

async function reply(phone, text) {
  bus.emit("reply", { text });
  await wa.send(phone, text);
}

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

async function watch(session, phone) {
  session.status = "working";
  save();
  bus.emit("status", { name: session.name, status: "working" });
  const state = await superset.waitSettled(session.terminal);
  if (session.status === "stopped") return;
  session.status = state === "timeout" ? "working" : state;
  save();
  bus.emit("status", { name: session.name, status: session.status });
  if (state === "timeout") return watch(session, phone);
  if (state === "exited") return reply(phone, `⛔ *${session.name}* exited.`);

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
    await reply(phone, `🔐 *${session.name}* needs you:\n${summary}\n\nReply \`@${session.name} <answer>\` or \`stop ${session.name}\`.`);
  } else {
    await reply(phone, `✅ *${session.name}* finished:\n${summary}\n\nFollow up with \`@${session.name} <message>\`.`);
  }
}

async function execute(intent, phone) {
  switch (intent.action) {
    case "list":
    case "status":
      return reply(phone, listText());
    case "help":
      return reply(phone, HELP);
    case "chat":
      return reply(phone, intent.reply || HELP);
    case "stop": {
      const s = sessions.get(intent.session);
      if (!s) return reply(phone, `No session named ${intent.session}.\n\n${listText()}`);
      s.status = "stopped";
      save();
      await superset.close(s.terminal).catch(() => {});
      bus.emit("status", { name: s.name, status: "stopped" });
      return reply(phone, `⏹️ Stopped *${s.name}*.`);
    }
    case "send": {
      const s = sessions.get(intent.session);
      if (!s) return reply(phone, `No session named ${intent.session}.\n\n${listText()}`);
      await superset.sendText(s.terminal, intent.prompt);
      await superset.sendKeys(s.terminal, "enter").catch(() => {});
      bus.emit("send", { name: s.name, prompt: intent.prompt });
      await reply(phone, `➡️ Sent to *${s.name}*.`);
      return watch(s, phone);
    }
    case "spawn": {
      const agent = AGENTS.has(intent.agent) ? intent.agent : "claude";
      const name = uniqueName(intent.name || intent.prompt?.split(/\s+/).slice(0, 3).join("-"));
      const terminal = await superset.spawn(agent, `${intent.prompt}

(Sent from WhatsApp through Hukam. Work only inside this workspace. Do not git push, deploy, or delete anything outside it. Finish with a two-line summary of what you changed.)`);
      const s = { name, agent, terminal, prompt: intent.prompt, status: "working", owner: phone };
      sessions.set(name, s);
      save();
      bus.emit("spawn", { name, agent, prompt: intent.prompt });
      await reply(phone, `🚀 Started *${name}* on ${agent}.\nI'll message you when it's done.`);
      return watch(s, phone);
    }
    default:
      return reply(phone, HELP);
  }
}

async function handle(phone, msg) {
  if (msg.media === "audio") {
    wa.markRead(phone, msg.id);
    wa.react(phone, msg.id, "🎙️");
    const started = Date.now();
    msg.body = await voice.transcribe(await wa.downloadMedia(phone, msg.id));
    bus.emit("voice", { text: msg.body, ms: Date.now() - started });
    if (!msg.body) return reply(phone, "🎙️ Couldn't hear anything in that voice note.");
    await wa.send(phone, `🎙️ _${msg.body}_`);
  } else if (msg.media) {
    return reply(phone, `I can read text and voice notes. ${msg.media} isn't supported yet.`);
  }
  bus.emit("inbound", { from: phone.slice(-4), text: msg.body, voice: msg.media === "audio" });
  // Instant acknowledgement: blue ticks plus a random emoji reaction (or a short text if the message has no ID).
  wa.markRead(phone, msg.id);
  const ack = ACKS[Math.floor(Math.random() * ACKS.length)];
  if (msg.id) wa.react(phone, msg.id, ack);
  else wa.send(phone, `${ack} on it`).catch(() => {});
  wa.typing(phone, true);

  let intent = fastPath(msg.body);
  if (intent?.action === "approval") {
    const p = pending.get(intent.code);
    if (!p) return reply(phone, `No pending approval with code ${intent.code}.`);
    pending.delete(intent.code);
    bus.emit("approval", { code: intent.code, ok: intent.ok, prompt: p.intent.prompt });
    if (!intent.ok) return reply(phone, "❌ Cancelled.");
    wa.react(phone, msg.id, "✅");
    return execute(p.intent, phone);
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

  if (intent.risk === "high" && ["spawn", "send"].includes(intent.action)) {
    const c = code();
    pending.set(c, { intent, phone });
    bus.emit("gate", { code: c, reason: intent.reason, prompt: intent.prompt });
    return reply(phone, `⚠️ Gemma flagged this as risky: ${intent.reason}\n\n"${intent.prompt}"\n\nReply \`yes ${c}\` to run or \`no ${c}\` to cancel.`);
  }
  return execute(intent, phone);
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
      const key = m.id || `${m.ts}|${m.body}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (m.fromMe) continue;
      handle(phone, m).catch(async (err) => {
        console.error("[handle]", err);
        bus.emit("error", { message: err.message });
        await wa.send(phone, `⚠️ ${err.message}`).catch(() => {});
      });
    }
  }
}

// Seed: never replay history from before startup.
for (const phone of ALLOW) {
  for (const m of await wa.recent(phone, 30)) seen.add(m.id || `${m.ts}|${m.body}`);
}
await bus.start();
for (const s of sessions.values()) if (s.status === "working") watch(s, s.owner);
bus.emit("ready", { allow: ALLOW.map((p) => `…${p.slice(-4)}`), model: gemma.model });
console.log(`Hukam listening for ${ALLOW.length} number(s), polling every ${POLL_MS} ms`);
setInterval(poll, POLL_MS);
