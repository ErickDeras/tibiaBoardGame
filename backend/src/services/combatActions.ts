import type { GameObject, Profession, SpellDamageSkill } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { effectiveDamage } from "./combatDamage.js";
import { pickCreatureTarget } from "./combatTargeting.js";
import { parseActorTurnState, parseStringArray, type ActorTurnStateJson } from "./combatJson.js";

export type Tx = Prisma.TransactionClient;

type ObjLite = {
  id: string;
  boardId: string;
  x: number;
  y: number;
  hitpoints: number;
  objectKind: GameObject["objectKind"];
  profession: Profession | null;
  attackValue: number;
  defenseValue: number;
  magicAttackValue: number;
  manaPoints: number;
  staminaPoints: number;
  swordSkill: number;
  axeSkill: number;
  maceSkill: number;
  distanceSkill: number;
  shieldingSkill: number;
  capacityMax: number;
  creatureTemplateId: string | null;
};

function sortActors(a: ObjLite, b: ObjLite): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.x !== b.x) return a.x - b.x;
  return a.id.localeCompare(b.id);
}

export function buildTurnOrderFromObjects(objects: ObjLite[]): string[] {
  const alive = objects.filter((o) => o.hitpoints > 0);
  const players = alive.filter((o) => o.objectKind === "PLAYER").sort(sortActors);
  const creatures = alive.filter((o) => o.objectKind === "CREATURE").sort(sortActors);
  return [...players.map((p) => p.id), ...creatures.map((c) => c.id)];
}

export async function getActiveCombatSession(boardId: string) {
  return prisma.combatSession.findFirst({
    where: { boardId, status: "ACTIVE" },
    include: { logEntries: { orderBy: { createdAt: "desc" }, take: 80 } },
  });
}

export async function boardHasActiveCombat(boardId: string): Promise<boolean> {
  const s = await prisma.combatSession.findFirst({
    where: { boardId, status: "ACTIVE" },
    select: { id: true },
  });
  return s != null;
}

export async function collectGroundLoot(playerId: string, x: number, y: number) {
  return prisma.$transaction(async (tx) => {
    const player = await tx.gameObject.findUnique({
      where: { id: playerId },
      include: { inventorySlots: true },
    });
    if (!player || player.objectKind !== "PLAYER") {
      return { error: "Jugador no encontrado" as const };
    }
    const piles = await tx.groundLoot.findMany({
      where: { boardId: player.boardId, x, y },
    });
    if (piles.length === 0) return { error: "No hay objetos en el suelo aqui" as const };

    const usedWeight = player.inventorySlots.reduce((s, sl) => s + sl.weight * sl.quantity, 0);
    const addW = piles.reduce((s, p) => s + p.weight * p.quantity, 0);
    if (usedWeight + addW > player.capacityMax) {
      return { error: "Capacidad insuficiente para recoger todo" as const };
    }

    const maxIdx = player.inventorySlots.reduce((m, sl) => Math.max(m, sl.slotIndex), -1);
    let next = maxIdx + 1;
    for (const p of piles) {
      await tx.inventorySlot.create({
        data: {
          gameObjectId: player.id,
          slotIndex: next++,
          itemName: p.itemName,
          weight: p.weight,
          quantity: p.quantity,
        },
      });
    }
    await tx.groundLoot.deleteMany({
      where: { id: { in: piles.map((g) => g.id) } },
    });
    const updated = await tx.gameObject.findUnique({
      where: { id: player.id },
      include: { inventorySlots: true, cards: true },
    });
    return { ok: true as const, player: updated, picked: piles.length };
  });
}

function skillBaseForDamage(
  o: Pick<
    ObjLite,
    "swordSkill" | "axeSkill" | "maceSkill" | "distanceSkill" | "shieldingSkill"
  >,
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

function allowedBasicKind(profession: Profession | null): "melee" | "distance" | "magic" {
  if (profession === "paladin") return "distance";
  if (profession === "mago" || profession === "druida") return "magic";
  return "melee";
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function basicAttackRange(kind: "melee" | "distance" | "magic"): number {
  return kind === "melee" ? 1 : 99;
}

function rawBasicAttack(actor: ObjLite, kind: "melee" | "distance" | "magic"): number {
  return kind === "magic" ? actor.magicAttackValue : actor.attackValue;
}

async function appendLog(
  tx: Tx,
  sessionId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  await tx.combatLogEntry.create({
    data: { sessionId, type, payload: payload as Prisma.InputJsonValue },
  });
}

async function loadBoardObjects(tx: Tx, boardId: string): Promise<ObjLite[]> {
  const rows = await tx.gameObject.findMany({ where: { boardId } });
  return rows.map((o) => ({
    id: o.id,
    boardId: o.boardId,
    x: o.x,
    y: o.y,
    hitpoints: o.hitpoints,
    objectKind: o.objectKind,
    profession: o.profession,
    attackValue: o.attackValue,
    defenseValue: o.defenseValue,
    magicAttackValue: o.magicAttackValue,
    manaPoints: o.manaPoints,
    staminaPoints: o.staminaPoints,
    swordSkill: o.swordSkill,
    axeSkill: o.axeSkill,
    maceSkill: o.maceSkill,
    distanceSkill: o.distanceSkill,
    shieldingSkill: o.shieldingSkill,
    capacityMax: o.capacityMax,
    creatureTemplateId: o.creatureTemplateId,
  }));
}

async function dropGroundLootForCreature(
  tx: Tx,
  boardId: string,
  x: number,
  y: number,
  templateId: string | null,
) {
  if (!templateId) return;
  const tpl = await tx.creatureTemplate.findUnique({
    where: { id: templateId },
    include: { lootEntries: true },
  });
  if (!tpl) return;
  for (const e of tpl.lootEntries) {
    await tx.groundLoot.create({
      data: {
        boardId,
        x,
        y,
        itemName: e.itemName,
        weight: e.weight,
        quantity: e.quantity,
        itemTemplateId: e.itemTemplateId,
      },
    });
  }
}

async function checkAndEndCombat(tx: Tx, sessionId: string, boardId: string): Promise<boolean> {
  const objs = await loadBoardObjects(tx, boardId);
  const players = objs.filter((o) => o.objectKind === "PLAYER" && o.hitpoints > 0);
  const creatures = objs.filter((o) => o.objectKind === "CREATURE" && o.hitpoints > 0);
  const allPlayersDead = objs.some((o) => o.objectKind === "PLAYER") && players.length === 0;
  const allCreaturesDead =
    objs.some((o) => o.objectKind === "CREATURE") && creatures.length === 0;
  if (allPlayersDead || allCreaturesDead) {
    await tx.combatSession.update({
      where: { id: sessionId },
      data: { status: "ENDED", endedAt: new Date() },
    });
    await appendLog(tx, sessionId, "COMBAT_END", {
      reason: allPlayersDead ? "ALL_PLAYERS_DEAD" : "ALL_CREATURES_DEAD",
    });
    return true;
  }
  return false;
}

/** Tras una acción: actualiza orden, ronda, pendientes y siguiente actor. */
async function advanceTurnState(
  tx: Tx,
  session: { id: string; boardId: string; turnOrder: unknown; pendingAddIds: unknown },
  completedActorId: string,
) {
  let order = parseStringArray(session.turnOrder);
  const byId = new Map((await loadBoardObjects(tx, session.boardId)).map((o) => [o.id, o]));
  order = order.filter((id) => {
    const o = byId.get(id);
    return o != null && o.hitpoints > 0;
  });
  const idx = order.indexOf(completedActorId);
  const fromIdx = idx >= 0 ? idx : 0;
  const roundWrapped = order.length > 0 && fromIdx === order.length - 1;

  if (roundWrapped) {
    const all = await loadBoardObjects(tx, session.boardId);
    order = buildTurnOrderFromObjects(all);
    await tx.combatSession.update({
      where: { id: session.id },
      data: { pendingAddIds: [], turnOrder: order, generation: { increment: 1 } },
    });
  } else {
    await tx.combatSession.update({
      where: { id: session.id },
      data: { turnOrder: order },
    });
  }

  const fresh = await tx.combatSession.findUniqueOrThrow({ where: { id: session.id } });
  order = parseStringArray(fresh.turnOrder);
  if (order.length === 0) {
    await tx.combatSession.update({
      where: { id: session.id },
      data: { currentActorId: null, actorTurnState: Prisma.DbNull },
    });
    return;
  }
  const nextIdx = roundWrapped ? 0 : (fromIdx + 1) % order.length;
  const nextId = order[nextIdx]!;
  await tx.combatSession.update({
    where: { id: session.id },
    data: {
      currentActorId: nextId,
      turnIndex: nextIdx,
      actorTurnState: Prisma.DbNull,
    },
  });
}

export async function startCombatSession(boardId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return { error: "Board no encontrado" as const };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.combatSession.findUnique({ where: { boardId } });
    if (existing?.status === "ACTIVE") {
      return { error: "Ya hay una partida activa en este tablero" as const };
    }
    if (existing) {
      await tx.combatSession.delete({ where: { boardId } });
    }

    const objects = await loadBoardObjects(tx, boardId);
    const order = buildTurnOrderFromObjects(objects);
    if (order.length === 0) {
      return { error: "No hay combatientes vivos en el tablero" as const };
    }

    const session = await tx.combatSession.create({
      data: {
        boardId,
        status: "ACTIVE",
        turnOrder: order,
        turnIndex: 0,
        currentActorId: order[0]!,
        pendingAddIds: [],
        actorTurnState: Prisma.DbNull,
      },
    });
    await tx.combatLogEntry.create({
      data: {
        sessionId: session.id,
        type: "COMBAT_START",
        payload: { boardId, turnOrder: order },
      },
    });
    return { session };
  });
}

export async function endCombatSession(boardId: string) {
  const s = await prisma.combatSession.findFirst({ where: { boardId, status: "ACTIVE" } });
  if (!s) return { error: "No hay partida activa" as const };
  await prisma.combatSession.update({
    where: { id: s.id },
    data: { status: "ENDED", endedAt: new Date() },
  });
  return { ok: true as const };
}

export type PlayerTurnInput = {
  actorId: string;
  moves: { x: number; y: number }[];
  basicAttack: { kind: "melee" | "distance" | "magic"; targetId: string } | null;
  cardAction: { cardId: string; targetId: string } | null;
};

export async function runPlayerTurn(boardId: string, input: PlayerTurnInput) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.combatSession.findFirst({
      where: { boardId, status: "ACTIVE" },
    });
    if (!session) return { error: "No hay partida activa" as const };
    if (session.currentActorId !== input.actorId) {
      return { error: "No es el turno de este actor" as const };
    }

    const actor = await tx.gameObject.findFirst({
      where: { id: input.actorId, boardId },
      include: { cards: true, inventorySlots: true },
    });
    if (!actor || actor.objectKind !== "PLAYER") {
      return { error: "Actor invalido" as const };
    }

    let st = parseActorTurnState(session.actorTurnState);
    const objects = await loadBoardObjects(tx, boardId);
    const byId = new Map(objects.map((o) => [o.id, o]));

    if (input.moves.length > 2) return { error: "Maximo 2 movimientos por turno" as const };
    if (input.moves.length === 2 && (input.basicAttack || input.cardAction)) {
      return { error: "Con doble movimiento no se puede atacar este turno" as const };
    }

    let ax = actor.x;
    let ay = actor.y;
    for (let i = 0; i < input.moves.length; i++) {
      const step = input.moves[i]!;
      const dist = Math.abs(ax - step.x) + Math.abs(ay - step.y);
      if (dist !== 1) return { error: "Movimiento invalido: solo adyacentes" as const };
      const occ = await tx.gameObject.findFirst({
        where: { boardId, x: step.x, y: step.y, id: { not: actor.id } },
      });
      if (occ) return { error: "Celda ocupada" as const };
      ax = step.x;
      ay = step.y;
      st = { ...st, moveCount: st.moveCount + 1 };
      if (st.moveCount >= 2) st = { ...st, forfeitedAttacks: true };
    }

    if (input.moves.length > 0) {
      await tx.gameObject.update({
        where: { id: actor.id },
        data: { x: ax, y: ay },
      });
      await appendLog(tx, session.id, "COMBAT_MOVE", {
        actorId: actor.id,
        from: { x: actor.x, y: actor.y },
        to: { x: ax, y: ay },
        steps: input.moves.length,
      });
    }

    if (st.forfeitedAttacks && (input.basicAttack || input.cardAction)) {
      return { error: "Este turno ya no permite ataques (doble movimiento)" as const };
    }

    const allowed = allowedBasicKind(actor.profession);
    if (input.basicAttack && input.basicAttack.kind !== allowed) {
      return { error: `Ataque basico debe ser ${allowed} para esta vocacion` as const };
    }

    if (input.basicAttack) {
      if (st.basicUsed) return { error: "Ataque basico ya usado" as const };
      const tgt = await tx.gameObject.findFirst({
        where: { id: input.basicAttack.targetId, boardId },
      });
      if (!tgt || tgt.hitpoints <= 0) return { error: "Objetivo invalido" as const };
      if (tgt.objectKind !== "CREATURE") {
        return { error: "El ataque basico del jugador solo puede apuntar a criaturas" as const };
      }
      const range = basicAttackRange(input.basicAttack.kind);
      if (manhattan({ x: ax, y: ay }, tgt) > range) {
        return { error: "Objetivo fuera de alcance" as const };
      }
      const raw = rawBasicAttack(
        {
          id: actor.id,
          boardId,
          x: ax,
          y: ay,
          hitpoints: actor.hitpoints,
          objectKind: actor.objectKind,
          profession: actor.profession,
          attackValue: actor.attackValue,
          defenseValue: actor.defenseValue,
          magicAttackValue: actor.magicAttackValue,
          manaPoints: actor.manaPoints,
          staminaPoints: actor.staminaPoints,
          swordSkill: actor.swordSkill,
          axeSkill: actor.axeSkill,
          maceSkill: actor.maceSkill,
          distanceSkill: actor.distanceSkill,
          shieldingSkill: actor.shieldingSkill,
          capacityMax: actor.capacityMax,
          creatureTemplateId: actor.creatureTemplateId,
        },
        input.basicAttack.kind,
      );
      const dmg = effectiveDamage(raw, tgt.defenseValue);
      const hpBefore = tgt.hitpoints;
      const hpAfter = Math.max(0, tgt.hitpoints - dmg);
      await tx.gameObject.update({
        where: { id: tgt.id },
        data: { hitpoints: hpAfter },
      });
      await appendLog(tx, session.id, "BASIC_ATTACK", {
        category: "BASIC_ATTACK",
        kind: input.basicAttack.kind,
        attackerId: actor.id,
        attackerPos: { x: ax, y: ay },
        targetId: tgt.id,
        targetPos: { x: tgt.x, y: tgt.y },
        attackValue: raw,
        defenseValue: tgt.defenseValue,
        damage: dmg,
        hpBefore,
        hpAfter,
        manaCost: 0,
      });
      st = { ...st, basicUsed: true };
      if (hpAfter <= 0 && tgt.objectKind === "CREATURE") {
        await dropGroundLootForCreature(tx, boardId, tgt.x, tgt.y, tgt.creatureTemplateId);
      }
    }

    if (input.cardAction) {
      if (st.cardUsed) return { error: "Carta ya usada este turno" as const };
      const actorFresh = await tx.gameObject.findFirst({
        where: { id: actor.id, boardId },
        include: { cards: true, inventorySlots: true },
      });
      if (!actorFresh) return { error: "Actor no encontrado" as const };
      const card = actorFresh.cards.find((c) => c.id === input.cardAction!.cardId);
      if (!card) return { error: "Carta no encontrada" as const };
      const tgt = await tx.gameObject.findFirst({
        where: { id: input.cardAction.targetId, boardId },
      });
      if (!tgt || tgt.hitpoints <= 0) return { error: "Objetivo de carta invalido" as const };

      const manaNeed = card.manaCost ?? 0;
      const staminaNeed = card.staminaCost ?? 0;
      const capNeed = card.capacityCost ?? 0;
      const usedWeight = actorFresh.inventorySlots.reduce((s, sl) => s + sl.weight * sl.quantity, 0);
      const freeCap = actorFresh.capacityMax - usedWeight;
      if (actorFresh.manaPoints < manaNeed) return { error: "Mana insuficiente para la carta" as const };
      if (actorFresh.staminaPoints < staminaNeed) {
        return { error: "Stamina insuficiente para la carta" as const };
      }
      if (capNeed > 0 && freeCap < capNeed) {
        return { error: "Capacidad insuficiente para la carta" as const };
      }

      const skillBase =
        card.damageSkill != null ? skillBaseForDamage(actorFresh, card.damageSkill) : 0;
      const effectivePower = skillBase + card.spellSkillBonus;

      const cat = card.deckCategory;
      let logType = "CARD_SUPPORT";
      let dmg = 0;
      let hpBefore = tgt.hitpoints;
      let hpAfter = tgt.hitpoints;

      if (
        cat === "SPELL_ATTACK" ||
        cat === "RUNE_ATTACK" ||
        cat === "ITEM_ATTACK"
      ) {
        dmg = effectiveDamage(effectivePower, tgt.defenseValue);
        hpAfter = Math.max(0, tgt.hitpoints - dmg);
        await tx.gameObject.update({ where: { id: tgt.id }, data: { hitpoints: hpAfter } });
        logType = "SPELL_ATTACK";
      } else if (
        cat === "SPELL_HEALING" ||
        cat === "RUNE_HEALING" ||
        cat === "ITEM_HEALING"
      ) {
        hpAfter = tgt.hitpoints + effectivePower;
        await tx.gameObject.update({ where: { id: tgt.id }, data: { hitpoints: hpAfter } });
        logType = "SPELL_HEALING";
        dmg = -effectivePower;
      }

      await tx.card.delete({ where: { id: card.id } });
      await tx.gameObject.update({
        where: { id: actorFresh.id },
        data: {
          manaPoints: actorFresh.manaPoints - manaNeed,
          staminaPoints: actorFresh.staminaPoints - staminaNeed,
        },
      });

      await appendLog(tx, session.id, logType, {
        category: cat,
        cardName: card.name,
        attackerId: actorFresh.id,
        attackerPos: { x: ax, y: ay },
        targetId: tgt.id,
        targetPos: { x: tgt.x, y: tgt.y },
        attackValue: effectivePower,
        defenseValue: tgt.defenseValue,
        damage: dmg,
        hpBefore,
        hpAfter,
        manaCost: manaNeed,
        staminaCost: staminaNeed,
      });
      st = { ...st, cardUsed: true };
      if (hpAfter <= 0 && tgt.objectKind === "CREATURE") {
        await dropGroundLootForCreature(tx, boardId, tgt.x, tgt.y, tgt.creatureTemplateId);
      }
    }

    if (input.moves.length > 0 || input.basicAttack || input.cardAction) {
      await tx.combatSession.update({
        where: { id: session.id },
        data: { actorTurnState: st as object },
      });
    }

    const passTurn =
      input.moves.length === 0 && input.basicAttack == null && input.cardAction == null;
    const advanceTurn =
      passTurn ||
      input.basicAttack != null ||
      input.cardAction != null ||
      st.forfeitedAttacks ||
      input.moves.length === 2;

    const ended = await checkAndEndCombat(tx, session.id, boardId);
    if (!ended && advanceTurn) {
      await advanceTurnState(tx, session, input.actorId);
    }

    const sess2 = await tx.combatSession.findUnique({ where: { id: session.id } });
    const objsOut = await tx.gameObject.findMany({
      where: { boardId },
      include: { cards: true, inventorySlots: true },
    });
    return { ok: true as const, session: sess2, objects: objsOut };
  });
}

export async function runCreatureTurn(boardId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.combatSession.findFirst({
      where: { boardId, status: "ACTIVE" },
    });
    if (!session) return { error: "No hay partida activa" as const };
    if (session.currentActorId !== actorId) {
      return { error: "No es el turno de esta criatura" as const };
    }

    const creature = await tx.gameObject.findFirst({
      where: { id: actorId, boardId },
      include: { creatureTemplate: true },
    });
    if (!creature || creature.objectKind !== "CREATURE") {
      return { error: "No es una criatura" as const };
    }

    const players = await tx.gameObject.findMany({
      where: { boardId, objectKind: "PLAYER" },
    });
    const tgt = pickCreatureTarget(players, creature);
    if (!tgt) {
      await appendLog(tx, session.id, "CREATURE_SKIP", {
        creatureId: creature.id,
        reason: "NO_PLAYER_TARGET",
      });
      const ended = await checkAndEndCombat(tx, session.id, boardId);
      if (!ended) await advanceTurnState(tx, session, actorId);
      const sess2 = await tx.combatSession.findUnique({ where: { id: session.id } });
      const objsOut = await tx.gameObject.findMany({
        where: { boardId },
        include: { cards: true, inventorySlots: true },
      });
      return { ok: true as const, session: sess2, objects: objsOut };
    }

    const tpl = creature.creatureTemplate;
    let raw = creature.attackValue;
    let usedAbility = false;
    if (
      tpl &&
      tpl.abilityName.trim() &&
      tpl.abilityManaCost <= creature.manaPoints &&
      tpl.abilityAttackBonus > 0
    ) {
      raw = creature.attackValue + tpl.abilityAttackBonus;
      usedAbility = true;
      await tx.gameObject.update({
        where: { id: creature.id },
        data: { manaPoints: creature.manaPoints - tpl.abilityManaCost },
      });
    }

    const range = creature.magicLevel > 0 ? 99 : 1;
    if (manhattan(creature, tgt) > range) {
      await appendLog(tx, session.id, "CREATURE_SKIP", {
        creatureId: creature.id,
        reason: "TARGET_OUT_OF_RANGE",
        targetId: tgt.id,
      });
      const ended = await checkAndEndCombat(tx, session.id, boardId);
      if (!ended) await advanceTurnState(tx, session, actorId);
      const sess2 = await tx.combatSession.findUnique({ where: { id: session.id } });
      const objsOut = await tx.gameObject.findMany({
        where: { boardId },
        include: { cards: true, inventorySlots: true },
      });
      return { ok: true as const, session: sess2, objects: objsOut };
    }

    const dmg = effectiveDamage(raw, tgt.defenseValue);
    const hpBefore = tgt.hitpoints;
    const hpAfter = Math.max(0, tgt.hitpoints - dmg);
    await tx.gameObject.update({
      where: { id: tgt.id },
      data: { hitpoints: hpAfter },
    });

    await appendLog(tx, session.id, usedAbility ? "CREATURE_ABILITY" : "CREATURE_ATTACK", {
      category: usedAbility ? "CREATURE_ABILITY" : "BASIC_ATTACK",
      attackerId: creature.id,
      attackerPos: { x: creature.x, y: creature.y },
      targetId: tgt.id,
      targetPos: { x: tgt.x, y: tgt.y },
      attackValue: raw,
      defenseValue: tgt.defenseValue,
      damage: dmg,
      hpBefore,
      hpAfter,
      manaCost: usedAbility && tpl ? tpl.abilityManaCost : 0,
    });

    if (hpAfter <= 0 && tgt.objectKind === "PLAYER") {
      /* no ground loot */
    }

    const ended = await checkAndEndCombat(tx, session.id, boardId);
    if (!ended) await advanceTurnState(tx, session, actorId);

    const sess2 = await tx.combatSession.findUnique({ where: { id: session.id } });
    const objsOut = await tx.gameObject.findMany({
      where: { boardId },
      include: { cards: true, inventorySlots: true },
    });
    return { ok: true as const, session: sess2, objects: objsOut };
  });
}

export async function pushPendingCombatant(boardId: string, objectId: string) {
  const session = await prisma.combatSession.findFirst({
    where: { boardId, status: "ACTIVE" },
  });
  if (!session) return;
  const pending = parseStringArray(session.pendingAddIds);
  if (!pending.includes(objectId)) pending.push(objectId);
  await prisma.combatSession.update({
    where: { id: session.id },
    data: { pendingAddIds: pending },
  });
}
