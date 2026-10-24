// A trace is one WhatsApp message (or portal command) followed through every hop of the pipeline.
// The router stamps every event emitted while handling a message with the same trace id (src/bus.mjs).
import type { Attachment, HukamEvent, Intent, SessionStatus } from "./types";

export type HopId = "whatsapp" | "whisper" | "gemma" | "gate" | "superset" | "agent" | "reply";
export type HopState = "idle" | "active" | "waiting" | "done" | "skipped" | "error";
export type Hop = { state: HopState; at?: number; ms?: number; note?: string };

export const HOP_ORDER: HopId[] = ["whatsapp", "whisper", "gemma", "gate", "superset", "agent", "reply"];

export type Phase = "routing" | "approval" | "working" | "needs-you" | "finished" | "answered" | "cancelled" | "error" | "stopped";

export type Trace = {
  id: string;
  chatId: string | null;
  chat: string | null;
  from: string | null;
  owner: boolean;
  source: "whatsapp" | "portal";
  text: string;
  voice: boolean;
  attachment?: Attachment;
  start: number;
  last: number;
  transcriptMs?: number;
  intent?: Intent;
  model?: string;
  gemmaMs?: number;
  gate?: { code: string; reason?: string; category?: string | null; at: number };
  approval?: { ok: boolean; via?: string; at: number };
  session?: string;
  agent?: string;
  status?: SessionStatus;
  summary?: string;
  spawnAt?: number;
  doneAt?: number;
  replies: { at: number; text: string; attachment?: Attachment }[];
  artifacts: { url?: string; path: string }[];
  previews: string[];
  error?: string;
  events: HukamEvent[];
  hops: Record<HopId, Hop>;
  phase: Phase;
};

const t = (e: HukamEvent) => Date.parse(e.at);

function blank(id: string, e: HukamEvent): Trace {
  return {
    id,
    chatId: e.chatId ?? null,
    chat: e.chat ?? null,
    from: null,
    owner: false,
    source: "whatsapp",
    text: "",
    voice: false,
    start: t(e),
    last: t(e),
    replies: [],
    artifacts: [],
    previews: [],
    events: [],
    hops: Object.fromEntries(HOP_ORDER.map((h) => [h, { state: "idle" }])) as Record<HopId, Hop>,
    phase: "routing",
  };
}

function apply(tr: Trace, e: HukamEvent) {
  tr.events.push(e);
  tr.last = Math.max(tr.last, t(e));
  tr.chatId ??= e.chatId ?? null;
  if (e.chat && !tr.chat) tr.chat = e.chat;
  switch (e.type) {
    case "inbound":
      tr.from = e.from;
      tr.owner = e.owner;
      tr.text = e.text;
      tr.voice = e.voice;
      tr.attachment = e.attachment;
      tr.source = e.source === "portal" ? "portal" : "whatsapp";
      tr.chat = e.chat ?? tr.chat;
      break;
    case "voice":
      tr.transcriptMs = e.ms;
      tr.voice = true;
      if (!tr.text) tr.text = e.text;
      break;
    case "intent":
      tr.intent = e.intent;
      tr.model = e.model;
      tr.gemmaMs = e.ms;
      break;
    case "gate":
      tr.gate = { code: e.code, reason: e.reason, category: e.category, at: t(e) };
      break;
    case "approval":
      tr.approval = { ok: e.ok, via: e.via, at: t(e) };
      break;
    case "spawn":
      tr.session = e.name;
      tr.agent = e.agent;
      tr.spawnAt = t(e);
      tr.status = "working";
      break;
    case "send":
      tr.session = e.name;
      tr.spawnAt = t(e);
      tr.status = "working";
      break;
    case "status":
      if (!tr.session) tr.session = e.name;
      tr.status = e.status;
      break;
    case "done":
      tr.summary = e.summary;
      tr.doneAt = t(e);
      tr.status = e.state === "blocked" ? "blocked" : "idle";
      break;
    case "artifact":
      tr.artifacts.push({ url: e.url, path: e.path });
      break;
    case "preview":
      if (e.url) tr.previews.push(e.url);
      break;
    case "reply":
      tr.replies.push({ at: t(e), text: e.text, attachment: e.attachment });
      break;
    case "error":
      tr.error = e.message;
      break;
  }
}

function derive(tr: Trace) {
  const h = tr.hops;
  const inboundAt = tr.events.find((e) => e.type === "inbound");
  h.whatsapp = { state: "done", at: inboundAt ? t(inboundAt) : tr.start, note: tr.source === "portal" ? "portal" : undefined };

  const voiceEv = tr.events.find((e) => e.type === "voice");
  h.whisper = voiceEv ? { state: "done", at: t(voiceEv), ms: tr.transcriptMs } : tr.voice ? { state: "active" } : { state: "skipped" };

  const intentEv = tr.events.find((e) => e.type === "intent");
  if (intentEv) h.gemma = { state: "done", at: t(intentEv), ms: tr.gemmaMs, note: tr.model };
  else if (tr.error) h.gemma = { state: "error" };
  else if (tr.events.some((e) => e.type === "approval")) h.gemma = { state: "skipped" };
  else h.gemma = { state: "active" };

  const act = tr.intent?.action;
  const runs = act === "spawn" || act === "send";
  if (tr.gate) {
    if (!tr.approval) h.gate = { state: "waiting", at: tr.gate.at, note: tr.gate.code };
    else h.gate = { state: tr.approval.ok ? "done" : "error", at: tr.approval.at, ms: tr.approval.at - tr.gate.at, note: tr.approval.ok ? "approved" : "cancelled" };
  } else if (intentEv) h.gate = { state: "skipped", note: runs ? "low risk" : undefined };

  if (tr.spawnAt) h.superset = { state: "done", at: tr.spawnAt, note: tr.session };
  else if (intentEv && !runs) h.superset = { state: "skipped" };
  else if (tr.gate && !tr.approval) h.superset = { state: "idle" };
  else if (tr.approval && !tr.approval.ok) h.superset = { state: "skipped" };
  else if (runs && !tr.error) h.superset = { state: "active" };
  else if (tr.error) h.superset = { state: "error" };

  if (tr.session && tr.spawnAt) {
    if (tr.status === "working") h.agent = { state: "active", at: tr.spawnAt };
    else if (tr.status === "blocked") h.agent = { state: "waiting", at: tr.doneAt, ms: tr.doneAt && tr.doneAt - tr.spawnAt };
    else if (tr.status === "exited") h.agent = { state: "error" };
    else if (tr.status === "stopped") h.agent = { state: "skipped", note: "stopped" };
    else h.agent = { state: "done", at: tr.doneAt, ms: tr.doneAt ? tr.doneAt - tr.spawnAt : undefined };
  } else if (h.superset.state === "skipped") h.agent = { state: "skipped" };

  const lastReply = tr.replies[tr.replies.length - 1];
  if (lastReply) {
    const finalWait = tr.status === "working" || (tr.gate && !tr.approval);
    h.reply = { state: finalWait ? "active" : "done", at: lastReply.at, note: `${tr.replies.length}` };
  } else if (tr.error) h.reply = { state: "error" };

  // "yes k3f9" / "no k3f9": the decision itself. The approved task continues in the trace that asked for it.
  if (act === "approval") {
    h.gate = { state: "done", at: intentEv ? t(intentEv) : undefined, note: tr.intent?.ok ? "approved" : "cancelled" };
    h.superset = { state: "skipped" };
    h.agent = { state: "skipped" };
    if (!lastReply) h.reply = { state: "skipped" };
  }

  // Hop timing: time from the previous completed hop to this one.
  let prev = h.whatsapp.at ?? tr.start;
  for (const id of HOP_ORDER.slice(1)) {
    const hop = h[id];
    if (hop.at && hop.ms == null && hop.state === "done") hop.ms = Math.max(0, hop.at - prev);
    if (hop.at) prev = hop.at;
  }

  tr.phase = tr.error
    ? "error"
    : act === "approval"
      ? "answered"
      : tr.gate && !tr.approval
        ? "approval"
      : tr.approval && !tr.approval.ok
        ? "cancelled"
        : tr.status === "working"
          ? "working"
          : tr.status === "blocked"
            ? "needs-you"
            : tr.status === "stopped"
              ? "stopped"
              : tr.status === "idle"
                ? "finished"
                : tr.replies.length
                  ? "answered"
                  : "routing";
}

/** Newest first. Events without a trace (status after a router restart) join the latest trace for that session. */
export function buildTraces(events: HukamEvent[]): Trace[] {
  const traces = new Map<string, Trace>();
  const bySession = new Map<string, Trace>();
  for (const e of events) {
    let tr: Trace | undefined;
    if (e.trace) {
      tr = traces.get(e.trace);
      if (!tr) {
        if (e.type !== "inbound" && !["intent", "voice", "spawn", "send", "reply", "gate"].includes(e.type)) continue;
        tr = blank(e.trace, e);
        traces.set(e.trace, tr);
      }
    } else if ("name" in e && typeof e.name === "string") {
      tr = bySession.get(e.name);
    }
    if (!tr) continue;
    apply(tr, e);
    if (tr.session) bySession.set(tr.session, tr);
  }
  const list = [...traces.values()];
  for (const tr of list) {
    if (!tr.text && tr.intent?.prompt) tr.text = tr.intent.prompt;
    derive(tr);
  }
  return list.sort((a, b) => b.start - a.start);
}

export const PHASE: Record<Phase, { label: string; tone: "neutral" | "active" | "attention" | "success" | "danger" | "muted" }> = {
  routing: { label: "Routing", tone: "active" },
  approval: { label: "Waiting for approval", tone: "attention" },
  working: { label: "Agent working", tone: "active" },
  "needs-you": { label: "Agent needs you", tone: "attention" },
  finished: { label: "Finished", tone: "success" },
  answered: { label: "Answered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "muted" },
  stopped: { label: "Stopped", tone: "muted" },
  error: { label: "Error", tone: "danger" },
};
