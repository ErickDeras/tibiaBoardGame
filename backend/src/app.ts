import cors from "cors";
import express from "express";
import { Prisma, type SpellDamageSkill } from "@prisma/client";
import { prisma } from "./prisma.js";
import {
  normalizeGameObjectCombatAndProgression,
  playerHpManaBonusPerLevel,
  playerMagicLevelBonusPerStep,
} from "./services/combatStats.js";
import { experienceLevelFromTotalXp } from "./services/progression.js";
import {
  addCardFromTemplateSchema,
  collectGroundLootSchema,
  collectLootSchema,
  combatCreatureTurnSchema,
  combatPlayerTurnSchema,
  createBoardSchema,
  createCardTemplateSchema,
  createCreatureTemplateSchema,
  createDungeonSchema,
  createEquipmentItemSchema,
  createItemTemplateSchema,
  createLootEntrySchema,
  createObjectSchema,
  devNoteCreateSchema,
  joinSessionSchema,
  lobbyDevBodySchema,
  patchSessionSchema,
  moveObjectSchema,
  setDungeonFloorSchema,
  spawnCreatureSchema,
  syncObjectsSchema,
  updateBoardSchema,
  updateCardTemplateSchema,
  updateCreatureTemplateSchema,
  updateDungeonSchema,
  updateEquipmentItemSchema,
  updateItemTemplateSchema,
  updateObjectSchema,
} from "./validation.js";
import { getSharedBoardId } from "./config.js";
import { loadLiveSession, enforceSharedBoardApi } from "./middleware/sharedBoardAuth.js";
import {
  bootstrapLiveSession,
  joinLiveSession,
  getPublicPresence,
  patchSessionUsername,
} from "./services/liveSession.js";
import {
  broadcastLobbyDevChatRow,
  notifyBoardRefresh,
  notifyCombatUpdate,
  notifyPresenceUpdate,
} from "./realtime/wsHub.js";
import { isSharedBoard, sessionHasPlayerObject } from "./services/boardSessionRules.js";
import {
  boardHasActiveCombat,
  collectGroundLoot,
  endCombatSession,
  getCombatSessionForBoard,
  pushPendingCombatant,
  runCreatureTurn,
  runPlayerTurn,
  startCombatSession,
} from "./services/combatActions.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(loadLiveSession);
app.use(enforceSharedBoardApi);

function realtimeBoard(boardId: string, opts?: { presence?: boolean }) {
  notifyBoardRefresh(boardId);
  if (opts?.presence) void notifyPresenceUpdate();
}

function realtimeCombat(boardId: string) {
  notifyCombatUpdate(boardId);
  notifyBoardRefresh(boardId);
}

app.post("/api/sessions/join", async (req, res) => {
  const parsed = joinSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const r = await joinLiveSession(parsed.data.username);
  if ("error" in r) {
    const code = r.error.includes("llena") ? 403 : 400;
    return res.status(code).json({ message: r.error });
  }
  res.status(201).json({
    token: r.token,
    sessionId: r.sessionId,
    boardId: r.boardId,
    needsUsername: false,
  });
});

app.post("/api/sessions/bootstrap", async (_req, res) => {
  const r = await bootstrapLiveSession();
  if ("error" in r) {
    const code = r.error.includes("llena") ? 403 : 400;
    return res.status(code).json({ message: r.error });
  }
  res.status(201).json({
    token: r.token,
    sessionId: r.sessionId,
    boardId: r.boardId,
    needsUsername: r.needsUsername,
  });
});

app.get("/api/sessions/me", async (req, res) => {
  if (!req.liveSession) return res.status(401).json({ message: "Sesion no encontrada" });
  const s = req.liveSession;
  res.json({
    sessionId: s.id,
    username: s.username,
    displayNameSet: s.displayNameSet,
    needsUsername: !s.displayNameSet,
    boardId: getSharedBoardId(),
    playerObjectId: s.ownedPlayer?.id ?? null,
  });
});

app.patch("/api/sessions/me", async (req, res) => {
  if (!req.liveSession) return res.status(401).json({ message: "Sesion no encontrada" });
  const parsed = patchSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const r = await patchSessionUsername(req.liveSession.id, parsed.data.username);
  if ("error" in r) {
    const code = r.error.includes("llena")
      ? 403
      : r.error.includes("asignado")
        ? 409
        : 400;
    return res.status(code).json({ message: r.error });
  }
  res.json({ ok: true });
});

app.get("/api/sessions/presence", async (_req, res) => {
  const p = await getPublicPresence();
  res.json(p);
});

app.get("/api/room-chat/recent", async (req, res) => {
  const shared = getSharedBoardId();
  if (!shared) return res.status(404).json({ message: "Sala no configurada" });
  if (!req.liveSession?.displayNameSet) {
    return res.status(403).json({ message: "Asigna tu nombre de usuario para continuar" });
  }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const rows = await prisma.roomChatMessage.findMany({
    where: { boardId: shared },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json([...rows].reverse());
});

app.get("/api/lobby-dev-chat", async (req, res) => {
  const shared = getSharedBoardId();
  if (!shared) return res.status(404).json({ message: "Sala no configurada" });
  const take = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const rows = await prisma.lobbyDevChatMessage.findMany({
    where: { boardId: shared },
    orderBy: { createdAt: "desc" },
    take,
  });
  res.json([...rows].reverse());
});

app.post("/api/lobby-dev-chat", async (req, res) => {
  const shared = getSharedBoardId();
  if (!shared) return res.status(404).json({ message: "Sala no configurada" });
  if (!req.liveSession?.displayNameSet) {
    return res.status(403).json({ message: "Asigna tu nombre de usuario para continuar" });
  }
  if (await boardHasActiveCombat(shared)) {
    return res
      .status(403)
      .json({ message: "El chat entre partidas no esta disponible durante el combate" });
  }
  const parsed = lobbyDevBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const row = await prisma.lobbyDevChatMessage.create({
    data: {
      boardId: shared,
      liveSessionId: req.liveSession.id,
      username: req.liveSession.username,
      body: parsed.data.body,
    },
  });
  broadcastLobbyDevChatRow(row);
  res.status(201).json(row);
});

app.get("/api/match-history", async (req, res) => {
  const take = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = Math.max(0, Number(req.query.offset) || 0);
  const list = await prisma.matchArchive.findMany({
    orderBy: { endedAt: "desc" },
    take,
    skip,
    include: { board: { select: { name: true } } },
  });
  res.json(list);
});

app.get("/api/dev-notes", async (_req, res) => {
  const rows = await prisma.devNote.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(rows);
});

app.post("/api/dev-notes", async (req, res) => {
  const parsed = devNoteCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const author = req.liveSession?.username ?? null;
  const row = await prisma.devNote.create({
    data: { body: parsed.data.body, authorUsername: author },
  });
  res.status(201).json(row);
});

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
  damageSkill?: string | null;
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
    damageSkill: (card.damageSkill ?? null) as Prisma.CardCreateManyGameObjectInput["damageSkill"],
  };
}

function skillBaseForDamage(
  o: {
    swordSkill: number;
    axeSkill: number;
    maceSkill: number;
    distanceSkill: number;
    shieldingSkill: number;
  },
  s: SpellDamageSkill,
): number {
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

app.get("/card-templates", async (_req, res) => {
  const list = await prisma.cardTemplate.findMany({ orderBy: { name: "asc" } });
  res.json(list);
});

app.post("/card-templates", async (req, res) => {
  const parsed = createCardTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const t = await prisma.cardTemplate.create({ data: parsed.data });
  res.status(201).json(t);
});

app.patch("/card-templates/:id", async (req, res) => {
  const parsed = updateCardTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const existing = await prisma.cardTemplate.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Plantilla no encontrada" });
  const merged = {
    name: parsed.data.name ?? existing.name,
    description: parsed.data.description ?? existing.description,
    deckCategory: parsed.data.deckCategory ?? existing.deckCategory,
    manaCost: parsed.data.manaCost !== undefined ? parsed.data.manaCost : existing.manaCost,
    staminaCost: parsed.data.staminaCost !== undefined ? parsed.data.staminaCost : existing.staminaCost,
    capacityCost: parsed.data.capacityCost !== undefined ? parsed.data.capacityCost : existing.capacityCost,
    rapidSpell: parsed.data.rapidSpell ?? existing.rapidSpell,
    spellSkillBonus: parsed.data.spellSkillBonus ?? existing.spellSkillBonus,
    critMultiplier: parsed.data.critMultiplier !== undefined ? parsed.data.critMultiplier : existing.critMultiplier,
    damageSkill: parsed.data.damageSkill !== undefined ? parsed.data.damageSkill : existing.damageSkill,
  };
  const valid = createCardTemplateSchema.safeParse(merged);
  if (!valid.success) return res.status(400).json(valid.error.flatten());
  try {
    const t = await prisma.cardTemplate.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(t);
  } catch {
    res.status(404).json({ message: "Plantilla no encontrada" });
  }
});

app.delete("/card-templates/:id", async (req, res) => {
  try {
    await prisma.cardTemplate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "Plantilla no encontrada" });
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
        cards: { create: [] },
      },
      include: { cards: true, inventorySlots: true },
    });
    await pushPendingCombatant(req.params.boardId, obj.id);
    realtimeBoard(req.params.boardId);
    res.status(201).json(obj);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "La celda ya esta ocupada" });
    }
    throw error;
  }
});

app.get("/boards/:boardId/combat", async (req, res) => {
  const session = await getCombatSessionForBoard(req.params.boardId);
  res.json({ session });
});

app.post("/boards/:boardId/combat/start", async (req, res) => {
  const r = await startCombatSession(req.params.boardId);
  if ("error" in r) return res.status(400).json({ message: r.error });
  realtimeCombat(req.params.boardId);
  res.status(201).json(r.session);
});

app.post("/boards/:boardId/combat/end", async (req, res) => {
  const r = await endCombatSession(req.params.boardId);
  if ("error" in r) return res.status(400).json({ message: r.error });
  realtimeCombat(req.params.boardId);
  res.json({ ok: true });
});

app.post("/boards/:boardId/combat/turn/player", async (req, res) => {
  const parsed = combatPlayerTurnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const body = parsed.data;
  const r = await runPlayerTurn(
    req.params.boardId,
    {
      actorId: body.actorId,
      moves: body.moves,
      basicAttack: body.basicAttack ?? null,
      cardAction: body.cardAction ?? null,
    },
    req.liveSession ? { requestingLiveSessionId: req.liveSession.id } : undefined,
  );
  if ("error" in r) return res.status(400).json({ message: r.error });
  realtimeCombat(req.params.boardId);
  res.json(r);
});

app.post("/boards/:boardId/combat/turn/creature", async (req, res) => {
  const parsed = combatCreatureTurnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const r = await runCreatureTurn(req.params.boardId, parsed.data.actorId);
  if ("error" in r) return res.status(400).json({ message: r.error });
  realtimeCombat(req.params.boardId);
  res.json(r);
});

app.get("/boards/:boardId/ground-loot", async (req, res) => {
  const rows = await prisma.groundLoot.findMany({
    where: { boardId: req.params.boardId },
    orderBy: [{ y: "asc" }, { x: "asc" }],
  });
  res.json(rows);
});

app.post("/objects/:id/collect-ground-loot", async (req, res) => {
  const parsed = collectGroundLootSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const playerRow = await prisma.gameObject.findUnique({ where: { id: req.params.id } });
  if (!playerRow || playerRow.objectKind !== "PLAYER") {
    return res.status(400).json({ message: "Solo un jugador puede recoger del suelo" });
  }
  if (
    isSharedBoard(playerRow.boardId) &&
    playerRow.ownerSessionId &&
    req.liveSession &&
    playerRow.ownerSessionId !== req.liveSession.id
  ) {
    return res.status(403).json({ message: "Solo tu personaje puede recoger aqui" });
  }

  const r = await collectGroundLoot(req.params.id, parsed.data.x, parsed.data.y);
  if ("error" in r) return res.status(400).json({ message: r.error });
  realtimeBoard(playerRow.boardId);
  res.json(r);
});

app.get("/item-templates", async (_req, res) => {
  const list = await prisma.itemTemplate.findMany({ orderBy: { name: "asc" } });
  res.json(list);
});

app.post("/item-templates", async (req, res) => {
  const parsed = createItemTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const t = await prisma.itemTemplate.create({ data: parsed.data });
  res.status(201).json(t);
});

app.patch("/item-templates/:id", async (req, res) => {
  const parsed = updateItemTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  try {
    const t = await prisma.itemTemplate.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(t);
  } catch {
    res.status(404).json({ message: "Plantilla no encontrada" });
  }
});

app.delete("/item-templates/:id", async (req, res) => {
  try {
    await prisma.itemTemplate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "Plantilla no encontrada" });
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
  if (
    isSharedBoard(collector.boardId) &&
    collector.ownerSessionId &&
    req.liveSession &&
    collector.ownerSessionId !== req.liveSession.id
  ) {
    return res.status(403).json({ message: "Solo tu personaje puede recoger este loot" });
  }

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
  realtimeBoard(collector.boardId);
  res.json({ added: created, collector: updated });
});

app.post("/objects/:objectId/cards/from-template", async (req, res) => {
  const parsed = addCardFromTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const obj = await prisma.gameObject.findUnique({
    where: { id: req.params.objectId },
    include: { cards: true },
  });
  if (!obj) return res.status(404).json({ message: "Objeto no encontrado" });
  if (obj.objectKind !== "PLAYER") {
    return res.status(400).json({ message: "Solo los jugadores tienen mazo de cartas" });
  }
  if (
    isSharedBoard(obj.boardId) &&
    obj.ownerSessionId &&
    req.liveSession &&
    obj.ownerSessionId !== req.liveSession.id
  ) {
    return res.status(403).json({ message: "Solo puedes editar tu personaje" });
  }
  if (obj.cards.length >= 5) {
    return res.status(400).json({ message: "Máximo 5 cartas por jugador" });
  }

  const template = await prisma.cardTemplate.findUnique({ where: { id: parsed.data.templateId } });
  if (!template) return res.status(404).json({ message: "Plantilla no encontrada" });

  const created = await prisma.card.create({
    data: {
      gameObjectId: obj.id,
      name: template.name,
      description: template.description,
      deckCategory: template.deckCategory,
      manaCost: template.manaCost,
      staminaCost: template.staminaCost,
      capacityCost: template.capacityCost,
      rapidSpell: template.rapidSpell,
      spellSkillBonus: template.spellSkillBonus,
      critMultiplier: template.critMultiplier,
      damageSkill: template.damageSkill,
    },
  });

  const full = await prisma.gameObject.findUnique({
    where: { id: obj.id },
    include: { cards: true, inventorySlots: true },
  });
  realtimeBoard(obj.boardId);
  res.status(201).json({ card: created, object: full });
});

app.post("/objects/:objectId/cards/:cardId/use", async (req, res) => {
  const objectId = req.params.objectId;
  const cardId = req.params.cardId;

  const obj = await prisma.gameObject.findUnique({
    where: { id: objectId },
    include: { cards: true, inventorySlots: true },
  });
  if (!obj) return res.status(404).json({ message: "Objeto no encontrado" });
  if (obj.objectKind !== "PLAYER") {
    return res.status(400).json({ message: "Solo los jugadores pueden usar cartas" });
  }
  if (
    isSharedBoard(obj.boardId) &&
    obj.ownerSessionId &&
    req.liveSession &&
    obj.ownerSessionId !== req.liveSession.id
  ) {
    return res.status(403).json({ message: "Solo puedes usar cartas de tu personaje" });
  }

  const card = obj.cards.find((c) => c.id === cardId);
  if (!card) return res.status(404).json({ message: "Carta no encontrada" });

  const manaNeed = card.manaCost ?? 0;
  const staminaNeed = card.staminaCost ?? 0;
  const capNeed = card.capacityCost ?? 0;
  const usedWeight = obj.inventorySlots.reduce((s, sl) => s + sl.weight * sl.quantity, 0);
  const freeCap = obj.capacityMax - usedWeight;

  if (obj.manaPoints < manaNeed) {
    return res.status(400).json({ message: "Mana insuficiente", need: manaNeed, have: obj.manaPoints });
  }
  if (obj.staminaPoints < staminaNeed) {
    return res.status(400).json({
      message: "Stamina insuficiente",
      need: staminaNeed,
      have: obj.staminaPoints,
    });
  }
  if (capNeed > 0 && freeCap < capNeed) {
    return res.status(400).json({
      message: "Capacidad libre insuficiente",
      need: capNeed,
      free: freeCap,
    });
  }

  const skillBase =
    card.damageSkill != null ? skillBaseForDamage(obj, card.damageSkill) : 0;
  const effectivePower = skillBase + card.spellSkillBonus;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.card.delete({ where: { id: cardId } });
    return tx.gameObject.update({
      where: { id: objectId },
      data: {
        manaPoints: obj.manaPoints - manaNeed,
        staminaPoints: obj.staminaPoints - staminaNeed,
      },
      include: { cards: true, inventorySlots: true },
    });
  });

  realtimeBoard(obj.boardId);
  res.json({
    object: updated,
    used: {
      cardId: card.id,
      name: card.name,
      deckCategory: card.deckCategory,
      damageSkill: card.damageSkill,
      skillBase,
      spellSkillBonus: card.spellSkillBonus,
      effectivePower,
      manaSpent: manaNeed,
      staminaSpent: staminaNeed,
    },
  });
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
  const link = await prisma.dungeonBoard.findUnique({ where: { boardId: req.params.id } });
  const floor = link?.floor ?? null;
  res.json(board.objects.map((o) => ({ ...o, floor })));
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
    realtimeBoard(req.params.id);
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
    realtimeBoard(item.boardId);
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
    const prev = await prisma.equipmentItem.findUnique({ where: { id: req.params.id } });
    await prisma.equipmentItem.delete({ where: { id: req.params.id } });
    if (prev) realtimeBoard(prev.boardId);
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
    damageSkill: SpellDamageSkill | null;
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
    damageSkill?: SpellDamageSkill | null;
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
    a.critMultiplier === (b.critMultiplier ?? null) &&
    a.damageSkill === (b.damageSkill ?? null)
  );
}

app.post("/boards/:id/sync", async (req, res) => {
  const parsed = syncObjectsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });

  if (await boardHasActiveCombat(req.params.id)) {
    return res.status(400).json({ message: "Partida activa: sincronizacion deshabilitada" });
  }

  const boardIdSync = req.params.id;
  const lsSync = req.liveSession;
  if (isSharedBoard(boardIdSync) && lsSync) {
    const createsPlayer = parsed.data.objects.filter((o) => !o.id && o.objectKind === "PLAYER");
    if (createsPlayer.length > 1) {
      return res.status(400).json({ message: "Solo un personaje por sincronizacion" });
    }
    if (createsPlayer.length === 1 && (await sessionHasPlayerObject(lsSync.id))) {
      return res.status(400).json({ message: "Ya tienes un personaje vinculado a tu sesion" });
    }
    for (const incoming of parsed.data.objects) {
      if (!incoming.id) continue;
      const ex = await prisma.gameObject.findFirst({
        where: { id: incoming.id, boardId: boardIdSync },
      });
      if (
        ex?.objectKind === "PLAYER" &&
        ex.ownerSessionId &&
        ex.ownerSessionId !== lsSync.id
      ) {
        return res.status(403).json({ message: "No puedes editar el personaje de otro jugador" });
      }
      if (ex?.objectKind === "PLAYER" && !ex.ownerSessionId && lsSync) {
        const mine = await prisma.gameObject.findFirst({
          where: {
            boardId: boardIdSync,
            ownerSessionId: lsSync.id,
            objectKind: "PLAYER",
          },
        });
        if (mine && mine.id !== ex.id) {
          return res.status(403).json({
            message: "Ya tienes un personaje; no puedes editar otro sin vincular",
          });
        }
      }
    }
  }

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
        const ownerExtra =
          isSharedBoard(req.params.id) &&
          lsSync &&
          incomingRest.objectKind === "PLAYER"
            ? { ownerSessionId: lsSync.id }
            : {};
        const createdObject = await tx.gameObject.create({
          data: {
            boardId: req.params.id,
            ...incomingRest,
            ...ownerExtra,
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

      let claimOwner: { ownerSessionId: string } | Record<string, never> = {};
      if (
        isSharedBoard(req.params.id) &&
        lsSync &&
        existing.objectKind === "PLAYER" &&
        !existing.ownerSessionId
      ) {
        const mine = await tx.gameObject.findFirst({
          where: {
            boardId: req.params.id,
            ownerSessionId: lsSync.id,
            objectKind: "PLAYER",
          },
        });
        if (!mine) claimOwner = { ownerSessionId: lsSync.id };
      }

      await tx.gameObject.update({
        where: { id: existing.id },
        data: {
          ...incomingRest,
          ...claimOwner,
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

  realtimeBoard(req.params.id, { presence: isSharedBoard(req.params.id) });
  res.json({ created, updated, merged, objects: synced });
});

app.post("/boards/:id/objects", async (req, res) => {
  const parsed = createObjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });

  if (await boardHasActiveCombat(req.params.id)) {
    return res.status(400).json({
      message: "Partida activa: no se pueden crear objetos (solo spawn de criaturas)",
    });
  }

  const { cards, inventorySlots, ...rest } = parsed.data;
  const boardIdObj = req.params.id;

  if (isSharedBoard(boardIdObj) && rest.objectKind === "PLAYER") {
    if (!req.liveSession) {
      return res.status(401).json({ message: "Sesion requerida" });
    }
    if (await sessionHasPlayerObject(req.liveSession.id)) {
      return res.status(400).json({ message: "Ya tienes un personaje en este tablero" });
    }
  }

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

  const ownerOnCreate =
    isSharedBoard(boardIdObj) && body.objectKind === "PLAYER" && req.liveSession
      ? { ownerSessionId: req.liveSession.id }
      : {};

  try {
    const object = await prisma.gameObject.create({
      data: {
        boardId: req.params.id,
        ...body,
        ...ownerOnCreate,
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
    realtimeBoard(req.params.id, {
      presence: isSharedBoard(boardIdObj) && body.objectKind === "PLAYER",
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

  if (await boardHasActiveCombat(existingRow.boardId)) {
    return res.status(400).json({ message: "Partida activa: no se pueden editar objetos" });
  }

  if (
    isSharedBoard(existingRow.boardId) &&
    existingRow.objectKind === "PLAYER" &&
    req.liveSession
  ) {
    if (
      existingRow.ownerSessionId &&
      existingRow.ownerSessionId !== req.liveSession.id
    ) {
      return res.status(403).json({ message: "No puedes editar el personaje de otro jugador" });
    }
    if (!existingRow.ownerSessionId) {
      if (await sessionHasPlayerObject(req.liveSession.id)) {
        return res.status(400).json({ message: "Ya tienes un personaje vinculado" });
      }
    }
  }

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
        ownerSessionId: _os,
        ...updatePayload
      } = finalRow;

      const claimOwnerPatch =
        isSharedBoard(existing.boardId) &&
        req.liveSession &&
        existing.objectKind === "PLAYER" &&
        !existing.ownerSessionId
          ? { ownerSessionId: req.liveSession.id }
          : {};

      const object = await tx.gameObject.update({
        where: { id: req.params.id },
        data: { ...updatePayload, ...claimOwnerPatch },
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

    realtimeBoard(existingRow.boardId, {
      presence: isSharedBoard(existingRow.boardId) && existingRow.objectKind === "PLAYER",
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
  const row = await prisma.gameObject.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ message: "Objeto no encontrado" });
  if (await boardHasActiveCombat(row.boardId)) {
    return res.status(400).json({ message: "Partida activa: no eliminar objetos" });
  }
  if (
    isSharedBoard(row.boardId) &&
    row.objectKind === "PLAYER" &&
    row.ownerSessionId &&
    req.liveSession &&
    row.ownerSessionId !== req.liveSession.id
  ) {
    return res.status(403).json({ message: "No puedes eliminar el personaje de otro jugador" });
  }
  try {
    await prisma.gameObject.delete({ where: { id: req.params.id } });
    realtimeBoard(row.boardId, {
      presence: isSharedBoard(row.boardId) && row.objectKind === "PLAYER",
    });
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

  if (await boardHasActiveCombat(object.boardId)) {
    return res
      .status(400)
      .json({ message: "Partida activa: use el movimiento de combate (no el movimiento de exploracion)" });
  }

  if (object.objectKind === "PLAYER" && object.staminaPoints <= 0) {
    return res.status(400).json({ message: "Stamina insuficiente" });
  }

  if (
    isSharedBoard(object.boardId) &&
    object.objectKind === "PLAYER" &&
    object.ownerSessionId &&
    req.liveSession &&
    object.ownerSessionId !== req.liveSession.id
  ) {
    return res.status(403).json({ message: "No puedes mover el personaje de otro jugador" });
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

  realtimeBoard(object.boardId);
  res.json(moved);
});
