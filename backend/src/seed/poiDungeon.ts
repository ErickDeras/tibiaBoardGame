import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { normalizeGameObjectCombatAndProgression } from "../services/combatStats.js";

const DUNGEON_NAME = "POI";
const BOARD_NAME = "piso 1";

const exoriCard = (): Prisma.CardCreateWithoutGameObjectInput => ({
  name: "Exori",
  description: "",
  deckCategory: "SPELL_ATTACK",
  manaCost: 2,
  staminaCost: 2,
  capacityCost: null,
  rapidSpell: false,
  spellSkillBonus: 15,
  critMultiplier: null,
  damageSkill: "SWORD",
});

async function spawnCreatureInstance(
  boardId: string,
  templateId: string,
  x: number,
  y: number,
) {
  const template = await prisma.creatureTemplate.findUniqueOrThrow({ where: { id: templateId } });
  await prisma.gameObject.create({
    data: {
      boardId,
      x,
      y,
      name: template.name,
      objectKind: "CREATURE",
      profession: null,
      creatureTemplateId: template.id,
      hitpoints: template.hitpoints,
      manaPoints: template.manaPoints,
      staminaPoints: template.staminaPoints,
      attackValue: template.attackValue,
      defenseValue: template.defenseValue,
      swordSkill: template.swordSkill,
      axeSkill: template.axeSkill,
      maceSkill: template.maceSkill,
      distanceSkill: template.distanceSkill,
      shieldingSkill: template.shieldingSkill,
      magicLevel: template.magicLevel,
      magicAttackValue: 0,
      experiencePoints: 0,
      experienceLevel: 1,
      gold: 0,
      manaRegen: 0,
      staminaRegen: 0,
      capacityMax: 0,
      spriteUrl: template.spriteUrl,
      cards: { create: [] },
    },
  });
}

/**
 * Crea la mazmorra POI con tablero "piso 1", jugador Eternal Oblivion, equipo y criaturas.
 * Idempotente: si ya existe una mazmorra llamada "POI", no hace nada.
 */
export async function seedPoiDungeon(): Promise<void> {
  const existingDungeon = await prisma.dungeon.findFirst({
    where: { name: DUNGEON_NAME },
  });
  if (existingDungeon) {
    console.log(`[seed] Mazmorra "${DUNGEON_NAME}" ya existe; omitiendo POI.`);
    return;
  }

  const board = await prisma.board.create({
    data: { name: BOARD_NAME, width: 12, height: 12 },
  });

  const dungeon = await prisma.dungeon.create({
    data: { name: DUNGEON_NAME, notes: "Configuración predeterminada (POI)", targetLevel: null },
  });

  await prisma.dungeonBoard.create({
    data: {
      dungeonId: dungeon.id,
      boardId: board.id,
      floor: 1,
    },
  });

  await prisma.equipmentItem.create({
    data: {
      boardId: board.id,
      slot: "Weapon",
      name: "Magic Sword",
      valueAttack: 38,
      valueDefense: 20,
      weight: 50,
    },
  });

  const playerBase = {
    x: 0,
    y: 0,
    name: "Eternal Oblivion",
    objectKind: "PLAYER" as const,
    profession: "guerrero" as const,
    helmet: "",
    armor: "",
    legs: "",
    boots: "",
    weapon: "Magic Sword",
    shield: "",
    ring: "",
    necklace: "",
    backpackEquipment: "",
    experiencePoints: 0,
    experienceLevel: 1,
    hitpoints: 100,
    manaPoints: 20,
    staminaPoints: 50,
    attackValue: 0,
    defenseValue: 0,
    magicAttackValue: 0,
    swordSkill: 60,
    axeSkill: 0,
    maceSkill: 0,
    distanceSkill: 0,
    shieldingSkill: 40,
    magicLevel: 0,
    gold: 0,
    manaRegen: 0,
    staminaRegen: 0,
    capacityMax: 800,
    spriteUrl: "",
  };

  const norm = await normalizeGameObjectCombatAndProgression(prisma, board.id, {
    helmet: playerBase.helmet,
    armor: playerBase.armor,
    legs: playerBase.legs,
    boots: playerBase.boots,
    weapon: playerBase.weapon,
    shield: playerBase.shield,
    ring: playerBase.ring,
    necklace: playerBase.necklace,
    backpackEquipment: playerBase.backpackEquipment,
    objectKind: "PLAYER",
    profession: playerBase.profession,
    experiencePoints: playerBase.experiencePoints,
    experienceLevel: playerBase.experienceLevel,
    hitpoints: playerBase.hitpoints,
    manaPoints: playerBase.manaPoints,
    attackValue: playerBase.attackValue,
    defenseValue: playerBase.defenseValue,
    magicAttackValue: playerBase.magicAttackValue,
    swordSkill: playerBase.swordSkill,
    axeSkill: playerBase.axeSkill,
    maceSkill: playerBase.maceSkill,
    distanceSkill: playerBase.distanceSkill,
    shieldingSkill: playerBase.shieldingSkill,
    magicLevel: playerBase.magicLevel,
  });

  await prisma.gameObject.create({
    data: {
      boardId: board.id,
      ...playerBase,
      ...norm,
      cards: {
        create: Array.from({ length: 5 }, () => exoriCard()),
      },
      inventorySlots: { create: [] },
    },
  });

  const tplSlime = await prisma.creatureTemplate.create({
    data: {
      name: "slime",
      hitpoints: 100,
      attackValue: 20,
      defenseValue: 12,
      experiencePoints: 150,
      manaPoints: 0,
      staminaPoints: 80,
      magicLevel: 0,
    },
  });

  const tplCaptain = await prisma.creatureTemplate.create({
    data: {
      name: "Captain Troll",
      hitpoints: 250,
      attackValue: 25,
      defenseValue: 22,
      experiencePoints: 200,
      manaPoints: 10,
      staminaPoints: 120,
      magicLevel: 0,
      abilityName: "Fury",
      abilityManaCost: 1,
      abilityAttackBonus: 10,
    },
  });

  const tplSuper = await prisma.creatureTemplate.create({
    data: {
      name: "Super Troll",
      hitpoints: 450,
      attackValue: 31,
      defenseValue: 25,
      experiencePoints: 400,
      manaPoints: 10,
      staminaPoints: 150,
      magicLevel: 0,
      abilityName: "Berserk",
      abilityManaCost: 1,
      abilityAttackBonus: 12,
    },
  });

  await spawnCreatureInstance(board.id, tplSlime.id, 1, 1);
  await spawnCreatureInstance(board.id, tplSlime.id, 0, 1);
  await spawnCreatureInstance(board.id, tplSlime.id, 0, 2);

  await spawnCreatureInstance(board.id, tplCaptain.id, 7, 1);
  await spawnCreatureInstance(board.id, tplCaptain.id, 4, 2);

  await spawnCreatureInstance(board.id, tplSuper.id, 11, 3);
  await spawnCreatureInstance(board.id, tplSuper.id, 11, 9);

  console.log(`[seed] Mazmorra "${DUNGEON_NAME}" creada (tablero "${BOARD_NAME}", id ${board.id}).`);
}
