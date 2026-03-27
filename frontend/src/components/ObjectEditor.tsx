import { useEffect, useState } from "react";
import { DECK_CATEGORIES, EQUIPMENT_SLOTS, FIELD_BY_SLOT } from "../constants";
import type {
  BaseStats,
  EquipmentValue,
  GameObject,
  ObjectForm,
  Profession,
} from "../types";
import { InventoryPanel } from "./InventoryPanel";

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
}: Props) {
  const [collectorId, setCollectorId] = useState("");

  useEffect(() => {
    const first = playersOnBoard[0]?.id ?? "";
    setCollectorId((prev) => (prev && playersOnBoard.some((p) => p.id === prev) ? prev : first));
  }, [playersOnBoard]);

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
            HP
            <input
              type="number"
              min={0}
              value={form.hitpoints}
              onChange={(e) => setForm((prev) => ({ ...prev, hitpoints: Number(e.target.value) }))}
            />
          </label>
          <label>
            Mana
            <input
              type="number"
              min={0}
              value={form.manaPoints}
              onChange={(e) => setForm((prev) => ({ ...prev, manaPoints: Number(e.target.value) }))}
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
            Base ataque
            <input
              type="number"
              min={0}
              value={baseStats.attackValue}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, attackValue: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            Base defensa
            <input
              type="number"
              min={0}
              value={baseStats.defenseValue}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, defenseValue: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            Base nivel magico
            <input
              type="number"
              min={0}
              value={baseStats.magicLevel}
              onChange={(e) =>
                setBaseStats((prev) => ({ ...prev, magicLevel: Number(e.target.value) }))
              }
            />
          </label>
        </div>

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

        <h3>Cartas (5)</h3>
        {form.cards.map((card, idx) => (
          <div className="cardRow" key={idx}>
            <input
              placeholder={`Carta ${idx + 1} nombre`}
              value={card.name}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cards: prev.cards.map((c, i) => (i === idx ? { ...c, name: e.target.value } : c)),
                }))
              }
            />
            <input
              placeholder="Descripcion"
              value={card.description}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cards: prev.cards.map((c, i) =>
                    i === idx ? { ...c, description: e.target.value } : c,
                  ),
                }))
              }
            />
            <select
              value={card.deckCategory}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cards: prev.cards.map((c, i) =>
                    i === idx ? { ...c, deckCategory: e.target.value as typeof c.deckCategory } : c,
                  ),
                }))
              }
            >
              {DECK_CATEGORIES.map((dc) => (
                <option key={dc} value={dc}>
                  {dc}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              title="Mana"
              placeholder="Mana"
              value={card.manaCost ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cards: prev.cards.map((c, i) =>
                    i === idx
                      ? {
                          ...c,
                          manaCost: e.target.value === "" ? null : Number(e.target.value),
                        }
                      : c,
                  ),
                }))
              }
            />
            <input
              type="number"
              min={0}
              title="Stamina"
              placeholder="Stam"
              value={card.staminaCost ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cards: prev.cards.map((c, i) =>
                    i === idx
                      ? {
                          ...c,
                          staminaCost: e.target.value === "" ? null : Number(e.target.value),
                        }
                      : c,
                  ),
                }))
              }
            />
            <input
              type="number"
              min={0}
              title="Capacidad"
              placeholder="Cap"
              value={card.capacityCost ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cards: prev.cards.map((c, i) =>
                    i === idx
                      ? {
                          ...c,
                          capacityCost: e.target.value === "" ? null : Number(e.target.value),
                        }
                      : c,
                  ),
                }))
              }
            />
            <label title="Healing rapid fuera de turno">
              <input
                type="checkbox"
                checked={card.rapidSpell}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    cards: prev.cards.map((c, i) =>
                      i === idx ? { ...c, rapidSpell: e.target.checked } : c,
                    ),
                  }))
                }
              />
              Rapid
            </label>
            <input
              type="number"
              min={0}
              title="Bonus SP carta"
              placeholder="+SP"
              value={card.spellSkillBonus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cards: prev.cards.map((c, i) =>
                    i === idx ? { ...c, spellSkillBonus: Number(e.target.value) } : c,
                  ),
                }))
              }
            />
            <input
              type="number"
              min={1}
              title="Crit mult (ej. 2 = x2)"
              placeholder="Crit"
              value={card.critMultiplier ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cards: prev.cards.map((c, i) =>
                    i === idx
                      ? {
                          ...c,
                          critMultiplier: e.target.value === "" ? null : Number(e.target.value),
                        }
                      : c,
                  ),
                }))
              }
            />
          </div>
        ))}

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
