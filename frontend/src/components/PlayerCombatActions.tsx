import { useId, useState } from "react";
import type { GameObject } from "../types";

function IconCrossedSwords({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M5 5 19 19" />
      <path d="M19 5 5 19" />
      <path d="M5 5 3 3M19 19 21 21M19 5 21 3M5 19 3 21" />
    </svg>
  );
}

function IconArrow({ dir }: { dir: "up" | "down" | "left" | "right" }) {
  const d =
    dir === "up"
      ? "M12 19V5M5 12l7-7 7 7"
      : dir === "down"
        ? "M12 5v14M19 12l-7 7-7-7"
        : dir === "left"
          ? "M19 12H5M12 19l-7-7 7-7"
          : "M5 12h14M12 5l7 7-7 7";
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

type Props = {
  className?: string;
  combatTargetId: string;
  objects: GameObject[];
  combatBusy: boolean;
  isPlayerTurn: boolean;
  actorForCards: GameObject | undefined;
  basicKind: "melee" | "distance" | "magic";
  onAttack: () => void;
  onPass: () => void;
  onStep: (dx: number, dy: number) => void;
  onUseCard: (cardId: string) => void;
  onError: (msg: string) => void;
};

export function PlayerCombatActions({
  className = "",
  combatTargetId,
  objects,
  combatBusy,
  isPlayerTurn,
  actorForCards,
  basicKind,
  onAttack,
  onPass,
  onStep,
  onUseCard,
  onError,
}: Props) {
  const selectId = useId();
  const [selectedCardId, setSelectedCardId] = useState("");

  if (!isPlayerTurn) return null;

  const targetName = combatTargetId ? objects.find((o) => o.id === combatTargetId)?.name : undefined;

  function handleUseCard() {
    if (!selectedCardId) {
      onError("Elige una carta");
      return;
    }
    onUseCard(selectedCardId);
  }

  return (
    <div className={`player-combat-actions ${className}`.trim()}>
      <p className="player-combat-actions__target">
        Objetivo: <strong>{targetName ?? "—"}</strong> ({basicKind})
      </p>
      <div className="player-combat-actions__row player-combat-actions__row--primary">
        <button
          type="button"
          className="combat-action-attack"
          title="Ataque basico"
          disabled={combatBusy || !combatTargetId}
          onClick={onAttack}
        >
          <IconCrossedSwords />
          <span className="player-combat-actions__btn-label">Ataque</span>
        </button>
        <button type="button" className="combat-action-pass" disabled={combatBusy} onClick={onPass}>
          Pasar turno
        </button>
      </div>
      <div className="combat-move-pad" role="group" aria-label="Movimiento una casilla">
        <button
          type="button"
          className="combat-action-move combat-move-pad__cell combat-move-pad__cell--up"
          title="Arriba"
          disabled={combatBusy}
          onClick={() => onStep(0, -1)}
        >
          <IconArrow dir="up" />
        </button>
        <button
          type="button"
          className="combat-action-move combat-move-pad__cell combat-move-pad__cell--left"
          title="Izquierda"
          disabled={combatBusy}
          onClick={() => onStep(-1, 0)}
        >
          <IconArrow dir="left" />
        </button>
        <button
          type="button"
          className="combat-action-move combat-move-pad__cell combat-move-pad__cell--right"
          title="Derecha"
          disabled={combatBusy}
          onClick={() => onStep(1, 0)}
        >
          <IconArrow dir="right" />
        </button>
        <button
          type="button"
          className="combat-action-move combat-move-pad__cell combat-move-pad__cell--down"
          title="Abajo"
          disabled={combatBusy}
          onClick={() => onStep(0, 1)}
        >
          <IconArrow dir="down" />
        </button>
      </div>
      <div className="player-combat-actions__row player-combat-actions__row--cards">
        <label className="visually-hidden" htmlFor={selectId}>
          Carta a usar
        </label>
        <select
          id={selectId}
          className="combat-card-select"
          value={selectedCardId}
          disabled={combatBusy || !combatTargetId}
          onChange={(e) => setSelectedCardId(e.target.value)}
        >
          <option value="">Carta a usar</option>
          {(actorForCards?.cards ?? [])
            .filter((c) => c.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <button
          type="button"
          className="combat-card-use"
          disabled={combatBusy || !combatTargetId}
          onClick={handleUseCard}
        >
          Usar carta
        </button>
      </div>
    </div>
  );
}
