// Event bus and web server for the portal. Events go over DNotifier realtime when configured,
// and always over local Server-Sent Events as a fallback. The same server serves the portal (portal/dist),
// the JSON API (src/api.mjs) and read-only media.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { readFileSync, existsSync, appendFileSync, writeFileSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { DNotifier } from "@dnotifier-realtime/dnotifier";

const ROUTER_ID = "hukam-router";
const DASHBOARD_ID = "hukam-dashboard";
const EVENTS_FILE = new URL("../.hukam-events.jsonl", import.meta.url);
const DIST = fileURLToPath(new URL("../portal/dist/", import.meta.url));
const HISTORY = 600;
const REPLAY = 400;
const sseClients = new Set();
const history = [];
let seq = 0;
let notifier = null;
export const dnotifier = { configured: false, connected: false, lastError: null };
export const startedAt = Date.now();

// Every event emitted while handling one WhatsApp message carries the same trace id, so the portal can follow
// that message through every hop (voice, Gemma, gate, agent, reply) without the router threading ids by hand.
const traces = new AsyncLocalStorage();
export const withTrace = (trace, fn) => traces.run({ trace }, fn);
export const currentTrace = () => traces.getStore()?.trace ?? null;

// Restore recent events so counters and timelines survive a restart.
try {
  if (existsSync(EVENTS_FILE)) {
    const lines = readFileSync(EVENTS_FILE, "utf8").trim().split("\n").filter(Boolean);
    for (const l of lines.slice(-HISTORY)) {
      try {
        history.push(JSON.parse(l));
      } catch {}
    }
    seq = history.reduce((m, e) => Math.max(m, e.id || 0), 0);
    if (lines.length > HISTORY * 4) writeFileSync(EVENTS_FILE, lines.slice(-HISTORY).join("\n") + "\n");
  }
} catch (err) {
  console.error("[bus] history", err.message);
}

// Recent errors for the System page: every console.error in the router lands here too.
const errors = [];
const consoleError = console.error.bind(console);
console.error = (...args) => {
  consoleError(...args);
  const text = args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  const m = text.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
  const scope = m ? m[1] : "router";
  const message = m ? m[2] : text;
  errors.unshift({ at: Date.now(), scope, message: message.slice(0, 400) });
  if (errors.length > 60) errors.pop();
};
export const recentErrors = () => errors;
export const events = (limit = HISTORY) => history.slice(-limit);

// Attachments users sent (photos, PDFs), served read-only from the agent workspace inbox.
const INBOX_TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", pdf: "application/pdf", txt: "text/plain; charset=utf-8" };
const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

// Only answer requests addressed to this machine by name (blocks DNS rebinding), and refuse writes that come
// from another origin (blocks a web page in the owner's browser from driving Hukam).
function trusted(req, port) {
  const hosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
  if (!hosts.has(req.headers.host || "")) return false;
  const origin = req.headers.origin;
  if (req.method !== "GET" && req.method !== "HEAD" && origin && !hosts.has(origin.replace(/^https?:\/\//, ""))) return false;
  return true;
}

async function sendFile(res, path, type, cache = "no-cache") {
  const body = await readFile(path).catch(() => null);
  if (!body) return false;
  res.writeHead(200, { "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
  res.end(body);
  return true;
}

export async function start({ inbox, outputs, workdir, api } = {}) {
  const { DNOTIFIER_APP_ID: appId, DNOTIFIER_SECRET: secret } = process.env;
  if (appId && secret) {
    dnotifier.configured = true;
    notifier = new DNotifier({
      appId,
      secret,
      transport: "ws",
      userId: ROUTER_ID,
      WebSocketImpl: WebSocket,
      onConnected: () => {
        dnotifier.connected = true;
        console.log("[bus] DNotifier connected");
      },
      onMessage: () => {},
      onDisconnected: () => {
        dnotifier.connected = false;
        console.log("[bus] DNotifier disconnected");
      },
    });
    try {
      await notifier.connect();
      dnotifier.connected = true;
    } catch (err) {
      console.error("[bus] DNotifier connect failed, using SSE only:", err.message);
      dnotifier.lastError = err.message;
      notifier = null;
    }
  }

  const port = Number(process.env.DASHBOARD_PORT || 4747);
  createServer(async (req, res) => {
    try {
      if (!trusted(req, port)) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        return res.end("forbidden");
      }
      const url = new URL(req.url, `http://localhost:${port}`);
      const path = url.pathname;

      if (path === "/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        for (const e of history.slice(-REPLAY)) res.write(`data: ${JSON.stringify(e)}\n\n`);
        sseClients.add(res);
        const ping = setInterval(() => res.write(": ping\n\n"), 20_000);
        req.on("close", () => {
          clearInterval(ping);
          sseClients.delete(res);
        });
        return;
      }
      if (path.startsWith("/api/") && api) return await api(req, res, url);

      const file = path.match(/^\/inbox\/([A-Za-z0-9_-]+\.([a-z]+))$/);
      if (file) {
        const type = INBOX_TYPES[file[2]];
        if (inbox && type && (await sendFile(res, `${inbox}/${file[1]}`, type, "max-age=3600"))) return;
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("not found");
      }
      // Agent-made images and previews, served from the WhatsApp daemon media root (only Hukam's own copies).
      const out = path.match(/^\/outputs\/(hukam-[A-Za-z0-9_-]+\.(png|jpg|webp))$/);
      if (out) {
        if (outputs && (await sendFile(res, `${outputs}/${out[1]}`, INBOX_TYPES[out[2]], "max-age=3600"))) return;
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("not found");
      }
      // Originals the agents saved under <workspace>/outputs/. Raster only: an SVG could run script on this origin.
      const made = path.match(/^\/files\/outputs\/([A-Za-z0-9_.-]+\.(png|jpg|webp))$/);
      if (made && !made[1].startsWith(".")) {
        if (workdir && (await sendFile(res, `${workdir}/outputs/${made[1]}`, INBOX_TYPES[made[2]]))) return;
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("not found");
      }
      if (path === "/config") {
        // Localhost portal only: the browser connects to DNotifier as the dashboard user.
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        return res.end(JSON.stringify(notifier ? { appId, secret, userId: DASHBOARD_ID, routerId: ROUTER_ID } : {}));
      }
      // The original single-page dashboard, kept as a fallback.
      if (path === "/classic" || path === "/classic/") {
        await sendFile(res, fileURLToPath(new URL("../public/index.html", import.meta.url)), "text/html; charset=utf-8");
        return;
      }
      if (path === "/flow" || path === "/flow/") {
        res.writeHead(302, { Location: `/${url.search}` });
        return res.end();
      }

      // The portal: static assets from portal/dist, and index.html for every client route.
      const rel = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, "");
      if (rel && !rel.startsWith("..")) {
        const abs = join(DIST, rel);
        const s = abs.startsWith(DIST) ? await stat(abs).catch(() => null) : null;
        if (s?.isFile()) {
          const immutable = rel.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache";
          if (await sendFile(res, abs, STATIC_TYPES[extname(abs)] || "application/octet-stream", immutable)) return;
        }
        if (extname(rel)) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          return res.end("not found");
        }
      }
      if (await sendFile(res, join(DIST, "index.html"), "text/html; charset=utf-8")) return;
      // No build yet: fall back to the classic dashboard instead of an error page.
      await sendFile(res, fileURLToPath(new URL("../public/index.html", import.meta.url)), "text/html; charset=utf-8");
    } catch (err) {
      console.error("[http]", err.message);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal error" }));
    }
  }).listen(port, "127.0.0.1", () => console.log(`[bus] portal http://localhost:${port}`));
}

export function emit(type, data = {}) {
  const trace = data.trace ?? currentTrace();
  const event = { id: ++seq, type, at: new Date().toISOString(), ...(trace && { trace }), ...data };
  history.push(event);
  if (history.length > HISTORY) history.shift();
  try {
    appendFileSync(EVENTS_FILE, JSON.stringify(event) + "\n");
  } catch {}
  console.log(`[${type}]`, JSON.stringify(data).slice(0, 200));
  for (const res of sseClients) res.write(`data: ${JSON.stringify({ ...event, via: "sse" })}\n\n`);
  notifier
    ?.send({ senderId: ROUTER_ID, receiverId: DASHBOARD_ID, data: { type: "hukam", event }, saveHistory: false })
    .catch((err) => console.error("[bus] DNotifier send failed:", err.message));
  return event;
}
