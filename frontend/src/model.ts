import type { Card, DeckCategory, GameObject, InventorySlotRow } from "./types";

export function normalizeInventorySlots(slots: InventorySlotRow[] | undefined): InventorySlotRow[] {
  if (!slots?.length) return [];
  return [...slots].sort((a, b) => a.slotIndex - b.slotIndex).map((s) => ({
    id: s.id,
    slotIndex: s.slotIndex,
    itemName: s.itemName,
    weight: s.weight,
    quantity: s.quantity,
  }));
}

export function normalizeCards(raw: Card[] | undefined): Card[] {
  const base: Card[] =
    raw?.map((c, i) => ({
      id: c.id,
      name: c.name || `Carta ${i + 1}`,
      description: c.description ?? "",
      deckCategory: (c.deckCategory ?? "SPELL_ATTACK") as DeckCategory,
      manaCost: c.manaCost ?? null,
      staminaCost: c.staminaCost ?? null,
      capacityCost: c.capacityCost ?? null,
      rapidSpell: c.rapidSpell ?? false,
      spellSkillBonus: c.spellSkillBonus ?? 0,
      critMultiplier: c.critMultiplier ?? null,
    })) ?? [];
  while (base.length < 5) {
    const n = base.length + 1;
    base.push({
      name: `Carta ${n}`,
      description: "",
      deckCategory: "SPELL_ATTACK",
      manaCost: null,
      staminaCost: null,
      capacityCost: null,
      rapidSpell: false,
      spellSkillBonus: 0,
      critMultiplier: null,
    });
  }
  return base.slice(0, 5);
}

export function normalizeGameObject(obj: GameObject): GameObject {
  return {
    ...obj,
    objectKind: obj.objectKind ?? "PLAYER",
    profession: obj.profession ?? null,
    creatureTemplateId: obj.creatureTemplateId ?? null,
    backpackEquipment: obj.backpackEquipment ?? "",
    magicAttackValue: obj.magicAttackValue ?? 0,
    cards: normalizeCards(obj.cards),
    inventorySlots: normalizeInventorySlots(obj.inventorySlots),
  };
}

export function inventoryWeight(slots: InventorySlotRow[]) {
  return slots.reduce((s, sl) => s + sl.weight * sl.quantity, 0);
}
