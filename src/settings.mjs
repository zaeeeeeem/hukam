// Owner settings edited from the portal. Stored in .hukam-settings.json (gitignored); anything not set there falls
// back to the environment (.env). The router reads get() on every use, so changes apply without a restart.
// Secrets never live here: keys stay in .env and the portal only learns whether they are set.

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";

const FILE = new URL("../.hukam-settings.json", import.meta.url);
const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

export const AGENTS = ["claude", "codex", "opencode"];
export const BACKENDS = ["gemini-api", "vertex"];
// What Gemma may label a high-risk task with. Anything else (or no label) is always gated.
export const RISK_CATEGORIES = ["push", "deploy", "delete", "secrets", "infra", "messaging", "spend"];
export const DEFAULT_ACKS = ["👀", "🫡", "⚡", "🔥", "🚀", "🧠", "🛠️", "👍", "✨", "🤝"];

function defaults() {
  const env = process.env;
  return {
    allow: list(env.WA_ALLOW),
    groups: list(env.WA_GROUPS),
    owner: env.WA_OWNER || "923124487312",
    ownerLid: (env.WA_OWNER_LID || "237077966905376@lid").split("@")[0],
    defaultAgent: "claude",
    models: { claude: env.HUKAM_CLAUDE_MODEL || "", codex: env.HUKAM_CODEX_MODEL || "", opencode: env.HUKAM_OPENCODE_MODEL || "" },
    gemma: {
      backends: [...BACKENDS],
      model: env.GEMMA_MODEL || "gemma-4-26b-a4b-it",
      fallbackModel: env.GEMMA_FALLBACK_MODEL || "gemma-4-31b-it",
    },
    risk: { gate: true, categories: Object.fromEntries(RISK_CATEGORIES.map((c) => [c, true])) },
    acks: [...DEFAULT_ACKS],
    voice: { enabled: true, whisperModel: env.WHISPER_MODEL || `${homedir()}/services/whisper/ggml-base.bin` },
    attachments: { enabled: true, maxMb: 8 },
    preview: { enabled: true },
    artifacts: { enabled: true },
    pollMs: Number(env.WA_POLL_MS || 2000),
  };
}

let stored = {};
try {
  if (existsSync(FILE)) stored = JSON.parse(readFileSync(FILE, "utf8"));
} catch (err) {
  console.error("[settings]", err.message);
}

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
}

let current = merge(defaults(), stored);
const listeners = new Set();

export const get = () => current;
export const onChange = (fn) => listeners.add(fn);

// Validates a partial update. Returns { value, errors } where value holds only the fields that passed.
function validate(patch) {
  const errors = {};
  const value = {};
  const bad = (path, msg) => (errors[path] = msg);
  const bool = (v) => typeof v === "boolean";
  const str = (v, max = 200) => typeof v === "string" && v.length <= max;

  if ("allow" in patch) {
    const v = patch.allow;
    if (!Array.isArray(v) || !v.every((p) => /^\d{8,15}$/.test(p))) bad("allow", "Phone numbers are 8 to 15 digits, country code first, no + or spaces.");
    else value.allow = [...new Set(v)];
  }
  if ("groups" in patch) {
    const v = patch.groups;
    if (!Array.isArray(v) || !v.every((g) => /^\d{5,30}(-\d{5,15})?@g\.us$/.test(g))) bad("groups", "Group IDs look like 120363414024669346@g.us.");
    else value.groups = [...new Set(v)];
  }
  if ("owner" in patch) {
    if (!/^\d{8,15}$/.test(patch.owner)) bad("owner", "The owner number is 8 to 15 digits, country code first.");
    else value.owner = patch.owner;
  }
  if ("ownerLid" in patch) {
    const v = String(patch.ownerLid || "").split("@")[0];
    if (v && !/^\d{5,30}$/.test(v)) bad("ownerLid", "A LID is digits only, for example 237077966905376.");
    else value.ownerLid = v;
  }
  if ("defaultAgent" in patch) {
    if (!AGENTS.includes(patch.defaultAgent)) bad("defaultAgent", `Pick one of ${AGENTS.join(", ")}.`);
    else value.defaultAgent = patch.defaultAgent;
  }
  if ("models" in patch) {
    if (!isObj(patch.models)) bad("models", "Expected a model per agent.");
    else {
      value.models = {};
      for (const [agent, model] of Object.entries(patch.models)) {
        if (!AGENTS.includes(agent)) bad(`models.${agent}`, "Unknown agent.");
        else if (!str(model, 80) || !/^[\w.:/-]*$/.test(model)) bad(`models.${agent}`, "Model names use letters, digits, dots, dashes, colons and slashes.");
        else value.models[agent] = model.trim();
      }
    }
  }
  if ("gemma" in patch) {
    const g = patch.gemma;
    value.gemma = {};
    if (!isObj(g)) bad("gemma", "Expected Gemma settings.");
    else {
      if ("backends" in g) {
        if (!Array.isArray(g.backends) || !g.backends.length || !g.backends.every((b) => BACKENDS.includes(b)) || new Set(g.backends).size !== g.backends.length)
          bad("gemma.backends", "Choose at least one backend, each once.");
        else value.gemma.backends = g.backends;
      }
      for (const k of ["model", "fallbackModel"]) {
        if (!(k in g)) continue;
        if (!str(g[k], 80) || !/^[\w.-]+$/.test(g[k])) bad(`gemma.${k}`, "Use a model ID such as gemma-4-26b-a4b-it.");
        else value.gemma[k] = g[k];
      }
    }
  }
  if ("risk" in patch) {
    const r = patch.risk;
    value.risk = {};
    if (!isObj(r)) bad("risk", "Expected risk settings.");
    else {
      if ("gate" in r) bool(r.gate) ? (value.risk.gate = r.gate) : bad("risk.gate", "On or off.");
      if ("categories" in r) {
        if (!isObj(r.categories) || !Object.entries(r.categories).every(([c, on]) => RISK_CATEGORIES.includes(c) && bool(on)))
          bad("risk.categories", "Unknown risk category.");
        else value.risk.categories = r.categories;
      }
    }
  }
  if ("acks" in patch) {
    const v = patch.acks;
    if (!Array.isArray(v) || !v.length || v.length > 20 || !v.every((e) => typeof e === "string" && e.trim() && e.length <= 16 && !/[\w\s]/.test(e)))
      bad("acks", "Use 1 to 20 emoji, no letters or spaces.");
    else value.acks = v.map((e) => e.trim());
  }
  if ("voice" in patch) {
    const v = patch.voice;
    value.voice = {};
    if (!isObj(v)) bad("voice", "Expected voice settings.");
    else {
      if ("enabled" in v) bool(v.enabled) ? (value.voice.enabled = v.enabled) : bad("voice.enabled", "On or off.");
      if ("whisperModel" in v) {
        if (!str(v.whisperModel, 400) || !v.whisperModel.startsWith("/") || !v.whisperModel.endsWith(".bin")) bad("voice.whisperModel", "Use an absolute path to a ggml .bin model.");
        else if (!existsSync(v.whisperModel)) bad("voice.whisperModel", "No file at that path.");
        else value.voice.whisperModel = v.whisperModel;
      }
    }
  }
  if ("attachments" in patch) {
    const a = patch.attachments;
    value.attachments = {};
    if (!isObj(a)) bad("attachments", "Expected attachment settings.");
    else {
      if ("enabled" in a) bool(a.enabled) ? (value.attachments.enabled = a.enabled) : bad("attachments.enabled", "On or off.");
      if ("maxMb" in a) Number.isInteger(a.maxMb) && a.maxMb >= 1 && a.maxMb <= 16 ? (value.attachments.maxMb = a.maxMb) : bad("attachments.maxMb", "Between 1 and 16 MB.");
    }
  }
  for (const k of ["preview", "artifacts"]) {
    if (!(k in patch)) continue;
    if (!isObj(patch[k]) || !bool(patch[k].enabled)) bad(`${k}.enabled`, "On or off.");
    else value[k] = { enabled: patch[k].enabled };
  }
  if ("pollMs" in patch) {
    Number.isInteger(patch.pollMs) && patch.pollMs >= 500 && patch.pollMs <= 30_000 ? (value.pollMs = patch.pollMs) : bad("pollMs", "Between 500 and 30000 ms.");
  }
  for (const k of Object.keys(patch)) if (!(k in defaults())) bad(k, "Unknown setting.");
  return { value, errors };
}

export function update(patch) {
  if (!isObj(patch)) return { errors: { _: "Expected a JSON object." } };
  const { value, errors } = validate(patch);
  if (Object.keys(errors).length) return { errors };
  const next = merge(current, value);
  if (!next.allow.length && !next.groups.length) return { errors: { allow: "Keep at least one allowed number or group, or Hukam reads nothing." } };
  stored = merge(stored, value);
  const tmp = new URL("../.hukam-settings.json.tmp", import.meta.url);
  writeFileSync(tmp, JSON.stringify(stored, null, 2));
  renameSync(tmp, FILE);
  const before = current;
  current = next;
  for (const fn of listeners) {
    try {
      fn(current, before);
    } catch (err) {
      console.error("[settings]", err.message);
    }
  }
  return { settings: current };
}

// Which secrets are present. Booleans only: values never leave the process.
export function keys() {
  const env = process.env;
  return {
    gemini: !!env.GEMINI_API_KEY,
    vertex: !!env.VERTEX_PROJECT,
    dnotifier: !!(env.DNOTIFIER_APP_ID && env.DNOTIFIER_SECRET),
    workspace: !!env.HUKAM_WORKSPACE,
  };
}

// Settings that only the environment controls; the portal shows them read-only with "restart required".
export function fixed() {
  const env = process.env;
  return {
    dashboardPort: Number(env.DASHBOARD_PORT || 4747),
    daemon: env.WA_DAEMON || "http://127.0.0.1:8766/mcp",
    workspaceDir: env.HUKAM_WORKSPACE_DIR || null,
  };
}
