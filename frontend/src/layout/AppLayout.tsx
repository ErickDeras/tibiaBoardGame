import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api";
import { SessionNameModal } from "../components/SessionNameModal";
import {
  LIVE_SESSION_TOKEN_KEY,
  LIVE_SESSION_USERNAME_KEY,
  USE_SHARED_ROOM,
} from "../constants";

type SessionMe = {
  sessionId: string;
  username: string;
  displayNameSet: boolean;
  needsUsername: boolean;
};

type PresenceResponse = {
  usernames: string[];
  full: boolean;
};

export function AppLayout() {
  const navigate = useNavigate();
  const [me, setMe] = useState<SessionMe | null>(null);
  const [meLoading, setMeLoading] = useState(USE_SHARED_ROOM);
  const [presence, setPresence] = useState<PresenceResponse | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem(LIVE_SESSION_TOKEN_KEY);
    localStorage.removeItem(LIVE_SESSION_USERNAME_KEY);
    setMe(null);
    setShowNameModal(false);
    window.location.href = "/";
  }, []);

  const loadMe = useCallback(async () => {
    if (!USE_SHARED_ROOM) {
      setMeLoading(false);
      return;
    }
    const token = localStorage.getItem(LIVE_SESSION_TOKEN_KEY);
    if (!token) {
      setMe(null);
      setMeLoading(false);
      setShowNameModal(false);
      return;
    }
    setMeLoading(true);
    try {
      const m = await api<SessionMe>("/api/sessions/me");
      setMe(m);
      if (m.displayNameSet) {
        localStorage.setItem(LIVE_SESSION_USERNAME_KEY, m.username);
        setShowNameModal(false);
      } else {
        localStorage.removeItem(LIVE_SESSION_USERNAME_KEY);
        setShowNameModal(true);
      }
    } catch {
      localStorage.removeItem(LIVE_SESSION_TOKEN_KEY);
      localStorage.removeItem(LIVE_SESSION_USERNAME_KEY);
      setMe(null);
      setShowNameModal(false);
      navigate("/", { replace: true });
    } finally {
      setMeLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (!USE_SHARED_ROOM) return;
    const token = localStorage.getItem(LIVE_SESSION_TOKEN_KEY);
    if (!token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!USE_SHARED_ROOM) return;
    async function poll() {
      try {
        const p = await api<PresenceResponse>("/api/sessions/presence");
        setPresence(p);
      } catch {
        setPresence(null);
      }
    }
    void poll();
    const t = setInterval(() => void poll(), 4000);
    return () => clearInterval(t);
  }, []);

  function handleNameComplete(_username: string) {
    setShowNameModal(false);
    void loadMe();
  }

  const displayUsername =
    me?.displayNameSet && me.username
      ? me.username
      : (typeof localStorage !== "undefined" && localStorage.getItem(LIVE_SESSION_USERNAME_KEY)) ||
        null;

  const blockOutlet = USE_SHARED_ROOM && (meLoading || showNameModal);

  return (
    <div className="app-shell">
      <header className="app-nav">
        <div className="app-nav__inner">
          <nav className="app-nav__links">
            {USE_SHARED_ROOM ? (
              <>
                <Link to="/tablero">Tablero</Link>
                <Link to="/dev-notes">Notas dev</Link>
                <Link to="/match-history">Historial</Link>
              </>
            ) : (
              <>
                <Link to="/">Tablero</Link>
                <Link to="/dev-notes">Notas dev</Link>
                <Link to="/match-history">Historial</Link>
              </>
            )}
          </nav>
          {USE_SHARED_ROOM ? (
            <div className="app-nav__presence" aria-label="Usuarios activos en la sala">
              {!presence ? (
                <span className="muted">Sala…</span>
              ) : presence.usernames.length === 0 ? (
                <span className="muted">Nadie conectado</span>
              ) : (
                presence.usernames.map((u) => (
                  <span key={u} className="nav-presence-chip">
                    {u}
                  </span>
                ))
              )}
            </div>
          ) : (
            <div />
          )}
          <div className="app-nav__user">
            {USE_SHARED_ROOM ? (
              <>
                {displayUsername ? (
                  <span className="app-nav__username" title="Tu sesión">
                    {displayUsername}
                  </span>
                ) : meLoading ? (
                  <span className="muted">Sesión…</span>
                ) : null}
                <button type="button" className="link-button" onClick={logout}>
                  Salir
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <div className={`app-outlet${blockOutlet ? " app-outlet--blocked" : ""}`}>
        <Outlet />
      </div>
      <SessionNameModal open={showNameModal} onComplete={handleNameComplete} onLeave={logout} />
    </div>
  );
}
