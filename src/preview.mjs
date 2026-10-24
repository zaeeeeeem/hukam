// After an agent changes the page, screenshot it in headless Chrome and send the picture back to WhatsApp.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { call } from "./whatsapp.mjs";

const run = promisify(execFile);
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// send_file only accepts files under the daemon's media root.
const MEDIA_ROOT = process.env.WA_MEDIA_ROOT || join(homedir(), "services/mcp-whatsapp/store/uploads");
const PAGE = process.env.PREVIEW_PAGE || "index.html";

let workspaceDir = process.env.PLAYGROUND_DIR || null;
async function playground() {
  if (workspaceDir) return workspaceDir;
  const { stdout } = await run("superset", ["workspaces", "get", process.env.HUKAM_WORKSPACE, "--json"]);
  workspaceDir = JSON.parse(stdout).worktreePath;
  return workspaceDir;
}

// Desktop viewport: the playground page is not responsive, and WhatsApp shows wide images well.
export async function capture(name) {
  const page = join(await playground(), PAGE);
  await mkdir(MEDIA_ROOT, { recursive: true });
  const out = join(MEDIA_ROOT, `hukam-${name.replace(/[^\w-]/g, "")}-${Date.now()}.png`);
  await run(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--user-data-dir=/tmp/hukam-chrome",
      "--window-size=1280,860",
      "--force-device-scale-factor=1",
      `--screenshot=${out}`,
      `file://${page}`,
    ],
    { timeout: 30_000 },
  );
  return out;
}

// Only send a preview when the agent actually touched the page during its run.
export async function changedSince(startedAt) {
  try {
    const { mtimeMs } = await stat(join(await playground(), PAGE));
    return mtimeMs >= startedAt;
  } catch {
    return false;
  }
}

export async function send(chat, name, startedAt) {
  if (!(await changedSince(startedAt))) return null;
  const path = await capture(name);
  const text = await call("send_file", { recipient: chat, media_path: path, caption: `📱 *${name}*: live preview` });
  const result = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  if (!result.Success) throw new Error(`send_file: ${result.Message}`);
  return path;
}
