import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { USE_SHARED_ROOM } from "../constants";

type DevNote = {
  id: string;
  body: string;
  authorUsername: string | null;
  createdAt: string;
};

type LobbyMsg = {
  id: string;
  username: string;
  body: string;
  createdAt: string;
};

export function DevNotesPage() {
  const [notes, setNotes] = useState<DevNote[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lobbyMessages, setLobbyMessages] = useState<LobbyMsg[]>([]);
  const [lobbyBody, setLobbyBody] = useState("");
  const [lobbyError, setLobbyError] = useState("");
  const [lobbyBusy, setLobbyBusy] = useState(false);

  async function load() {
    try {
      const rows = await api<DevNote[]>("/api/dev-notes");
      setNotes(rows);
    } catch (e) {
      setError(String(e));
    }
  }

  async function loadLobby() {
    if (!USE_SHARED_ROOM) return;
    try {
      const rows = await api<LobbyMsg[]>("/api/lobby-dev-chat?limit=100");
      setLobbyMessages(rows);
      setLobbyError("");
    } catch (e) {
      setLobbyError(String(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!USE_SHARED_ROOM) return;
    void loadLobby();
    const t = setInterval(() => void loadLobby(), 8000);
    return () => clearInterval(t);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = body.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    try {
      await api<DevNote>("/api/dev-notes", {
        method: "POST",
        body: JSON.stringify({ body: t }),
      });
      setBody("");
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitLobby(e: FormEvent) {
    e.preventDefault();
    const t = lobbyBody.trim();
    if (!t) return;
    setLobbyBusy(true);
    setLobbyError("");
    try {
      await api<LobbyMsg>("/api/lobby-dev-chat", {
        method: "POST",
        body: JSON.stringify({ body: t }),
      });
      setLobbyBody("");
      await loadLobby();
    } catch (err) {
      setLobbyError(String(err));
    } finally {
      setLobbyBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>Notas de desarrollo</h1>
      <p className="muted">Feedback y comentarios para el equipo.</p>

      <form className="dev-notes-form" onSubmit={(e) => void submit(e)}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Escribe tu nota…"
          maxLength={8000}
        />
        <button type="submit" disabled={busy}>
          {busy ? "Enviando…" : "Publicar"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <ul className="dev-notes-list">
        {notes.map((n) => (
          <li key={n.id}>
            <div className="dev-note-meta">
              {n.authorUsername ?? "Anónimo"} · {new Date(n.createdAt).toLocaleString()}
            </div>
            <div className="dev-note-body">{n.body}</div>
          </li>
        ))}
      </ul>

      {USE_SHARED_ROOM ? (
        <section className="lobby-dev-chat">
          <h2>Chat entre partidas</h2>
          <p className="muted">
            Mensajes en el tablero compartido cuando no hay combate activo. También visible aquí para
            seguimiento.
          </p>
          <form className="dev-notes-form" onSubmit={(e) => void submitLobby(e)}>
            <textarea
              value={lobbyBody}
              onChange={(e) => setLobbyBody(e.target.value)}
              rows={3}
              placeholder="Mensaje para el chat entre partidas…"
              maxLength={2000}
            />
            <button type="submit" disabled={lobbyBusy}>
              {lobbyBusy ? "Enviando…" : "Enviar al chat entre partidas"}
            </button>
          </form>
          {lobbyError ? <p className="error">{lobbyError}</p> : null}
          <ul className="lobby-dev-chat__list">
            {lobbyMessages.map((m) => (
              <li key={m.id}>
                <span className="lobby-dev-chat__user">{m.username}:</span> {m.body}
                <span className="muted"> · {new Date(m.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
