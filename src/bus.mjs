// Event bus for the live dashboard. Events go over DNotifier realtime when configured,
// and always over local Server-Sent Events as a fallback.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import WebSocket from "ws";
import { DNotifier } from "@dnotifier-realtime/dnotifier";

const ROUTER_ID = "hukam-router";
const DASHBOARD_ID = "hukam-dashboard";
const sseClients = new Set();
const history = [];
let notifier = null;

export async function start() {
  const { DNOTIFIER_APP_ID: appId, DNOTIFIER_SECRET: secret } = process.env;
  if (appId && secret) {
    notifier = new DNotifier({
      appId,
      secret,
      transport: "ws",
      userId: ROUTER_ID,
      WebSocketImpl: WebSocket,
      onConnected: () => console.log("[bus] DNotifier connected"),
      onMessage: () => {},
      onDisconnected: () => console.log("[bus] DNotifier disconnected"),
    });
    try {
      await notifier.connect();
    } catch (err) {
      console.error("[bus] DNotifier connect failed, using SSE only:", err.message);
      notifier = null;
    }
  }

  const port = Number(process.env.DASHBOARD_PORT || 4747);
  createServer(async (req, res) => {
    if (req.url === "/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      for (const e of history) res.write(`data: ${JSON.stringify(e)}\n\n`);
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }
    if (req.url === "/config") {
      // Localhost dev dashboard only: the browser connects to DNotifier as the dashboard user.
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(notifier ? { appId, secret, userId: DASHBOARD_ID } : {}));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(await readFile(new URL("../public/index.html", import.meta.url)));
  }).listen(port, "127.0.0.1", () => console.log(`[bus] dashboard http://localhost:${port}`));
}

export function emit(type, data = {}) {
  const event = { type, at: new Date().toISOString(), ...data };
  history.push(event);
  if (history.length > 200) history.shift();
  console.log(`[${type}]`, JSON.stringify(data).slice(0, 200));
  for (const res of sseClients) res.write(`data: ${JSON.stringify({ ...event, via: "sse" })}\n\n`);
  notifier
    ?.send({ senderId: ROUTER_ID, receiverId: DASHBOARD_ID, data: { type: "hukam", event }, saveHistory: false })
    .catch((err) => console.error("[bus] DNotifier send failed:", err.message));
}
