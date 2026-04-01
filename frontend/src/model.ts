import type {
  Card,
  DeckCategory,
  GameObject,
  InventorySlotRow,
  Profession,
  SpellDamageSkill,
} from "./types";

/** Misma fórmula que el backend (`progression.experienceLevelFromTotalXp`). */
export function experienceLevelFromTotalXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  const disc = 85 * 85 + 60 * xp;
  const raw = Math.floor((-85 + Math.sqrt(disc)) / 30);
  return Math.max(1, raw);
}

/** +1 por nivel; guerrero +1; paladín +2 atk extra (igual que backend). */
export function playerAttackLevelBonusPerStep(profession: Profession | null): number {
  let n = 1;
  if (profession === "guerrero") n += 1;
  if (profession === "paladin") n += 2;
  return n;
}

/** +1 por nivel; guerrero +1 def extra. */
export function playerDefenseLevelBonusPerStep(profession: Profession | null): number {
  let n = 1;
  if (profession === "guerrero") n += 1;
  return n;
}

/** +1 por nivel; mago/druida +2 nivel mágico extra. */
export function playerMagicLevelBonusPerStep(profession: Profession | null): number {
  let n = 1;
  if (profession === "mago" || profession === "druida") n += 2;
  return n;
}

/** Igual que backend `skillAttackPointsForProfession`; `magicBase` = ML base (personaje+ítems, sin bono por nivel). */
export function skillAttackPointsForProfession(
  profession: Profession | null,
  skills: {
    swordSkill: number;
    axeSkill: number;
    maceSkill: number;
    distanceSkill: number;
    magicBase: number;
  },
): number {
  const p = profession;
  const sword = Math.max(0, Math.floor(skills.swordSkill));
  const axe = Math.max(0, Math.floor(skills.axeSkill));
  const mace = Math.max(0, Math.floor(skills.maceSkill));
  const distance = Math.max(0, Math.floor(skills.distanceSkill));
  const magic = Math.max(0, Math.floor(skills.magicBase));
  if (p === "guerrero") return Math.floor(0.1 * (sword + axe + mace));
  if (p === "paladin") return Math.floor(0.1 * distance);
  if (p === "mago" || p === "druida") return Math.floor(0.1 * magic);
  return 0;
}

export function shieldingDefensePointsFromSkill(shieldingSkill: number): number {
  const s = Math.max(0, Math.floor(shieldingSkill));
  return Math.floor(0.1 * s);
}

/** Bonos por nivel (L>1); los valores de HP/Mana del formulario son base nivel 1. */
export function playerHpManaBonusPerLevel(
  profession: Profession | null,
): { hitpoints: number; manaPoints: number } {
  if (profession === "guerrero") return { hitpoints: 15, manaPoints: 5 };
  if (profession === "mago" || profession === "druida") return { hitpoints: 5, manaPoints: 30 };
  if (profession === "paladin") return { hitpoints: 10, manaPoints: 20 };
  return { hitpoints: 0, manaPoints: 0 };
}

/** Convierte totales guardados en API → base para el editor. */
export function playerHitpointsManaBaseFromStored(
  objectKind: GameObject["objectKind"],
  profession: Profession | null,
  experienceLevel: number,
  hitpoints: number,
  manaPoints: number,
): { hitpoints: number; manaPoints: number } {
  if (objectKind !== "PLAYER") return { hitpoints, manaPoints };
  const L = Math.max(1, experienceLevel);
  const { hitpoints: hpG, manaPoints: mpG } = playerHpManaBonusPerLevel(profession);
  const steps = Math.max(0, L - 1);
  return {
    hitpoints: Math.max(0, hitpoints - steps * hpG),
    manaPoints: Math.max(0, manaPoints - steps * mpG),
  };
}

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

export function skillBaseFromDamageSkill(
  o: {
    swordSkill: number;
    axeSkill: number;
    maceSkill: number;
    distanceSkill: number;
    shieldingSkill: number;
  },
  s: SpellDamageSkill | null | undefined,
): number {
  if (s == null) return 0;
  switch (s) {
    case "SWORD":
      return o.swordSkill;
    case "AXE":
      return o.axeSkill;
    case "MACE":
      return o.maceSkill;
    case "SHIELD":
      return o.shieldingSkill;
    case "DISTANCE":
      return o.distanceSkill;
    default:
      return 0;
  }
}

export function normalizeCards(raw: Card[] | undefined): Card[] {
  if (!raw?.length) return [];
  return raw.slice(0, 5).map((c, i) => ({
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
    damageSkill: c.damageSkill ?? null,
  }));
}

export function normalizeGameObject(obj: GameObject): GameObject {
  return {
    ...obj,
    objectKind: obj.objectKind ?? "PLAYER",
    profession: obj.profession ?? null,
    creatureTemplateId: obj.creatureTemplateId ?? null,
    backpackEquipment: obj.backpackEquipment ?? "",
    magicAttackValue: obj.magicAttackValue ?? 0,
    floor: obj.floor ?? null,
    cards: normalizeCards(obj.cards),
    inventorySlots: normalizeInventorySlots(obj.inventorySlots),
  };
}

export function inventoryWeight(slots: InventorySlotRow[]) {
  return slots.reduce((s, sl) => s + sl.weight * sl.quantity, 0);
}
