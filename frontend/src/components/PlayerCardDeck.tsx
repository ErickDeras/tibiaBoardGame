import { useState } from "react";
import { api } from "../api";
import type { Card, CardTemplate, GameObject, ObjectForm } from "../types";
import { inventoryWeight, skillBaseFromDamageSkill } from "../model";

type UseResponse = {
  object: GameObject;
  used: {
    cardId: string;
    name: string;
    deckCategory: string;
    damageSkill: string | null;
    skillBase: number;
    spellSkillBonus: number;
    effectivePower: number;
    manaSpent: number;
    staminaSpent: number;
  };
};

type Props = {
  objectId: string;
  form: ObjectForm;
  onFormPatched: (patch: Partial<ObjectForm>) => void;
  onRefreshObjects: () => Promise<void>;
  onError: (msg: string) => void;
  cardTemplates: CardTemplate[];
};

export function PlayerCardDeck({
  objectId,
  form,
  onFormPatched,
  onRefreshObjects,
  onError,
  cardTemplates,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastUse, setLastUse] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");

  const cards = form.cards;
  const usedW = inventoryWeight(form.inventorySlots);
  const freeCap = form.capacityMax - usedW;

  function canUse(card: Card): boolean {
    const manaNeed = card.manaCost ?? 0;
    const staminaNeed = card.staminaCost ?? 0;
    const capNeed = card.capacityCost ?? 0;
    return (
      form.manaPoints >= manaNeed &&
      form.staminaPoints >= staminaNeed &&
      (capNeed <= 0 || freeCap >= capNeed)
    );
  }

  async function addFromTemplate() {
    if (!templateId || cards.length >= 5) return;
    setBusyId("__add__");
    try {
      await api<{ object: GameObject }>(`/objects/${objectId}/cards/from-template`, {
        method: "POST",
        body: JSON.stringify({ templateId }),
      });
      await onRefreshObjects();
      setTemplateId("");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function useCard(card: Card) {
    if (!card.id || !canUse(card)) return;
    setBusyId(card.id);
    setLastUse(null);
    try {
      const res = await api<UseResponse>(`/objects/${objectId}/cards/${card.id}/use`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      onFormPatched({
        manaPoints: res.object.manaPoints,
        staminaPoints: res.object.staminaPoints,
        cards: res.object.cards.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          deckCategory: c.deckCategory,
          manaCost: c.manaCost,
          staminaCost: c.staminaCost,
          capacityCost: c.capacityCost,
          rapidSpell: c.rapidSpell,
          spellSkillBonus: c.spellSkillBonus,
          critMultiplier: c.critMultiplier,
          damageSkill: c.damageSkill ?? null,
        })),
      });
      setLastUse(
        `Usado: ${res.used.name} — poder efectivo ${res.used.effectivePower} (base ${res.used.skillBase} + bono ${res.used.spellSkillBonus}). −${res.used.manaSpent} mana, −${res.used.staminaSpent} stamina.`,
      );
      await onRefreshObjects();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="playerDeck">
      <h3>Mazo ({cards.length}/5)</h3>
      <div className="deckAdd row">
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">— Plantilla —</option>
          {cardTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!templateId || cards.length >= 5 || busyId === "__add__"}
          onClick={() => void addFromTemplate()}
        >
          Añadir al mazo
        </button>
      </div>

      {cards.length === 0 ? (
        <p className="muted">Sin cartas. Crea plantillas en el panel izquierdo y añádelas aquí.</p>
      ) : (
        <div className="cardCarousel" role="region" aria-label="Cartas del jugador">
          {cards.map((card) => {
            const base = skillBaseFromDamageSkill(form, card.damageSkill);
            const previewPower = base + card.spellSkillBonus;
            const ok = canUse(card);
            return (
              <div key={card.id ?? card.name} className="playCard">
                <div className="playCardInner">
                  <div className="playCardTitle">{card.name}</div>
                  <div className="playCardCat">{card.deckCategory}</div>
                  {card.description ? <p className="playCardDesc">{card.description}</p> : null}
                  <div className="playCardStats">
                    {card.damageSkill ? (
                      <span>
                        {card.damageSkill}: poder {previewPower} (base {base} + bono {card.spellSkillBonus})
                      </span>
                    ) : (
                      <span>Bono carta {card.spellSkillBonus}</span>
                    )}
                  </div>
                  <div className="playCardCosts">
                    M {card.manaCost ?? 0} · S {card.staminaCost ?? 0}
                    {(card.capacityCost ?? 0) > 0 ? ` · Cap ${card.capacityCost}` : ""}
                  </div>
                  <button
                    type="button"
                    className="playCardUse"
                    disabled={!card.id || !ok || busyId !== null}
                    title={!ok ? "Mana, stamina o capacidad insuficiente" : "Usar y descartar carta"}
                    onClick={() => void useCard(card)}
                  >
                    {busyId === card.id ? "…" : "Usar carta"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lastUse ? <p className="useResult">{lastUse}</p> : null}
    </div>
  );
}
