import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { LIVE_SESSION_USERNAME_KEY } from "../constants";

type PresenceResponse = {
  usernames: string[];
  full: boolean;
};

type Props = {
  open: boolean;
  onComplete: (username: string) => void;
  onLeave?: () => void;
};

export function SessionNameModal({ open, onComplete, onLeave }: Props) {
  const [username, setUsername] = useState("");
  const [presence, setPresence] = useState<PresenceResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const p = await api<PresenceResponse>("/api/sessions/presence");
        setPresence(p);
      } catch {
        setPresence(null);
      }
    })();
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = username.trim();
    if (!t) return;
    setError("");
    setBusy(true);
    try {
      await api<{ ok: true }>("/api/sessions/me", {
        method: "PATCH",
        body: JSON.stringify({ username: t }),
      });
      localStorage.setItem(LIVE_SESSION_USERNAME_KEY, t);
      onComplete(t);
      setUsername("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="session-name-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="session-name-title">
      <div className="session-name-modal">
        <h1 id="session-name-title">Elige tu nombre</h1>
        <p className="muted">Necesitamos un nombre para la sala compartida (máx. 40 caracteres).</p>
        {presence?.usernames.length ? (
          <p className="session-name-modal__taken muted">
            Nombres en uso ahora: {presence.usernames.join(", ")}
          </p>
        ) : null}
        <form onSubmit={(e) => void submit(e)}>
          <label className="session-name-modal__label">
            Nombre de usuario
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={40}
              required
              autoComplete="username"
              autoFocus
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Continuar"}
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
        {onLeave ? (
          <p className="session-name-modal__leave">
            <button type="button" className="link-button" onClick={onLeave}>
              Volver al inicio (cerrar sesión)
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
