// Shapes of the router's JSON API (src/api.mjs) and its event stream (bus.emit in src/*.mjs).

export type AgentKind = "claude" | "codex" | "opencode";
export type SessionStatus = "working" | "idle" | "blocked" | "exited" | "stopped";
export type Risk = "low" | "high";

export type Intent = {
  action: "spawn" | "send" | "list" | "status" | "stop" | "chat" | "await_attachment" | "help" | "approval" | string;
  agent?: string | null;
  session?: string | null;
  name?: string | null;
  prompt?: string | null;
  risk?: Risk | string | null;
  category?: string | null;
  reason?: string | null;
  reply?: string | null;
  description?: string | null;
  ok?: boolean;
  code?: string;
};

export type Attachment = { kind: "image" | "pdf"; url: string; name: string; size?: number };

type Base = { id: number; at: string; trace?: string; chatId?: string; chat?: string; via?: string };

export type HukamEvent = Base &
  (
    | { type: "inbound"; from: string; owner: boolean; text: string; voice: boolean; source?: "portal"; phone?: string; attachment?: Attachment }
    | { type: "voice"; text: string; ms: number; from?: string | null }
    | { type: "intent"; model: string; ms?: number; intent: Intent; attachment?: string }
    | { type: "gate"; code: string; reason?: string; prompt: string; category?: string | null; from?: string | null }
    | { type: "approval"; code: string; ok: boolean; via?: string; prompt: string }
    | { type: "spawn"; name: string; agent: AgentKind; prompt: string }
    | { type: "send"; name: string; prompt: string }
    | { type: "status"; name: string; status: SessionStatus }
    | { type: "done"; name: string; state: string; summary: string; model?: string; ms?: number }
    | { type: "artifact"; name: string; path: string; url?: string }
    | { type: "preview"; name: string; url?: string }
    | { type: "reply"; text: string; attachment?: Attachment }
    | { type: "awaiting"; prompt: string }
    | { type: "error"; message: string }
    | { type: "ready"; allow: string[]; groups: string[]; model: string }
    | { type: "settings"; changed: boolean }
  );

export type EventType = HukamEvent["type"];

export type Session = {
  name: string;
  agent: AgentKind;
  status: SessionStatus;
  prompt: string;
  model: string | null;
  chatId: string | null;
  chat: string | null;
  from: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  finishedAt: number | null;
  summary: string | null;
  artifacts: { path: string; url: string; at: number }[];
  previews: { url: string; at: number }[];
  followUps: { prompt: string; at: number; from: string | null }[];
};

export type ChatImage = { path: string; url: string | null; source: "user" | "agent"; session?: string; at: number };

export type Chat = {
  id: string;
  kind: "dm" | "group";
  label: string;
  allowed: boolean;
  owner: boolean;
  members: { phone: string | null; lid: string | null; name: string | null; owner: boolean }[];
  images: ChatImage[];
  awaiting: { prompt: string; at: number } | null;
  sessions: string[];
};

export type PendingApproval = {
  code: string;
  prompt: string;
  reason: string | null;
  category: string | null;
  action: string;
  agent: string | null;
  session: string | null;
  chatId: string;
  chat: string;
  from: string | null;
  at: number | null;
};

export type Decision = {
  code: string;
  ok: boolean;
  via: "whatsapp" | "portal" | string;
  at: number;
  askedAt?: number;
  prompt: string;
  reason?: string | null;
  category?: string | null;
  chatId?: string;
  chat?: string;
  from?: string | null;
};

export type Settings = {
  allow: string[];
  groups: string[];
  owner: string;
  ownerLid: string;
  defaultAgent: AgentKind;
  models: Record<AgentKind, string>;
  gemma: { backends: string[]; model: string; fallbackModel: string };
  risk: { gate: boolean; categories: Record<string, boolean> };
  acks: string[];
  voice: { enabled: boolean; whisperModel: string };
  attachments: { enabled: boolean; maxMb: number };
  preview: { enabled: boolean };
  artifacts: { enabled: boolean };
  pollMs: number;
};

export type Keys = { gemini: boolean; vertex: boolean; dnotifier: boolean; workspace: boolean };
export type Fixed = { dashboardPort: number; daemon: string; workspaceDir: string | null };

export type GemmaBackend = {
  key: string;
  via: string;
  model: string;
  calls: number;
  failures: number;
  lastMs: number | null;
  lastOkAt: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
};

export type GemmaTelemetry = {
  chain: string;
  lastServed: { key: string; via: string; model: string; ms: number; at: number } | null;
  backends: GemmaBackend[];
  configured: { gemini: boolean; vertex: boolean };
};

export type DNotifierStatus = { configured: boolean; connected: boolean; lastError: string | null };

export type HukamState = {
  now: number;
  startedAt: number;
  owner: { phone: string; lid: string };
  sessions: Session[];
  chats: Chat[];
  approvals: { pending: PendingApproval[]; history: Decision[] };
  settings: Settings;
  keys: Keys;
  fixed: Fixed;
  options: { agents: AgentKind[]; backends: string[]; riskCategories: string[] };
  gemma: GemmaTelemetry;
  dnotifier: DNotifierStatus;
};

export type Health = {
  now: number;
  router: {
    ok: boolean;
    startedAt: number;
    uptimeMs: number;
    pid: number;
    node: string;
    pollMs: number;
    poll: { lastOkAt?: number | null; lastErrorAt?: number | null; lastError?: string | null; polls?: number };
  };
  whatsapp: { ok: boolean; connected: boolean; paired: boolean; phone: string | null; latencyMs: number | null; error: string | null; daemon: string };
  gemma: GemmaTelemetry & { ok: boolean };
  superset: { ok: boolean; version: string | null; error: string | null; workspace: boolean };
  whisper: { ok: boolean; enabled: boolean; binary: string | null; ffmpeg: boolean; model: string; modelExists: boolean };
  chrome: { ok: boolean; path: string };
  pdftotext: { ok: boolean };
  dnotifier: DNotifierStatus;
  errors: { at: number; scope: string; message: string }[];
};

export type GalleryItem = {
  url: string;
  name: string;
  kind: "image" | "pdf";
  source: "user" | "agent" | "preview";
  at: number;
  size: number;
  session?: string | null;
  chatId?: string | null;
  chat?: string | null;
  from?: string | null;
  text?: string | null;
};
