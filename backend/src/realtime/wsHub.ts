import type { Server } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { prisma } from "../prisma.js";
import { resolveSessionFromToken } from "../services/liveSession.js";
import { buildPresencePayload } from "../services/liveSession.js";
import { getSharedBoardId } from "../config.js";
import { boardHasActiveCombat } from "../services/combatActions.js";
type SocketClient = {
  ws: WebSocket;
  sessionId: string;
};

const clients = new Set<SocketClient>();

async function broadcastPresenceToAll() {
  const payload = JSON.stringify(await buildPresencePayload());
  for (const c of clients) {
    try {
      if (c.ws.readyState === 1) c.ws.send(payload);
    } catch {
      //
    }
  }
}

export function attachWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    let client: SocketClient | null = null;

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          token?: string;
          body?: string;
        };
        if (msg.type === "auth" && msg.token) {
          const session = await resolveSessionFromToken(msg.token.trim());
          const shared = getSharedBoardId();
          if (!session || !shared) {
            ws.send(JSON.stringify({ type: "error", message: "Sesion invalida" }));
            ws.close();
            return;
          }
          if (session.ownedPlayer && session.ownedPlayer.boardId !== shared) {
            ws.send(JSON.stringify({ type: "error", message: "Sesion invalida" }));
            ws.close();
            return;
          }
          client = { ws, sessionId: session.id };
          clients.add(client);
          ws.send(JSON.stringify({ type: "auth_ok" }));
          await broadcastPresenceToAll();
          return;
        }

        const chatKind =
          msg.type === "room_chat" || msg.type === "chat"
            ? "room"
            : msg.type === "lobby_dev_chat"
              ? "lobby"
              : null;
        if (chatKind && client) {
          const body = String(msg.body ?? "").trim().slice(0, 2000);
          if (!body) return;

          const fresh = await prisma.liveSession.findUnique({
            where: { id: client.sessionId },
            include: { ownedPlayer: { select: { name: true } } },
          });
          if (!fresh || !fresh.displayNameSet) return;

          const shared = getSharedBoardId();
          if (!shared) return;

          if (chatKind === "lobby") {
            if (await boardHasActiveCombat(shared)) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "El chat entre partidas no esta disponible durante el combate",
                }),
              );
              return;
            }
            const row = await prisma.lobbyDevChatMessage.create({
              data: {
                boardId: shared,
                liveSessionId: fresh.id,
                username: fresh.username,
                body,
              },
            });
            const out = JSON.stringify({
              type: "lobby_dev_chat",
              id: row.id,
              username: row.username,
              body: row.body,
              createdAt: row.createdAt.toISOString(),
            });
            for (const c of clients) {
              try {
                if (c.ws.readyState === 1) c.ws.send(out);
              } catch {
                //
              }
            }
            return;
          }

          const charName = fresh.ownedPlayer?.name ?? null;
          const row = await prisma.roomChatMessage.create({
            data: {
              boardId: shared,
              liveSessionId: fresh.id,
              username: fresh.username,
              characterName: charName,
              body,
            },
          });
          const label = charName
            ? `${row.username} (${charName})`
            : `${row.username} (Observador)`;
          const out = JSON.stringify({
            type: "room_chat",
            id: row.id,
            username: row.username,
            characterName: charName,
            body: row.body,
            createdAt: row.createdAt.toISOString(),
            label,
          });
          for (const c of clients) {
            try {
              if (c.ws.readyState === 1) c.ws.send(out);
            } catch {
              //
            }
          }
        }
      } catch {
        //
      }
    });

    ws.on("close", () => {
      if (client) {
        clients.delete(client);
        void broadcastPresenceToAll();
      }
    });
  });
}

export function notifyBoardRefresh(boardId: string) {
  const msg = JSON.stringify({ type: "board:refresh", boardId });
  for (const c of clients) {
    try {
      if (c.ws.readyState === 1) c.ws.send(msg);
    } catch {
      //
    }
  }
}

export function notifyCombatUpdate(boardId: string) {
  const msg = JSON.stringify({ type: "combat:update", boardId });
  for (const c of clients) {
    try {
      if (c.ws.readyState === 1) c.ws.send(msg);
    } catch {
      //
    }
  }
}

export async function notifyPresenceUpdate() {
  await broadcastPresenceToAll();
}

export function broadcastLobbyDevChatRow(row: {
  id: string;
  username: string;
  body: string;
  createdAt: Date;
}) {
  const out = JSON.stringify({
    type: "lobby_dev_chat",
    id: row.id,
    username: row.username,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  });
  for (const c of clients) {
    try {
      if (c.ws.readyState === 1) c.ws.send(out);
    } catch {
      //
    }
  }
}
