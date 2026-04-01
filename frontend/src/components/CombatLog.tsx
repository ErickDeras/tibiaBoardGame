import type { CombatLogEntry } from "../types";

function formatLine(e: CombatLogEntry): string {
  const p = e.payload;
  switch (e.type) {
    case "COMBAT_START":
      return `[Inicio] Orden: ${String((p.turnOrder as string[])?.length ?? 0)} actores`;
    case "COMBAT_END":
      return `[Fin] ${String(p.reason ?? "")}`;
    case "BASIC_ATTACK":
      return `[Ataque basico ${String(p.kind ?? "")}] ${String(p.attackerId)} (${pos(p.attackerPos)}) → ${String(p.targetId)} (${pos(p.targetPos)}) atk ${String(p.attackValue)} def ${String(p.defenseValue)} daño ${String(p.damage)} HP ${String(p.hpBefore)}→${String(p.hpAfter)}`;
    case "SPELL_ATTACK":
      return `[Hechizo ataque ${String(p.category ?? "")}] ${String(p.cardName ?? "")} mana ${String(p.manaCost ?? 0)} poder ${String(p.attackValue)} ${String(p.attackerId)} (${pos(p.attackerPos)}) → ${String(p.targetId)} (${pos(p.targetPos)}) daño ${String(p.damage)} HP ${String(p.hpBefore)}→${String(p.hpAfter)}`;
    case "SPELL_HEALING":
      return `[Curacion] ${String(p.cardName ?? "")} mana ${String(p.manaCost ?? 0)} ${String(p.targetId)} HP ${String(p.hpBefore)}→${String(p.hpAfter)}`;
    case "CREATURE_ATTACK":
    case "CREATURE_ABILITY": {
      const hpB = p.targetHpBefore ?? p.hpBefore;
      const hpA = p.targetHpAfter ?? p.hpAfter;
      const manaSpent = Number(p.creatureManaSpent ?? p.manaCost ?? 0);
      const manaNote =
        e.type === "CREATURE_ABILITY" && manaSpent > 0
          ? ` (la criatura gastó ${manaSpent} de su maná en la habilidad)`
          : "";
      return `[Criatura ${e.type === "CREATURE_ABILITY" ? "habilidad" : "ataque"}] ${String(p.attackerId)} (${pos(p.attackerPos)}) → ${String(p.targetId)} (${pos(p.targetPos)}) atk ${String(p.attackValue)} def ${String(p.defenseValue)} daño a HP del jugador ${String(p.damage)} [HP ${String(hpB)}→${String(hpA)}]${manaNote}`;
    }
    case "CREATURE_ELIMINATED":
    case "KILL_EXPERIENCE": {
      const cname = p.eliminatedCreatureName ?? p.creatureName;
      const cid = p.eliminatedCreatureId ?? p.creatureId;
      const killerLabel = p.killerName ? String(p.killerName) : String(p.killerId ?? "?");
      const lv =
        p.killerNewExperienceLevel != null
          ? ` | jugador nivel ${String(p.killerNewExperienceLevel)}, XP ${String(p.killerExperiencePoints ?? "")}`
          : "";
      return `[Criatura eliminada] ${String(cname ?? cid)} — eliminador: ${killerLabel}, +${String(p.experienceGained ?? 0)} XP${lv}`;
    }
    case "COMBAT_MOVE":
      return `[Movimiento] ${String(p.actorId)} ${pos(p.from)} → ${pos(p.to)}`;
    case "CREATURE_SKIP":
      return `[Criatura] Sin accion: ${String(p.reason ?? "")}`;
    default:
      return `[${e.type}] ${JSON.stringify(p)}`;
  }
}

function pos(v: unknown): string {
  if (!v || typeof v !== "object") return "?";
  const o = v as { x?: number; y?: number };
  return `${o.x ?? "?"},${o.y ?? "?"}`;
}

type Props = {
  entries: CombatLogEntry[] | undefined;
};

export function CombatLog({ entries }: Props) {
  const list = entries ?? [];
  return (
    <div className="combatLog">
      <h3>Registro de combate</h3>
      <div className="combatLogScroll" role="log">
        {list.length === 0 ? (
          <p className="muted">Sin eventos aun.</p>
        ) : (
          list.map((e) => (
            <div key={e.id} className="combatLogLine">
              <time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleTimeString()}</time>
              <span>{formatLine(e)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
