// Artifact return: images an agent created during its run (outputs/ plus new top-level images in the workspace)
// are converted to PNG when needed and sent back to the WhatsApp chat that started the session.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, stat, copyFile, mkdir, writeFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, relative, basename, extname } from "node:path";
import { call } from "./whatsapp.mjs";

const run = promisify(execFile);
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const MEDIA_ROOT = process.env.WA_MEDIA_ROOT || join(homedir(), "services/mcp-whatsapp/store/uploads");
const IMAGE = /\.(png|jpe?g|webp|svg)$/i;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 3;

async function images(dir, depth) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory() && depth > 0) out.push(...(await images(p, depth - 1)));
    else if (e.isFile() && IMAGE.test(e.name)) out.push(p);
  }
  return out;
}

// New images since `since` (ms): newest first, max 3, < 8 MB. An SVG is skipped when a PNG with the same name exists.
export async function collect(workdir, since) {
  const paths = [...(await images(join(workdir, "outputs"), 2)), ...(await images(workdir, 0))];
  const found = [];
  for (const p of new Set(paths)) {
    const s = await stat(p).catch(() => null);
    if (s && s.mtimeMs >= since && s.size > 0 && s.size < MAX_BYTES) found.push({ path: p, rel: relative(workdir, p), mtimeMs: s.mtimeMs });
  }
  const pngs = new Set(found.filter((f) => /\.png$/i.test(f.path)).map((f) => f.path.replace(/\.png$/i, "")));
  return found
    .filter((f) => !(/\.svg$/i.test(f.path) && pngs.has(f.path.replace(/\.svg$/i, ""))))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MAX_FILES);
}

// Render an SVG to PNG with headless Chrome (same binary as the page preview).
export async function svgToPng(svgPath, outPath) {
  const dir = join(tmpdir(), `hukam-svg-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  const html = join(dir, "render.html");
  await writeFile(
    html,
    `<!doctype html><html><body style="margin:0;background:#fff;width:1024px;height:1024px;display:flex;align-items:center;justify-content:center">
<img src="${new URL(`file://${svgPath}`).href}" style="max-width:1024px;max-height:1024px;width:100%;height:100%;object-fit:contain"></body></html>`,
  );
  try {
    await run(
      CHROME,
      ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--user-data-dir=/tmp/hukam-chrome-svg",
        "--window-size=1024,1024", "--force-device-scale-factor=1", `--screenshot=${outPath}`, `file://${html}`],
      { timeout: 30_000 },
    );
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  return outPath;
}

const safe = (s) => String(s).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "image";

// Copies (or renders) one artifact into the daemon media root as a PNG/JPG/WEBP. Returns the media path.
export async function prepare(file, name) {
  await mkdir(MEDIA_ROOT, { recursive: true });
  const stem = `hukam-${safe(name)}-${safe(basename(file.path, extname(file.path)))}-${Date.now()}`;
  if (/\.svg$/i.test(file.path)) return svgToPng(file.path, join(MEDIA_ROOT, `${stem}.png`));
  const out = join(MEDIA_ROOT, `${stem}${extname(file.path).toLowerCase().replace(".jpeg", ".jpg")}`);
  await copyFile(file.path, out);
  return out;
}

// Send every new artifact to `chat`. Returns [{ rel, media }] for the ones that went out.
export async function send(chat, name, startedAt, workdir) {
  const sent = [];
  for (const file of await collect(workdir, startedAt)) {
    try {
      const media = await prepare(file, name);
      const text = await call("send_file", { recipient: chat, media_path: media, caption: `🎨 *${name}*: ${basename(file.path)}` });
      const result = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      if (!result.Success) throw new Error(`send_file: ${result.Message}`);
      sent.push({ rel: file.rel, media });
    } catch (err) {
      console.error("[artifact]", file.rel, err.message);
    }
  }
  return sent;
}
