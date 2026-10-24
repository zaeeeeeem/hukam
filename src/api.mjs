// JSON API for the portal, served by bus.mjs on 127.0.0.1 only. Reads router state through the controller the
// router hands over, and acts through the same paths WhatsApp messages take. Never returns secret values.

import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { delimiter, join } from "node:path";
import * as bus from "./bus.mjs";
import * as settings from "./settings.mjs";
import * as gemma from "./gemma.mjs";
import * as superset from "./superset.mjs";
import * as wa from "./whatsapp.mjs";
import { MEDIA_ROOT } from "./artifacts.mjs";

const run = promisify(execFile);
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MAX_BODY = 16 * 1024;

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
const fail = (res, status, error, extra = {}) => json(res, status, { error, ...extra });

// Writes must be JSON: a cross-site form or no-cors fetch cannot send that content type without a CORS preflight,
// which this server never approves.
async function body(req) {
  if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) throw Object.assign(new Error("Send JSON (Content-Type: application/json)."), { status: 415 });
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw Object.assign(new Error("Request body is too large."), { status: 413 });
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw Object.assign(new Error("Request body is not valid JSON."), { status: 400 });
  }
}

const onPath = (bin) => (process.env.PATH || "").split(delimiter).map((d) => join(d, bin)).find((p) => existsSync(p)) || null;

// Workspace-relative image paths (from per-chat memory) to URLs the portal can load, or null when not served.
function mediaUrl(path) {
  let m;
  if ((m = path.match(/^inbox\/([A-Za-z0-9_-]+\.(png|jpg|webp|pdf))$/))) return `/inbox/${m[1]}`;
  if ((m = path.match(/^outputs\/([A-Za-z0-9_.-]+\.(png|jpg|webp))$/))) return `/files/outputs/${m[1]}`;
  return null;
}

// Display names come from what people wrote in groups (WhatsApp push names), keyed by phone.
function knownNames() {
  const names = new Map();
  for (const e of bus.events()) if (e.type === "inbound" && e.phone && e.from && !/^\d+$/.test(e.from)) names.set(e.phone, e.from);
  return names;
}

export function createApi(c) {
  const cfg = () => settings.get();
  const isOwnerPhone = (p) => p === cfg().owner;

  function sessionView(s) {
    return {
      name: s.name,
      agent: s.agent,
      status: s.status,
      prompt: s.prompt,
      model: s.model || cfg().models[s.agent] || null,
      chatId: s.owner || null,
      chat: s.owner ? c.chatLabel(s.owner) : null,
      from: s.from || null,
      createdAt: s.createdAt || null,
      updatedAt: s.updatedAt || null,
      finishedAt: s.finishedAt || null,
      summary: s.summary || null,
      artifacts: s.artifacts || [],
      previews: s.previews || [],
      followUps: s.followUps || [],
    };
  }

  function chatsView() {
    const names = knownNames();
    const ids = new Set([...cfg().allow, ...cfg().groups, ...c.chatMem.keys(), ...[...c.sessions.values()].map((s) => s.owner).filter(Boolean)]);
    return [...ids].map((id) => {
      const group = wa.isGroup(id);
      const info = group ? c.groupInfo.get(id) : null;
      const mem = c.chatMem.get(id);
      return {
        id,
        kind: group ? "group" : "dm",
        label: group ? info?.name || "Unnamed group" : isOwnerPhone(id) ? "Owner" : `+${id}`,
        allowed: group ? cfg().groups.includes(id) : cfg().allow.includes(id),
        owner: !group && isOwnerPhone(id),
        members: group
          ? (info?.members || []).map((m) => ({ phone: m.phone || null, lid: m.lid || null, name: names.get(m.phone) || null, owner: isOwnerPhone(m.phone) || (!!m.lid && m.lid === cfg().ownerLid) }))
          : [],
        images: (mem?.images || []).map((i) => ({ ...i, url: mediaUrl(i.path) })),
        awaiting: mem?.awaiting && Date.now() - mem.awaiting.at < 10 * 60_000 ? mem.awaiting : null,
        sessions: [...c.sessions.values()].filter((s) => s.owner === id).map((s) => s.name),
      };
    });
  }

  function approvalsView() {
    return {
      pending: [...c.pending.values()].map((p) => ({
        code: p.code,
        prompt: p.intent.prompt,
        reason: p.intent.reason || null,
        category: p.intent.category || null,
        action: p.intent.action,
        agent: p.intent.agent || null,
        session: p.intent.session || null,
        chatId: p.chat,
        chat: c.chatLabel(p.chat),
        from: p.sender?.name || (isOwnerPhone(p.sender?.phone) ? "Owner" : null),
        at: p.at || null,
      })),
      history: c.decisions.slice(0, 100),
    };
  }

  function state() {
    return {
      now: Date.now(),
      startedAt: bus.startedAt,
      owner: { phone: cfg().owner, lid: cfg().ownerLid },
      sessions: [...c.sessions.values()].map(sessionView).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)),
      chats: chatsView(),
      approvals: approvalsView(),
      settings: cfg(),
      keys: settings.keys(),
      fixed: settings.fixed(),
      options: { agents: settings.AGENTS, backends: settings.BACKENDS, riskCategories: settings.RISK_CATEGORIES },
      gemma: gemma.telemetry(),
      dnotifier: bus.dnotifier,
    };
  }

  // Slow probes (daemon round trip, CLI spawn) are cached briefly so the System page can poll.
  let probes = { at: 0, value: null };
  async function probe() {
    if (Date.now() - probes.at < 5_000 && probes.value) return probes.value;
    const started = Date.now();
    const whatsapp = await wa
      .call("get_status", {})
      .then((t) => {
        const s = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
        return { ok: !!s.connected, connected: !!s.connected, paired: !!s.paired, phone: s.own_phone || null, latencyMs: Date.now() - started, error: null };
      })
      .catch((err) => ({ ok: false, connected: false, paired: false, phone: null, latencyMs: null, error: err.message.slice(0, 200) }));
    const cli = await superset
      .version()
      .then((v) => ({ ok: true, version: v, error: null }))
      .catch((err) => ({ ok: false, version: null, error: (err.code === "ENOENT" ? "superset CLI not found on PATH" : err.message).slice(0, 200) }));
    probes = { at: Date.now(), value: { whatsapp, cli } };
    return probes.value;
  }

  async function health() {
    const { whatsapp, cli } = await probe();
    const v = cfg().voice;
    const whisper = onPath("whisper-cli");
    const ffmpeg = onPath("ffmpeg");
    return {
      now: Date.now(),
      router: { ok: true, startedAt: bus.startedAt, uptimeMs: Date.now() - bus.startedAt, pid: process.pid, node: process.version, pollMs: cfg().pollMs, poll: c.pollStats },
      whatsapp: { ...whatsapp, daemon: settings.fixed().daemon },
      gemma: { ...gemma.telemetry(), ok: gemma.telemetry().backends.length > 0 },
      superset: { ...cli, workspace: settings.keys().workspace },
      whisper: { ok: !!whisper && !!ffmpeg && existsSync(v.whisperModel), enabled: v.enabled, binary: whisper, ffmpeg: !!ffmpeg, model: v.whisperModel, modelExists: existsSync(v.whisperModel) },
      chrome: { ok: existsSync(CHROME), path: CHROME },
      pdftotext: { ok: !!onPath("pdftotext") },
      dnotifier: bus.dnotifier,
      errors: bus.recentErrors().slice(0, 40),
    };
  }

  async function listDir(dir, re) {
    const names = await readdir(dir).catch(() => []);
    const out = [];
    for (const name of names) {
      if (!re.test(name)) continue;
      const s = await stat(join(dir, name)).catch(() => null);
      if (s?.isFile()) out.push({ name, at: s.mtimeMs, size: s.size });
    }
    return out;
  }

  async function gallery() {
    const sent = new Map();
    for (const e of bus.events()) if (e.type === "inbound" && e.attachment?.url) sent.set(e.attachment.url, { chatId: e.chatId || null, chat: e.chat || null, from: e.from || null, text: e.text || null });
    const inbox = (await listDir(c.inbox, /^[A-Za-z0-9_-]+\.(png|jpg|webp|pdf)$/)).map((f) => {
      const url = `/inbox/${f.name}`;
      return { url, name: f.name, kind: /\.pdf$/.test(f.name) ? "pdf" : "image", source: "user", at: f.at, size: f.size, ...sent.get(url) };
    });
    const made = (await listDir(join(c.workdir, "outputs"), /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.(png|jpg|webp)$/)).map((f) => {
      const owner = [...c.sessions.values()].find((s) => (s.artifacts || []).some((a) => a.path === `outputs/${f.name}`));
      return { url: `/files/outputs/${f.name}`, name: f.name, kind: "image", source: "agent", at: f.at, size: f.size, session: owner?.name || null, chatId: owner?.owner || null };
    });
    // Live-preview screenshots: hukam-<session>-<13-digit ms>.png in the daemon media root.
    const names = [...c.sessions.keys()].sort((a, b) => b.length - a.length);
    const previews = (await listDir(MEDIA_ROOT, /^hukam-[A-Za-z0-9_-]+-\d{13}\.png$/))
      .map((f) => {
        const session = names.find((n) => f.name === `hukam-${n}-${f.name.slice(-17)}`) || null;
        return session ? { url: `/outputs/${f.name}`, name: f.name, kind: "image", source: "preview", at: f.at, size: f.size, session, chatId: c.sessions.get(session)?.owner || null } : null;
      })
      .filter(Boolean);
    return { items: [...inbox, ...made, ...previews].sort((a, b) => b.at - a.at) };
  }

  const getSession = (name) => (/^[\w-]{1,64}$/.test(name) ? c.sessions.get(name) : null);

  return async function api(req, res, url) {
    const path = url.pathname;
    const method = req.method;
    let m;
    try {
      if (method === "GET" && path === "/api/state") return json(res, 200, state());
      if (method === "GET" && path === "/api/health") return json(res, 200, await health());
      if (method === "GET" && path === "/api/gallery") return json(res, 200, await gallery());
      if (method === "GET" && path === "/api/events") {
        const limit = Math.min(600, Math.max(1, Number(url.searchParams.get("limit")) || 600));
        return json(res, 200, { events: bus.events(limit) });
      }
      if (path === "/api/settings") {
        if (method === "GET") return json(res, 200, { settings: cfg(), keys: settings.keys(), fixed: settings.fixed() });
        if (method === "PUT") {
          const out = settings.update(await body(req));
          if (out.errors) return fail(res, 400, "Some settings were not valid.", { errors: out.errors });
          bus.emit("settings", { changed: true });
          return json(res, 200, { settings: out.settings, keys: settings.keys(), fixed: settings.fixed() });
        }
      }
      if (method === "POST" && path === "/api/command") {
        const b = await body(req);
        const text = typeof b.text === "string" ? b.text.trim() : "";
        if (!text) return fail(res, 400, "Type a command first.");
        if (text.length > 2000) return fail(res, 400, "Commands are limited to 2000 characters.");
        const chat = b.chat == null || b.chat === "" ? cfg().owner : String(b.chat);
        if (chat !== cfg().owner && !cfg().allow.includes(chat) && !cfg().groups.includes(chat))
          return fail(res, 400, "Replies can only go to the owner, an allowed number or an allowed group.");
        const trace = c.command(text, chat);
        return json(res, 202, { ok: true, trace, chat });
      }
      if ((m = path.match(/^\/api\/sessions\/([^/]+)(\/(send|stop|terminal))?$/))) {
        const s = getSession(decodeURIComponent(m[1]));
        if (!s) return fail(res, 404, "No session with that name.");
        const action = m[3];
        if (!action && method === "GET") {
          const traces = new Set();
          const own = bus.events().filter((e) => e.name === s.name);
          for (const e of own) if (e.trace) traces.add(e.trace);
          const events = bus.events().filter((e) => e.name === s.name || (e.trace && traces.has(e.trace)));
          return json(res, 200, { session: sessionView(s), events });
        }
        if (action === "terminal" && method === "GET") {
          const text = await superset.read(s.terminal, 120).catch(() => null);
          return json(res, 200, text == null ? { text: null, error: "The terminal is closed or Superset did not answer." } : { text });
        }
        if (action === "send" && method === "POST") {
          const b = await body(req);
          const text = typeof b.text === "string" ? b.text.trim() : "";
          if (!text) return fail(res, 400, "Type a follow-up first.");
          if (text.length > 2000) return fail(res, 400, "Follow-ups are limited to 2000 characters.");
          if (["stopped", "exited"].includes(s.status)) return fail(res, 409, `${s.name} is ${s.status}. Start a new task instead.`);
          return json(res, 202, { ok: true, trace: c.followUp(s, text) });
        }
        if (action === "stop" && method === "POST") {
          await body(req);
          if (s.status === "stopped") return fail(res, 409, `${s.name} is already stopped.`);
          await c.stop(s);
          return json(res, 200, { ok: true });
        }
      }
      if ((m = path.match(/^\/api\/approvals\/([a-z0-9]{4})$/)) && method === "POST") {
        const b = await body(req);
        if (typeof b.ok !== "boolean") return fail(res, 400, 'Send {"ok": true} to approve or {"ok": false} to cancel.');
        if (!c.pending.has(m[1])) return fail(res, 404, "That approval was already decided or does not exist.");
        await c.decide(m[1], b.ok);
        return json(res, 200, { ok: true });
      }
      return fail(res, 404, "Unknown API route.");
    } catch (err) {
      if (err.status) return fail(res, err.status, err.message);
      console.error("[api]", err.message);
      return fail(res, 500, "Hukam hit an error handling that request. Check the System page for details.");
    }
  };
}
