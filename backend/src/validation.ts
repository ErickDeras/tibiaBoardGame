import { z } from "zod";

const professionValues = ["mago", "guerrero", "paladin", "druida"] as const;
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
});

export const createBoardSchema = z.object({
  name: z.string().trim().min(1),
});

export const updateBoardSchema = z.object({
  name: z.string().trim().min(1),
});

export const createObjectSchema = z.object({
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(11),
  name: z.string().trim().min(1),
  profession: z.enum(professionValues),
  helmet: z.string().trim().default(""),
  armor: z.string().trim().default(""),
  legs: z.string().trim().default(""),
  boots: z.string().trim().default(""),
  weapon: z.string().trim().default(""),
  shield: z.string().trim().default(""),
  ring: z.string().trim().default(""),
  necklace: z.string().trim().default(""),
  backpack: z.string().trim().default(""),
  hitpoints: z.number().int().min(0),
  manaPoints: z.number().int().min(0),
  staminaPoints: z.number().int().min(0),
  valueAttack: z.number().int().min(0).default(0),
  valueDefense: z.number().int().min(0).default(0),
  swordSkill: z.number().int().min(0).default(0),
  axeSkill: z.number().int().min(0).default(0),
  maceSkill: z.number().int().min(0).default(0),
  distanceSkill: z.number().int().min(0).default(0),
  shieldingSkill: z.number().int().min(0).default(0),
  magicLevel: z.number().int().min(0).default(0),
  experiencePoints: z.number().int().min(0).default(0),
  capacityPoints: z.number().int().min(0).default(0),
  spriteUrl: z.string().trim().url().or(z.literal("")).default(""),
  cards: z.array(cardSchema).length(5),
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
