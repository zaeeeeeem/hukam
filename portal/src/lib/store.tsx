// Portal data: router state (polled + refreshed on events), the live event stream (SSE, plus DNotifier when the
// router has it configured), and the owner's actions. In demo mode the same interface is backed by DemoEngine.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import { DemoEngine } from "./demo";
import { buildTraces, type Trace } from "./traces";
import type { GalleryItem, Health, HukamEvent, HukamState, Settings } from "./types";

export type Live = "connecting" | "sse" | "dnotifier" | "offline" | "demo";
export type Load = "loading" | "ready" | "error";

type Toast = { id: number; tone: "success" | "danger" | "neutral"; text: string };

type Store = {
  demo: boolean;
  state: HukamState | null;
  load: Load;
  error: string | null;
  events: HukamEvent[];
  traces: Trace[];
  live: Live;
  refresh: () => void;
  command: (text: string, chat?: string) => Promise<string | null>;
  followUp: (name: string, text: string) => Promise<boolean>;
  stop: (name: string) => Promise<boolean>;
  decide: (code: string, ok: boolean) => Promise<boolean>;
  saveSettings: (patch: Partial<Settings>) => Promise<{ ok: true } | { ok: false; error: string; errors?: Record<string, string> }>;
  health: () => Promise<Health>;
  gallery: () => Promise<GalleryItem[]>;
  terminal: (name: string) => Promise<{ text: string | null; error?: string }>;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
};

const Ctx = createContext<Store | null>(null);

export const usePortal = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortal outside PortalProvider");
  return v;
};

const REFRESH_ON = new Set(["spawn", "status", "done", "gate", "approval", "settings", "artifact", "preview", "awaiting", "send", "inbound", "ready"]);

export function PortalProvider({ children }: { children: ReactNode }) {
  const demo = useMemo(() => new URLSearchParams(window.location.search).has("demo"), []);
  const engine = useMemo(() => (demo ? new DemoEngine() : null), [demo]);
  const [state, setState] = useState<HukamState | null>(engine ? engine.state : null);
  const [load, setLoad] = useState<Load>(engine ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<HukamEvent[]>(engine ? engine.events : []);
  const [live, setLive] = useState<Live>(engine ? "demo" : "connecting");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string, tone: Toast["tone"] = "neutral") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // --- demo -------------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!engine) return;
    const off = engine.subscribe(() => {
      setState({ ...engine.state });
      setEvents(engine.events);
    });
    engine.start();
    return () => {
      off();
      engine.stop();
    };
  }, [engine]);

  // --- live: state ------------------------------------------------------------------------------------------
  const inflight = useRef(false);
  const refresh = useCallback(() => {
    if (engine || inflight.current) return;
    inflight.current = true;
    api
      .state()
      .then((s) => {
        setState(s);
        setLoad("ready");
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoad((l) => (l === "ready" ? "ready" : "error"));
      })
      .finally(() => (inflight.current = false));
  }, [engine]);

  useEffect(() => {
    if (engine) return;
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [engine, refresh]);

  // --- live: events -----------------------------------------------------------------------------------------
  const seen = useRef(new Set<number>());
  const pending = useRef<HukamEvent[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ingest = useCallback(
    (e: HukamEvent) => {
      if (!e || typeof e.id !== "number" || seen.current.has(e.id)) return;
      seen.current.add(e.id);
      pending.current.push(e);
      // Batch bursts (history replay sends hundreds at once) into one render.
      if (!flushTimer.current)
        flushTimer.current = setTimeout(() => {
          flushTimer.current = null;
          const batch = pending.current;
          pending.current = [];
          setEvents((prev) => [...prev, ...batch].sort((a, b) => a.id - b.id).slice(-600));
        }, 60);
      if (REFRESH_ON.has(e.type)) {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(refresh, 350);
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (engine) return;
    let dnotifierUp = false;
    const es = new EventSource("/events");
    es.onopen = () => setLive((l) => (dnotifierUp ? "dnotifier" : l === "dnotifier" ? l : "sse"));
    es.onerror = () => setLive(dnotifierUp ? "dnotifier" : "offline");
    es.onmessage = (m) => {
      try {
        ingest(JSON.parse(m.data));
      } catch {}
    };

    // DNotifier realtime when the router has it configured; SSE stays on as history + fallback, deduped by id.
    let notifier: { disconnect?: () => void } | null = null;
    let cancelled = false;
    api
      .config()
      .then(async (cfg) => {
        if (!cfg.appId || !cfg.secret || cancelled) return;
        const { DNotifier } = await import("@dnotifier-realtime/dnotifier");
        const n = new DNotifier({
          appId: cfg.appId,
          secret: cfg.secret,
          transport: "ws",
          userId: cfg.userId,
          onConnected: () => {
            dnotifierUp = true;
            setLive("dnotifier");
          },
          onDisconnected: () => {
            dnotifierUp = false;
            setLive(es.readyState === EventSource.OPEN ? "sse" : "offline");
          },
          onMessage: (msg: unknown) => {
            const m = msg as { payload?: { toJSON?: () => unknown } } | undefined;
            const data = (m?.payload?.toJSON?.() ?? m?.payload ?? msg) as { event?: HukamEvent; data?: { event?: HukamEvent } };
            const event = data?.event ?? data?.data?.event;
            if (event) ingest({ ...event, via: "dnotifier" });
          },
        } as never);
        notifier = n as unknown as { disconnect?: () => void };
        await n.connect();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      es.close();
      notifier?.disconnect?.();
    };
  }, [engine, ingest]);

  const traces = useMemo(() => buildTraces(events), [events]);

  // --- actions ----------------------------------------------------------------------------------------------
  const report = useCallback(
    (err: unknown) => {
      toast(err instanceof Error ? err.message : "Something went wrong.", "danger");
      return false as const;
    },
    [toast],
  );

  const command = useCallback(
    async (text: string, chat?: string) => {
      if (engine) return engine.command(text, chat);
      try {
        const r = await api.command(text, chat);
        return r.trace;
      } catch (err) {
        report(err);
        return null;
      }
    },
    [engine, report],
  );

  const followUp = useCallback(
    async (name: string, text: string) => {
      if (engine) {
        engine.followUp(name, text);
        toast(`Sent to ${name}.`, "success");
        return true;
      }
      try {
        await api.followUp(name, text);
        toast(`Sent to ${name}.`, "success");
        return true;
      } catch (err) {
        return report(err);
      }
    },
    [engine, report, toast],
  );

  const stop = useCallback(
    async (name: string) => {
      if (engine) {
        engine.stopSession(name);
        toast(`Stopped ${name}.`, "neutral");
        return true;
      }
      try {
        await api.stop(name);
        toast(`Stopped ${name}.`, "neutral");
        refresh();
        return true;
      } catch (err) {
        return report(err);
      }
    },
    [engine, refresh, report, toast],
  );

  const decide = useCallback(
    async (code: string, ok: boolean) => {
      if (engine) {
        engine.decide(code, ok);
        toast(ok ? "Approved. The task is running." : "Cancelled. Nothing ran.", ok ? "success" : "neutral");
        return true;
      }
      try {
        await api.decide(code, ok);
        toast(ok ? "Approved. The task is running." : "Cancelled. Nothing ran.", ok ? "success" : "neutral");
        refresh();
        return true;
      } catch (err) {
        return report(err);
      }
    },
    [engine, refresh, report, toast],
  );

  const saveSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (engine) {
        engine.saveSettings(patch);
        return { ok: true as const };
      }
      try {
        const r = await api.saveSettings(patch);
        setState((s) => (s ? { ...s, settings: r.settings, keys: r.keys, fixed: r.fixed } : s));
        return { ok: true as const };
      } catch (err) {
        if (err instanceof ApiError) return { ok: false as const, error: err.message, errors: err.errors };
        return { ok: false as const, error: "Could not save settings." };
      }
    },
    [engine],
  );

  const health = useCallback(async () => (engine ? engine.health() : api.health()), [engine]);
  const gallery = useCallback(async () => (engine ? engine.galleryItems() : (await api.gallery()).items), [engine]);
  const terminal = useCallback(
    async (name: string) => (engine ? { text: engine.terminal(name) } : api.terminal(name).catch((e: Error) => ({ text: null, error: e.message }))),
    [engine],
  );

  const value: Store = {
    demo,
    state,
    load,
    error,
    events,
    traces,
    live,
    refresh,
    command,
    followUp,
    stop,
    decide,
    saveSettings,
    health,
    gallery,
    terminal,
    toasts,
    toast,
    dismiss,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Re-renders every `ms` so relative times stay fresh. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useMediaQuery(query: string) {
  const [on, setOn] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setOn(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return on;
}
