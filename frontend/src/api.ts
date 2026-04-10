import { API_BASE, LIVE_SESSION_TOKEN_KEY } from "./constants";

function authHeaders(): HeadersInit {
  if (typeof localStorage === "undefined") return {};
  const token = localStorage.getItem(LIVE_SESSION_TOKEN_KEY);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new Error(
      `No se pudo conectar con la API (${API_BASE}). Verifica VITE_API_BASE_URL y que el backend este activo con HTTPS.`,
    );
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Error de API");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export { API_BASE };
