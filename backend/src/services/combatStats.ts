import type { EquipmentSlot, PrismaClient } from "@prisma/client";

/** Cliente de transacción o Prisma global (mismo delegado `equipmentItem`). */
export type PrismaEquipmentClient = Pick<PrismaClient, "equipmentItem">;
import { experienceLevelFromTotalXp } from "./progression.js";

type Profession = "mago" | "guerrero" | "paladin" | "druida";

export type EquipmentStrings = {
  helmet: string;
  armor: string;
  legs: string;
  boots: string;
  weapon: string;
  shield: string;
  ring: string;
  necklace: string;
  backpackEquipment: string;
};

const DEFENSE_SLOTS: { field: keyof EquipmentStrings; slot: EquipmentSlot }[] = [
  { field: "helmet", slot: "Helmet" },
  { field: "armor", slot: "Armor" },
  { field: "legs", slot: "Legs" },
  { field: "boots", slot: "Boots" },
  { field: "weapon", slot: "Weapon" },
  { field: "shield", slot: "Shield_Quiver" },
  { field: "ring", slot: "Ring" },
  { field: "necklace", slot: "Necklace" },
  { field: "backpackEquipment", slot: "Backpack" },
];

/**
 * Convención (documento + equipo actual):
 * - Ataque físico del equipo: solo Weapon.valueAttack.
 * - Defensa: suma valueDefense de todos los slots con ítem equipado.
 * - Ataque mágico / nivel mágico: base del personaje + bono plano por nivel (+ extras mago/druida); sin multiplicador % por nivel.
 */
export async function sumEquipmentStats(
  prisma: PrismaEquipmentClient,
  boardId: string,
  equipment: EquipmentStrings,
): Promise<{ weaponAttack: number; armorDefense: number }> {
  let weaponAttack = 0;

  if (equipment.weapon.trim()) {
    const w = await prisma.equipmentItem.findUnique({
      where: {
        boardId_slot_name: { boardId, slot: "Weapon", name: equipment.weapon.trim() },
      },
    });
    if (w) weaponAttack = w.valueAttack;
  }

  let armorDefense = 0;
  for (const { field, slot } of DEFENSE_SLOTS) {
    const name = equipment[field].trim();
    if (!name) continue;
    const item = await prisma.equipmentItem.findUnique({
      where: { boardId_slot_name: { boardId, slot, name } },
    });
    if (item) armorDefense += item.valueDefense;
  }

  return { weaponAttack, armorDefense };
}

type ObjectKind = "PLAYER" | "CREATURE";

export type NormalizeInput = EquipmentStrings & {
  objectKind: ObjectKind;
  profession?: Profession | null;
  experiencePoints: number;
  experienceLevel: number;
  hitpoints: number;
  manaPoints: number;
  attackValue: number;
  defenseValue: number;
  magicAttackValue?: number;
  swordSkill?: number;
  axeSkill?: number;
  maceSkill?: number;
  distanceSkill?: number;
  shieldingSkill?: number;
  magicLevel?: number;
};

export type NormalizeResult = {
  experienceLevel: number;
  attackValue: number;
  defenseValue: number;
  magicAttackValue: number;
  magicLevel?: number;
  hitpoints?: number;
  manaPoints?: number;
};

/** +1 por nivel para todos; caballero +1 atk extra; paladín +2 atk extra. */
export function playerAttackLevelBonusPerStep(profession: Profession | null | undefined): number {
  const p = profession ?? null;
  let n = 1;
  if (p === "guerrero") n += 1;
  if (p === "paladin") n += 2;
  return n;
}

/** +1 por nivel para todos; caballero +1 def extra. */
export function playerDefenseLevelBonusPerStep(profession: Profession | null | undefined): number {
  const p = profession ?? null;
  let n = 1;
  if (p === "guerrero") n += 1;
  return n;
}

/** +1 por nivel para todos; mago/druida +2 nivel mágico extra. */
export function playerMagicLevelBonusPerStep(profession: Profession | null | undefined): number {
  const p = profession ?? null;
  let n = 1;
  if (p === "mago" || p === "druida") n += 2;
  return n;
}

function skillAttackPointsForProfession(
  profession: Profession | null | undefined,
  skills: {
    swordSkill?: number;
    axeSkill?: number;
    maceSkill?: number;
    distanceSkill?: number;
    magicLevel?: number;
  },
): number {
  const p = profession ?? null;
  const sword = Math.max(0, Math.floor(skills.swordSkill ?? 0));
  const axe = Math.max(0, Math.floor(skills.axeSkill ?? 0));
  const mace = Math.max(0, Math.floor(skills.maceSkill ?? 0));
  const distance = Math.max(0, Math.floor(skills.distanceSkill ?? 0));
  const magic = Math.max(0, Math.floor(skills.magicLevel ?? 0));

  // Conversión: 10% del total de skill points por categoría relevante.
  if (p === "guerrero") return Math.floor(0.1 * (sword + axe + mace));
  if (p === "paladin") return Math.floor(0.1 * distance);
  if (p === "mago" || p === "druida") return Math.floor(0.1 * magic);
  return 0;
}

function shieldingDefensePoints(shieldingSkill: number | undefined): number {
  const s = Math.max(0, Math.floor(shieldingSkill ?? 0));
  return Math.floor(0.1 * s);
}

/** Por nivel adicional (L>1): bonos de HP / mana según vocación. `hitpoints`/`manaPoints` entrantes son base nivel 1. */
export function playerHpManaBonusPerLevel(profession: Profession | null | undefined): {
  hitpoints: number;
  manaPoints: number;
} {
  const p = profession ?? null;
  if (p === "guerrero") return { hitpoints: 15, manaPoints: 5 };
  if (p === "mago" || p === "druida") return { hitpoints: 5, manaPoints: 30 };
  if (p === "paladin") return { hitpoints: 10, manaPoints: 20 };
  return { hitpoints: 0, manaPoints: 0 };
}

export async function normalizeGameObjectCombatAndProgression(
  prisma: PrismaEquipmentClient,
  boardId: string,
  data: NormalizeInput,
): Promise<NormalizeResult> {
  if (data.objectKind === "CREATURE") {
    return {
      experienceLevel: data.experienceLevel,
      attackValue: data.attackValue,
      defenseValue: data.defenseValue,
      magicAttackValue: data.magicAttackValue ?? 0,
    };
  }

  const expLevel = experienceLevelFromTotalXp(data.experiencePoints);
  const { weaponAttack, armorDefense } = await sumEquipmentStats(prisma, boardId, data);

  const atkFromSkills = skillAttackPointsForProfession(data.profession, {
    swordSkill: data.swordSkill,
    axeSkill: data.axeSkill,
    maceSkill: data.maceSkill,
    distanceSkill: data.distanceSkill,
    magicLevel: data.magicLevel,
  });
  const defFromShieldSkill = shieldingDefensePoints(data.shieldingSkill);

  const { hitpoints: hpPerLv, manaPoints: mpPerLv } = playerHpManaBonusPerLevel(data.profession);
  const leveling = Math.max(0, expLevel - 1);
  const baseHp = Math.max(0, Math.floor(data.hitpoints));
  const baseMp = Math.max(0, Math.floor(data.manaPoints));
  const baseMl = Math.max(0, Math.floor(data.magicLevel ?? 0));
  const atkStep = playerAttackLevelBonusPerStep(data.profession);
  const defStep = playerDefenseLevelBonusPerStep(data.profession);
  const mlStep = playerMagicLevelBonusPerStep(data.profession);
  const effectiveMagicLevel = baseMl + leveling * mlStep;

  return {
    experienceLevel: expLevel,
    attackValue: weaponAttack + atkFromSkills + leveling * atkStep,
    defenseValue: armorDefense + defFromShieldSkill + leveling * defStep,
    magicAttackValue: effectiveMagicLevel,
    magicLevel: effectiveMagicLevel,
    hitpoints: baseHp + leveling * hpPerLv,
    manaPoints: baseMp + leveling * mpPerLv,
  };
}
