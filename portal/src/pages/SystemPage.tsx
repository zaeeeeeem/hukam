import { AlertOctagon, AudioLines, Check, Cpu, Globe, FileText, HeartPulse, MessageCircle, Radio, Server, TriangleAlert, Workflow, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "../components/shell/Shell";
import { EmptyState, InlineError, Mono, SectionCard, Skeleton, StatusPill, TimeAgo } from "../components/ui/primitives";
import { SURFACE } from "../components/ui/surface";
import { clock, duration, phone } from "../lib/format";
import { usePortal } from "../lib/store";
import type { Health } from "../lib/types";

type Check = { key: string; label: string; icon: LucideIcon; ok: boolean; warn?: boolean; status: string; rows: [string, ReactNode][] };

function checks(h: Health): Check[] {
  const g = h.gemma;
  const served = g.lastServed;
  return [
    {
      key: "whatsapp",
      label: "WhatsApp daemon",
      icon: MessageCircle,
      ok: h.whatsapp.connected,
      status: h.whatsapp.connected ? "Connected" : h.whatsapp.error ? "Unreachable" : "Disconnected",
      rows: [
        ["Paired number", h.whatsapp.phone ? <Mono>{phone(h.whatsapp.phone)}</Mono> : "Not paired"],
        ["Round trip", h.whatsapp.latencyMs != null ? <Mono>{duration(h.whatsapp.latencyMs)}</Mono> : "—"],
        ["Endpoint", <Mono className="truncate">{h.whatsapp.daemon}</Mono>],
        ...(h.whatsapp.error ? ([["Error", <span className="text-[#ff9a92]">{h.whatsapp.error}</span>]] as [string, ReactNode][]) : []),
      ],
    },
    {
      key: "gemma",
      label: "Gemma 4",
      icon: Cpu,
      ok: g.ok,
      warn: g.ok && !!g.backends.find((b) => b.lastErrorAt && (!b.lastOkAt || b.lastErrorAt > b.lastOkAt)),
      status: !g.ok ? "No backend configured" : served ? `Served by ${served.via === "vertex" ? "Vertex AI" : "Gemini API"}` : "Ready, no calls yet",
      rows: [
        ["Last answer", served ? <><Mono>{duration(served.ms)}</Mono> <TimeAgo at={served.at} className="text-white/40" /></> : "—"],
        ["Model", served ? <Mono>{served.model}</Mono> : "—"],
        ["Order", <span className="truncate" title={g.chain}>{g.backends.length ? `${g.backends.length} backends` : "none"}</span>],
      ],
    },
    {
      key: "superset",
      label: "Superset CLI",
      icon: Workflow,
      ok: h.superset.ok && h.superset.workspace,
      status: !h.superset.ok ? "Not found" : !h.superset.workspace ? "No workspace set" : "Ready",
      rows: [
        ["Version", h.superset.version ? <Mono>{h.superset.version}</Mono> : "—"],
        ["Workspace", h.superset.workspace ? "HUKAM_WORKSPACE set" : "HUKAM_WORKSPACE missing"],
        ...(h.superset.error ? ([["Error", <span className="text-[#ff9a92]">{h.superset.error}</span>]] as [string, ReactNode][]) : []),
      ],
    },
    {
      key: "whisper",
      label: "Whisper (voice)",
      icon: AudioLines,
      ok: h.whisper.ok || !h.whisper.enabled,
      warn: !h.whisper.enabled,
      status: !h.whisper.enabled ? "Turned off" : h.whisper.ok ? "Ready, on-device" : !h.whisper.binary ? "whisper-cli missing" : !h.whisper.modelExists ? "Model file missing" : "ffmpeg missing",
      rows: [
        ["Binary", h.whisper.binary ? <Mono className="truncate">{h.whisper.binary}</Mono> : "Not on PATH"],
        ["Model", <Mono className="truncate" title={h.whisper.model}>{h.whisper.model.split("/").pop()}</Mono>],
        ["ffmpeg", h.whisper.ffmpeg ? "Installed" : "Missing"],
      ],
    },
    {
      key: "chrome",
      label: "Chrome (previews)",
      icon: Globe,
      ok: h.chrome.ok,
      status: h.chrome.ok ? "Ready" : "Not found",
      rows: [["Path", <Mono className="truncate" title={h.chrome.path}>{h.chrome.path.split("/").slice(-1)[0]}</Mono>]],
    },
    {
      key: "pdf",
      label: "pdftotext (PDFs)",
      icon: FileText,
      ok: h.pdftotext.ok,
      status: h.pdftotext.ok ? "Ready" : "Not installed",
      rows: [["Used for", "Text of PDF briefs"]],
    },
    {
      key: "dnotifier",
      label: "DNotifier realtime",
      icon: Radio,
      ok: h.dnotifier.connected,
      warn: !h.dnotifier.configured,
      status: h.dnotifier.connected ? "Connected" : h.dnotifier.configured ? "Configured, not connected" : "Not configured · local stream",
      rows: [
        ["Portal events", h.dnotifier.connected ? "DNotifier + local stream" : "Local stream (SSE)"],
        ...(h.dnotifier.lastError ? ([["Error", <span className="text-[#ff9a92]">{h.dnotifier.lastError}</span>]] as [string, ReactNode][]) : []),
      ],
    },
    {
      key: "router",
      label: "Hukam router",
      icon: Server,
      ok: true,
      warn: !!h.router.poll.lastErrorAt && (!h.router.poll.lastOkAt || h.router.poll.lastErrorAt > h.router.poll.lastOkAt),
      status: `Up ${duration(h.router.uptimeMs)}`,
      rows: [
        ["Last poll", h.router.poll.lastOkAt ? <TimeAgo at={h.router.poll.lastOkAt} /> : "—"],
        ["Polls", <Mono>{(h.router.poll.polls ?? 0).toLocaleString()}</Mono>],
        ["Interval · PID", <Mono>{h.router.pollMs} ms · {h.router.pid}</Mono>],
      ],
    },
  ];
}

export function SystemPage() {
  const { health } = usePortal();
  const [h, setH] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pull = useCallback(
    () =>
      health()
        .then((x) => {
          setH(x);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [health],
  );
  useEffect(() => {
    pull();
    const id = setInterval(pull, 5000);
    return () => clearInterval(id);
  }, [pull]);

  const list = h ? checks(h) : [];
  const down = list.filter((c) => !c.ok);
  const warn = list.filter((c) => c.ok && c.warn);

  return (
    <div className="flex flex-col gap-3 pb-6">
      <PageHeader
        title="System"
        facts={
          h ? (
            <span className="flex items-center gap-1.5">
              {down.length ? <X className="size-3.5 text-[#ff8f86]" /> : <Check className="size-3.5 text-[#5fe0ad]" />}
              {down.length ? `${down.length} ${down.length === 1 ? "part needs" : "parts need"} attention` : "Every part is up"}
              {warn.length ? ` · ${warn.length} with a warning` : ""} · checked {clock(h.now)}
            </span>
          ) : null
        }
      />
      {error && <InlineError onRetry={pull}>Could not reach the router for a health check. {error}</InlineError>}

      {!h ? (
        <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-[22px]" />
          ))}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
            {list.map((c) => (
              <li key={c.key} className={`flex min-w-0 flex-col gap-3 rounded-[22px] p-4 ${SURFACE} ${!c.ok ? "border-st-danger/40" : ""}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70">
                    <c.icon className="size-4" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-white">{c.label}</p>
                    <p className={`truncate text-[12px] ${!c.ok ? "text-[#ff8f86]" : c.warn ? "text-[#ffa46b]" : "text-[#5fe0ad]"}`}>{c.status}</p>
                  </div>
                  {!c.ok ? (
                    <StatusPill tone="danger" icon={X} label="Down" size="sm" />
                  ) : c.warn ? (
                    <StatusPill tone="attention" icon={TriangleAlert} label="Check" size="sm" />
                  ) : (
                    <StatusPill tone="success" icon={Check} label="OK" size="sm" />
                  )}
                </div>
                <dl className="flex flex-col gap-1.5 border-t border-white/[0.06] pt-3 text-[12px]">
                  {c.rows.map(([k, v]) => (
                    <div key={k} className="flex min-w-0 items-baseline justify-between gap-3">
                      <dt className="shrink-0 text-white/40">{k}</dt>
                      <dd className="flex min-w-0 justify-end gap-1.5 text-right text-white/80">{v}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <SectionCard icon={Cpu} title="Gemma 4 backends" subtitle={h.gemma.chain} bodyClassName="p-0">
              {h.gemma.backends.length === 0 ? (
                <EmptyState icon={Cpu} title="No backend configured">
                  Set GEMINI_API_KEY or VERTEX_PROJECT in .env and restart. Until then the regex fallback handles “claude: …”, “@name …” and “list”.
                </EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-[12px]">
                    <thead>
                      <tr className="text-[11px] tracking-[0.06em] text-white/40 uppercase">
                        <th className="px-5 py-2.5 font-medium">Backend</th>
                        <th className="px-3 py-2.5 text-right font-medium">Calls</th>
                        <th className="px-3 py-2.5 text-right font-medium">Failed</th>
                        <th className="px-3 py-2.5 text-right font-medium">Last latency</th>
                        <th className="px-5 py-2.5 font-medium">Last result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h.gemma.backends.map((b, i) => {
                        const failing = b.lastErrorAt && (!b.lastOkAt || b.lastErrorAt > b.lastOkAt);
                        return (
                          <tr key={b.key} className="border-t border-white/[0.05] align-top">
                            <td className="px-5 py-3">
                              <span className="flex items-center gap-2">
                                <Mono className="text-white/35">{i + 1}</Mono>
                                <span>
                                  <span className="block text-[13px] text-white/85">{b.via === "vertex" ? "Vertex AI" : "Gemini API"}</span>
                                  <Mono className="block text-[11px] text-white/40">{b.model}</Mono>
                                </span>
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-white/75 tabular-nums">{b.calls}</td>
                            <td className={`px-3 py-3 text-right font-mono tabular-nums ${b.failures ? "text-[#ffa46b]" : "text-white/45"}`}>{b.failures}</td>
                            <td className="px-3 py-3 text-right font-mono text-white/75 tabular-nums">{b.lastMs != null ? duration(b.lastMs) : "—"}</td>
                            <td className="px-5 py-3">
                              {failing ? (
                                <span className="flex flex-col gap-0.5">
                                  <span className="text-[#ff9a92]">Failed <TimeAgo at={b.lastErrorAt} /></span>
                                  <span className="line-clamp-2 text-[11px] text-white/40" title={b.lastError ?? ""}>
                                    {b.lastError}
                                  </span>
                                </span>
                              ) : b.lastOkAt ? (
                                <span className="text-[#5fe0ad]">
                                  OK <TimeAgo at={b.lastOkAt} className="text-white/40" />
                                </span>
                              ) : (
                                <span className="text-white/35">Not used yet</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard icon={AlertOctagon} title="Recent errors" count={h.errors.length} bodyClassName="max-h-[420px] overflow-y-auto p-2">
              {h.errors.length === 0 ? (
                <EmptyState icon={HeartPulse} title="No errors since the router started" />
              ) : (
                <ol className="flex flex-col">
                  {h.errors.map((e, i) => (
                    <li key={i} className="flex min-w-0 gap-3 rounded-[10px] px-3 py-2 hover:bg-white/[0.03]">
                      <Mono className="w-[58px] shrink-0 pt-px text-[11px] text-white/35">{clock(e.at)}</Mono>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-white/75">{e.scope}</p>
                        <p className="line-clamp-2 text-[12px] leading-snug break-words text-white/50" title={e.message}>
                          {e.message}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
