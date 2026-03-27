import type { EquipmentSlot, PrismaClient } from "@prisma/client";

/** Cliente de transacción o Prisma global (mismo delegado `equipmentItem`). */
export type PrismaEquipmentClient = Pick<PrismaClient, "equipmentItem">;
import {
  computeAttackValue,
  computeDefenseValue,
  computeMagicAttackValue,
  experienceLevelFromTotalXp,
} from "./progression.js";

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
 * - Ataque mágico base: mismo ítem Weapon → valueAttack + magicLevel (runas escalan con magicAttackValue).
 */
export async function sumEquipmentStats(
  prisma: PrismaEquipmentClient,
  boardId: string,
  equipment: EquipmentStrings,
): Promise<{ weaponAttack: number; armorDefense: number; magicWeaponPoints: number }> {
  let weaponAttack = 0;
  let magicWeaponPoints = 0;

  if (equipment.weapon.trim()) {
    const w = await prisma.equipmentItem.findUnique({
      where: {
        boardId_slot_name: { boardId, slot: "Weapon", name: equipment.weapon.trim() },
      },
    });
    if (w) {
      weaponAttack = w.valueAttack;
      magicWeaponPoints = w.valueAttack + w.magicLevel;
    }
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

  return { weaponAttack, armorDefense, magicWeaponPoints };
}

type ObjectKind = "PLAYER" | "CREATURE";

export type NormalizeInput = EquipmentStrings & {
  objectKind: ObjectKind;
  experiencePoints: number;
  experienceLevel: number;
  attackValue: number;
  defenseValue: number;
  magicAttackValue?: number;
};

export type NormalizeResult = {
  experienceLevel: number;
  attackValue: number;
  defenseValue: number;
  magicAttackValue: number;
};

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
  const { weaponAttack, armorDefense, magicWeaponPoints } = await sumEquipmentStats(
    prisma,
    boardId,
    data,
  );

  return {
    experienceLevel: expLevel,
    attackValue: computeAttackValue(weaponAttack, expLevel),
    defenseValue: computeDefenseValue(armorDefense, expLevel),
    magicAttackValue: computeMagicAttackValue(magicWeaponPoints, expLevel),
  };
}
