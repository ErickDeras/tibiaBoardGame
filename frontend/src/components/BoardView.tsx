import { useCallback, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { inventoryWeight } from "../model";
import type { GameObject } from "../types";

const TOOLTIP_W = 272;
/** Altura aproximada para mantener el tooltip dentro del viewport al hacer clamp. */
const TOOLTIP_H = 400;

function clampTooltipPos(clientX: number, clientY: number) {
  const pad = 14;
  let left = clientX + pad;
  let top = clientY + pad;
  if (typeof window !== "undefined") {
    left = Math.min(left, window.innerWidth - TOOLTIP_W - 8);
    top = Math.min(top, window.innerHeight - TOOLTIP_H - 8);
    left = Math.max(8, left);
    top = Math.max(8, top);
  }
  return { left, top };
}

function EquipSummary({ obj }: { obj: GameObject }) {
  const rows: { label: string; value: string }[] = [
    { label: "Casco", value: obj.helmet },
    { label: "Armadura", value: obj.armor },
    { label: "Piernas", value: obj.legs },
    { label: "Botas", value: obj.boots },
    { label: "Arma", value: obj.weapon },
    { label: "Escudo", value: obj.shield },
    { label: "Anillo", value: obj.ring },
    { label: "Amuleto", value: obj.necklace },
    { label: "Mochila", value: obj.backpackEquipment },
  ].filter((r) => r.value.trim() !== "");
  if (rows.length === 0) return null;
  return (
    <ul className="boardOccupantTooltip-equip">
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span> {r.value}
        </li>
      ))}
    </ul>
  );
}

function OccupantTooltipBody({ obj }: { obj: GameObject }) {
  const invW = inventoryWeight(obj.inventorySlots);
  const base = (
    <>
      <div className="boardOccupantTooltip-title">{obj.name}</div>
      <div className="boardOccupantTooltip-pos">
        Casilla {obj.x},{obj.y}
        {obj.floor != null ? ` · piso ${obj.floor}` : ""}
      </div>
      <dl className="boardOccupantTooltip-grid">
        <dt>HP</dt>
        <dd>{obj.hitpoints}</dd>
        <dt>Maná</dt>
        <dd>{obj.manaPoints}</dd>
        <dt>Stamina</dt>
        <dd>{obj.staminaPoints}</dd>
        <dt>Ataque</dt>
        <dd>{obj.attackValue}</dd>
        <dt>Defensa</dt>
        <dd>{obj.defenseValue}</dd>
        <dt>Ataque mág.</dt>
        <dd>{obj.magicAttackValue}</dd>
        <dt>Nivel mág.</dt>
        <dd>{obj.magicLevel}</dd>
      </dl>
    </>
  );

  if (obj.objectKind === "PLAYER") {
    return (
      <div className="boardOccupantTooltip-inner">
        {base}
        <dl className="boardOccupantTooltip-grid boardOccupantTooltip-grid--sub">
          <dt>Vocación</dt>
          <dd>{obj.profession ?? "—"}</dd>
          <dt>XP / nivel</dt>
          <dd>
            {obj.experiencePoints} · L{obj.experienceLevel}
          </dd>
          <dt>Oro</dt>
          <dd>{obj.gold}</dd>
          <dt>Capacidad</dt>
          <dd>
            {invW}/{obj.capacityMax}
          </dd>
          <dt>Cartas</dt>
          <dd>{obj.cards?.length ?? 0}</dd>
        </dl>
        <div className="boardOccupantTooltip-skills">
          Esp: {obj.swordSkill} · Hacha: {obj.axeSkill} · Maza: {obj.maceSkill} · Dist:{" "}
          {obj.distanceSkill} · Esc: {obj.shieldingSkill}
        </div>
        <EquipSummary obj={obj} />
      </div>
    );
  }

  return (
    <div className="boardOccupantTooltip-inner">
      {base}
      <div className="boardOccupantTooltip-kind">Criatura</div>
    </div>
  );
}

type Props = {
  objects: GameObject[];
  selectedObjectId: string;
  selectedObject: GameObject | undefined;
  /** Criatura elegida como objetivo (solo se resalta en turno de jugador). */
  combatTargetId?: string;
  onCellClick: (x: number, y: number, occupant: GameObject | undefined) => void;
};

export function BoardView({
  objects,
  selectedObjectId,
  selectedObject,
  combatTargetId = "",
  onCellClick,
}: Props) {
  const map = new Map<string, GameObject>();
  objects.forEach((obj) => map.set(`${obj.x}-${obj.y}`, obj));

  const [hoverTip, setHoverTip] = useState<{ obj: GameObject; left: number; top: number } | null>(null);

  const onOccupantEnter = useCallback((e: MouseEvent<HTMLButtonElement>, obj: GameObject) => {
    const { left, top } = clampTooltipPos(e.clientX, e.clientY);
    setHoverTip({ obj, left, top });
  }, []);

  const onOccupantMove = useCallback((e: MouseEvent<HTMLButtonElement>, obj: GameObject) => {
    setHoverTip((prev) => {
      if (prev?.obj.id !== obj.id) return prev;
      const { left, top } = clampTooltipPos(e.clientX, e.clientY);
      return { obj, left, top };
    });
  }, []);

  const onOccupantLeave = useCallback(() => {
    setHoverTip(null);
  }, []);

  return (
    <>
      <section className="board">
      {Array.from({ length: 12 * 12 }).map((_, index) => {
        const x = index % 12;
        const y = Math.floor(index / 12);
        const obj = map.get(`${x}-${y}`);
        const isCombatTarget =
          Boolean(combatTargetId) && obj != null && obj.id === combatTargetId && obj.objectKind === "CREATURE";
        return (
          <button
            key={`${x}-${y}`}
            type="button"
            className={[
              "cell",
              selectedObjectId && selectedObject?.x === x && selectedObject?.y === y ? "active" : "",
              isCombatTarget ? "cell-combat-target" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onCellClick(x, y, obj)}
            onMouseEnter={obj ? (e) => onOccupantEnter(e, obj) : undefined}
            onMouseMove={obj ? (e) => onOccupantMove(e, obj) : undefined}
            onMouseLeave={obj ? onOccupantLeave : undefined}
          >
            {obj ? (
              <div className={`spriteWrap${obj.spriteUrl ? "" : " spriteWrap--noSprite"}`}>
                {obj.spriteUrl ? <img src={obj.spriteUrl} alt={obj.name} className="sprite" /> : null}
                <span className={obj.spriteUrl ? "cellHp cellHp--withSprite" : "cellHp cellHp--solo"} title="HP">
                  {obj.hitpoints}
                </span>
                <small>
                  {obj.name}
                  {obj.floor != null ? <span className="floorZ"> z{obj.floor}</span> : null}
                </small>
              </div>
            ) : (
              <span className="coords">
                {x},{y}
              </span>
            )}
          </button>
        );
      })}
      </section>
      {hoverTip != null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="boardOccupantTooltip"
            style={{ left: hoverTip.left, top: hoverTip.top }}
            role="tooltip"
          >
            <OccupantTooltipBody obj={hoverTip.obj} />
          </div>,
          document.body,
        )}
    </>
  );
}
