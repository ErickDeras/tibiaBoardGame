export function parseStringArray(j: unknown): string[] {
  if (!Array.isArray(j)) return [];
  return j.filter((x): x is string => typeof x === "string");
}

export type ActorTurnStateJson = {
  moveCount: number;
  forfeitedAttacks: boolean;
  basicUsed: boolean;
  cardUsed: boolean;
};

export function parseActorTurnState(j: unknown): ActorTurnStateJson {
  if (!j || typeof j !== "object") {
    return { moveCount: 0, forfeitedAttacks: false, basicUsed: false, cardUsed: false };
  }
  const o = j as Record<string, unknown>;
  return {
    moveCount: typeof o.moveCount === "number" ? o.moveCount : 0,
    forfeitedAttacks: Boolean(o.forfeitedAttacks),
    basicUsed: Boolean(o.basicUsed),
    cardUsed: Boolean(o.cardUsed),
  };
}
