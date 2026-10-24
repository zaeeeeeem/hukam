import { ArrowLeft, Bot, ChevronRight, Clock, ImageIcon, MessageSquare, Search, Send, Square, SquareTerminal, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EventLog } from "../components/live/EventLog";
import { PageHeader } from "../components/shell/Shell";
import { AgentAvatar, EmptyState, Img, INPUT, InlineError, Segmented, SectionCard, Skeleton, StatusPill, TimeAgo, WaText } from "../components/ui/primitives";
import { DANGER_SM, PILL_SM_BUTTON, PRIMARY_SM, SURFACE } from "../components/ui/surface";
import { api } from "../lib/api";
import { dateTime, duration, plural } from "../lib/format";
import { Link, navigate } from "../lib/router";
import { useNow, usePortal } from "../lib/store";
import type { HukamEvent, Session } from "../lib/types";
import { agentMeta, sessionStatus } from "../lib/vocab";

type Filter = "all" | "working" | "blocked" | "idle" | "ended";

export function SessionsPage() {
  const { state, load, error, refresh } = usePortal();
  const [filter, setFilter] = useState<Filter>("all");
  const [agent, setAgent] = useState<string>("all");
  const [q, setQ] = useState("");
  const sessions = state?.sessions ?? [];
  const count = (f: Filter) => sessions.filter((s) => matchFilter(s, f)).length;
  const shown = sessions
    .filter((s) => matchFilter(s, filter))
    .filter((s) => agent === "all" || s.agent === agent)
    .filter((s) => !q.trim() || `${s.name} ${s.prompt} ${s.chat ?? ""} ${s.from ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-3 pb-6">
      <PageHeader
        title="Agents"
        facts={
          state ? (
            <span>
              {plural(sessions.length, "session")} · {count("working")} working · {count("blocked")} need you
            </span>
          ) : null
        }
      />
      <section className={`flex flex-col rounded-[22px] ${SURFACE}`} aria-label="Sessions">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <Segmented
            label="Status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: sessions.length },
              { value: "working", label: "Working", count: count("working") },
              { value: "blocked", label: "Needs you", count: count("blocked") },
              { value: "idle", label: "Finished", count: count("idle") },
              { value: "ended", label: "Stopped", count: count("ended") },
            ]}
          />
          <Segmented
            label="Agent"
            value={agent}
            onChange={setAgent}
            options={[{ value: "all", label: "Any agent" }, ...(state?.options.agents ?? ["claude", "codex", "opencode"]).map((a) => ({ value: a, label: agentMeta(a).short }))]}
          />
          <div className="relative ml-auto w-full max-w-[280px] min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/35" />
            <label htmlFor="session-search" className="sr-only">
              Search sessions
            </label>
            <input id="session-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, prompt, chat" className={`${INPUT} h-8 rounded-full pl-8`} />
          </div>
        </div>

        {load === "error" && !state ? (
          <div className="p-4">
            <InlineError onRetry={refresh}>Could not load sessions. {error}</InlineError>
          </div>
        ) : load === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={Bot} title={sessions.length ? "No session matches" : "No agents yet"}>
            {sessions.length ? "Try another filter or clear the search." : "Send a task from WhatsApp, or from the command box on the Live page."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-[13px]">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="text-[11px] font-medium tracking-[0.06em] text-white/40 uppercase">
                  <th className="px-5 py-2.5 font-medium">Session</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Agent</th>
                  <th className="px-3 py-2.5 font-medium">Task</th>
                  <th className="px-3 py-2.5 font-medium">Chat</th>
                  <th className="px-5 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const st = sessionStatus(s.status);
                  const href = `/sessions/${encodeURIComponent(s.name)}`;
                  return (
                    <tr
                      key={s.name}
                      onClick={() => navigate(href)}
                      className="group cursor-pointer border-t border-white/[0.05] transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-3">
                        <Link to={href} className="flex min-w-0 items-center gap-3 rounded-lg" onClick={(e) => e.stopPropagation()}>
                          <AgentAvatar agent={s.agent} size={30} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-white" title={s.name}>
                              {s.name}
                            </span>
                            {(s.artifacts.length > 0 || s.previews.length > 0) && (
                              <span className="flex items-center gap-1 text-[11px] text-white/40">
                                <ImageIcon className="size-3" />
                                {plural(s.artifacts.length + s.previews.length, "image")}
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill tone={st.tone} icon={st.icon} label={st.label} size="sm" />
                      </td>
                      <td className="px-3 py-3 text-white/70">
                        <span className="block truncate">
                          {agentMeta(s.agent).short}
                          {s.model ? <span className="text-white/40"> · {s.model}</span> : null}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="line-clamp-2 leading-snug text-white/70" title={s.prompt}>
                          {s.prompt}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-white/60">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {s.chat && s.chat !== "DM" ? <Users className="size-3.5 shrink-0 text-white/40" /> : <MessageSquare className="size-3.5 shrink-0 text-white/40" />}
                          <span className="truncate">{s.chat === "DM" || !s.chat ? "Owner DM" : s.chat}</span>
                        </span>
                        {s.from && s.chat !== "DM" && <span className="block truncate text-[11px] text-white/35">{s.from}</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-[12px] text-white/45">
                        <span className="inline-flex items-center gap-1">
                          <TimeAgo at={s.updatedAt ?? s.createdAt} />
                          {!s.updatedAt && !s.createdAt && "—"}
                          <ChevronRight className="size-3.5 text-white/25 transition-colors group-hover:text-white/70" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function matchFilter(s: Session, f: Filter) {
  if (f === "all") return true;
  if (f === "ended") return s.status === "stopped" || s.status === "exited";
  return s.status === f;
}

export function SessionDetailPage({ name }: { name: string }) {
  const { state, load, demo, events: allEvents, followUp, stop, terminal } = usePortal();
  const s = state?.sessions.find((x) => x.name === name) ?? null;
  const now = useNow(1000);
  const [events, setEvents] = useState<HukamEvent[] | null>(null);
  const [term, setTerm] = useState<{ text: string | null; error?: string } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  // Session timeline: everything with this session's name, plus the messages that led to it.
  const loadEvents = useCallback(() => {
    if (demo) {
      const traces = new Set(allEvents.filter((e) => "name" in e && e.name === name && e.trace).map((e) => e.trace));
      setEvents(allEvents.filter((e) => ("name" in e && e.name === name) || (e.trace && traces.has(e.trace))));
      return;
    }
    api
      .session(name)
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]));
  }, [demo, allEvents, name]);
  useEffect(loadEvents, [loadEvents, s?.status, s?.updatedAt]);

  const working = s?.status === "working";
  useEffect(() => {
    if (!s) return;
    let alive = true;
    const pull = () => terminal(name).then((t) => alive && setTerm(t));
    pull();
    const id = working ? setInterval(pull, 4000) : null;
    return () => {
      alive = false;
      if (id) clearInterval(id);
    };
  }, [name, working, terminal, s]);

  if (load === "loading") {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="mt-2 h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-[22px]" />
      </div>
    );
  }
  if (!s) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Session not found" />
        <div className={`rounded-[22px] ${SURFACE}`}>
          <EmptyState icon={Bot} title={`No session named “${name}”`} action={<Link to="/sessions" className={PILL_SM_BUTTON}>Back to agents</Link>}>
            It may have been created on another machine, or the router state was reset.
          </EmptyState>
        </div>
      </div>
    );
  }

  const st = sessionStatus(s.status);
  const meta = agentMeta(s.agent);
  const ended = s.status === "stopped" || s.status === "exited";
  const images = [...s.artifacts.map((a) => ({ url: a.url, label: a.path, at: a.at, kind: "Made by the agent" })), ...s.previews.map((p) => ({ url: p.url, label: "Live preview", at: p.at, kind: "Page screenshot" }))].sort((a, b) => b.at - a.at);

  async function sendFollowUp() {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    if (await followUp(name, t)) setText("");
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3 pb-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 px-1 pt-1 text-[13px] text-white/45">
        <Link to="/sessions" className="inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-white">
          <ArrowLeft className="size-3.5" />
          Agents
        </Link>
        <ChevronRight className="size-3.5 text-white/25" />
        <span className="truncate text-white/70">{s.name}</span>
      </nav>

      <section className={`rounded-[22px] p-5 ${SURFACE}`} aria-label="Session">
        <div className="flex flex-wrap items-start gap-4">
          <AgentAvatar agent={s.agent} size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="font-display text-[26px] leading-tight break-all text-white">{s.name}</h1>
              <StatusPill tone={st.tone} icon={st.icon} label={st.label} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-white/50">
              <span>
                {meta.label}
                {s.model ? ` · ${s.model}` : ""}
              </span>
              <span aria-hidden="true">·</span>
              <span>{s.chat === "DM" || !s.chat ? "Owner DM" : s.chat}</span>
              {s.from && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>asked by {s.from}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!ended &&
              (confirmStop ? (
                <>
                  <span className="text-[12px] text-white/55">Close this agent's terminal?</span>
                  <button type="button" className={PILL_SM_BUTTON} onClick={() => setConfirmStop(false)}>
                    Keep running
                  </button>
                  <button
                    type="button"
                    className={DANGER_SM}
                    onClick={async () => {
                      setConfirmStop(false);
                      await stop(name);
                    }}
                  >
                    <Square className="size-3" />
                    Stop agent
                  </button>
                </>
              ) : (
                <button type="button" className={DANGER_SM} onClick={() => setConfirmStop(true)}>
                  <Square className="size-3" />
                  Stop
                </button>
              ))}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 text-[12px] md:grid-cols-4">
          <Fact label="Started" value={s.createdAt ? dateTime(s.createdAt) : "Before timestamps were recorded"} />
          <Fact label="Last update" value={s.updatedAt ? dateTime(s.updatedAt) : "—"} />
          <Fact label={working ? "Running for" : "Settled"} value={working ? duration(now - (s.updatedAt ?? s.createdAt ?? now)) : s.finishedAt ? dateTime(s.finishedAt) : "—"} mono={working} />
          <Fact label="Follow-ups" value={String(s.followUps.length)} mono />
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard icon={MessageSquare} title="Task">
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-white/85">{s.prompt}</p>
            {s.summary && (
              <div className={`mt-4 rounded-[14px] border px-3.5 py-3 ${s.status === "blocked" ? "border-st-attention/30 bg-st-attention/[0.06]" : "border-white/[0.07] bg-black/30"}`}>
                <p className="mb-1 text-[11px] font-medium tracking-[0.06em] text-white/40 uppercase">{s.status === "blocked" ? "The agent is asking" : "Summary Gemma sent to WhatsApp"}</p>
                <WaText text={s.summary} className="text-[13px] leading-relaxed text-white/80" />
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Send} title="Follow up" subtitle={ended ? `${s.name} has ${s.status}. Start a new task from Live instead.` : "Sent to the agent's terminal, like “@name …” on WhatsApp. Hukam replies in the session's chat."}>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendFollowUp();
              }}
            >
              <label htmlFor="follow-up" className="sr-only">
                Follow-up message
              </label>
              <textarea
                id="follow-up"
                value={text}
                disabled={ended}
                rows={3}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void sendFollowUp();
                  }
                }}
                placeholder={s.status === "blocked" ? "Answer the agent's question" : "e.g. make the headline bigger and add our address"}
                className={`${INPUT} h-auto resize-none py-2.5 leading-relaxed disabled:opacity-40`}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-white/35">⌘/Ctrl + Enter to send</span>
                <button type="submit" disabled={ended || busy || !text.trim()} className={PRIMARY_SM}>
                  <Send className="size-3.5" />
                  {busy ? "Sending…" : "Send follow-up"}
                </button>
              </div>
            </form>
            {s.followUps.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
                {s.followUps.map((f, i) => (
                  <li key={i} className="flex gap-3 text-[12px]">
                    <TimeAgo at={f.at} className="w-16 shrink-0 text-white/35" />
                    <span className="min-w-0 flex-1 text-white/70">
                      {f.from && <span className="text-white/45">{f.from}: </span>}
                      {f.prompt}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard icon={Clock} title="Timeline" count={events?.length ?? undefined} bodyClassName="h-[360px] p-0">
            {events == null ? (
              <div className="p-4">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <EventLog events={events} />
            )}
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard
            icon={SquareTerminal}
            title="Terminal"
            subtitle={working ? "Last 120 lines · refreshes every 4 s" : "Last 120 lines"}
            bodyClassName="p-0"
          >
            {term == null ? (
              <div className="p-4">
                <Skeleton className="h-40 w-full" />
              </div>
            ) : term.text == null ? (
              <div className="p-4">
                <InlineError>{term.error ?? "The terminal is closed."}</InlineError>
              </div>
            ) : (
              <pre className="max-h-[440px] overflow-auto rounded-b-[22px] bg-black/50 px-4 py-3 font-mono text-[11.5px] leading-[1.55] whitespace-pre-wrap text-white/75">{term.text.trimEnd() || "(empty)"}</pre>
            )}
          </SectionCard>

          <SectionCard icon={ImageIcon} title="Images" count={images.length}>
            {images.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-white/45">Images this agent saves under outputs/, and screenshots of the page after it changes, show up here and go back to WhatsApp.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 2xl:grid-cols-3">
                {images.map((img) => (
                  <button key={img.url} type="button" onClick={() => setViewer(img.url)} className="group flex flex-col gap-1.5 text-left">
                    <Img src={img.url} alt={img.label} className="aspect-[4/3] w-full rounded-xl border border-white/10 bg-black/40 object-cover transition-[border-color] group-hover:border-white/30" />
                    <span className="truncate text-[12px] text-white/70" title={img.label}>
                      {img.label}
                    </span>
                    <span className="text-[11px] text-white/40">
                      {img.kind} · <TimeAgo at={img.at} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
      {viewer && <Lightbox url={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-white/40">{label}</dt>
      <dd className={`mt-0.5 truncate text-[13px] text-white/85 ${mono ? "font-mono tabular-nums" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

export function Lightbox({ url, onClose, caption }: { url: string; onClose: () => void; caption?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Image" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-10 backdrop-blur-md" onClick={onClose}>
      <figure className="flex max-h-full max-w-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt={caption ?? ""} className="max-h-[80vh] max-w-[80vw] rounded-2xl border border-white/10 object-contain shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]" />
        {caption && <figcaption className="text-[13px] text-white/60">{caption}</figcaption>}
      </figure>
      <button type="button" autoFocus onClick={onClose} aria-label="Close" className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/80 hover:bg-white/[0.12]">
        <X className="size-4" />
      </button>
    </div>
  );
}

