import type { ObjectKind } from "@prisma/client";

type PosObj = {
  id: string;
  x: number;
  y: number;
  hitpoints: number;
  objectKind: ObjectKind;
  defenseValue: number;
};

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Criatura elige jugador vivo: más cercano, empate menor HP, empate id lex. */
export function pickCreatureTarget(players: PosObj[], from: { x: number; y: number }): PosObj | null {
  const alive = players.filter((p) => p.hitpoints > 0 && p.objectKind === "PLAYER");
  if (alive.length === 0) return null;
  return alive.reduce((best, p) => {
    const db = manhattan(from, best);
    const dp = manhattan(from, p);
    if (dp < db) return p;
    if (dp > db) return best;
    if (p.hitpoints < best.hitpoints) return p;
    if (p.hitpoints > best.hitpoints) return best;
    return p.id < best.id ? p : best;
  });
}
