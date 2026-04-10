import { useCallback, useEffect, useRef } from "react";
import { LIVE_SESSION_TOKEN_KEY } from "../constants";
import { buildWebSocketUrl } from "../lib/wsUrl";

export type PresenceEntry = {
  sessionId: string;
  username: string;
  playerObjectId: string | null;
  characterName: string | null;
};

export type ChatEntry = {
  id: string;
  label: string;
  body: string;
  createdAt: string;
};

export function useSharedRoomRealtime(
  enabled: boolean,
  boardId: string | undefined,
  onBoardRefresh: () => void,
  onCombatRefresh: () => void,
  setPresence: ((p: PresenceEntry[]) => void) | undefined,
  appendChat: (c: ChatEntry) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);

  const sendChat = useCallback((body: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "room_chat", body }));
    }
  }, []);

  useEffect(() => {
    if (!enabled || !boardId) return;
    const token = localStorage.getItem(LIVE_SESSION_TOKEN_KEY);
    if (!token) return;

    const ws = new WebSocket(buildWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        if (msg.type === "auth_ok") return;
        if (msg.type === "error") return;
        if (msg.type === "presence" && setPresence && Array.isArray(msg.sessions)) {
          setPresence(msg.sessions as PresenceEntry[]);
          return;
        }
        if (msg.type === "board:refresh" && msg.boardId === boardId) {
          onBoardRefresh();
          return;
        }
        if (msg.type === "combat:update" && msg.boardId === boardId) {
          void onCombatRefresh();
          onBoardRefresh();
          return;
        }
        if (
          (msg.type === "room_chat" || msg.type === "chat") &&
          typeof msg.id === "string"
        ) {
          const uname = String(msg.username ?? "");
          appendChat({
            id: msg.id,
            label: uname ? `${uname}:` : "",
            body: String(msg.body ?? ""),
            createdAt: String(msg.createdAt ?? ""),
          });
        }
      } catch {
        //
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [enabled, boardId, onBoardRefresh, onCombatRefresh, setPresence, appendChat]);

  return { sendChat };
}
