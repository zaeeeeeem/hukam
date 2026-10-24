// Serves the agents' playground with live reload, so a page an agent edits from WhatsApp updates on screen instantly.
// Usage: node scripts/serve-playground.mjs [dir] [port]

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { join, extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(process.argv[2] || fileURLToPath(new URL("../../demo/playground", import.meta.url)));
const PORT = Number(process.argv[3] || process.env.PLAYGROUND_PORT || 5190);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json" };
const RELOAD = `<script>new EventSource("/__reload").onmessage = () => location.reload();</script>`;
const clients = new Set();

let timer = null;
watch(ROOT, { recursive: true }, (_event, file) => {
  if (!file || /^(inbox|\.git|node_modules)\//.test(file)) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`[reload] ${file}`);
    for (const res of clients) res.write("data: reload\n\n");
  }, 150);
});

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/__reload") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  const path = normalize(join(ROOT, url.endsWith("/") ? `${url}index.html` : url));
  if (!path.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    if ((await stat(path)).isDirectory()) return res.writeHead(302, { Location: `${url}/` }).end();
    let body = await readFile(path);
    const type = TYPES[extname(path).toLowerCase()] || "application/octet-stream";
    if (type.startsWith("text/html")) body = body.toString().replace(/<\/body>/i, `${RELOAD}</body>`);
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`playground http://localhost:${PORT} (live reload) serving ${ROOT}`));
