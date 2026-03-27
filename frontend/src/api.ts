import { API_BASE } from "./constants";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
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
