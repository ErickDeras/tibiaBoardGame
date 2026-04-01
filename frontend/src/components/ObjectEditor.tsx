import { useEffect, useState } from "react";
import { EQUIPMENT_SLOTS, FIELD_BY_SLOT } from "../constants";
import type {
  BaseStats,
  CardTemplate,
  EquipmentValue,
  GameObject,
  ObjectForm,
  Profession,
} from "../types";
import { InventoryPanel } from "./InventoryPanel";
import { PlayerCardDeck } from "./PlayerCardDeck";
import { experienceLevelFromTotalXp, playerHpManaBonusPerLevel } from "../model";

type Props = {
  form: ObjectForm;
  setForm: React.Dispatch<React.SetStateAction<ObjectForm>>;
  baseStats: BaseStats;
  setBaseStats: React.Dispatch<React.SetStateAction<BaseStats>>;
  equipmentItems: EquipmentValue[];
  selectedObjectId: string;
  selectedBoardId: string;
  playersOnBoard: GameObject[];
  onSave: () => void;
  onRemove: () => void;
  onNew: () => void;
  onCollectLoot: (collectorObjectId: string) => void;
  lootBusy: boolean;
  cardTemplates: CardTemplate[];
  onRefreshObjects: () => Promise<void>;
  onError: (msg: string) => void;
};

export function ObjectEditor({
  form,
  setForm,
  baseStats,
  setBaseStats,
  equipmentItems,
  selectedObjectId,
  selectedBoardId,
  playersOnBoard,
  onSave,
  onRemove,
  onNew,
  onCollectLoot,
  lootBusy,
  cardTemplates,
  onRefreshObjects,
  onError,
}: Props) {
  const [collectorId, setCollectorId] = useState("");

  useEffect(() => {
    const first = playersOnBoard[0]?.id ?? "";
    setCollectorId((prev) => (prev && playersOnBoard.some((p) => p.id === prev) ? prev : first));
  }, [playersOnBoard]);

  const playerExpLevel =
    form.objectKind === "PLAYER" ? experienceLevelFromTotalXp(form.experiencePoints) : 1;
  const vitalGain =
    form.objectKind === "PLAYER" ? playerHpManaBonusPerLevel(form.profession) : { hitpoints: 0, manaPoints: 0 };
  const vitalSteps =
    form.objectKind === "PLAYER" ? Math.max(0, playerExpLevel - 1) : 0;
  const displayHitpoints =
    form.objectKind === "PLAYER"
      ? form.hitpoints + vitalSteps * vitalGain.hitpoints
      : form.hitpoints;
  const displayManaPoints =
    form.objectKind === "PLAYER"
      ? form.manaPoints + vitalSteps * vitalGain.manaPoints
      : form.manaPoints;

  return (
    <aside className="editor">
      <h2>{selectedObjectId ? "Editar objeto" : "Crear objeto"}</h2>
      <div className="form">
        <label>
          Nombre
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>

        <label>
          Tipo
          <select
            value={form.objectKind}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                objectKind: e.target.value as ObjectForm["objectKind"],
                profession:
                  e.target.value === "CREATURE" ? null : prev.profession ?? "guerrero",
              }))
            }
          >
            <option value="PLAYER">Jugador</option>
            <option value="CREATURE">Criatura</option>
          </select>
        </label>

        <label>
          Profesion
          <select
            value={form.profession ?? ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                profession: (e.target.value || null) as Profession | null,
              }))
            }
            disabled={form.objectKind === "CREATURE"}
          >
            {form.objectKind === "CREATURE" ? <option value="">—</option> : null}
            <option value="mago">mago</option>
            <option value="guerrero">guerrero</option>
            <option value="paladin">paladin</option>
            <option value="druida">druida</option>
          </select>
        </label>

        <div className="row3">
          <label>
            X
            <input
              type="number"
              min={0}
              max={11}
              value={form.x}
              onChange={(e) => setForm((prev) => ({ ...prev, x: Number(e.target.value) }))}
            />
          </label>
          <label>
            Y
            <input
              type="number"
              min={0}
              max={11}
              value={form.y}
              onChange={(e) => setForm((prev) => ({ ...prev, y: Number(e.target.value) }))}
            />
          </label>
          <label>
            Sprite URL
            <input
              value={form.spriteUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, spriteUrl: e.target.value }))}
            />
          </label>
        </div>

        <div className="row3">
          <label>
            HP (total)
            <input
              type="number"
              min={0}
              value={displayHitpoints}
              onChange={(e) => {
                const t = Number(e.target.value);
                setForm((prev) => {
                  if (prev.objectKind !== "PLAYER") return { ...prev, hitpoints: t };
                  const L = experienceLevelFromTotalXp(prev.experiencePoints);
                  const g = playerHpManaBonusPerLevel(prev.profession);
                  const s = Math.max(0, L - 1);
                  return { ...prev, hitpoints: Math.max(0, t - s * g.hitpoints) };
                });
              }}
            />
          </label>
          <label>
            Mana (total)
            <input
              type="number"
              min={0}
              value={displayManaPoints}
              onChange={(e) => {
                const t = Number(e.target.value);
                setForm((prev) => {
                  if (prev.objectKind !== "PLAYER") return { ...prev, manaPoints: t };
                  const L = experienceLevelFromTotalXp(prev.experiencePoints);
                  const g = playerHpManaBonusPerLevel(prev.profession);
                  const s = Math.max(0, L - 1);
                  return { ...prev, manaPoints: Math.max(0, t - s * g.manaPoints) };
                });
              }}
            />
          </label>
          <label>
            Stamina
            <input
              type="number"
              min={0}
              value={form.staminaPoints}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, staminaPoints: Number(e.target.value) }))
              }
            />
          </label>
        </div>

        <div className="row3">
          <label>
            Nivel
            <input
              type="number"
              min={1}
              value={form.experienceLevel}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, experienceLevel: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            Oro
            <input
              type="number"
              min={0}
              value={form.gold}
              onChange={(e) => setForm((prev) => ({ ...prev, gold: Number(e.target.value) }))}
            />
          </label>
          <label>
            XP
            <input
              type="number"
              min={0}
              value={form.experiencePoints}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, experiencePoints: Number(e.target.value) }))
              }
            />
          </label>
        </div>

        <div className="row3">
          <label>
            Mana regen
            <input
              type="number"
              min={0}
              value={form.manaRegen}
              onChange={(e) => setForm((prev) => ({ ...prev, manaRegen: Number(e.target.value) }))}
            />
          </label>
          <label>
            Stamina regen
            <input
              type="number"
              min={0}
              value={form.staminaRegen}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, staminaRegen: Number(e.target.value) }))
              }
            />
          </label>
        </div>

        <div className="row3">
          <label>
            {form.objectKind === "PLAYER" ? "Ataque (total)" : "Base ataque"}
            <input
              type="number"
              min={0}
              readOnly={form.objectKind === "PLAYER"}
              title={
                form.objectKind === "PLAYER"
                  ? "Equipo + skills + bono por nivel (segun XP). Se guarda al persistir."
                  : undefined
              }
              value={form.objectKind === "PLAYER" ? form.attackValue : baseStats.attackValue}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, attackValue: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            {form.objectKind === "PLAYER" ? "Defensa (total)" : "Base defensa"}
            <input
              type="number"
              min={0}
              readOnly={form.objectKind === "PLAYER"}
              title={
                form.objectKind === "PLAYER"
                  ? "Equipo + escudo (skill) + bono por nivel (segun XP)."
                  : undefined
              }
              value={form.objectKind === "PLAYER" ? form.defenseValue : baseStats.defenseValue}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, defenseValue: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            {form.objectKind === "PLAYER" ? "ML base (sin bono por nivel)" : "Base nivel magico"}
            <input
              type="number"
              min={0}
              title={
                form.objectKind === "PLAYER"
                  ? "Base de personaje; los items de equipo suman en el total (Mag. atk) con el bono por nivel."
                  : undefined
              }
              value={baseStats.magicLevel}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, magicLevel: Number(e.target.value) }))
              }
            />
          </label>
        </div>

        {form.objectKind === "PLAYER" ? (
          <div className="row3">
            <label>
              Mag. atk (total)
              <input type="number" min={0} readOnly value={form.magicAttackValue} />
            </label>
          </div>
        ) : null}

        <div className="row3">
          <label>
            Base espada
            <input
              type="number"
              min={0}
              value={baseStats.swordSkill}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, swordSkill: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            Base hacha
            <input
              type="number"
              min={0}
              value={baseStats.axeSkill}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, axeSkill: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            Base maza
            <input
              type="number"
              min={0}
              value={baseStats.maceSkill}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, maceSkill: Number(e.target.value) }))
              }
            />
          </label>
        </div>

        <div className="row3">
          <label>
            Base distancia
            <input
              type="number"
              min={0}
              value={baseStats.distanceSkill}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, distanceSkill: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            Base escudo
            <input
              type="number"
              min={0}
              value={baseStats.shieldingSkill}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, shieldingSkill: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            Capacidad base (max.)
            <input
              type="number"
              min={0}
              value={baseStats.capacityMax}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, capacityMax: Number(e.target.value) }))
              }
            />
          </label>
        </div>

        <p>
          Totales: Atk {form.attackValue}, Def {form.defenseValue}, MagAtk {form.magicAttackValue} (servidor
          al guardar), Sword {form.swordSkill}, Axe {form.axeSkill}, Mace {form.maceSkill}, Distance{" "}
          {form.distanceSkill}, Shielding {form.shieldingSkill}, Magic {form.magicLevel}, Cap max{" "}
          {form.capacityMax}
        </p>

        {EQUIPMENT_SLOTS.map((slot) => {
          const field = FIELD_BY_SLOT[slot];
          const options = equipmentItems.filter((item) => item.slot === slot);
          return (
            <label key={slot}>
              {slot}
              <select
                value={form[field]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
              >
                <option value="">(ninguno)</option>
                {options.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          );
        })}

        {form.objectKind === "PLAYER" && (
          <InventoryPanel
            slots={form.inventorySlots}
            capacityMax={form.capacityMax}
            onChange={(next) =>
              setForm((prev) => ({
                ...prev,
                inventorySlots: next.map((row, i) => ({
                  ...row,
                  slotIndex: row.slotIndex ?? i,
                })),
              }))
            }
          />
        )}

        {form.objectKind === "CREATURE" && selectedObjectId && (
          <div className="block">
            <h3>Loot</h3>
            <p>El loot proviene de la plantilla (bestiario). Entrega al jugador seleccionado.</p>
            <label>
              Jugador
              <select value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
                {playersOnBoard.length === 0 ? (
                  <option value="">Sin jugadores</option>
                ) : null}
                {playersOnBoard.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!collectorId || lootBusy}
              onClick={() => onCollectLoot(collectorId)}
            >
              Recolectar loot
            </button>
          </div>
        )}

        {form.objectKind === "PLAYER" && selectedObjectId ? (
          <PlayerCardDeck
            objectId={selectedObjectId}
            form={form}
            onFormPatched={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onRefreshObjects={onRefreshObjects}
            onError={onError}
            cardTemplates={cardTemplates}
          />
        ) : null}

        <div className="row">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={!selectedBoardId || !form.name.trim()}
          >
            {selectedObjectId ? "Guardar cambios" : "Crear objeto"}
          </button>
          <button type="button" onClick={onNew}>
            Nuevo
          </button>
          <button type="button" onClick={() => void onRemove()} disabled={!selectedObjectId}>
            Eliminar
          </button>
        </div>

        {form.spriteUrl && (
          <div className="preview">
            <img src={form.spriteUrl} alt="preview" />
          </div>
        )}
      </div>
    </aside>
  );
}
