import { Bot, ChevronRight, Crown, ImageIcon, MessageSquare, MessagesSquare, Paperclip, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { TraceCard } from "../components/live/TraceCard";
import { PageHeader } from "../components/shell/Shell";
import { AgentAvatar, Chip, CopyButton, Img, initialsOf, EmptyState, InlineError, Mono, SectionCard, Skeleton, StatusPill, TimeAgo } from "../components/ui/primitives";
import { SURFACE } from "../components/ui/surface";
import { phone, plural } from "../lib/format";
import { Link, navigate } from "../lib/router";
import { usePortal } from "../lib/store";
import type { Chat } from "../lib/types";
import { sessionStatus } from "../lib/vocab";
import { Lightbox } from "./SessionsPage";

export function ChatsPage({ id }: { id?: string }) {
  const { state, load, error, refresh, traces } = usePortal();
  const chats = useMemo(() => (state ? [...state.chats].sort((a, b) => Number(b.owner) - Number(a.owner) || a.label.localeCompare(b.label)) : []), [state]);
  const current = chats.find((c) => c.id === id) ?? chats[0] ?? null;
  const lastByChat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of traces) if (t.chatId && !m.has(t.chatId)) m.set(t.chatId, t.start);
    return m;
  }, [traces]);
  const countByChat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of traces) if (t.chatId) m.set(t.chatId, (m.get(t.chatId) ?? 0) + 1);
    return m;
  }, [traces]);

  return (
    <div className="flex flex-col gap-3 pb-6">
      <PageHeader
        title="Chats"
        facts={state ? <span>{plural(chats.filter((c) => c.kind === "dm").length, "direct chat")} · {plural(chats.filter((c) => c.kind === "group").length, "group")}</span> : null}
      />
      {load === "error" && !state ? (
        <InlineError onRetry={refresh}>Could not load chats. {error}</InlineError>
      ) : (
        <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-3 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <nav aria-label="Chats" className={`flex h-fit flex-col gap-1 rounded-[22px] p-2 ${SURFACE}`}>
            {load === "loading" && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            {chats.map((c) => {
              const on = current?.id === c.id;
              return (
                <Link
                  key={c.id}
                  to={`/chats/${encodeURIComponent(c.id)}`}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-16 items-center gap-3 rounded-[16px] border px-3 py-2.5 transition-colors ${on ? "border-white/15 bg-white/[0.07]" : "border-transparent hover:bg-white/[0.04]"}`}
                >
                  <ChatIcon chat={c} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[14px] font-medium text-white">{c.label}</span>
                      {c.owner && <Crown className="size-3.5 shrink-0 text-[#ffb685]" aria-label="Owner" />}
                    </span>
                    <span className="block truncate text-[12px] text-white/45">
                      {c.kind === "group" ? plural(c.members.length, "member") : phone(c.id)} · {plural(countByChat.get(c.id) ?? 0, "message")}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-white/35">
                    {lastByChat.get(c.id) ? <TimeAgo at={lastByChat.get(c.id)} /> : <span>—</span>}
                    {!c.allowed && <span className="text-[#ffa46b]">not allowed</span>}
                  </span>
                </Link>
              );
            })}
          </nav>
          {current ? <ChatDetail chat={current} /> : load === "ready" ? <div className={`rounded-[22px] ${SURFACE}`}><EmptyState icon={MessagesSquare} title="No chats configured">Add an allowed number or group in Settings.</EmptyState></div> : null}
        </div>
      )}
    </div>
  );
}

function ChatIcon({ chat }: { chat: Chat }) {
  return (
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-full border ${chat.kind === "group" ? "border-st-active/35 bg-st-active/10 text-[#8fd3ff]" : "border-fu-orange/40 bg-fu-orange/10 text-[#ffb08a]"}`}>
      {chat.kind === "group" ? <Users className="size-4" /> : <MessageSquare className="size-4" />}
    </span>
  );
}

function ChatDetail({ chat }: { chat: Chat }) {
  const { traces, state } = usePortal();
  const [viewer, setViewer] = useState<string | null>(null);
  const history = traces.filter((t) => t.chatId === chat.id);
  const sessions = (state?.sessions ?? []).filter((s) => s.chatId === chat.id);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <section className={`rounded-[22px] p-5 ${SURFACE}`} aria-label={chat.label}>
        <div className="flex flex-wrap items-center gap-4">
          <ChatIcon chat={chat} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[22px] leading-tight text-white">{chat.label}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-white/50">
              <span>{chat.kind === "group" ? "WhatsApp group" : chat.owner ? "The owner's direct chat" : "Direct chat"}</span>
              <span aria-hidden="true">·</span>
              <Mono className="text-[12px] text-white/45">{chat.kind === "group" ? chat.id : phone(chat.id)}</Mono>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {chat.allowed ? (
              <StatusPill tone="success" icon={ShieldCheck} label={chat.kind === "group" ? "Allowed group" : "Allowlisted"} size="sm" />
            ) : (
              <StatusPill tone="attention" icon={ShieldCheck} label="Not allowed" size="sm" title="Hukam ignores this chat. Add it in Settings." />
            )}
            <CopyButton text={chat.id} label={chat.kind === "group" ? "Copy JID" : "Copy number"} />
          </div>
        </div>
        {chat.kind === "group" && (
          <p className="mt-4 rounded-[12px] border border-white/[0.06] bg-black/25 px-3.5 py-2.5 text-[12px] leading-relaxed text-white/55">
            Any member can start or follow up on agents here. Only the owner can approve risky tasks or stop an agent.
          </p>
        )}
        {chat.awaiting && (
          <p className="mt-3 flex items-center gap-2 rounded-[12px] border border-st-active/25 bg-st-active/[0.06] px-3.5 py-2.5 text-[12px] text-[#a8dcff]">
            <Paperclip className="size-3.5 shrink-0" />
            Waiting for a photo or PDF: “{chat.awaiting.prompt}” · asked <TimeAgo at={chat.awaiting.at} />
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SectionCard icon={MessagesSquare} title="Conversation with Hukam" count={history.length} bodyClassName="max-h-[720px] overflow-y-auto p-3">
          {history.length === 0 ? (
            <EmptyState icon={MessagesSquare} title="No messages yet">
              Messages, decisions and replies for this chat appear here as they happen.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((t) => (
                <TraceCard key={t.id} trace={t} showChat={false} />
              ))}
            </div>
          )}
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-3">
          {chat.kind === "group" && (
            <SectionCard icon={Users} title="Members" count={chat.members.length} bodyClassName="p-2">
              {chat.members.length === 0 ? (
                <p className="p-3 text-[13px] text-white/45">Member list not loaded yet. WhatsApp rate-limits group lookups; Hukam retries in the background.</p>
              ) : (
                <ul className="flex flex-col">
                  {chat.members.map((m) => (
                    <li key={m.lid ?? m.phone ?? Math.random()} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-[11px] font-semibold text-white/70">
                        {initialsOf(m.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-white/85">{m.name ?? (m.owner ? "Owner" : "Name not seen yet")}</span>
                        <Mono className="block truncate text-[11px] text-white/40">{m.phone ? phone(m.phone) : `LID ${m.lid}`}</Mono>
                      </span>
                      {m.owner && <StatusPill tone="attention" icon={Crown} label="Owner" size="sm" />}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          <SectionCard icon={ImageIcon} title="Image memory" subtitle="For follow-ups like “make it blue”" count={chat.images.length}>
            {chat.images.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-white/45">The last five images in this chat (photos people sent and images agents made) are remembered so follow-ups can refer to them.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {chat.images.map((img) => (
                  <button key={img.path + img.at} type="button" disabled={!img.url} onClick={() => img.url && setViewer(img.url)} className="group flex min-w-0 flex-col gap-1 text-left">
                    {img.url ? (
                      <Img src={img.url} alt={img.path} className="aspect-square w-full rounded-xl border border-white/10 bg-black/40 object-cover group-hover:border-white/30" />
                    ) : (
                      <span className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-white/12 text-white/30">
                        <ImageIcon className="size-5" />
                      </span>
                    )}
                    <span className="truncate text-[11px] text-white/65" title={img.path}>
                      {img.source === "user" ? "Photo" : img.path.split("/").pop()}
                    </span>
                    <span className="truncate text-[11px] text-white/35">{img.source === "agent" ? `by ${img.session ?? "an agent"}` : "sent here"}</span>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Bot} title="Sessions from this chat" count={sessions.length} bodyClassName="p-2">
            {sessions.length === 0 ? (
              <p className="p-3 text-[13px] text-white/45">No agents started from this chat yet.</p>
            ) : (
              <ul className="flex flex-col">
                {sessions.map((s) => {
                  const st = sessionStatus(s.status);
                  return (
                    <li key={s.name}>
                      <button
                        type="button"
                        onClick={() => navigate(`/sessions/${encodeURIComponent(s.name)}`)}
                        className="group flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <AgentAvatar agent={s.agent} size={28} />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">{s.name}</span>
                        <StatusPill tone={st.tone} icon={st.icon} label={st.label} size="sm" />
                        <ChevronRight className="size-3.5 shrink-0 text-white/25 group-hover:text-white/70" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
          {chat.sessions.length > sessions.length && (
            <Chip className="self-start">{chat.sessions.length - sessions.length} older sessions not in the current state</Chip>
          )}
        </div>
      </div>
      {viewer && <Lightbox url={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
