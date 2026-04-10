import { useCallback, useMemo } from "react";
import { api } from "../api";
import { normalizeGameObject } from "../model";
import type { CombatSession, GameObject, Profession } from "../types";

export function basicKindForProfession(p: Profession | null): "melee" | "distance" | "magic" {
  if (p === "paladin") return "distance";
  if (p === "mago" || p === "druida") return "magic";
  return "melee";
}

export type PlayerTurnSubmitBody = {
  moves: { x: number; y: number }[];
  basicAttack: { kind: "melee" | "distance" | "magic"; targetId: string } | null;
  cardAction: { cardId: string; targetId: string } | null;
};

export type CombatPlayerTurnApi = {
  submitPlayerTurn: (body: PlayerTurnSubmitBody) => Promise<void>;
  step: (dx: number, dy: number) => void;
  chainCreatureTurns: (initialObjects: GameObject[]) => Promise<void>;
  isPlayerTurn: boolean;
  actorForCards: GameObject | undefined;
  basicKind: "melee" | "distance" | "magic";
  current: GameObject | undefined;
};

type Args = {
  boardId: string;
  session: CombatSession | null;
  objects: GameObject[];
  selectedObjectId: string;
  setCombatBusy: (v: boolean) => void;
  onObjectsUpdate: (objects: GameObject[]) => void;
  onRefreshCombat: () => Promise<void>;
  onError: (msg: string) => void;
};

export function useCombatPlayerTurn({
  boardId,
  session,
  objects,
  selectedObjectId,
  setCombatBusy,
  onObjectsUpdate,
  onRefreshCombat,
  onError,
}: Args): CombatPlayerTurnApi {
  const active = session?.status === "ACTIVE";
  const current = useMemo(
    () => objects.find((o) => o.id === session?.currentActorId),
    [objects, session?.currentActorId],
  );

  const chainCreatureTurns = useCallback(
    async (initialObjects: GameObject[]) => {
      if (!boardId) return;
      let curObjs = initialObjects;
      for (let guard = 0; guard < 24; guard++) {
        const s = (await api<{ session: CombatSession | null }>(`/boards/${boardId}/combat`)).session;
        if (!s || s.status !== "ACTIVE") break;
        const actor = curObjs.find((o) => o.id === s.currentActorId);
        if (!actor || actor.objectKind !== "CREATURE") break;
        const r = await api<{ objects: GameObject[] }>(`/boards/${boardId}/combat/turn/creature`, {
          method: "POST",
          body: JSON.stringify({ actorId: actor.id }),
        });
        curObjs = r.objects.map(normalizeGameObject);
        onObjectsUpdate(curObjs);
        await onRefreshCombat();
      }
    },
    [boardId, onObjectsUpdate, onRefreshCombat],
  );

  const submitPlayerTurn = useCallback(
    async (body: PlayerTurnSubmitBody) => {
      if (!boardId || !session?.currentActorId) return;
      setCombatBusy(true);
      try {
        const r = await api<{ objects: GameObject[] }>(`/boards/${boardId}/combat/turn/player`, {
          method: "POST",
          body: JSON.stringify({ actorId: session.currentActorId, ...body }),
        });
        const norm = r.objects.map(normalizeGameObject);
        onObjectsUpdate(norm);
        await onRefreshCombat();
        await chainCreatureTurns(norm);
      } catch (e) {
        onError(String(e));
      } finally {
        setCombatBusy(false);
      }
    },
    [
      boardId,
      session?.currentActorId,
      setCombatBusy,
      onObjectsUpdate,
      onRefreshCombat,
      onError,
      chainCreatureTurns,
    ],
  );

  const step = useCallback(
    (dx: number, dy: number) => {
      if (!session?.currentActorId) return;
      const a = objects.find((o) => o.id === session.currentActorId);
      if (!a) return;
      const nx = a.x + dx;
      const ny = a.y + dy;
      if (nx < 0 || nx > 11 || ny < 0 || ny > 11) return;
      void submitPlayerTurn({
        moves: [{ x: nx, y: ny }],
        basicAttack: null,
        cardAction: null,
      });
    },
    [session?.currentActorId, objects, submitPlayerTurn],
  );

  const isPlayerTurn =
    Boolean(active && session?.currentActorId === selectedObjectId && current?.objectKind === "PLAYER");
  const actorForCards = isPlayerTurn ? current : undefined;
  const basicKind = basicKindForProfession(actorForCards?.profession ?? null);

  return {
    submitPlayerTurn,
    step,
    chainCreatureTurns,
    isPlayerTurn,
    actorForCards,
    basicKind,
    current,
  };
}
