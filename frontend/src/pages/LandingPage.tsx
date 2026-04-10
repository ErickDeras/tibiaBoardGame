import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  LIVE_SESSION_TOKEN_KEY,
  LIVE_SESSION_USERNAME_KEY,
  SHARED_BOARD_ID,
  USE_SHARED_ROOM,
} from "../constants";

type PresenceResponse = {
  usernames: string[];
  full: boolean;
  boardId: string | null;
};

export function LandingPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [presence, setPresence] = useState<PresenceResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);

  async function loadPresence() {
    try {
      const p = await api<PresenceResponse>("/api/sessions/presence");
      setPresence(p);
    } catch {
      setPresence(null);
    }
  }

  useEffect(() => {
    if (!USE_SHARED_ROOM) {
      navigate("/tablero", { replace: true });
      return;
    }
    void loadPresence();
    const t = setInterval(() => void loadPresence(), 5000);
    return () => clearInterval(t);
  }, [navigate]);

  async function handleBootstrap() {
    setError("");
    setBusy(true);
    try {
      const r = await api<{
        token: string;
        sessionId: string;
        boardId: string;
        needsUsername: boolean;
      }>("/api/sessions/bootstrap", { method: "POST", body: "{}" });
      localStorage.setItem(LIVE_SESSION_TOKEN_KEY, r.token);
      localStorage.removeItem(LIVE_SESSION_USERNAME_KEY);
      navigate("/tablero", { replace: true });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await api<{
        token: string;
        sessionId: string;
        boardId: string;
        needsUsername?: boolean;
      }>("/api/sessions/join", {
        method: "POST",
        body: JSON.stringify({ username: username.trim() }),
      });
      localStorage.setItem(LIVE_SESSION_TOKEN_KEY, r.token);
      localStorage.setItem(LIVE_SESSION_USERNAME_KEY, username.trim());
      navigate("/tablero", { replace: true });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!USE_SHARED_ROOM) return null;

  return (
    <div className="page landing-page">
      <h1>Entrar a la sala</h1>
      <p className="muted">
        Tablero compartido <code>{SHARED_BOARD_ID || "(sin id)"}</code>. Máximo 4 usuarios con nombre
        asignado.
      </p>

      {presence ? (
        <section className="landing-presence">
          <h2>En la sala ahora</h2>
          {presence.usernames.length === 0 ? (
            <p>Nadie conectado todavía.</p>
          ) : (
            <ul>
              {presence.usernames.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          )}
          {presence.full ? (
            <p className="error">
              La sala está llena. Solo puedes ver la lista; no es posible unirse hasta que haya cupo.
            </p>
          ) : null}
        </section>
      ) : (
        <p>Cargando estado de la sala…</p>
      )}

      {presence?.full ? null : (
        <div className="landing-actions">
          <button type="button" className="landing-primary" disabled={busy} onClick={() => void handleBootstrap()}>
            {busy && !showJoinForm ? "Entrando…" : "Entrar a la sala"}
          </button>
          <p className="muted landing-actions__hint">
            Tras entrar te pediremos el nombre en una ventana emergente.
          </p>
          <button
            type="button"
            className="link-button landing-toggle"
            onClick={() => setShowJoinForm((v) => !v)}
          >
            {showJoinForm ? "Ocultar" : "Unirse con nombre ahora (atajo)"}
          </button>
          {showJoinForm ? (
            <form className="landing-form" onSubmit={(e) => void handleJoin(e)}>
              <label>
                Nombre de usuario
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={40}
                  required
                  autoComplete="username"
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? "Entrando…" : "Entrar al tablero"}
              </button>
            </form>
          ) : null}
        </div>
      )}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
