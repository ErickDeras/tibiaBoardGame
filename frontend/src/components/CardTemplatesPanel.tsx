import { useState } from "react";
import { api } from "../api";
import { DECK_CATEGORIES, SPELL_DAMAGE_SKILLS } from "../constants";
import type { CardTemplate, DeckCategory } from "../types";

type Props = {
  templates: CardTemplate[];
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
};

const emptyTpl: Partial<CardTemplate> = {
  name: "",
  description: "",
  deckCategory: "SPELL_ATTACK",
  manaCost: null,
  staminaCost: null,
  capacityCost: null,
  rapidSpell: false,
  spellSkillBonus: 0,
  critMultiplier: null,
  damageSkill: "SWORD",
};

function needsDamageSkill(dc: DeckCategory) {
  return dc === "SPELL_ATTACK" || dc === "SPELL_DEFENSIVE";
}

export function CardTemplatesPanel({ templates, onReload, onError }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTpl);

  function startNew() {
    setEditingId(null);
    setForm({ ...emptyTpl, name: "Nueva carta", deckCategory: "SPELL_ATTACK", damageSkill: "SWORD" });
  }

  function startEdit(t: CardTemplate) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description,
      deckCategory: t.deckCategory,
      manaCost: t.manaCost,
      staminaCost: t.staminaCost,
      capacityCost: t.capacityCost,
      rapidSpell: t.rapidSpell,
      spellSkillBonus: t.spellSkillBonus,
      critMultiplier: t.critMultiplier,
      damageSkill: t.damageSkill ?? "SWORD",
    });
  }

  async function saveTemplate() {
    try {
      const dc = (form.deckCategory ?? "SPELL_ATTACK") as DeckCategory;
      const body = {
        name: (form.name ?? "").trim() || "Carta",
        description: (form.description ?? "").trim(),
        deckCategory: dc,
        manaCost: form.manaCost ?? null,
        staminaCost: form.staminaCost ?? null,
        capacityCost: form.capacityCost ?? null,
        rapidSpell: form.rapidSpell ?? false,
        spellSkillBonus: form.spellSkillBonus ?? 0,
        critMultiplier: form.critMultiplier ?? null,
        damageSkill: needsDamageSkill(dc) ? (form.damageSkill ?? "SWORD") : null,
      };
      if (editingId) {
        await api<CardTemplate>(`/card-templates/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api<CardTemplate>("/card-templates", {
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
      await api<void>(`/card-templates/${id}`, { method: "DELETE" });
      await onReload();
      if (editingId === id) startNew();
    } catch (e) {
      onError(String(e));
    }
  }

  const dc = (form.deckCategory ?? "SPELL_ATTACK") as DeckCategory;

  return (
    <div className="block">
      <h2>Mazo — plantillas</h2>
      <p className="hint">Crea plantillas y añádelas al jugador seleccionado (máx. 5 cartas).</p>
      <div className="row">
        <button type="button" onClick={startNew}>
          Nueva plantilla
        </button>
      </div>

      {templates.map((t) => (
        <div key={t.id} className="item">
          {t.name}{" "}
          <span className="muted">
            {t.deckCategory}
            {t.damageSkill ? ` / ${t.damageSkill}` : ""}
          </span>
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
        <h3>{editingId ? "Editar plantilla" : "Crear plantilla"}</h3>
        <label>
          Nombre
          <input
            value={form.name ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </label>
        <label>
          Descripción
          <input
            value={form.description ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </label>
        <label>
          Categoría
          <select
            value={dc}
            onChange={(e) => {
              const v = e.target.value as DeckCategory;
              setForm((p) => ({
                ...p,
                deckCategory: v,
                damageSkill: v === "SPELL_ATTACK" || v === "SPELL_DEFENSIVE" ? p.damageSkill ?? "SWORD" : null,
              }));
            }}
          >
            {DECK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {needsDamageSkill(dc) ? (
          <label>
            Daño según habilidad base
            <select
              value={form.damageSkill ?? "SWORD"}
              onChange={(e) =>
                setForm((p) => ({ ...p, damageSkill: e.target.value as (typeof SPELL_DAMAGE_SKILLS)[number] }))
              }
            >
              {SPELL_DAMAGE_SKILLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="row3">
          <label>
            Mana
            <input
              type="number"
              min={0}
              value={form.manaCost ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  manaCost: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </label>
          <label>
            Stamina
            <input
              type="number"
              min={0}
              value={form.staminaCost ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  staminaCost: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </label>
          <label>
            Cap. libre
            <input
              type="number"
              min={0}
              value={form.capacityCost ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  capacityCost: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </label>
        </div>
        <label className="row">
          <input
            type="checkbox"
            checked={form.rapidSpell ?? false}
            onChange={(e) => setForm((p) => ({ ...p, rapidSpell: e.target.checked }))}
          />
          Rapid
        </label>
        <div className="row3">
          <label>
            Bonus habilidad carta
            <input
              type="number"
              min={0}
              value={form.spellSkillBonus ?? 0}
              onChange={(e) => setForm((p) => ({ ...p, spellSkillBonus: Number(e.target.value) }))}
            />
          </label>
          <label>
            Crit mult
            <input
              type="number"
              min={1}
              value={form.critMultiplier ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  critMultiplier: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </label>
        </div>
        <button type="button" onClick={() => void saveTemplate()}>
          Guardar plantilla
        </button>
      </div>
    </div>
  );
}
