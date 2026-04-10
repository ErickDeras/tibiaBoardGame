import { useEffect, useState } from "react";
import { api } from "../api";

type LogRow = {
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type ConvoRow = {
  id: string;
  username: string;
  body: string;
  createdAt: string;
  characterName?: string | null;
};

type MatchArchive = {
  id: string;
  boardId: string;
  endedAt: string;
  entries: LogRow[];
  conversationLog?: unknown;
  board: { name: string };
};

export function MatchHistoryPage() {
  const [matches, setMatches] = useState<MatchArchive[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const list = await api<MatchArchive[]>("/api/match-history?limit=30");
        setMatches(list);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  function formatEntry(row: LogRow): string {
    const p = row.payload;
    const u = (p.actorUsername as string | null | undefined) ?? null;
    const c = (p.actorCharacterName as string | null | undefined) ?? null;
    const who =
      u != null || c != null
        ? `${u ?? "?"}${c ? ` — personaje: ${c}` : ""}`
        : null;
    const base = `${row.type} @ ${row.createdAt}`;
    return who ? `${base} · ${who}` : base;
  }

  function parseConversation(m: MatchArchive): ConvoRow[] {
    const raw = m.conversationLog;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (x): x is ConvoRow =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as ConvoRow).id === "string" &&
        typeof (x as ConvoRow).username === "string" &&
        typeof (x as ConvoRow).body === "string",
    );
  }

  return (
    <div className="page">
      <h1>Historial de partidas</h1>
      <p className="muted">
        Partidas terminadas: log de combate y conversación de sala (lobby + partida) archivada al terminar.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <ul className="match-history">
        {matches.map((m) => (
          <li key={m.id} className="match-history__item">
            <button
              type="button"
              className="match-history__toggle"
              onClick={() => setOpenId((id) => (id === m.id ? null : m.id))}
            >
              {m.board.name} — {new Date(m.endedAt).toLocaleString()} (
              {Array.isArray(m.entries) ? m.entries.length : 0} eventos)
            </button>
            {openId === m.id ? (
              <>
                <h3 className="match-history__sub">Combate</h3>
                <ol className="match-history__log">
                  {(Array.isArray(m.entries) ? m.entries : []).map((e, i) => (
                    <li key={`${m.id}-c-${i}`}>
                      <pre className="match-history__pre">{formatEntry(e)}</pre>
                      <code className="match-history__payload">
                        {JSON.stringify(e.payload, null, 0)}
                      </code>
                    </li>
                  ))}
                </ol>
                <h3 className="match-history__sub">Conversación</h3>
                {parseConversation(m).length === 0 ? (
                  <p className="muted">Sin mensajes archivados en esta partida.</p>
                ) : (
                  <ul className="match-history__convo">
                    {parseConversation(m).map((c) => (
                      <li key={c.id}>
                        <span className="match-history__convo-user">{c.username}:</span>{" "}
                        <span className="match-history__convo-body">{c.body}</span>
                        <span className="match-history__convo-time muted">
                          {" "}
                          ({new Date(c.createdAt).toLocaleString()})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
