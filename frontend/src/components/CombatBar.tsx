import { api } from "../api";
import { normalizeGameObject } from "../model";
import type { CombatSession, GameObject, Profession } from "../types";

function basicKindForProfession(p: Profession | null): "melee" | "distance" | "magic" {
  if (p === "paladin") return "distance";
  if (p === "mago" || p === "druida") return "magic";
  return "melee";
}

type Props = {
  boardId: string;
  session: CombatSession | null;
  objects: GameObject[];
  selectedObjectId: string;
  combatTargetId: string;
  combatBusy: boolean;
  setCombatBusy: (v: boolean) => void;
  onStart: () => Promise<void>;
  onEnd: () => Promise<void>;
  onRefreshCombat: () => Promise<void>;
  onObjectsUpdate: (objects: GameObject[]) => void;
  onReloadObjects: () => Promise<void>;
  onError: (msg: string) => void;
};

async function fetchCombat(boardId: string) {
  return api<{ session: CombatSession | null }>(`/boards/${boardId}/combat`);
}

export function CombatBar({
  boardId,
  session,
  objects,
  selectedObjectId,
  combatTargetId,
  combatBusy,
  setCombatBusy,
  onStart,
  onEnd,
  onRefreshCombat,
  onObjectsUpdate,
  onReloadObjects,
  onError,
}: Props) {
  const active = session?.status === "ACTIVE";
  const combatEnded = session?.status === "ENDED";
  const current = objects.find((o) => o.id === session?.currentActorId);
  const currentName = current?.name ?? session?.currentActorId ?? "—";

  async function chainCreatureTurns(initialObjects: GameObject[]) {
    let curObjs = initialObjects;
    for (let guard = 0; guard < 24; guard++) {
      const s = (await fetchCombat(boardId)).session;
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
  }

  async function submitPlayerTurn(body: {
    moves: { x: number; y: number }[];
    basicAttack: { kind: "melee" | "distance" | "magic"; targetId: string } | null;
    cardAction: { cardId: string; targetId: string } | null;
  }) {
    if (!session?.currentActorId) return;
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
  }

  const isPlayerTurn =
    active && session?.currentActorId === selectedObjectId && current?.objectKind === "PLAYER";
  const actorForCards = isPlayerTurn ? current : undefined;
  const selectedPlayer = objects.find((o) => o.id === selectedObjectId && o.objectKind === "PLAYER");

  function step(dx: number, dy: number) {
    const a = objects.find((o) => o.id === session!.currentActorId!);
    if (!a) return;
    const nx = a.x + dx;
    const ny = a.y + dy;
    if (nx < 0 || nx > 11 || ny < 0 || ny > 11) return;
    void submitPlayerTurn({
      moves: [{ x: nx, y: ny }],
      basicAttack: null,
      cardAction: null,
    });
  }

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
      {isPlayerTurn ? (
        <div className="combatActions">
          <p>
            Objetivo:{" "}
            <strong>{combatTargetId ? objects.find((o) => o.id === combatTargetId)?.name : "—"}</strong> (
            {basicKindForProfession(actorForCards?.profession ?? null)})
          </p>
          <div className="row">
            <button
              type="button"
              disabled={combatBusy || !combatTargetId}
              onClick={() => {
                const k = basicKindForProfession(actorForCards?.profession ?? null);
                void submitPlayerTurn({
                  moves: [],
                  basicAttack: { kind: k, targetId: combatTargetId },
                  cardAction: null,
                });
              }}
            >
              Ataque basico
            </button>
            <button
              type="button"
              disabled={combatBusy}
              onClick={() =>
                void submitPlayerTurn({ moves: [], basicAttack: null, cardAction: null })
              }
            >
              Pasar turno
            </button>
          </div>
          <div className="row">
            <button type="button" disabled={combatBusy} onClick={() => step(0, -1)}>
              ↑
            </button>
            <button type="button" disabled={combatBusy} onClick={() => step(0, 1)}>
              ↓
            </button>
            <button type="button" disabled={combatBusy} onClick={() => step(1, 0)}>
              →
            </button>
            <button type="button" disabled={combatBusy} onClick={() => step(-1, 0)}>
              ←
            </button>
          </div>
          <div className="row">
            <select
              id="combatCardPick"
              defaultValue=""
              disabled={combatBusy || !combatTargetId}
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
              disabled={combatBusy || !combatTargetId}
              onClick={() => {
                const sel = document.getElementById("combatCardPick") as HTMLSelectElement;
                const cardId = sel?.value;
                if (!cardId) {
                  onError("Elige una carta");
                  return;
                }
                void submitPlayerTurn({
                  moves: [],
                  basicAttack: null,
                  cardAction: { cardId, targetId: combatTargetId },
                });
              }}
            >
              Usar carta
            </button>
          </div>
        </div>
      ) : null}
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
