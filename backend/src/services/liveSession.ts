import crypto from "crypto";
import type { GameObject, LiveSession } from "@prisma/client";
import { prisma } from "../prisma.js";
import {
  getSharedBoardId,
  LIVE_SESSION_WINDOW_MS,
  MAX_LIVE_SESSIONS,
} from "../config.js";

/** Prefijo de username hasta que el usuario elija nombre en el modal. */
export const PENDING_USERNAME_PREFIX = "__pending_";

export function isPendingDisplayName(username: string): boolean {
  return username.startsWith(PENDING_USERNAME_PREFIX);
}

export type LiveSessionWithPlayer = LiveSession & {
  ownedPlayer: Pick<GameObject, "id" | "name" | "boardId"> | null;
};

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function activeNamedSessionWhere() {
  const cutoff = new Date(Date.now() - LIVE_SESSION_WINDOW_MS);
  return {
    lastSeenAt: { gte: cutoff },
    displayNameSet: true,
  } as const;
}

export async function countActiveNamedSessions(): Promise<number> {
  return prisma.liveSession.count({
    where: activeNamedSessionWhere(),
  });
}

export async function bootstrapLiveSession(): Promise<
  | { ok: true; token: string; sessionId: string; boardId: string; needsUsername: true }
  | { error: string }
> {
  const boardId = getSharedBoardId();
  if (!boardId) return { error: "Sala no configurada (SHARED_BOARD_ID)" };
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return { error: "Tablero compartido no encontrado" };

  if ((await countActiveNamedSessions()) >= MAX_LIVE_SESSIONS) {
    return { error: "Sala llena (maximo 4 usuarios)" };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const pendingName = `${PENDING_USERNAME_PREFIX}${crypto.randomBytes(8).toString("hex")}`;
  const session = await prisma.liveSession.create({
    data: {
      tokenHash,
      username: pendingName,
      displayNameSet: false,
      lastSeenAt: new Date(),
    },
  });
  return {
    ok: true,
    token,
    sessionId: session.id,
    boardId,
    needsUsername: true,
  };
}

export async function patchSessionUsername(
  sessionId: string,
  username: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = username.trim().slice(0, 40);
  if (!trimmed) return { error: "Nombre de usuario requerido" };
  if (isPendingDisplayName(trimmed)) {
    return { error: "Nombre no valido" };
  }

  const existing = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!existing) return { error: "Sesion no encontrada" };
  if (existing.displayNameSet) return { error: "El nombre ya fue asignado" };

  const cutoff = new Date(Date.now() - LIVE_SESSION_WINDOW_MS);
  const namedOthers = await prisma.liveSession.findMany({
    where: {
      id: { not: sessionId },
      lastSeenAt: { gte: cutoff },
      displayNameSet: true,
    },
    select: { username: true },
  });
  if (namedOthers.some((s) => s.username.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "Ese nombre ya esta en uso en la sala" };
  }

  if ((await countActiveNamedSessions()) >= MAX_LIVE_SESSIONS) {
    return { error: "Sala llena (maximo 4 usuarios)" };
  }

  await prisma.liveSession.update({
    where: { id: sessionId },
    data: { username: trimmed, displayNameSet: true, lastSeenAt: new Date() },
  });
  return { ok: true };
}

export async function joinLiveSession(
  username: string,
): Promise<
  | { ok: true; token: string; sessionId: string; boardId: string }
  | { error: string }
> {
  const boardId = getSharedBoardId();
  if (!boardId) return { error: "Sala no configurada (SHARED_BOARD_ID)" };
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return { error: "Tablero compartido no encontrado" };

  const trimmed = username.trim().slice(0, 40);
  if (!trimmed) return { error: "Nombre de usuario requerido" };

  if ((await countActiveNamedSessions()) >= MAX_LIVE_SESSIONS) {
    return { error: "Sala llena (maximo 4 usuarios)" };
  }
  const cutoff = new Date(Date.now() - LIVE_SESSION_WINDOW_MS);
  const activeNamed = await prisma.liveSession.findMany({
    where: activeNamedSessionWhere(),
    select: { username: true },
  });
  if (activeNamed.some((s) => s.username.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "Ese nombre ya esta en uso en la sala" };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const session = await prisma.liveSession.create({
    data: {
      tokenHash,
      username: trimmed,
      displayNameSet: true,
      lastSeenAt: new Date(),
    },
  });
  return { ok: true, token, sessionId: session.id, boardId };
}

export async function getPublicPresence(): Promise<{
  usernames: string[];
  full: boolean;
  boardId: string | null;
}> {
  const boardId = getSharedBoardId();
  if (!boardId) return { usernames: [], full: false, boardId: null };
  const rows = await prisma.liveSession.findMany({
    where: activeNamedSessionWhere(),
    orderBy: { username: "asc" },
    select: { username: true },
  });
  const usernames = rows.map((r) => r.username);
  return {
    usernames,
    full: usernames.length >= MAX_LIVE_SESSIONS,
    boardId,
  };
}

export async function resolveSessionFromToken(
  token: string | undefined,
): Promise<LiveSessionWithPlayer | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = await prisma.liveSession.findUnique({
    where: { tokenHash },
    include: {
      ownedPlayer: { select: { id: true, name: true, boardId: true } },
    },
  });
  if (!row) return null;
  await prisma.liveSession.update({
    where: { id: row.id },
    data: { lastSeenAt: new Date() },
  });
  return row;
}

export async function buildPresencePayload(): Promise<{
  type: "presence";
  sessions: {
    sessionId: string;
    username: string;
    playerObjectId: string | null;
    characterName: string | null;
  }[];
}> {
  const rows = await prisma.liveSession.findMany({
    where: activeNamedSessionWhere(),
    orderBy: { username: "asc" },
    include: {
      ownedPlayer: { select: { id: true, name: true } },
    },
  });
  return {
    type: "presence",
    sessions: rows.map((r) => ({
      sessionId: r.id,
      username: r.username,
      playerObjectId: r.ownedPlayer?.id ?? null,
      characterName: r.ownedPlayer?.name ?? null,
    })),
  };
}
