import { useState } from "react";
import { api } from "../api";
import type { CreatureTemplate, LootEntry } from "../types";

type Props = {
  templates: CreatureTemplate[];
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
  spawnTemplateId: string;
  setSpawnTemplateId: (id: string) => void;
  spawnMode: boolean;
  setSpawnMode: (v: boolean) => void;
};

const emptyTpl: Partial<CreatureTemplate> = {
  name: "",
  spriteUrl: "",
  hitpoints: 10,
  manaPoints: 0,
  staminaPoints: 0,
  attackValue: 0,
  defenseValue: 0,
  swordSkill: 0,
  axeSkill: 0,
  maceSkill: 0,
  distanceSkill: 0,
  shieldingSkill: 0,
  magicLevel: 0,
  abilityName: "",
  abilityManaCost: 0,
  abilityAttackBonus: 0,
  experiencePoints: 0,
};

export function BestiaryPanel({
  templates,
  onReload,
  onError,
  spawnTemplateId,
  setSpawnTemplateId,
  spawnMode,
  setSpawnMode,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTpl);
  const [lootItem, setLootItem] = useState({ itemName: "Gold", weight: 1, quantity: 1 });

  const selected = templates.find((t) => t.id === editingId);

  function startNew() {
    setEditingId(null);
    setForm({ ...emptyTpl, name: "Criatura" });
  }

  function startEdit(t: CreatureTemplate) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      spriteUrl: t.spriteUrl,
      hitpoints: t.hitpoints,
      manaPoints: t.manaPoints,
      staminaPoints: t.staminaPoints,
      attackValue: t.attackValue,
      defenseValue: t.defenseValue,
      swordSkill: t.swordSkill,
      axeSkill: t.axeSkill,
      maceSkill: t.maceSkill,
      distanceSkill: t.distanceSkill,
      shieldingSkill: t.shieldingSkill,
      magicLevel: t.magicLevel,
      abilityName: t.abilityName ?? "",
      abilityManaCost: t.abilityManaCost ?? 0,
      abilityAttackBonus: t.abilityAttackBonus ?? 0,
      experiencePoints: t.experiencePoints ?? 0,
    });
  }

  async function saveTemplate() {
    try {
      const body = {
        name: (form.name ?? "").trim() || "Criatura",
        spriteUrl: form.spriteUrl ?? "",
        hitpoints: form.hitpoints ?? 10,
        manaPoints: form.manaPoints ?? 0,
        staminaPoints: form.staminaPoints ?? 0,
        attackValue: form.attackValue ?? 0,
        defenseValue: form.defenseValue ?? 0,
        swordSkill: form.swordSkill ?? 0,
        axeSkill: form.axeSkill ?? 0,
        maceSkill: form.maceSkill ?? 0,
        distanceSkill: form.distanceSkill ?? 0,
        shieldingSkill: form.shieldingSkill ?? 0,
        magicLevel: form.magicLevel ?? 0,
        abilityName: form.abilityName ?? "",
        abilityManaCost: form.abilityManaCost ?? 0,
        abilityAttackBonus: form.abilityAttackBonus ?? 0,
        experiencePoints: form.experiencePoints ?? 0,
      };
      if (editingId) {
        await api<CreatureTemplate>(`/creature-templates/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api<CreatureTemplate>("/creature-templates", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      await onReload();
      startNew();
    } catch (e) {
      onError(String(e));
    }
  }

  async function deleteTemplate(id: string) {
    try {
      await api<void>(`/creature-templates/${id}`, { method: "DELETE" });
      await onReload();
      if (editingId === id) startNew();
    } catch (e) {
      onError(String(e));
    }
  }

  async function addLoot(templateId: string) {
    try {
      await api<LootEntry>(`/creature-templates/${templateId}/loot`, {
        method: "POST",
        body: JSON.stringify(lootItem),
      });
      await onReload();
    } catch (e) {
      onError(String(e));
    }
  }

  async function deleteLoot(id: string) {
    try {
      await api<void>(`/loot-entries/${id}`, { method: "DELETE" });
      await onReload();
    } catch (e) {
      onError(String(e));
    }
  }

  return (
    <div className="block">
      <h2>Bestiario</h2>
      <p>
        <label>
          Plantilla para spawn en tablero
          <select value={spawnTemplateId} onChange={(e) => setSpawnTemplateId(e.target.value)}>
            <option value="">—</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={spawnMode}
            onChange={(e) => setSpawnMode(e.target.checked)}
          />
          Modo spawn (clic en celda vacia)
        </label>
      </p>

      <div className="row">
        <button type="button" onClick={startNew}>
          Nueva plantilla
        </button>
      </div>

      {templates.map((t) => (
        <div key={t.id} className="item">
          {t.name}
          <div className="row">
            <button type="button" onClick={() => startEdit(t)}>
              Editar
            </button>
            <button type="button" onClick={() => void deleteTemplate(t.id)}>
              Borrar
            </button>
          </div>
        </div>
      ))}

      <div className="block">
        <h3>{editingId ? "Editar" : "Crear"} plantilla</h3>
        <label>
          Nombre
          <input
            value={form.name ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </label>
        <label>
          Sprite URL
          <input
            value={form.spriteUrl ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, spriteUrl: e.target.value }))}
          />
        </label>
        <div className="row3">
          <label>
            HP
            <input
              type="number"
              min={0}
              value={form.hitpoints ?? 0}
              onChange={(e) => setForm((p) => ({ ...p, hitpoints: Number(e.target.value) }))}
            />
          </label>
          <label>
            Atk
            <input
              type="number"
              min={0}
              value={form.attackValue ?? 0}
              onChange={(e) => setForm((p) => ({ ...p, attackValue: Number(e.target.value) }))}
            />
          </label>
          <label>
            Def
            <input
              type="number"
              min={0}
              value={form.defenseValue ?? 0}
              onChange={(e) => setForm((p) => ({ ...p, defenseValue: Number(e.target.value) }))}
            />
          </label>
          <label>
            XP al morir
            <input
              type="number"
              min={0}
              value={form.experiencePoints ?? 0}
              onChange={(e) => setForm((p) => ({ ...p, experiencePoints: Number(e.target.value) }))}
            />
          </label>
        </div>
        <label>
          Habilidad (nombre)
          <input
            value={form.abilityName ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, abilityName: e.target.value }))}
          />
        </label>
        <div className="row3">
          <label>
            Mana habilidad
            <input
              type="number"
              min={0}
              value={form.abilityManaCost ?? 0}
              onChange={(e) => setForm((p) => ({ ...p, abilityManaCost: Number(e.target.value) }))}
            />
          </label>
          <label>
            Bonus atk habilidad
            <input
              type="number"
              min={0}
              value={form.abilityAttackBonus ?? 0}
              onChange={(e) => setForm((p) => ({ ...p, abilityAttackBonus: Number(e.target.value) }))}
            />
          </label>
        </div>
        <button type="button" onClick={() => void saveTemplate()}>
          Guardar plantilla
        </button>
      </div>

      {selected ? (
        <div className="block">
          <h3>Loot de {selected.name}</h3>
          <div className="row">
            <input
              value={lootItem.itemName}
              onChange={(e) => setLootItem((p) => ({ ...p, itemName: e.target.value }))}
            />
            <input
              type="number"
              min={0}
              value={lootItem.weight}
              onChange={(e) => setLootItem((p) => ({ ...p, weight: Number(e.target.value) }))}
            />
            <input
              type="number"
              min={1}
              value={lootItem.quantity}
              onChange={(e) => setLootItem((p) => ({ ...p, quantity: Number(e.target.value) }))}
            />
            <button type="button" onClick={() => void addLoot(selected.id)}>
              Añadir loot
            </button>
          </div>
          {selected.lootEntries.map((e) => (
            <div key={e.id} className="item">
              {e.itemName} x{e.quantity} ({e.weight}w)
              <button type="button" onClick={() => void deleteLoot(e.id)}>
                Quitar
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
