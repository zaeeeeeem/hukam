// Superset CLI wrapper: spawn, message, wait on and read terminal coding agents.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const WORKSPACE = () => process.env.HUKAM_WORKSPACE;

async function superset(args, timeoutMs = 60_000) {
  const { stdout } = await run("superset", [...args, "--local", "--workspace", WORKSPACE(), "--json"], {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

export async function spawn(agent, prompt) {
  const model = process.env[`HUKAM_${agent.toUpperCase()}_MODEL`];
  const out = await superset(["agents", "create", "--agent", agent, "--prompt", prompt, ...(model ? ["--model", model] : [])]);
  if (out.kind !== "terminal") throw new Error(`expected terminal agent, got ${out.kind}`);
  return out.sessionId;
}

export const sendText = (terminal, text) => superset(["terminals", "send", "--terminal", terminal, "--text", text]);

export const sendKeys = (terminal, keys) => superset(["terminals", "send", "--terminal", terminal, "--keys", keys]);

export async function read(terminal, maxLines = 160) {
  const out = await superset(["terminals", "read", "--terminal", terminal, "--max-lines", String(maxLines)]);
  return out.text ?? "";
}

// Resolves with "idle" | "blocked" | "exited". Long timeout: agents can work for many minutes.
export async function waitSettled(terminal, timeoutSec = 1800) {
  try {
    const out = await superset(
      ["agents", "wait", "--terminal", terminal, "--until", "settled", "--timeout", String(timeoutSec)],
      (timeoutSec + 30) * 1000,
    );
    return out.state ?? "idle";
  } catch (err) {
    return /timeout/i.test(String(err.stderr || err.message)) ? "timeout" : "exited";
  }
}

export const close = (terminal) => superset(["terminals", "close", "--terminal", terminal]);
