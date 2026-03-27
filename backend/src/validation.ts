import { z } from "zod";

const professionValues = ["mago", "guerrero", "paladin", "druida"] as const;
const objectKindValues = ["PLAYER", "CREATURE"] as const;
const deckCategoryValues = [
  "SPELL_ATTACK",
  "SPELL_SUPPORT",
  "SPELL_DEFENSIVE",
  "SPELL_HEALING",
  "RUNE_ATTACK",
  "RUNE_SUPPORT",
  "RUNE_DEFENSIVE",
  "RUNE_HEALING",
  "ITEM_ATTACK",
  "ITEM_SUPPORT",
  "ITEM_DEFENSIVE",
  "ITEM_HEALING",
] as const;
const equipmentSlots = [
  "Helmet",
  "Armor",
  "Legs",
  "Boots",
  "Weapon",
  "Shield_Quiver",
  "Necklace",
  "Ring",
  "Backpack",
] as const;

const cardSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().default(""),
  deckCategory: z.enum(deckCategoryValues).default("SPELL_ATTACK"),
  manaCost: z.number().int().min(0).nullable().optional(),
  staminaCost: z.number().int().min(0).nullable().optional(),
  capacityCost: z.number().int().min(0).nullable().optional(),
  rapidSpell: z.boolean().default(false),
  spellSkillBonus: z.number().int().min(0).default(0),
  critMultiplier: z.number().int().min(1).nullable().optional(),
});

const inventorySlotSchema = z.object({
  id: z.string().trim().min(1).optional(),
  slotIndex: z.number().int().min(0),
  itemName: z.string().trim().min(1),
  weight: z.number().int().min(0).default(0),
  quantity: z.number().int().min(1).default(1),
});

export const createBoardSchema = z.object({
  name: z.string().trim().min(1),
});

export const updateBoardSchema = z.object({
  name: z.string().trim().min(1),
});

export const createDungeonSchema = z.object({
  name: z.string().trim().min(1),
  notes: z.string().trim().default(""),
  targetLevel: z.number().int().min(0).nullable().optional(),
});

export const updateDungeonSchema = createDungeonSchema.partial();

export const setDungeonFloorSchema = z.object({
  boardId: z.string().trim().min(1),
  floor: z.number().int().min(1).max(4),
});

export const createObjectSchema = z.object({
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(11),
  name: z.string().trim().min(1),
  objectKind: z.enum(objectKindValues).default("PLAYER"),
  profession: z.enum(professionValues).optional().nullable(),
  creatureTemplateId: z.string().trim().min(1).optional().nullable(),
  helmet: z.string().trim().default(""),
  armor: z.string().trim().default(""),
  legs: z.string().trim().default(""),
  boots: z.string().trim().default(""),
  weapon: z.string().trim().default(""),
  shield: z.string().trim().default(""),
  ring: z.string().trim().default(""),
  necklace: z.string().trim().default(""),
  backpackEquipment: z.string().trim().default(""),
  hitpoints: z.number().int().min(0),
  manaPoints: z.number().int().min(0),
  staminaPoints: z.number().int().min(0),
  attackValue: z.number().int().min(0).default(0),
  defenseValue: z.number().int().min(0).default(0),
  magicAttackValue: z.number().int().min(0).default(0),
  swordSkill: z.number().int().min(0).default(0),
  axeSkill: z.number().int().min(0).default(0),
  maceSkill: z.number().int().min(0).default(0),
  distanceSkill: z.number().int().min(0).default(0),
  shieldingSkill: z.number().int().min(0).default(0),
  magicLevel: z.number().int().min(0).default(0),
  experiencePoints: z.number().int().min(0).default(0),
  experienceLevel: z.number().int().min(1).default(1),
  gold: z.number().int().min(0).default(0),
  manaRegen: z.number().int().min(0).default(0),
  staminaRegen: z.number().int().min(0).default(0),
  capacityMax: z.number().int().min(0).default(0),
  spriteUrl: z.string().trim().url().or(z.literal("")).default(""),
  cards: z.array(cardSchema).length(5),
  inventorySlots: z.array(inventorySlotSchema).default([]),
});

export const updateObjectSchema = createObjectSchema.partial();

export const moveObjectSchema = z.object({
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(11),
});

export const syncObjectsSchema = z.object({
  objects: z.array(
    createObjectSchema.extend({
      id: z.string().trim().min(1).optional(),
    }),
  ),
});

export const createEquipmentItemSchema = z.object({
  slot: z.enum(equipmentSlots),
  name: z.string().trim().min(1),
  valueAttack: z.number().int().min(0).default(0),
  valueDefense: z.number().int().min(0).default(0),
  swordSkill: z.number().int().min(0).default(0),
  axeSkill: z.number().int().min(0).default(0),
  maceSkill: z.number().int().min(0).default(0),
  distanceSkill: z.number().int().min(0).default(0),
  shieldingSkill: z.number().int().min(0).default(0),
  magicLevel: z.number().int().min(0).default(0),
  weight: z.number().int().min(0).default(0),
});

export const updateEquipmentItemSchema = createEquipmentItemSchema.partial();

export const createCreatureTemplateSchema = z.object({
  name: z.string().trim().min(1),
  spriteUrl: z.string().trim().url().or(z.literal("")).default(""),
  hitpoints: z.number().int().min(0).default(10),
  manaPoints: z.number().int().min(0).default(0),
  staminaPoints: z.number().int().min(0).default(0),
  attackValue: z.number().int().min(0).default(0),
  defenseValue: z.number().int().min(0).default(0),
  swordSkill: z.number().int().min(0).default(0),
  axeSkill: z.number().int().min(0).default(0),
  maceSkill: z.number().int().min(0).default(0),
  distanceSkill: z.number().int().min(0).default(0),
  shieldingSkill: z.number().int().min(0).default(0),
  magicLevel: z.number().int().min(0).default(0),
});

export const updateCreatureTemplateSchema = createCreatureTemplateSchema.partial();

export const createLootEntrySchema = z.object({
  itemName: z.string().trim().min(1),
  weight: z.number().int().min(0).default(0),
  quantity: z.number().int().min(1).default(1),
});

export const spawnCreatureSchema = z.object({
  templateId: z.string().trim().min(1),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(11),
});

export const collectLootSchema = z.object({
  collectorObjectId: z.string().trim().min(1),
});
