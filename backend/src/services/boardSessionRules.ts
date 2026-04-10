import { prisma } from "../prisma.js";
import { getSharedBoardId } from "../config.js";

export function isSharedBoard(boardId: string): boolean {
  const s = getSharedBoardId();
  return s != null && s === boardId;
}

export async function sessionHasPlayerObject(sessionId: string): Promise<boolean> {
  const n = await prisma.gameObject.count({
    where: { ownerSessionId: sessionId, objectKind: "PLAYER" },
  });
  return n > 0;
}
