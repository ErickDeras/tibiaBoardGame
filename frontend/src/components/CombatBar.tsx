import { api } from "../api";
import { normalizeGameObject } from "../model";
import type { CombatPlayerTurnApi } from "../hooks/useCombatPlayerTurn";
import type { CombatSession, GameObject } from "../types";
import { PlayerCombatActions } from "./PlayerCombatActions";

type Props = {
  boardId: string;
  session: CombatSession | null;
  objects: GameObject[];
  selectedObjectId: string;
  combatTargetId: string;
  combatBusy: boolean;
  setCombatBusy: (v: boolean) => void;
  playerTurn: CombatPlayerTurnApi;
  onStart: () => Promise<void>;
  onEnd: () => Promise<void>;
  onRefreshCombat: () => Promise<void>;
  onObjectsUpdate: (objects: GameObject[]) => void;
  onReloadObjects: () => Promise<void>;
  onError: (msg: string) => void;
};

export function CombatBar({
  boardId,
  session,
  objects,
  selectedObjectId,
  combatTargetId,
  combatBusy,
  setCombatBusy,
  playerTurn,
  onStart,
  onEnd,
  onRefreshCombat,
  onObjectsUpdate,
  onReloadObjects,
  onError,
}: Props) {
  const active = session?.status === "ACTIVE";
  const combatEnded = session?.status === "ENDED";
  const { current, chainCreatureTurns, isPlayerTurn, actorForCards, basicKind, submitPlayerTurn, step } =
    playerTurn;
  const currentName = current?.name ?? session?.currentActorId ?? "—";
  const selectedPlayer = objects.find((o) => o.id === selectedObjectId && o.objectKind === "PLAYER");

  return (
    <div className="combatBar block">
      <h3>Combate</h3>
      {combatEnded ? (
        <p className="hint">
          Partida terminada. El tablero no se vacía: puedes recoger loot del suelo y revisar skills en el editor.
          Cuando quieras otro combate, reinicia la partida.
        </p>
      ) : null}
      {!active ? (
        <div className="row">
          <button type="button" disabled={combatBusy} onClick={() => void onStart()}>
            {combatEnded ? "Reiniciar partida" : "Iniciar partida"}
          </button>
        </div>
      ) : (
        <div className="row">
          <span>
            Turno: <strong>{currentName}</strong>
          </span>
          <button type="button" disabled={combatBusy} onClick={() => void onEnd()}>
            Finalizar partida
          </button>
        </div>
      )}
      {active ? (
        <p className="hint">
          Con tu turno activo, clic en una criatura para elegir objetivo. Cada flecha = 1 casilla (max 2 por
          turno; el segundo movimiento impide atacar en ese mismo envio — usa dos clics de flecha).
        </p>
      ) : null}
      <PlayerCombatActions
        className="combatActions"
        combatTargetId={combatTargetId}
        objects={objects}
        combatBusy={combatBusy}
        isPlayerTurn={isPlayerTurn}
        actorForCards={actorForCards}
        basicKind={basicKind}
        onAttack={() =>
          void submitPlayerTurn({
            moves: [],
            basicAttack: { kind: basicKind, targetId: combatTargetId },
            cardAction: null,
          })
        }
        onPass={() => void submitPlayerTurn({ moves: [], basicAttack: null, cardAction: null })}
        onStep={(dx, dy) => step(dx, dy)}
        onUseCard={(cardId) =>
          void submitPlayerTurn({
            moves: [],
            basicAttack: null,
            cardAction: { cardId, targetId: combatTargetId },
          })
        }
        onError={onError}
      />
      {active && current?.objectKind === "CREATURE" ? (
        <div className="row">
          <button
            type="button"
            disabled={combatBusy}
            onClick={async () => {
              setCombatBusy(true);
              try {
                const r = await api<{ objects: GameObject[] }>(`/boards/${boardId}/combat/turn/creature`, {
                  method: "POST",
                  body: JSON.stringify({ actorId: current.id }),
                });
                onObjectsUpdate(r.objects.map(normalizeGameObject));
                await onRefreshCombat();
                await chainCreatureTurns(r.objects.map(normalizeGameObject));
              } catch (e) {
                onError(String(e));
              } finally {
                setCombatBusy(false);
              }
            }}
          >
            Ejecutar turno de criatura
          </button>
        </div>
      ) : null}
      {selectedPlayer && (active || combatEnded) ? (
        <div className="row">
          <button
            type="button"
            disabled={combatBusy}
            onClick={async () => {
              setCombatBusy(true);
              try {
                await api(`/objects/${selectedPlayer.id}/collect-ground-loot`, {
                  method: "POST",
                  body: JSON.stringify({ x: selectedPlayer.x, y: selectedPlayer.y }),
                });
                await onReloadObjects();
              } catch {
                try {
                  await api(`/objects/${selectedPlayer.id}/collect-ground-loot`, {
                    method: "POST",
                    body: JSON.stringify({ x: selectedPlayer.x + 1, y: selectedPlayer.y }),
                  });
                  await onReloadObjects();
                } catch (e2) {
                  onError(String(e2));
                }
              } finally {
                setCombatBusy(false);
              }
            }}
          >
            Recoger loot (celda o E+1)
          </button>
        </div>
      ) : null}
    </div>
  );
}
