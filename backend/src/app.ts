import cors from "cors";
import express from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import {
  normalizeGameObjectCombatAndProgression,
  playerHpManaBonusPerLevel,
  playerMagicLevelBonusPerStep,
} from "./services/combatStats.js";
import { experienceLevelFromTotalXp } from "./services/progression.js";
import {
  collectLootSchema,
  createBoardSchema,
  createCreatureTemplateSchema,
  createDungeonSchema,
  createEquipmentItemSchema,
  createLootEntrySchema,
  createObjectSchema,
  moveObjectSchema,
  setDungeonFloorSchema,
  spawnCreatureSchema,
  syncObjectsSchema,
  updateBoardSchema,
  updateCreatureTemplateSchema,
  updateDungeonSchema,
  updateEquipmentItemSchema,
  updateObjectSchema,
} from "./validation.js";

export const app = express();

app.use(cors());
app.use(express.json());

function mergeDefined<E extends Record<string, unknown>>(base: E, patch: Partial<E>): E {
  const out = { ...base };
  for (const k of Object.keys(patch) as (keyof E)[]) {
    const v = patch[k];
    if (v !== undefined) (out as Record<string, unknown>)[k as string] = v as unknown;
  }
  return out;
}

function cardToCreate(card: {
  name: string;
  description: string;
  deckCategory: string;
  manaCost?: number | null;
  staminaCost?: number | null;
  capacityCost?: number | null;
  rapidSpell?: boolean;
  spellSkillBonus?: number;
  critMultiplier?: number | null;
}) {
  return {
    name: card.name,
    description: card.description,
    deckCategory: card.deckCategory as Prisma.CardCreateManyGameObjectInput["deckCategory"],
    manaCost: card.manaCost ?? null,
    staminaCost: card.staminaCost ?? null,
    capacityCost: card.capacityCost ?? null,
    rapidSpell: card.rapidSpell ?? false,
    spellSkillBonus: card.spellSkillBonus ?? 0,
    critMultiplier: card.critMultiplier ?? null,
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/dungeons", async (_req, res) => {
  const list = await prisma.dungeon.findMany({
    orderBy: { createdAt: "asc" },
    include: { floors: { include: { board: true } } },
  });
  res.json(list);
});

app.get("/dungeons/:id", async (req, res) => {
  const d = await prisma.dungeon.findUnique({
    where: { id: req.params.id },
    include: { floors: { include: { board: true } } },
  });
  if (!d) return res.status(404).json({ message: "Mazmorra no encontrada" });
  res.json(d);
});

app.post("/dungeons", async (req, res) => {
  const parsed = createDungeonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const d = await prisma.dungeon.create({ data: parsed.data });
  res.status(201).json(d);
});

app.patch("/dungeons/:id", async (req, res) => {
  const parsed = updateDungeonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  try {
    const d = await prisma.dungeon.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(d);
  } catch {
    res.status(404).json({ message: "Mazmorra no encontrada" });
  }
});

app.delete("/dungeons/:id", async (req, res) => {
  try {
    await prisma.dungeon.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "Mazmorra no encontrada" });
  }
});

app.post("/dungeons/:id/floors", async (req, res) => {
  const parsed = setDungeonFloorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const dungeon = await prisma.dungeon.findUnique({ where: { id: req.params.id } });
  if (!dungeon) return res.status(404).json({ message: "Mazmorra no encontrada" });

  const board = await prisma.board.findUnique({ where: { id: parsed.data.boardId } });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });

  try {
    await prisma.dungeonBoard.deleteMany({
      where: { dungeonId: req.params.id, floor: parsed.data.floor },
    });
    const link = await prisma.dungeonBoard.create({
      data: {
        dungeonId: req.params.id,
        boardId: parsed.data.boardId,
        floor: parsed.data.floor,
      },
      include: { board: true },
    });
    res.status(201).json(link);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Board ya asignado a otra mazmorra o piso duplicado" });
    }
    throw error;
  }
});

app.get("/creature-templates", async (_req, res) => {
  const list = await prisma.creatureTemplate.findMany({
    orderBy: { name: "asc" },
    include: { lootEntries: true },
  });
  res.json(list);
});

app.post("/creature-templates", async (req, res) => {
  const parsed = createCreatureTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const t = await prisma.creatureTemplate.create({ data: parsed.data, include: { lootEntries: true } });
  res.status(201).json(t);
});

app.patch("/creature-templates/:id", async (req, res) => {
  const parsed = updateCreatureTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  try {
    const t = await prisma.creatureTemplate.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { lootEntries: true },
    });
    res.json(t);
  } catch {
    res.status(404).json({ message: "Plantilla no encontrada" });
  }
});

app.delete("/creature-templates/:id", async (req, res) => {
  try {
    await prisma.creatureTemplate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "Plantilla no encontrada" });
  }
});

app.post("/creature-templates/:id/loot", async (req, res) => {
  const parsed = createLootEntrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const t = await prisma.creatureTemplate.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ message: "Plantilla no encontrada" });
  const entry = await prisma.lootEntry.create({
    data: { creatureTemplateId: req.params.id, ...parsed.data },
  });
  res.status(201).json(entry);
});

app.delete("/loot-entries/:id", async (req, res) => {
  try {
    await prisma.lootEntry.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "Loot no encontrado" });
  }
});

app.post("/boards/:boardId/spawn-creature", async (req, res) => {
  const parsed = spawnCreatureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const board = await prisma.board.findUnique({ where: { id: req.params.boardId } });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });

  const template = await prisma.creatureTemplate.findUnique({ where: { id: parsed.data.templateId } });
  if (!template) return res.status(404).json({ message: "Plantilla no encontrada" });

  const occupied = await prisma.gameObject.findFirst({
    where: { boardId: req.params.boardId, x: parsed.data.x, y: parsed.data.y },
  });
  if (occupied) return res.status(409).json({ message: "La celda ya esta ocupada" });

  const emptyCards = Array.from({ length: 5 }).map((_, i) => ({
    name: `Carta ${i + 1}`,
    description: "",
    deckCategory: "SPELL_ATTACK" as const,
    manaCost: null as number | null,
    staminaCost: null as number | null,
    capacityCost: null as number | null,
  }));

  try {
    const obj = await prisma.gameObject.create({
      data: {
        boardId: req.params.boardId,
        x: parsed.data.x,
        y: parsed.data.y,
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
        cards: { create: emptyCards.map(cardToCreate) },
      },
      include: { cards: true, inventorySlots: true },
    });
    res.status(201).json(obj);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "La celda ya esta ocupada" });
    }
    throw error;
  }
});

app.post("/objects/:id/collect-loot", async (req, res) => {
  const parsed = collectLootSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const creature = await prisma.gameObject.findUnique({
    where: { id: req.params.id },
    include: { creatureTemplate: { include: { lootEntries: true } } },
  });
  if (!creature || creature.objectKind !== "CREATURE") {
    return res.status(400).json({ message: "El objeto no es una criatura" });
  }

  const collector = await prisma.gameObject.findFirst({
    where: { id: parsed.data.collectorObjectId, objectKind: "PLAYER" },
    include: { inventorySlots: true },
  });
  if (!collector) return res.status(404).json({ message: "Coleccionista no encontrado" });

  const loot = creature.creatureTemplate?.lootEntries ?? [];
  if (loot.length === 0) {
    return res.json({ added: [], message: "Sin loot definido" });
  }

  const usedWeight = collector.inventorySlots.reduce(
    (s, sl) => s + sl.weight * sl.quantity,
    0,
  );
  const lootWeight = loot.reduce((s, e) => s + e.weight * e.quantity, 0);
  if (usedWeight + lootWeight > collector.capacityMax) {
    return res.status(400).json({
      message: "Capacidad insuficiente para todo el loot",
      usedWeight,
      lootWeight,
      capacityMax: collector.capacityMax,
    });
  }

  const maxIdx = collector.inventorySlots.reduce((m, sl) => Math.max(m, sl.slotIndex), -1);
  let nextSlot = maxIdx + 1;

  const created = await prisma.$transaction(async (tx) => {
    const rows: Awaited<ReturnType<typeof tx.inventorySlot.create>>[] = [];
    for (const entry of loot) {
      rows.push(
        await tx.inventorySlot.create({
          data: {
            gameObjectId: collector.id,
            slotIndex: nextSlot++,
            itemName: entry.itemName,
            weight: entry.weight,
            quantity: entry.quantity,
          },
        }),
      );
    }
    return rows;
  });

  const updated = await prisma.gameObject.findUnique({
    where: { id: collector.id },
    include: { inventorySlots: true, cards: true },
  });
  res.json({ added: created, collector: updated });
});

app.get("/boards", async (_req, res) => {
  const boards = await prisma.board.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { objects: true } } },
  });
  res.json(boards);
});

app.post("/boards", async (req, res) => {
  const parsed = createBoardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const board = await prisma.board.create({ data: parsed.data });
  res.status(201).json(board);
});

app.patch("/boards/:id", async (req, res) => {
  const parsed = updateBoardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  try {
    const board = await prisma.board.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(board);
  } catch {
    res.status(404).json({ message: "Board no encontrado" });
  }
});

app.delete("/boards/:id", async (req, res) => {
  try {
    await prisma.board.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "Board no encontrado" });
  }
});

app.get("/boards/:id/objects", async (req, res) => {
  const board = await prisma.board.findUnique({
    where: { id: req.params.id },
    include: {
      objects: {
        include: { cards: true, inventorySlots: true },
        orderBy: [{ y: "asc" }, { x: "asc" }],
      },
    },
  });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });
  res.json(board.objects);
});

app.get("/boards/:id/equipment-items", async (req, res) => {
  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });

  const items = await prisma.equipmentItem.findMany({
    where: { boardId: req.params.id },
    orderBy: [{ slot: "asc" }, { name: "asc" }],
  });
  res.json(items);
});

app.post("/boards/:id/equipment-items", async (req, res) => {
  const parsed = createEquipmentItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });

  try {
    const item = await prisma.equipmentItem.create({
      data: { boardId: req.params.id, ...parsed.data },
    });
    res.status(201).json(item);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({ message: "Ya existe item con ese slot/nombre" });
    }
    throw error;
  }
});

app.patch("/equipment-items/:id", async (req, res) => {
  const parsed = updateEquipmentItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  try {
    const item = await prisma.equipmentItem.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(item);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return res.status(404).json({ message: "Item no encontrado" });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({ message: "Ya existe item con ese slot/nombre" });
    }
    throw error;
  }
});

app.delete("/equipment-items/:id", async (req, res) => {
  try {
    await prisma.equipmentItem.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "Item no encontrado" });
  }
});

function sameCard(
  a: {
    name: string;
    description: string;
    deckCategory: string;
    manaCost: number | null;
    staminaCost: number | null;
    capacityCost: number | null;
    rapidSpell: boolean;
    spellSkillBonus: number;
    critMultiplier: number | null;
  },
  b: {
    name?: string;
    description?: string;
    deckCategory?: string;
    manaCost?: number | null;
    staminaCost?: number | null;
    capacityCost?: number | null;
    rapidSpell?: boolean;
    spellSkillBonus?: number;
    critMultiplier?: number | null;
  },
) {
  return (
    a.name === b.name &&
    a.description === (b.description ?? "") &&
    a.deckCategory === (b.deckCategory ?? "SPELL_ATTACK") &&
    a.manaCost === (b.manaCost ?? null) &&
    a.staminaCost === (b.staminaCost ?? null) &&
    a.capacityCost === (b.capacityCost ?? null) &&
    a.rapidSpell === (b.rapidSpell ?? false) &&
    a.spellSkillBonus === (b.spellSkillBonus ?? 0) &&
    a.critMultiplier === (b.critMultiplier ?? null)
  );
}

app.post("/boards/:id/sync", async (req, res) => {
  const parsed = syncObjectsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });

  let created = 0;
  let updated = 0;
  let merged = 0;

  const synced = await prisma.$transaction(async (tx) => {
    const result = [];
    for (const incoming of parsed.data.objects) {
      const { id: _incomingId, cards, inventorySlots, ...restIn } = incoming;
      const norm = await normalizeGameObjectCombatAndProgression(tx, req.params.id, {
        helmet: restIn.helmet,
        armor: restIn.armor,
        legs: restIn.legs,
        boots: restIn.boots,
        weapon: restIn.weapon,
        shield: restIn.shield,
        ring: restIn.ring,
        necklace: restIn.necklace,
        backpackEquipment: restIn.backpackEquipment,
        objectKind: restIn.objectKind,
        profession: restIn.profession,
        experiencePoints: restIn.experiencePoints,
        experienceLevel: restIn.experienceLevel,
        hitpoints: restIn.hitpoints,
        manaPoints: restIn.manaPoints,
        attackValue: restIn.attackValue,
        defenseValue: restIn.defenseValue,
        magicAttackValue: restIn.magicAttackValue ?? 0,
        swordSkill: restIn.swordSkill,
        axeSkill: restIn.axeSkill,
        maceSkill: restIn.maceSkill,
        distanceSkill: restIn.distanceSkill,
        shieldingSkill: restIn.shieldingSkill,
        magicLevel: restIn.magicLevel,
      });
      const incomingRest = { ...restIn, ...norm };

      const existing = incoming.id
        ? await tx.gameObject.findFirst({
            where: { id: incoming.id, boardId: req.params.id },
            include: { cards: true, inventorySlots: true },
          })
        : null;

      if (!existing) {
        const createdObject = await tx.gameObject.create({
          data: {
            boardId: req.params.id,
            ...incomingRest,
            cards: { create: cards.map(cardToCreate) },
            inventorySlots: {
              create: inventorySlots.map(({ slotIndex, itemName, weight, quantity }) => ({
                slotIndex,
                itemName,
                weight,
                quantity,
              })),
            },
          },
          include: { cards: true, inventorySlots: true },
        });
        created += 1;
        result.push(createdObject);
        continue;
      }

      const sameFields =
        existing.x === incomingRest.x &&
        existing.y === incomingRest.y &&
        existing.name === incomingRest.name &&
        existing.objectKind === incomingRest.objectKind &&
        existing.profession === incomingRest.profession &&
        existing.creatureTemplateId === incomingRest.creatureTemplateId &&
        existing.helmet === incomingRest.helmet &&
        existing.armor === incomingRest.armor &&
        existing.legs === incomingRest.legs &&
        existing.boots === incomingRest.boots &&
        existing.weapon === incomingRest.weapon &&
        existing.shield === incomingRest.shield &&
        existing.ring === incomingRest.ring &&
        existing.necklace === incomingRest.necklace &&
        existing.backpackEquipment === incomingRest.backpackEquipment &&
        existing.hitpoints === incomingRest.hitpoints &&
        existing.manaPoints === incomingRest.manaPoints &&
        existing.staminaPoints === incomingRest.staminaPoints &&
        existing.attackValue === incomingRest.attackValue &&
        existing.defenseValue === incomingRest.defenseValue &&
        existing.magicAttackValue === incomingRest.magicAttackValue &&
        existing.swordSkill === incomingRest.swordSkill &&
        existing.axeSkill === incomingRest.axeSkill &&
        existing.maceSkill === incomingRest.maceSkill &&
        existing.distanceSkill === incomingRest.distanceSkill &&
        existing.shieldingSkill === incomingRest.shieldingSkill &&
        existing.magicLevel === incomingRest.magicLevel &&
        existing.experiencePoints === incomingRest.experiencePoints &&
        existing.experienceLevel === incomingRest.experienceLevel &&
        existing.gold === incomingRest.gold &&
        existing.manaRegen === incomingRest.manaRegen &&
        existing.staminaRegen === incomingRest.staminaRegen &&
        existing.capacityMax === incomingRest.capacityMax &&
        existing.spriteUrl === incomingRest.spriteUrl;

      const sameCards =
        existing.cards.length === cards.length &&
        existing.cards.every((card, idx) => sameCard(card, cards[idx]!));

      const invA = [...existing.inventorySlots].sort((a, b) => a.slotIndex - b.slotIndex);
      const invB = [...inventorySlots].sort((a, b) => a.slotIndex - b.slotIndex);
      const sameInv =
        invA.length === invB.length &&
        invA.every(
          (s, i) =>
            s.itemName === invB[i]?.itemName &&
            s.weight === invB[i]?.weight &&
            s.quantity === invB[i]?.quantity &&
            s.slotIndex === invB[i]?.slotIndex,
        );

      if (sameFields && sameCards && sameInv) {
        merged += 1;
        result.push(existing);
        continue;
      }

      await tx.gameObject.update({
        where: { id: existing.id },
        data: {
          ...incomingRest,
        },
      });

      await tx.card.deleteMany({ where: { gameObjectId: existing.id } });
      await tx.card.createMany({
        data: cards.map((card) => ({
          gameObjectId: existing.id,
          ...cardToCreate(card),
        })),
      });

      await tx.inventorySlot.deleteMany({ where: { gameObjectId: existing.id } });
      await tx.inventorySlot.createMany({
        data: inventorySlots.map(({ slotIndex, itemName, weight, quantity }) => ({
          gameObjectId: existing.id,
          slotIndex,
          itemName,
          weight,
          quantity,
        })),
      });

      updated += 1;
      result.push(
        await tx.gameObject.findUniqueOrThrow({
          where: { id: existing.id },
          include: { cards: true, inventorySlots: true },
        }),
      );
    }
    return result;
  });

  res.json({ created, updated, merged, objects: synced });
});

app.post("/boards/:id/objects", async (req, res) => {
  const parsed = createObjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });

  const { cards, inventorySlots, ...rest } = parsed.data;

  const norm = await normalizeGameObjectCombatAndProgression(prisma, req.params.id, {
    helmet: rest.helmet,
    armor: rest.armor,
    legs: rest.legs,
    boots: rest.boots,
    weapon: rest.weapon,
    shield: rest.shield,
    ring: rest.ring,
    necklace: rest.necklace,
    backpackEquipment: rest.backpackEquipment,
    objectKind: rest.objectKind,
    profession: rest.profession,
    experiencePoints: rest.experiencePoints,
    experienceLevel: rest.experienceLevel,
    hitpoints: rest.hitpoints,
    manaPoints: rest.manaPoints,
    attackValue: rest.attackValue,
    defenseValue: rest.defenseValue,
    magicAttackValue: rest.magicAttackValue ?? 0,
    swordSkill: rest.swordSkill,
    axeSkill: rest.axeSkill,
    maceSkill: rest.maceSkill,
    distanceSkill: rest.distanceSkill,
    shieldingSkill: rest.shieldingSkill,
    magicLevel: rest.magicLevel,
  });
  const body = { ...rest, ...norm };

  try {
    const object = await prisma.gameObject.create({
      data: {
        boardId: req.params.id,
        ...body,
        cards: {
          create: cards.map(cardToCreate),
        },
        inventorySlots: {
          create: inventorySlots.map(({ slotIndex, itemName, weight, quantity }) => ({
            slotIndex,
            itemName,
            weight,
            quantity,
          })),
        },
      },
      include: { cards: true, inventorySlots: true },
    });
    res.status(201).json(object);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({ message: "La celda ya esta ocupada" });
    }
    throw error;
  }
});

app.patch("/objects/:id", async (req, res) => {
  const parsed = updateObjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const payload = parsed.data;
  const cards = payload.cards;
  const inventorySlots = payload.inventorySlots;
  const { cards: _c, inventorySlots: _i, ...rest } = payload;

  const existingRow = await prisma.gameObject.findUnique({ where: { id: req.params.id } });
  if (!existingRow) return res.status(404).json({ message: "Objeto no encontrado" });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.gameObject.findUniqueOrThrow({ where: { id: req.params.id } });

      const merged = mergeDefined(
        existing as unknown as Record<string, unknown>,
        rest as Record<string, unknown>,
      ) as typeof existing;

      const prevLevel = experienceLevelFromTotalXp(existing.experiencePoints);
      const { hitpoints: hpPerLvPrev, manaPoints: mpPerLvPrev } = playerHpManaBonusPerLevel(
        existing.profession,
      );
      const prevSteps = Math.max(0, prevLevel - 1);
      let hpBase = merged.hitpoints;
      let mpBase = merged.manaPoints;
      let mlBase = merged.magicLevel;
      if (merged.objectKind === "PLAYER") {
        if (rest.hitpoints === undefined) {
          hpBase = Math.max(0, merged.hitpoints - prevSteps * hpPerLvPrev);
        }
        if (rest.manaPoints === undefined) {
          mpBase = Math.max(0, merged.manaPoints - prevSteps * mpPerLvPrev);
        }
        if (rest.magicLevel === undefined) {
          const mlPerStepPrev = playerMagicLevelBonusPerStep(existing.profession);
          mlBase = Math.max(0, merged.magicLevel - prevSteps * mlPerStepPrev);
        }
      }

      const norm = await normalizeGameObjectCombatAndProgression(tx, existing.boardId, {
        helmet: merged.helmet,
        armor: merged.armor,
        legs: merged.legs,
        boots: merged.boots,
        weapon: merged.weapon,
        shield: merged.shield,
        ring: merged.ring,
        necklace: merged.necklace,
        backpackEquipment: merged.backpackEquipment,
        objectKind: merged.objectKind,
        profession: merged.profession,
        experiencePoints: merged.experiencePoints,
        experienceLevel: merged.experienceLevel,
        hitpoints: hpBase,
        manaPoints: mpBase,
        attackValue: merged.attackValue,
        defenseValue: merged.defenseValue,
        magicAttackValue: merged.magicAttackValue ?? 0,
        swordSkill: merged.swordSkill,
        axeSkill: merged.axeSkill,
        maceSkill: merged.maceSkill,
        distanceSkill: merged.distanceSkill,
        shieldingSkill: merged.shieldingSkill,
        magicLevel: mlBase,
      });
      const finalRow = { ...merged, ...norm };

      const {
        id: _oid,
        boardId: _boardId,
        createdAt: _ca,
        updatedAt: _ua,
        ...updatePayload
      } = finalRow;

      const object = await tx.gameObject.update({
        where: { id: req.params.id },
        data: updatePayload,
      });

      if (cards) {
        await tx.card.deleteMany({ where: { gameObjectId: object.id } });
        await tx.card.createMany({
          data: cards.map((card) => ({
            gameObjectId: object.id,
            ...cardToCreate(card),
          })),
        });
      }

      if (inventorySlots) {
        await tx.inventorySlot.deleteMany({ where: { gameObjectId: object.id } });
        await tx.inventorySlot.createMany({
          data: inventorySlots.map(({ slotIndex, itemName, weight, quantity }) => ({
            gameObjectId: object.id,
            slotIndex,
            itemName,
            weight,
            quantity,
          })),
        });
      }

      return tx.gameObject.findUnique({
        where: { id: object.id },
        include: { cards: true, inventorySlots: true },
      });
    });

    res.json(updated);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return res.status(404).json({ message: "Objeto no encontrado" });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({ message: "La celda ya esta ocupada" });
    }
    throw error;
  }
});

app.delete("/objects/:id", async (req, res) => {
  try {
    await prisma.gameObject.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "Objeto no encontrado" });
  }
});

app.post("/objects/:id/move", async (req, res) => {
  const parsed = moveObjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const object = await prisma.gameObject.findUnique({ where: { id: req.params.id } });
  if (!object) return res.status(404).json({ message: "Objeto no encontrado" });

  if (object.objectKind === "PLAYER" && object.staminaPoints <= 0) {
    return res.status(400).json({ message: "Stamina insuficiente" });
  }

  const distance = Math.abs(object.x - parsed.data.x) + Math.abs(object.y - parsed.data.y);
  if (distance !== 1) {
    return res
      .status(400)
      .json({ message: "Movimiento invalido: solo celdas adyacentes" });
  }

  const occupied = await prisma.gameObject.findFirst({
    where: {
      boardId: object.boardId,
      x: parsed.data.x,
      y: parsed.data.y,
      id: { not: object.id },
    },
  });
  if (occupied) return res.status(409).json({ message: "La celda ya esta ocupada" });

  const moved = await prisma.gameObject.update({
    where: { id: object.id },
    data: {
      x: parsed.data.x,
      y: parsed.data.y,
      ...(object.objectKind === "PLAYER" ? { staminaPoints: { decrement: 1 } } : {}),
    },
    include: { cards: true, inventorySlots: true },
  });

  res.json(moved);
});
