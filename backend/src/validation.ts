import { z } from "zod";

const professionValues = ["mago", "guerrero", "paladin", "druida"] as const;

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
  spriteUrl: z.string().trim().url().or(z.literal("")).default(""),
  cards: z.array(cardSchema).length(5),
});

export const updateObjectSchema = createObjectSchema.partial();

export const moveObjectSchema = z.object({
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(11),
});
