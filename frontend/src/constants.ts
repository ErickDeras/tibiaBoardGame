import type { DeckCategory, EquipmentField, EquipmentSlot, SpellDamageSkill } from "./types";

export const RAW_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  "http://localhost:4000";
export const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

/** Si coincide con el backend (SHARED_BOARD_ID), modo sala global con login y WS. */
export const SHARED_BOARD_ID =
  (import.meta.env.VITE_SHARED_BOARD_ID as string | undefined)?.trim() || "";

export const USE_SHARED_ROOM = Boolean(SHARED_BOARD_ID);

export const LIVE_SESSION_TOKEN_KEY = "tbg_live_session_token";
export const LIVE_SESSION_USERNAME_KEY = "tbg_live_session_username";

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "Helmet",
  "Armor",
  "Legs",
  "Boots",
  "Weapon",
  "Shield_Quiver",
  "Necklace",
  "Ring",
  "Backpack",
];

export const FIELD_BY_SLOT: Record<EquipmentSlot, EquipmentField> = {
  Helmet: "helmet",
  Armor: "armor",
  Legs: "legs",
  Boots: "boots",
  Weapon: "weapon",
  Shield_Quiver: "shield",
  Necklace: "necklace",
  Ring: "ring",
  Backpack: "backpackEquipment",
};

export const DECK_CATEGORIES: DeckCategory[] = [
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
];

export const SPELL_DAMAGE_SKILLS: SpellDamageSkill[] = [
  "SWORD",
  "AXE",
  "MACE",
  "SHIELD",
  "DISTANCE",
];
