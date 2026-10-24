// The words, tones and icons the portal uses. Components read labels from here; never hard-code a status label.
import {
  AlertOctagon,
  AudioLines,
  Bot,
  Braces,
  CheckCircle2,
  CircleStop,
  Cpu,
  Hand,
  ImageIcon,
  Inbox,
  KeyRound,
  ListChecks,
  MessageCircle,
  MessageSquareReply,
  Moon,
  OctagonX,
  Paperclip,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkle,
  SquareTerminal,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AgentKind, EventType, SessionStatus } from "./types";

export type Tone = "neutral" | "active" | "attention" | "success" | "danger" | "muted";
type Entry = { label: string; tone: Tone; icon: LucideIcon };

export const SESSION_STATUS: Record<SessionStatus, Entry> = {
  working: { label: "Working", tone: "active", icon: Zap },
  blocked: { label: "Needs you", tone: "attention", icon: Hand },
  idle: { label: "Finished", tone: "success", icon: CheckCircle2 },
  exited: { label: "Exited", tone: "danger", icon: OctagonX },
  stopped: { label: "Stopped", tone: "muted", icon: CircleStop },
};
export const sessionStatus = (s: string): Entry => SESSION_STATUS[s as SessionStatus] ?? { label: s, tone: "neutral", icon: Moon };

export const AGENT: Record<AgentKind, { label: string; short: string; icon: LucideIcon; color: string; vendor: string }> = {
  claude: { label: "Claude Code", short: "Claude", icon: Sparkle, color: "#e08a62", vendor: "Anthropic" },
  codex: { label: "Codex", short: "Codex", icon: Braces, color: "#c9ccd6", vendor: "OpenAI" },
  opencode: { label: "OpenCode", short: "OpenCode", icon: SquareTerminal, color: "#5cc2ff", vendor: "SST" },
};
export const agentMeta = (a: string | null | undefined) => AGENT[(a ?? "claude") as AgentKind] ?? { label: a ?? "Agent", short: a ?? "Agent", icon: Bot, color: "#9aa0aa", vendor: "" };

export const ACTION_LABEL: Record<string, string> = {
  spawn: "Start agent",
  send: "Follow up",
  list: "List sessions",
  status: "Status",
  stop: "Stop agent",
  chat: "Answer in chat",
  await_attachment: "Wait for attachment",
  help: "Help",
  approval: "Approval",
};
export const actionLabel = (a: string | null | undefined) => (a ? (ACTION_LABEL[a] ?? a) : "Unknown");

export const RISK_CATEGORY: Record<string, { label: string; hint: string }> = {
  push: { label: "Git push or merge", hint: "Pushing or merging to a shared branch" },
  deploy: { label: "Deploy or release", hint: "Shipping to production or any environment" },
  delete: { label: "Delete data", hint: "Deleting data or files outside the project" },
  secrets: { label: "Secrets and keys", hint: "Reading or sending .env files, keys, tokens or passwords" },
  infra: { label: "Cloud and DNS", hint: "Changing cloud, infrastructure or DNS" },
  messaging: { label: "Messages to others", hint: "Sending messages or emails to other people" },
  spend: { label: "Spending money", hint: "Anything that costs money" },
  other: { label: "Other", hint: "Risky, outside the listed categories" },
};

/** Event types grouped into the log's filter chips. */
export const EVENT_GROUP: Record<EventType, "messages" | "gemma" | "agents" | "approvals" | "replies" | "system"> = {
  inbound: "messages",
  voice: "messages",
  awaiting: "messages",
  intent: "gemma",
  gate: "approvals",
  approval: "approvals",
  spawn: "agents",
  send: "agents",
  status: "agents",
  done: "agents",
  artifact: "agents",
  preview: "agents",
  reply: "replies",
  error: "system",
  ready: "system",
  settings: "system",
};

export const EVENT_META: Record<EventType, { label: string; icon: LucideIcon; tone: Tone }> = {
  inbound: { label: "Message", icon: MessageCircle, tone: "neutral" },
  voice: { label: "Voice note", icon: AudioLines, tone: "neutral" },
  awaiting: { label: "Waiting for file", icon: Paperclip, tone: "neutral" },
  intent: { label: "Gemma decision", icon: Cpu, tone: "active" },
  gate: { label: "Approval needed", icon: ShieldAlert, tone: "attention" },
  approval: { label: "Decision", icon: ShieldCheck, tone: "success" },
  spawn: { label: "Agent started", icon: Zap, tone: "active" },
  send: { label: "Follow-up", icon: Send, tone: "active" },
  status: { label: "Status", icon: Workflow, tone: "neutral" },
  done: { label: "Agent finished", icon: CheckCircle2, tone: "success" },
  artifact: { label: "Image made", icon: ImageIcon, tone: "success" },
  preview: { label: "Live preview", icon: ImageIcon, tone: "success" },
  reply: { label: "Reply", icon: MessageSquareReply, tone: "neutral" },
  error: { label: "Error", icon: AlertOctagon, tone: "danger" },
  ready: { label: "Router ready", icon: ListChecks, tone: "success" },
  settings: { label: "Settings saved", icon: Settings2, tone: "neutral" },
};

export const LOG_FILTERS = [
  { key: "all", label: "All" },
  { key: "messages", label: "Messages" },
  { key: "gemma", label: "Gemma" },
  { key: "approvals", label: "Approvals" },
  { key: "agents", label: "Agents" },
  { key: "replies", label: "Replies" },
  { key: "system", label: "System" },
] as const;

export const UI_ICON = { inbox: Inbox, key: KeyRound };
