import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  Cpu,
  Eye,
  ImageIcon,
  KeyRound,
  MessageCircle,
  Plus,
  RotateCcw,
  Server,
  ShieldCheck,
  Smile,
  TriangleAlert,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "../components/shell/Shell";
import { Field, INPUT, InlineError, Mono, SectionCard, Segmented, Skeleton, StatusPill, Toggle } from "../components/ui/primitives";
import { PILL_SM_BUTTON, PRIMARY, PILL_BUTTON, TAG } from "../components/ui/surface";
import { phone } from "../lib/format";
import { usePortal } from "../lib/store";
import type { AgentKind, Settings } from "../lib/types";
import { agentMeta, RISK_CATEGORY } from "../lib/vocab";

const LIVE = (
  <span className={`${TAG} border-st-success/30 bg-st-success/10 text-[#5fe0ad]`} title="Applies the moment you save. No restart.">
    <Zap className="size-3" />
    Applies live
  </span>
);
const RESTART = (
  <span className={`${TAG} border-st-attention/30 bg-st-attention/10 text-[#ffa46b]`} title="Set in .env, then restart the router (npm start).">
    <RotateCcw className="size-3" />
    Requires restart
  </span>
);

export function SettingsPage() {
  const { state, load, error, refresh, saveSettings, toast } = usePortal();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Start from the router's settings; keep local edits until saved or discarded.
  useEffect(() => {
    if (state && !draft) setDraft(structuredClone(state.settings));
  }, [state, draft]);

  const changed = useMemo(() => {
    if (!state || !draft) return [] as (keyof Settings)[];
    return (Object.keys(draft) as (keyof Settings)[]).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(state.settings[k]));
  }, [state, draft]);

  if (load === "error" && !state) return <InlineError onRetry={refresh}>Could not load settings. {error}</InlineError>;
  if (!state || !draft) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Settings" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-[22px]" />
        ))}
      </div>
    );
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setDraft({ ...draft, [k]: v });
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([p]) => p.split(".")[0] !== k)));
  };
  const err = (path: string) => errors[path] ?? Object.entries(errors).find(([p]) => p.startsWith(`${path}.`))?.[1];

  async function save() {
    if (!draft || !changed.length) return;
    setSaving(true);
    const patch = Object.fromEntries(changed.map((k) => [k, draft[k]])) as Partial<Settings>;
    const r = await saveSettings(patch);
    setSaving(false);
    if (r.ok) {
      setErrors({});
      setDraft(null); // re-seed from the router's saved copy
      toast("Settings saved. Hukam is using them now.", "success");
    } else {
      setErrors(r.errors ?? { _: r.error });
      toast(r.error, "danger");
    }
  }

  const groupName = (jid: string) => state.chats.find((c) => c.id === jid)?.label;

  return (
    <div className="flex flex-col gap-3 pb-28">
      <PageHeader title="Settings" facts={<span>Saved to .hukam-settings.json · read live by the router · secrets stay in .env</span>} />
      {errors._ && <InlineError>{errors._}</InlineError>}

      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
        <SectionCard icon={Users} title="Who can command Hukam" action={LIVE}>
          <div className="flex flex-col gap-5">
            <Field label="Allowed numbers" hint="1:1 chats Hukam reads. Country code first, digits only. Everyone else is ignored." error={err("allow")}>
              <ListEditor
                items={draft.allow}
                onChange={(v) => set("allow", v)}
                placeholder="923001234567"
                validate={(v) => (/^\d{8,15}$/.test(v) ? null : "8 to 15 digits, no + or spaces.")}
                render={(v) => (
                  <>
                    <span className="text-white/85 tabular-nums">{phone(v)}</span>
                    {v === draft.owner && <span className="text-[11px] text-[#ffb685]">owner</span>}
                  </>
                )}
              />
            </Field>
            <Field label="Groups" hint="Any member can start or follow up on agents. Approvals and stop stay with the owner." error={err("groups")}>
              <ListEditor
                items={draft.groups}
                onChange={(v) => set("groups", v)}
                placeholder="120363414024669346@g.us"
                validate={(v) => (/^\d{5,30}(-\d{5,15})?@g\.us$/.test(v) ? null : "Group IDs end in @g.us.")}
                render={(v) => (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-white/85">{groupName(v) ?? "Name loads after the next group refresh"}</span>
                    <Mono className="truncate text-[11px] text-white/40">{v}</Mono>
                  </span>
                )}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Owner number" htmlFor="owner" hint="Approves risky tasks and stops agents." error={err("owner")}>
                <input id="owner" className={INPUT} value={draft.owner} inputMode="numeric" onChange={(e) => set("owner", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Owner LID" htmlFor="owner-lid" hint="How the owner appears in “lid” groups." error={err("ownerLid")}>
                <input id="owner-lid" className={INPUT} value={draft.ownerLid} inputMode="numeric" onChange={(e) => set("ownerLid", e.target.value.replace(/\D/g, ""))} />
              </Field>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Bot} title="Agents" action={LIVE}>
          <div className="flex flex-col gap-5">
            <Field label="Default agent" hint="Used when a message doesn't name one.">
              <Segmented
                label="Default agent"
                value={draft.defaultAgent}
                onChange={(v) => set("defaultAgent", v as AgentKind)}
                options={state.options.agents.map((a) => ({ value: a, label: agentMeta(a).label }))}
              />
            </Field>
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-medium text-white/85">Model per agent</p>
              {state.options.agents.map((a) => (
                <div key={a} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
                  <label htmlFor={`model-${a}`} className="text-[13px] text-white/60">
                    {agentMeta(a).label}
                  </label>
                  <input
                    id={`model-${a}`}
                    className={INPUT}
                    value={draft.models[a] ?? ""}
                    placeholder="Agent default"
                    onChange={(e) => set("models", { ...draft.models, [a]: e.target.value })}
                  />
                </div>
              ))}
              {err("models") ? <p className="text-[12px] text-[#ff9a92]">{err("models")}</p> : <p className="text-[12px] text-white/40">Passed to Superset as --model, e.g. sonnet or opus. Empty uses the agent's own default.</p>}
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Cpu} title="Gemma 4" action={LIVE}>
          <div className="flex flex-col gap-5">
            <Field label="Backends, in order" hint="Each gets two tries (rate limits are common), then the next. If all fail, a strict regex parser keeps commands working." error={err("gemma")}>
              <ul className="flex flex-col gap-1.5">
                {draft.gemma.backends.map((b, i) => {
                  const configured = b === "gemini-api" ? state.keys.gemini : state.keys.vertex;
                  return (
                    <li key={b} className="flex min-h-11 items-center gap-3 rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                      <Mono className="w-5 text-[12px] text-white/40">{i + 1}</Mono>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-white/85">{b === "gemini-api" ? "Gemini API" : "Vertex AI"}</span>
                        <span className="block text-[11px] text-white/40">{b === "gemini-api" ? "GEMINI_API_KEY" : "VERTEX_PROJECT + gcloud login"}</span>
                      </span>
                      <KeyBadge ok={configured} />
                      <div className="flex items-center gap-1">
                        <IconBtn label="Move up" disabled={i === 0} onClick={() => set("gemma", { ...draft.gemma, backends: move(draft.gemma.backends, i, -1) })}>
                          <ArrowUp className="size-3.5" />
                        </IconBtn>
                        <IconBtn label="Move down" disabled={i === draft.gemma.backends.length - 1} onClick={() => set("gemma", { ...draft.gemma, backends: move(draft.gemma.backends, i, 1) })}>
                          <ArrowDown className="size-3.5" />
                        </IconBtn>
                        <IconBtn label="Remove" disabled={draft.gemma.backends.length === 1} onClick={() => set("gemma", { ...draft.gemma, backends: draft.gemma.backends.filter((x) => x !== b) })}>
                          <X className="size-3.5" />
                        </IconBtn>
                      </div>
                    </li>
                  );
                })}
                {state.options.backends
                  .filter((b) => !draft.gemma.backends.includes(b))
                  .map((b) => (
                    <li key={b}>
                      <button type="button" className={PILL_SM_BUTTON} onClick={() => set("gemma", { ...draft.gemma, backends: [...draft.gemma.backends, b] })}>
                        <Plus className="size-3.5" />
                        Add {b === "gemini-api" ? "Gemini API" : "Vertex AI"}
                      </button>
                    </li>
                  ))}
              </ul>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Model" htmlFor="gemma-model" error={err("gemma.model")}>
                <input id="gemma-model" className={INPUT} value={draft.gemma.model} onChange={(e) => set("gemma", { ...draft.gemma, model: e.target.value.trim() })} />
              </Field>
              <Field label="Fallback model" htmlFor="gemma-fallback" hint="Gemini API only, tried after the first model." error={err("gemma.fallbackModel")}>
                <input id="gemma-fallback" className={INPUT} value={draft.gemma.fallbackModel} onChange={(e) => set("gemma", { ...draft.gemma, fallbackModel: e.target.value.trim() })} />
              </Field>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={ShieldCheck} title="Risk gate" action={LIVE}>
          <div className="flex flex-col gap-4">
            <Row title="Hold risky tasks for the owner" hint="Gemma rates every task. High-risk ones wait for “yes <code>” on WhatsApp or Approve here.">
              <Toggle label="Risk gate" checked={draft.risk.gate} onChange={(v) => set("risk", { ...draft.risk, gate: v })} />
            </Row>
            {!draft.risk.gate && (
              <p className="flex items-start gap-2 rounded-[12px] border border-st-danger/30 bg-st-danger/[0.07] px-3 py-2.5 text-[12px] leading-relaxed text-[#ff9a92]">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                With the gate off, anyone allowed (including group members) can make an agent push, deploy or touch secrets without asking you.
              </p>
            )}
            <fieldset disabled={!draft.risk.gate} className="flex flex-col gap-1 disabled:opacity-45">
              <legend className="mb-2 text-[13px] font-medium text-white/85">Ask before</legend>
              {state.options.riskCategories.map((c) => {
                const on = draft.risk.categories[c] !== false;
                return (
                  <label key={c} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-[10px] px-2 transition-colors hover:bg-white/[0.03]">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => set("risk", { ...draft.risk, categories: { ...draft.risk.categories, [c]: e.target.checked } })}
                      className="size-4 shrink-0 accent-[#1f77f6]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-white/85">{RISK_CATEGORY[c]?.label ?? c}</span>
                      <span className="block truncate text-[11px] text-white/40">{RISK_CATEGORY[c]?.hint}</span>
                    </span>
                    {c === "secrets" && !on && <span className="shrink-0 text-[11px] text-[#ff9a92]">not recommended</span>}
                  </label>
                );
              })}
              <p className="mt-1 px-2 text-[11px] text-white/35">Anything Gemma can't place in a category is always held.</p>
            </fieldset>
          </div>
        </SectionCard>

        <SectionCard icon={MessageCircle} title="On WhatsApp" action={LIVE}>
          <div className="flex flex-col gap-5">
            <Field label="Acknowledgement emoji" hint="Hukam reacts to each message with one of these, at random, the moment it reads it." error={err("acks")}>
              <EmojiEditor items={draft.acks} onChange={(v) => set("acks", v)} />
            </Field>
            <Field label="Poll interval" htmlFor="poll" hint="How often Hukam checks WhatsApp. Lower is snappier; 2000 ms is a good balance." error={err("pollMs")}>
              <div className="flex items-center gap-2">
                <input id="poll" type="number" min={500} max={30000} step={250} className={`${INPUT} w-32 font-mono`} value={draft.pollMs} onChange={(e) => set("pollMs", Number(e.target.value))} />
                <span className="text-[13px] text-white/45">ms</span>
              </div>
            </Field>
          </div>
        </SectionCard>

        <SectionCard icon={Smile} title="Inputs" action={LIVE}>
          <div className="flex flex-col gap-4">
            <Row title="Voice notes" hint="Transcribed on this machine with whisper.cpp. Audio never leaves it.">
              <Toggle label="Voice notes" checked={draft.voice.enabled} onChange={(v) => set("voice", { ...draft.voice, enabled: v })} />
            </Row>
            <Field label="Whisper model" htmlFor="whisper" hint="Absolute path to a ggml .bin model." error={err("voice.whisperModel")}>
              <input id="whisper" className={`${INPUT} font-mono text-[12px]`} disabled={!draft.voice.enabled} value={draft.voice.whisperModel} onChange={(e) => set("voice", { ...draft.voice, whisperModel: e.target.value })} />
            </Field>
            <div className="h-px bg-white/[0.06]" />
            <Row title="Photos and PDFs" hint="Saved into the agent workspace inbox/ and shown to Gemma 4 vision.">
              <Toggle label="Photos and PDFs" checked={draft.attachments.enabled} onChange={(v) => set("attachments", { ...draft.attachments, enabled: v })} />
            </Row>
            <Field label="Largest file" htmlFor="max-mb" error={err("attachments.maxMb")}>
              <div className="flex items-center gap-2">
                <input id="max-mb" type="number" min={1} max={16} className={`${INPUT} w-24 font-mono`} disabled={!draft.attachments.enabled} value={draft.attachments.maxMb} onChange={(e) => set("attachments", { ...draft.attachments, maxMb: Number(e.target.value) })} />
                <span className="text-[13px] text-white/45">MB</span>
              </div>
            </Field>
          </div>
        </SectionCard>

        <SectionCard icon={ImageIcon} title="Outputs" action={LIVE}>
          <div className="flex flex-col gap-4">
            <Row title="Live preview" hint="After an agent changes the page, send a headless Chrome screenshot of it to the chat." icon={Eye}>
              <Toggle label="Live preview" checked={draft.preview.enabled} onChange={(v) => set("preview", { enabled: v })} />
            </Row>
            <Row title="Return images agents make" hint="Images saved under outputs/ go back to the chat that started the session." icon={ImageIcon}>
              <Toggle label="Return images" checked={draft.artifacts.enabled} onChange={(v) => set("artifacts", { enabled: v })} />
            </Row>
          </div>
        </SectionCard>

        <SectionCard icon={Server} title="Environment" action={RESTART}>
          <dl className="flex flex-col">
            <EnvRow label="Portal port" value={<Mono>{state.fixed.dashboardPort}</Mono>} env="DASHBOARD_PORT" />
            <EnvRow label="WhatsApp daemon" value={<Mono className="truncate">{state.fixed.daemon}</Mono>} env="WA_DAEMON" />
            <EnvRow label="Superset workspace" value={<KeyBadge ok={state.keys.workspace} />} env="HUKAM_WORKSPACE" />
            <EnvRow label="Gemini API key" value={<KeyBadge ok={state.keys.gemini} />} env="GEMINI_API_KEY" />
            <EnvRow label="Vertex AI project" value={<KeyBadge ok={state.keys.vertex} />} env="VERTEX_PROJECT" />
            <EnvRow
              label="DNotifier realtime"
              value={
                state.dnotifier.connected ? (
                  <StatusPill tone="success" icon={Check} label="Connected" size="sm" />
                ) : state.keys.dnotifier ? (
                  <StatusPill tone="attention" icon={TriangleAlert} label="Configured, not connected" size="sm" />
                ) : (
                  <KeyBadge ok={false} />
                )
              }
              env="DNOTIFIER_APP_ID, DNOTIFIER_SECRET"
            />
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-white/40">
            <KeyRound className="size-3.5" />
            Secret values are never sent to the portal, only whether they are set.
          </p>
        </SectionCard>
      </div>

      <AnimatePresence>
        {changed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="sticky bottom-3 z-20 mx-auto flex w-full max-w-[720px] items-center gap-3 rounded-full border border-white/15 bg-[#0f1013]/95 py-2 pr-2 pl-5 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
            role="region"
            aria-label="Unsaved changes"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] text-white/75">
              {changed.length} unsaved {changed.length === 1 ? "change" : "changes"}
              {Object.keys(errors).length > 0 && <span className="text-[#ff9a92]"> · fix the highlighted fields</span>}
            </span>
            <button type="button" className={PILL_BUTTON} onClick={() => (setDraft(structuredClone(state.settings)), setErrors({}))}>
              Discard
            </button>
            <button type="button" className={PRIMARY} disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const move = <T,>(a: T[], i: number, d: number) => {
  const b = [...a];
  [b[i], b[i + d]] = [b[i + d], b[i]];
  return b;
};

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex size-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-25">
      {children}
    </button>
  );
}

function KeyBadge({ ok }: { ok: boolean }) {
  return ok ? <StatusPill tone="success" icon={Check} label="Configured" size="sm" /> : <StatusPill tone="muted" icon={X} label="Not set" size="sm" />;
}

function Row({ title, hint, children, icon: Icon }: { title: string; hint: string; children: ReactNode; icon?: typeof Eye }) {
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/85">
          {Icon && <Icon className="size-3.5 text-white/45" />}
          {title}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">{hint}</p>
      </div>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

function EnvRow({ label, value, env }: { label: string; value: ReactNode; env: string }) {
  return (
    <div className="flex min-h-12 items-center gap-4 border-b border-white/[0.05] py-2 last:border-b-0">
      <dt className="min-w-0 flex-1">
        <span className="block text-[13px] text-white/80">{label}</span>
        <Mono className="block truncate text-[11px] text-white/35">{env}</Mono>
      </dt>
      <dd className="flex min-w-0 shrink-0 justify-end text-[12px] text-white/70">{value}</dd>
    </div>
  );
}

function ListEditor({ items, onChange, placeholder, validate, render }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; validate: (v: string) => string | null; render: (v: string) => ReactNode }) {
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const add = () => {
    const v = value.trim().replace(/^\+/, "").replace(/\s+/g, "");
    if (!v) return;
    const p = items.includes(v) ? "Already in the list." : validate(v);
    if (p) return setProblem(p);
    onChange([...items, v]);
    setValue("");
    setProblem(null);
  };
  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((it) => (
            <li key={it} className="flex min-h-10 items-center gap-3 rounded-[12px] border border-white/[0.08] bg-white/[0.03] py-1.5 pr-1.5 pl-3 text-[13px]">
              <span className="flex min-w-0 flex-1 items-center gap-2">{render(it)}</span>
              <IconBtn label={`Remove ${it}`} onClick={() => onChange(items.filter((x) => x !== it))}>
                <X className="size-3.5" />
              </IconBtn>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          className={`${INPUT} font-mono text-[12px]`}
          value={value}
          placeholder={placeholder}
          aria-label={`Add ${placeholder.includes("@") ? "group ID" : "number"}`}
          onChange={(e) => (setValue(e.target.value), setProblem(null))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className={PILL_SM_BUTTON} onClick={add} disabled={!value.trim()}>
          <Plus className="size-3.5" />
          Add
        </button>
      </div>
      {problem && <p className="text-[12px] text-[#ff9a92]">{problem}</p>}
    </div>
  );
}

function EmojiEditor({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const [value, setValue] = useState("");
  const add = () => {
    const parts = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value.trim())].map((s) => s.segment).filter((s) => s.trim() && !/[\w\s]/.test(s));
    if (!parts.length) return;
    onChange([...new Set([...items, ...parts])].slice(0, 20));
    setValue("");
  };
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-1.5">
        {items.map((e) => (
          <li key={e}>
            <button
              type="button"
              disabled={items.length === 1}
              onClick={() => onChange(items.filter((x) => x !== e))}
              aria-label={`Remove ${e}`}
              title="Remove"
              className="group relative flex size-9 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.03] text-[18px] transition-colors hover:border-st-danger/40 hover:bg-st-danger/10 disabled:pointer-events-none"
            >
              {e}
              <X className="absolute -top-1 -right-1 size-3.5 rounded-full bg-[#1a1b1f] p-0.5 text-white/70 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input className={`${INPUT} w-40`} value={value} placeholder="Paste emoji" aria-label="Add emoji" onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        <button type="button" className={PILL_SM_BUTTON} onClick={add} disabled={!value.trim()}>
          <Plus className="size-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
