import type { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma.js";
import { getSharedBoardId } from "../config.js";
import { resolveSessionFromToken } from "../services/liveSession.js";

export async function loadLiveSession(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : undefined;
  if (token) {
    req.liveSession = await resolveSessionFromToken(token);
  }
  next();
}

export async function enforceSharedBoardApi(req: Request, res: Response, next: NextFunction) {
  const shared = getSharedBoardId();
  if (!shared) return next();

  let targetBoardId: string | null = null;
  const boardPath = /^\/boards\/([^/]+)/.exec(req.path);
  if (boardPath) targetBoardId = boardPath[1] ?? null;

  const objectPath = /^\/objects\/([^/]+)/.exec(req.path);
  if (objectPath) {
    const obj = await prisma.gameObject.findUnique({
      where: { id: objectPath[1]! },
      select: { boardId: true },
    });
    targetBoardId = obj?.boardId ?? null;
  }

  const equipPath = /^\/equipment-items\/([^/]+)/.exec(req.path);
  if (equipPath) {
    const eq = await prisma.equipmentItem.findUnique({
      where: { id: equipPath[1]! },
      select: { boardId: true },
    });
    targetBoardId = eq?.boardId ?? null;
  }

  if (!targetBoardId || targetBoardId !== shared) return next();

  if (!req.liveSession) {
    return res.status(401).json({ message: "Sesion requerida para el tablero compartido" });
  }
  if (!req.liveSession.displayNameSet) {
    return res.status(403).json({ message: "Asigna tu nombre de usuario para continuar" });
  }
  next();
}
