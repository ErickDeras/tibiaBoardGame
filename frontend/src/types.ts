export type Profession = "mago" | "guerrero" | "paladin" | "druida";

export type ObjectKind = "PLAYER" | "CREATURE";

export type DeckCategory =
  | "SPELL_ATTACK"
  | "SPELL_SUPPORT"
  | "SPELL_DEFENSIVE"
  | "SPELL_HEALING"
  | "RUNE_ATTACK"
  | "RUNE_SUPPORT"
  | "RUNE_DEFENSIVE"
  | "RUNE_HEALING"
  | "ITEM_ATTACK"
  | "ITEM_SUPPORT"
  | "ITEM_DEFENSIVE"
  | "ITEM_HEALING";

export type SpellDamageSkill = "SWORD" | "AXE" | "MACE" | "SHIELD" | "DISTANCE";

export type Card = {
  id?: string;
  name: string;
  description: string;
  deckCategory: DeckCategory;
  manaCost: number | null;
  staminaCost: number | null;
  capacityCost: number | null;
  rapidSpell: boolean;
  spellSkillBonus: number;
  critMultiplier: number | null;
  damageSkill: SpellDamageSkill | null;
};

export type CardTemplate = {
  id: string;
  name: string;
  description: string;
  deckCategory: DeckCategory;
  manaCost: number | null;
  staminaCost: number | null;
  capacityCost: number | null;
  rapidSpell: boolean;
  spellSkillBonus: number;
  critMultiplier: number | null;
  damageSkill: SpellDamageSkill | null;
};

export type InventorySlotRow = {
  id?: string;
  slotIndex: number;
  itemName: string;
  weight: number;
  quantity: number;
};

export type Board = {
  id: string;
  name: string;
  width: number;
  height: number;
  _count?: { objects: number };
};

export type GameObject = {
  id: string;
  boardId: string;
  x: number;
  y: number;
  name: string;
  objectKind: ObjectKind;
  profession: Profession | null;
  creatureTemplateId: string | null;
  helmet: string;
  armor: string;
  legs: string;
  boots: string;
  weapon: string;
  shield: string;
  ring: string;
  necklace: string;
  backpackEquipment: string;
  hitpoints: number;
  manaPoints: number;
  staminaPoints: number;
  attackValue: number;
  defenseValue: number;
  magicAttackValue: number;
  swordSkill: number;
  axeSkill: number;
  maceSkill: number;
  distanceSkill: number;
  shieldingSkill: number;
  magicLevel: number;
  experiencePoints: number;
  experienceLevel: number;
  gold: number;
  manaRegen: number;
  staminaRegen: number;
  capacityMax: number;
  spriteUrl: string;
  cards: Card[];
  inventorySlots: InventorySlotRow[];
  /** Piso de mazmorra (1–4) si el tablero está enlazado; si no, null */
  floor?: number | null;
};

export type ObjectForm = Omit<GameObject, "id" | "boardId">;
export type SyncObjectPayload = Omit<GameObject, "boardId">;

export type EquipmentField =
  | "helmet"
  | "armor"
  | "legs"
  | "boots"
  | "weapon"
  | "shield"
  | "necklace"
  | "ring"
  | "backpackEquipment";

export type EquipmentSlot =
  | "Helmet"
  | "Armor"
  | "Legs"
  | "Boots"
  | "Weapon"
  | "Shield_Quiver"
  | "Necklace"
  | "Ring"
  | "Backpack";

export type EquipmentValue = {
  id: string;
  slot: EquipmentSlot;
  name: string;
  valueAttack: number;
  valueDefense: number;
  swordSkill: number;
  axeSkill: number;
  maceSkill: number;
  distanceSkill: number;
  shieldingSkill: number;
  magicLevel: number;
  weight: number;
};

export type EquipmentEditorForm = Omit<EquipmentValue, "id"> & { id?: string };

export type BaseStats = {
  attackValue: number;
  defenseValue: number;
  swordSkill: number;
  axeSkill: number;
  maceSkill: number;
  distanceSkill: number;
  shieldingSkill: number;
  magicLevel: number;
  capacityMax: number;
};

export type DungeonFloor = {
  id: string;
  floor: number;
  boardId: string;
  board: Board;
};

export type Dungeon = {
  id: string;
  name: string;
  notes: string;
  targetLevel: number | null;
  floors: DungeonFloor[];
};

export type LootEntry = {
  id: string;
  creatureTemplateId: string;
  itemName: string;
  weight: number;
  quantity: number;
  itemTemplateId?: string | null;
};

export type CreatureTemplate = {
  id: string;
  name: string;
  spriteUrl: string;
  hitpoints: number;
  manaPoints: number;
  staminaPoints: number;
  attackValue: number;
  defenseValue: number;
  swordSkill: number;
  axeSkill: number;
  maceSkill: number;
  distanceSkill: number;
  shieldingSkill: number;
  magicLevel: number;
  abilityName: string;
  abilityManaCost: number;
  abilityAttackBonus: number;
  lootEntries: LootEntry[];
};

export type CombatLogEntry = {
  id: string;
  sessionId: string;
  createdAt: string;
  type: string;
  payload: Record<string, unknown>;
};

export type CombatSession = {
  id: string;
  boardId: string;
  status: "ACTIVE" | "ENDED";
  startedAt: string;
  endedAt: string | null;
  turnOrder: unknown;
  turnIndex: number;
  generation: number;
  pendingAddIds: unknown;
  currentActorId: string | null;
  actorTurnState: unknown;
  logEntries?: CombatLogEntry[];
};

export type GroundLoot = {
  id: string;
  boardId: string;
  x: number;
  y: number;
  itemName: string;
  weight: number;
  quantity: number;
  itemTemplateId: string | null;
};

export type ItemTemplate = {
  id: string;
  name: string;
  description: string;
  weight: number;
};
