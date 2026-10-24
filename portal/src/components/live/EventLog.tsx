// Every bus event, newest first, with type filters. The raw audit trail behind the Live view.
import { ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { clock } from "../../lib/format";
import type { HukamEvent } from "../../lib/types";
import { actionLabel, EVENT_GROUP, EVENT_META, LOG_FILTERS, sessionStatus } from "../../lib/vocab";
import { EmptyState, Mono, TONE } from "../ui/primitives";

export function describe(e: HukamEvent): string {
  switch (e.type) {
    case "inbound":
      return `${e.owner ? "You" : e.from}${e.source === "portal" ? " (portal)" : ""}: ${e.attachment ? `[${e.attachment.kind}] ` : ""}${e.text || ""}`;
    case "voice":
      return `Transcribed in ${(e.ms / 1000).toFixed(1)} s: “${e.text}”`;
    case "intent":
      return `${actionLabel(e.intent.action)}${e.intent.agent ? ` · ${e.intent.agent}` : ""}${e.intent.session ? ` · ${e.intent.session}` : ""}${e.intent.risk === "high" ? " · high risk" : ""}`;
    case "gate":
      return `Code ${e.code}: ${e.reason ?? e.prompt}`;
    case "approval":
      return `${e.ok ? "Approved" : "Cancelled"} ${e.code}${e.via ? ` via ${e.via === "portal" ? "portal" : "WhatsApp"}` : ""}`;
    case "spawn":
      return `${e.name} on ${e.agent}: ${e.prompt}`;
    case "send":
      return `${e.name}: ${e.prompt}`;
    case "status":
      return `${e.name}: ${sessionStatus(e.status).label.toLowerCase()}`;
    case "done":
      return `${e.name}: ${e.summary.split("\n")[0]}`;
    case "artifact":
      return `${e.name} made ${e.path}`;
    case "preview":
      return `Screenshot of ${e.name}'s page sent`;
    case "reply":
      return e.text.replace(/\n+/g, " · ");
    case "awaiting":
      return `Next photo or PDF will: ${e.prompt}`;
    case "error":
      return e.message;
    case "ready":
      return `Listening to ${e.allow.length} number(s) and ${e.groups.length} group(s) · ${e.model}`;
    case "settings":
      return "Owner settings changed";
  }
}

type Filter = (typeof LOG_FILTERS)[number]["key"];

export function EventLog({ events }: { events: HukamEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: events.length };
    for (const e of events) c[EVENT_GROUP[e.type]] = (c[EVENT_GROUP[e.type]] ?? 0) + 1;
    return c;
  }, [events]);
  const shown = useMemo(() => [...events].reverse().filter((e) => filter === "all" || EVENT_GROUP[e.type] === filter), [events, filter]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pt-3 pb-2.5" role="toolbar" aria-label="Filter events">
        {LOG_FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] whitespace-nowrap transition-colors ${
                on ? "border-white/25 bg-white/[0.1] text-white" : "border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/15 hover:text-white/85"
              }`}
            >
              {f.label}
              <span className="font-mono text-[11px] text-white/35 tabular-nums">{counts[f.key] ?? 0}</span>
            </button>
          );
        })}
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {shown.length === 0 && (
          <EmptyState icon={ScrollText} title="Nothing here yet">
            Events appear the moment Hukam receives a message, decides, starts an agent or replies.
          </EmptyState>
        )}
        {shown.map((e) => {
          const meta = EVENT_META[e.type];
          const Icon = meta.icon;
          return (
            <li key={e.id} className="flex min-w-0 items-start gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
              <Mono className="w-[58px] shrink-0 pt-px text-[11px] text-white/35">{clock(e.at)}</Mono>
              <Icon className={`mt-0.5 size-3.5 shrink-0 ${TONE[meta.tone].text}`} strokeWidth={2} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-baseline gap-1.5 text-[12px] leading-snug">
                  <span className="shrink-0 font-medium text-white/85">{meta.label}</span>
                  {e.chat && <span className="truncate text-white/35">{e.chat === "DM" ? "Owner DM" : e.chat}</span>}
                </p>
                <p className="truncate text-[12px] leading-snug text-white/55" title={describe(e)}>
                  {describe(e)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
