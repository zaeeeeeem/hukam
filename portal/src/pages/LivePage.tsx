import { AnimatePresence } from "motion/react";
import { Bot, Cpu, Crosshair, MessagesSquare, Radio } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AgentCard } from "../components/live/AgentCard";
import { Composer, type ComposerHandle } from "../components/live/Composer";
import { DecisionCard } from "../components/live/DecisionCard";
import { EventLog } from "../components/live/EventLog";
import { PipelineRail } from "../components/live/PipelineRail";
import { senderName, TraceCard } from "../components/live/TraceCard";
import { PageHeader } from "../components/shell/Shell";
import { CountUp, EmptyState, Segmented, Skeleton, TimeAgo } from "../components/ui/primitives";
import { PILL_SM_BUTTON, SURFACE } from "../components/ui/surface";
import { duration, plural, sameDay } from "../lib/format";
import { useMediaQuery, usePortal } from "../lib/store";
import { PHASE } from "../lib/traces";

export function LivePage() {
  const { state, load, traces, events } = usePortal();
  const [pinned, setPinned] = useState<string | null>(null);
  const [tab, setTab] = useState<"conversations" | "log">("conversations");
  const composer = useRef<ComposerHandle>(null);
  const compact = useMediaQuery("(max-width: 1499px)");

  const followed = (pinned && traces.find((t) => t.id === pinned)) || traces[0] || null;
  const decisions = traces.filter((t) => t.intent && t.intent.action !== "approval");
  const sessions = useMemo(
    () => (state ? [...state.sessions].sort((a, b) => rank(a.status) - rank(b.status) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0)) : []),
    [state],
  );

  const working = state?.sessions.filter((s) => s.status === "working").length ?? 0;
  const pending = state?.approvals.pending.length ?? 0;
  const facts = state
    ? [
        working ? `${plural(working, "agent")} working` : "No agent working",
        pending ? `${pending} waiting for your approval` : null,
        traces[0] ? (
          <span key="last">
            last message <TimeAgo at={traces[0].start} />
          </span>
        ) : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="flex min-h-full flex-col gap-3 pb-1">
      <PageHeader
        title="Live"
        facts={
          load === "loading" ? (
            <Skeleton className="h-3.5 w-64" />
          ) : (
            <span className="flex flex-wrap items-center gap-x-1.5">
              {facts.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  {f}
                </span>
              ))}
            </span>
          )
        }
      />

      <Counters />

      <section aria-label="Pipeline" className={`rounded-[22px] ${SURFACE}`}>
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-5 pt-3.5 pb-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[15px] font-medium text-white">
              <Radio className="size-4 text-white/60" strokeWidth={1.8} />
              Pipeline
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-white/45">
              {followed ? (
                <>
                  {pinned ? "Pinned: " : "Following the latest message: "}
                  <span className="text-white/70">{senderName(followed)}</span>
                  {followed.chat && followed.chat !== "DM" ? ` in ${followed.chat}` : ""} · “{(followed.text || followed.intent?.prompt || "").slice(0, 70)}
                  {(followed.text || "").length > 70 ? "…" : ""}” · {PHASE[followed.phase].label.toLowerCase()}
                </>
              ) : (
                "Each message travels WhatsApp → Whisper → Gemma 4 → risk gate → Superset → agent → reply."
              )}
            </p>
          </div>
          {pinned && (
            <button type="button" className={PILL_SM_BUTTON} onClick={() => setPinned(null)}>
              <Crosshair className="size-3.5" />
              Follow latest
            </button>
          )}
        </header>
        <div className="px-3 pb-3">
          <PipelineRail trace={followed} state={state} />
        </div>
      </section>

      <div className="grid min-h-[480px] flex-1 grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <section aria-label="Conversations" className={`@container flex min-h-0 flex-col rounded-[22px] ${SURFACE}`}>
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4">
            <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-medium text-white">
              <MessagesSquare className="size-4 shrink-0 text-white/60" strokeWidth={1.8} />
              <span className="truncate">WhatsApp</span>
            </h2>
            <Segmented
              label="Conversation view"
              value={tab}
              onChange={setTab}
              options={[
                { value: "conversations", label: "Messages", count: compact ? undefined : traces.length },
                { value: "log", label: "Event log", count: compact ? undefined : events.length },
              ]}
            />
          </header>
          <div className="relative min-h-0 flex-1">
            {tab === "conversations" ? (
              <div className="absolute inset-0 overflow-y-auto p-3">
                {load === "loading" ? (
                  <ListSkeleton />
                ) : traces.length === 0 ? (
                  <EmptyState icon={MessagesSquare} title="Waiting for the first message">
                    Message the paired WhatsApp number from an allowed phone, or type a command below.
                  </EmptyState>
                ) : (
                  <div className="flex flex-col gap-2">
                    <AnimatePresence initial={false}>
                      {traces.slice(0, 60).map((t) => (
                        <TraceCard key={t.id} trace={t} selected={followed?.id === t.id && !!pinned} onSelect={() => setPinned(pinned === t.id ? null : t.id)} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0">
                <EventLog events={events} />
              </div>
            )}
          </div>
          <Composer ref={composer} onSent={() => setPinned(null)} />
        </section>

        <section aria-label="Gemma decisions" className={`flex min-h-0 flex-col rounded-[22px] ${SURFACE}`}>
          <ColumnHeader icon={Cpu} title={compact ? "Gemma 4" : "Gemma 4 decisions"} meta={state?.gemma.lastServed ? `${duration(state.gemma.lastServed.ms)} last` : undefined} count={decisions.length} />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {load === "loading" ? (
              <ListSkeleton />
            ) : decisions.length === 0 ? (
              <EmptyState icon={Cpu} title="No decisions yet">
                Gemma 4 turns each message into one action: start an agent, follow up, list, stop, or answer in chat.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {decisions.slice(0, 40).map((t) => (
                    <DecisionCard key={t.id} trace={t} selected={followed?.id === t.id && !!pinned} onSelect={() => setPinned(pinned === t.id ? null : t.id)} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>

        <section aria-label="Agents" className={`flex min-h-0 flex-col rounded-[22px] ${SURFACE}`}>
          <ColumnHeader icon={Bot} title="Agents" meta={working ? `${working} working` : undefined} count={sessions.length} />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {load === "loading" ? (
              <ListSkeleton />
            ) : sessions.length === 0 ? (
              <EmptyState icon={Bot} title="No agents yet">
                When Gemma starts a task, its Claude Code, Codex or OpenCode session appears here with a live status.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2.5">
                <AnimatePresence initial={false}>
                  {sessions.slice(0, 30).map((s) => (
                    <AgentCard key={s.name} session={s} compact />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ColumnHeader({ icon: Icon, title, meta, count }: { icon: typeof Cpu; title: string; meta?: string; count: number }) {
  return (
    <header className="@container flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4">
      <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-medium whitespace-nowrap text-white">
        <Icon className="size-4 shrink-0 text-white/60" strokeWidth={1.8} />
        {title}
      </h2>
      <div className="flex shrink-0 items-center gap-2">
        {meta && <span className="text-[12px] whitespace-nowrap text-white/40 @max-[300px]:hidden">{meta}</span>}
        <span className="inline-flex h-6 items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 font-mono text-[11px] text-white/75 tabular-nums">{count}</span>
      </div>
    </header>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-[16px] border border-white/[0.06] p-3.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Today's counters, computed from the event stream (persisted by the router across restarts). */
function Counters() {
  const { events, state, load } = usePortal();
  const today = useMemo(() => {
    const now = Date.now();
    const t = events.filter((e) => sameDay(Date.parse(e.at), now));
    const gemma = t.filter((e) => e.type === "intent" && e.ms && e.model !== "fast-path") as Extract<(typeof t)[number], { type: "intent" }>[];
    return {
      messages: t.filter((e) => e.type === "inbound").length,
      voice: t.filter((e) => e.type === "voice").length,
      files: t.filter((e) => e.type === "inbound" && e.attachment).length,
      decisions: t.filter((e) => e.type === "intent").length,
      gemmaAvg: gemma.length ? gemma.reduce((s, e) => s + (e.ms ?? 0), 0) / gemma.length : null,
      started: t.filter((e) => e.type === "spawn").length,
      replies: t.filter((e) => e.type === "reply").length,
      images: t.filter((e) => e.type === "artifact" || e.type === "preview").length,
      gated: t.filter((e) => e.type === "gate").length,
    };
  }, [events]);
  const pending = state?.approvals.pending.length ?? 0;
  const working = state?.sessions.filter((s) => s.status === "working").length ?? 0;
  const cells = [
    { label: "Messages today", value: today.messages, hint: `${plural(today.voice, "voice note")} · ${plural(today.files, "file")}` },
    { label: "Gemma decisions", value: today.decisions, hint: today.gemmaAvg != null ? `avg ${duration(today.gemmaAvg)}` : "no model calls yet" },
    { label: "Agents started", value: today.started, hint: `${working} working now` },
    { label: "Waiting on you", value: pending, hint: `${plural(today.gated, "risky task")} today`, attention: pending > 0 },
    { label: "Replies sent", value: today.replies, hint: `${plural(today.images, "image")} returned` },
  ];
  return (
    <section aria-label="Today" className={`grid grid-cols-5 rounded-[20px] ${SURFACE}`}>
      {cells.map((c, i) => (
        <div key={c.label} className={`flex min-w-0 flex-col gap-0.5 px-5 py-3.5 ${i > 0 ? "border-l border-white/[0.06]" : ""}`}>
          <p className="truncate text-[12px] text-white/50">{c.label}</p>
          {load === "loading" ? (
            <Skeleton className="my-1 h-6 w-12" />
          ) : (
            <p className={`font-display text-[26px] leading-tight tracking-tight ${c.attention ? "text-[#ffa46b]" : "text-white"}`}>
              <CountUp value={c.value} />
            </p>
          )}
          <p className="truncate text-[11px] text-white/40">{c.hint}</p>
        </div>
      ))}
    </section>
  );
}

const rank = (s: string) => ({ working: 0, blocked: 1, idle: 2, exited: 3, stopped: 4 })[s] ?? 5;
