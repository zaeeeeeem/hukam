// Fetch wrappers for the router API. Errors carry the router's own message so the UI can show it as is.
import type { GalleryItem, Health, HukamEvent, HukamState, Session, Settings, Keys, Fixed } from "./types";

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string>;
  constructor(message: string, status: number, errors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
  } catch {
    throw new ApiError("Hukam is not reachable. Is the router running (npm start)?", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || `Request failed (${res.status}).`, res.status, body.errors);
  return body as T;
}

export const api = {
  state: () => call<HukamState>("/api/state"),
  health: () => call<Health>("/api/health"),
  gallery: () => call<{ items: GalleryItem[] }>("/api/gallery"),
  events: () => call<{ events: HukamEvent[] }>("/api/events"),
  session: (name: string) => call<{ session: Session; events: HukamEvent[] }>(`/api/sessions/${encodeURIComponent(name)}`),
  terminal: (name: string) => call<{ text: string | null; error?: string }>(`/api/sessions/${encodeURIComponent(name)}/terminal`),
  command: (text: string, chat?: string) => call<{ ok: true; trace: string; chat: string }>("/api/command", { method: "POST", json: { text, chat } }),
  followUp: (name: string, text: string) => call<{ ok: true; trace: string }>(`/api/sessions/${encodeURIComponent(name)}/send`, { method: "POST", json: { text } }),
  stop: (name: string) => call<{ ok: true }>(`/api/sessions/${encodeURIComponent(name)}/stop`, { method: "POST", json: {} }),
  decide: (code: string, ok: boolean) => call<{ ok: true }>(`/api/approvals/${code}`, { method: "POST", json: { ok } }),
  saveSettings: (patch: Partial<Settings>) => call<{ settings: Settings; keys: Keys; fixed: Fixed }>("/api/settings", { method: "PUT", json: patch }),
  config: () => call<{ appId?: string; secret?: string; userId?: string }>("/config"),
};
