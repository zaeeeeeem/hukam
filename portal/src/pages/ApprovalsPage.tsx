import { Check, History, Laptop, MessageCircle, ShieldAlert, ShieldCheck, Users, X } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/shell/Shell";
import { AgentAvatar, Chip, EmptyState, InlineError, Mono, SectionCard, Skeleton, StatusPill, TimeAgo } from "../components/ui/primitives";
import { DANGER_SM, PRIMARY_SM } from "../components/ui/surface";
import { dateTime, duration } from "../lib/format";
import { Link } from "../lib/router";
import { usePortal } from "../lib/store";
import type { PendingApproval } from "../lib/types";
import { actionLabel, agentMeta, RISK_CATEGORY } from "../lib/vocab";

export function ApprovalsPage() {
  const { state, load, error, refresh } = usePortal();
  const pending = state?.approvals.pending ?? [];
  const history = state?.approvals.history ?? [];
  const gate = state?.settings.risk.gate ?? true;

  return (
    <div className="flex flex-col gap-3 pb-6">
      <PageHeader
        title="Approvals"
        facts={
          state ? (
            <span>
              {pending.length ? `${pending.length} waiting for you` : "Nothing waiting"} · {history.length} decided · risk gate {gate ? "on" : "off"}
            </span>
          ) : null
        }
      />
      {!gate && state && (
        <InlineError>
          The risk gate is off: Gemma still rates tasks, but nothing waits for approval. Turn it back on in <Link to="/settings" className="underline underline-offset-2">Settings</Link>.
        </InlineError>
      )}
      {load === "error" && !state && <InlineError onRetry={refresh}>Could not load approvals. {error}</InlineError>}

      <SectionCard icon={ShieldAlert} title="Waiting for you" subtitle="Gemma flagged these as risky. Nothing runs until you approve, here or with “yes <code>” on WhatsApp." count={pending.length} bodyClassName="p-3">
        {load === "loading" ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : pending.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nothing waiting">
            Tasks that could push, deploy, delete, touch secrets, message other people or spend money wait here for your decision.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(520px,1fr))] gap-3">
            {pending.map((p) => (
              <PendingCard key={p.code} p={p} />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard icon={History} title="Decisions" count={history.length} bodyClassName="p-0">
        {history.length === 0 ? (
          <EmptyState icon={History} title="No decisions yet">
            Every approve and cancel is recorded here with who asked, why it was flagged and how long it waited.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-left text-[13px]">
              <colgroup>
                <col className="w-[13%]" />
                <col />
                <col className="w-[17%]" />
                <col className="w-[17%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead>
                <tr className="text-[11px] tracking-[0.06em] text-white/40 uppercase">
                  <th className="px-5 py-2.5 font-medium">Decision</th>
                  <th className="px-3 py-2.5 font-medium">Task</th>
                  <th className="px-3 py-2.5 font-medium">Category</th>
                  <th className="px-3 py-2.5 font-medium">Asked by</th>
                  <th className="px-5 py-2.5 text-right font-medium">Decided</th>
                </tr>
              </thead>
              <tbody>
                {history.map((d) => (
                  <tr key={d.code + d.at} className="border-t border-white/[0.05] align-top">
                    <td className="px-5 py-3">
                      {d.ok ? <StatusPill tone="success" icon={Check} label="Approved" size="sm" /> : <StatusPill tone="muted" icon={X} label="Cancelled" size="sm" />}
                    </td>
                    <td className="px-3 py-3">
                      <p className="line-clamp-2 leading-snug text-white/80" title={d.prompt}>
                        {d.prompt}
                      </p>
                      {d.reason && <p className="mt-0.5 line-clamp-1 text-[12px] text-white/40">{d.reason}</p>}
                    </td>
                    <td className="px-3 py-3 text-white/65">{d.category ? (RISK_CATEGORY[d.category]?.label ?? d.category) : "—"}</td>
                    <td className="px-3 py-3 text-white/65">
                      <span className="block truncate">{d.from ?? "Owner"}</span>
                      <span className="block truncate text-[11px] text-white/35">{d.chat === "DM" || !d.chat ? "Owner DM" : d.chat}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-[12px] text-white/55">
                      <span className="block whitespace-nowrap">{dateTime(d.at)}</span>
                      <span className="flex items-center justify-end gap-1 text-[11px] whitespace-nowrap text-white/35">
                        {d.via === "portal" ? <Laptop className="size-3" /> : <MessageCircle className="size-3" />}
                        {d.via === "portal" ? "portal" : "WhatsApp"}
                        {d.askedAt ? ` · waited ${duration(d.at - d.askedAt)}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function PendingCard({ p }: { p: PendingApproval }) {
  const { decide } = usePortal();
  const [busy, setBusy] = useState<null | "yes" | "no">(null);
  const cat = p.category ? RISK_CATEGORY[p.category] : null;
  return (
    <article className="flex flex-col gap-3.5 rounded-[18px] border border-st-attention/30 bg-st-attention/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="attention" icon={ShieldAlert} label={cat ? cat.label : "High risk"} size="sm" title={cat?.hint} />
        <Chip>
          code <Mono className="text-white">{p.code}</Mono>
        </Chip>
        <span className="ml-auto text-[12px] text-white/45">
          asked <TimeAgo at={p.at} />
        </span>
      </div>
      <p className="text-[15px] leading-relaxed text-white">“{p.prompt}”</p>
      {p.reason && (
        <p className="text-[13px] leading-relaxed text-white/60">
          <span className="text-white/40">Why Gemma flagged it: </span>
          {p.reason}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/55">
        <span className="flex items-center gap-1.5">
          {p.chat !== "DM" ? <Users className="size-3.5" /> : <MessageCircle className="size-3.5" />}
          {p.chat === "DM" ? "Owner DM" : p.chat}
        </span>
        {p.from && <span>· from {p.from}</span>}
        <span className="flex items-center gap-1.5">
          · would {actionLabel(p.action).toLowerCase()}
          {p.agent && (
            <>
              <AgentAvatar agent={p.agent} size={18} />
              {agentMeta(p.agent).short}
            </>
          )}
          {p.session && <Mono className="text-white/70">{p.session}</Mono>}
        </span>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-st-attention/15 pt-3">
        <button
          type="button"
          className={DANGER_SM}
          disabled={!!busy}
          onClick={async () => {
            setBusy("no");
            await decide(p.code, false);
            setBusy(null);
          }}
        >
          <X className="size-3.5" />
          {busy === "no" ? "Cancelling…" : "Cancel task"}
        </button>
        <button
          type="button"
          className={PRIMARY_SM}
          disabled={!!busy}
          onClick={async () => {
            setBusy("yes");
            await decide(p.code, true);
            setBusy(null);
          }}
        >
          <Check className="size-3.5" />
          {busy === "yes" ? "Approving…" : "Approve and run"}
        </button>
      </div>
    </article>
  );
}
