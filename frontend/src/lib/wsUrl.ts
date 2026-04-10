import { API_BASE } from "../constants";

/** URL del WebSocket del backend (mismo host que la API, path `/ws`). */
export function buildWebSocketUrl(): string {
  const explicit = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (explicit) {
    const base = explicit.replace(/\/+$/, "");
    return base.endsWith("/ws") ? base : `${base}/ws`;
  }
  const normalized = API_BASE.replace(/\/+$/, "");
  const u = new URL(normalized.includes("://") ? normalized : `http://${normalized}`);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return `${u.origin}/ws`;
}
