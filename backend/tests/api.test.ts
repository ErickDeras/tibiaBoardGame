import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";

function cardStub(i: number) {
  return {
    name: `Card ${i + 1}`,
    description: `Desc ${i + 1}`,
    deckCategory: "SPELL_ATTACK" as const,
    manaCost: null as number | null,
    staminaCost: null as number | null,
    capacityCost: null as number | null,
    rapidSpell: false,
    spellSkillBonus: 0,
    critMultiplier: null as number | null,
    damageSkill: "SWORD" as const,
  };
}

const baseObjectBody = {
  helmet: "",
  armor: "",
  legs: "",
  boots: "",
  weapon: "Sword",
  shield: "Viking Shield",
  ring: "",
  necklace: "",
  backpackEquipment: "",
  hitpoints: 100,
  manaPoints: 20,
  staminaPoints: 2,
  spriteUrl: "",
  objectKind: "PLAYER" as const,
  profession: "guerrero" as const,
  attackValue: 5,
  defenseValue: 3,
  magicAttackValue: 0,
  experiencePoints: 0,
  experienceLevel: 1,
  gold: 0,
  manaRegen: 0,
  staminaRegen: 0,
  capacityMax: 500,
  inventorySlots: [] as { slotIndex: number; itemName: string; weight: number; quantity: number }[],
  cards: [] as ReturnType<typeof cardStub>[],
};

/** Arma 10 atk, escudo 4 def (servidor recalcula PLAYER desde equipo + nivel). */
async function seedMeleeGear(boardId: string) {
  await request(app).post(`/boards/${boardId}/equipment-items`).send({
    slot: "Weapon",
    name: "Sword",
    valueAttack: 10,
    valueDefense: 0,
  });
  await request(app).post(`/boards/${boardId}/equipment-items`).send({
    slot: "Shield_Quiver",
    name: "Viking Shield",
    valueAttack: 0,
    valueDefense: 4,
  });
}

beforeEach(async () => {
  await prisma.roomChatMessage.deleteMany();
  await prisma.lobbyDevChatMessage.deleteMany();
  await prisma.matchArchive.deleteMany();
  await prisma.combatLogEntry.deleteMany();
  await prisma.combatSession.deleteMany();
  await prisma.groundLoot.deleteMany();
  await prisma.lootEntry.deleteMany();
  await prisma.itemTemplate.deleteMany();
  await prisma.creatureTemplate.deleteMany();
  await prisma.dungeonBoard.deleteMany();
  await prisma.dungeon.deleteMany();
  await prisma.card.deleteMany();
  await prisma.cardTemplate.deleteMany();
  await prisma.inventorySlot.deleteMany();
  await prisma.gameObject.deleteMany();
  await prisma.equipmentItem.deleteMany();
  await prisma.devNote.deleteMany();
  await prisma.liveSession.deleteMany();
  await prisma.board.deleteMany();
});

describe("board/object api", () => {
  it("creates a board and object; attack/defense from equipment rule", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Tablero test" });
    expect(boardRes.status).toBe(201);
    await seedMeleeGear(boardRes.body.id);

    const objectRes = await request(app)
      .post(`/boards/${boardRes.body.id}/objects`)
      .send({
        x: 0,
        y: 0,
        name: "Knight",
        ...baseObjectBody,
      });

    expect(objectRes.status).toBe(201);
    expect(objectRes.body.cards).toHaveLength(0);
    expect(objectRes.body.attackValue).toBe(10);
    expect(objectRes.body.defenseValue).toBe(4);
    expect(objectRes.body.magicAttackValue).toBe(0);
    expect(objectRes.body.backpackEquipment).toBe("");
  });

  it("adds skill conversion to attack/defense with profession restrictions", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Skills Board" });
    expect(boardRes.status).toBe(201);
    await seedMeleeGear(boardRes.body.id);

    // Guerrero: solo sword/axe/mace suman a ataque (10%); distance NO suma.
    const warriorRes = await request(app)
      .post(`/boards/${boardRes.body.id}/objects`)
      .send({
        x: 0,
        y: 0,
        name: "Warrior",
        ...baseObjectBody,
        profession: "guerrero",
        swordSkill: 50,
        axeSkill: 25,
        maceSkill: 25,
        distanceSkill: 999,
        shieldingSkill: 50,
      });
    expect(warriorRes.status).toBe(201);
    // Weapon 10 + floor(0.1*(50+25+25))=10 => 20
    expect(warriorRes.body.attackValue).toBe(20);
    // Shield item 4 + floor(0.1*50)=5 => 9
    expect(warriorRes.body.defenseValue).toBe(9);

    // Paladin: solo distance suma a ataque; sword/axe/mace NO suman.
    const paladinRes = await request(app)
      .post(`/boards/${boardRes.body.id}/objects`)
      .send({
        x: 1,
        y: 0,
        name: "Paladin",
        ...baseObjectBody,
        profession: "paladin",
        swordSkill: 999,
        axeSkill: 999,
        maceSkill: 999,
        distanceSkill: 50,
        shieldingSkill: 0,
      });
    expect(paladinRes.status).toBe(201);
    // Weapon 10 + floor(0.1*50)=5 => 15
    expect(paladinRes.body.attackValue).toBe(15);

    // Mago: solo magicLevel suma a ataque; distance NO suma.
    const mageRes = await request(app)
      .post(`/boards/${boardRes.body.id}/objects`)
      .send({
        x: 2,
        y: 0,
        name: "Mage",
        ...baseObjectBody,
        profession: "mago",
        weapon: "",
        shield: "",
        magicLevel: 80,
        distanceSkill: 999,
        shieldingSkill: 0,
      });
    expect(mageRes.status).toBe(201);
    // Weapon 0 + floor(0.1*80)=8 => 8
    expect(mageRes.body.attackValue).toBe(8);
    // magicAttackValue solo usa magicLevel del personaje (no arma ni otras skills)
    expect(mageRes.body.magicAttackValue).toBe(80);
  });

  it("moves only to adjacent cell and consumes stamina for PLAYER", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Move Board" });
    await request(app).post(`/boards/${boardRes.body.id}/equipment-items`).send({
      slot: "Weapon",
      name: "Wand",
      valueAttack: 3,
      valueDefense: 0,
      magicLevel: 2,
    });
    await request(app).post(`/boards/${boardRes.body.id}/equipment-items`).send({
      slot: "Shield_Quiver",
      name: "Spellbook",
      valueAttack: 0,
      valueDefense: 1,
    });

    const objectRes = await request(app)
      .post(`/boards/${boardRes.body.id}/objects`)
      .send({
        x: 1,
        y: 1,
        name: "Mage",
        ...baseObjectBody,
        profession: "mago",
        weapon: "Wand",
        shield: "Spellbook",
        staminaPoints: 1,
        cards: Array.from({ length: 5 }).map((_, i) => ({
          ...cardStub(i),
          description: "",
        })),
      });

    const moved = await request(app)
      .post(`/objects/${objectRes.body.id}/move`)
      .send({ x: 2, y: 1 });
    expect(moved.status).toBe(200);
    expect(moved.body.staminaPoints).toBe(0);

    const exhausted = await request(app)
      .post(`/objects/${objectRes.body.id}/move`)
      .send({ x: 3, y: 1 });
    expect(exhausted.status).toBe(400);

    const nonAdjacent = await request(app)
      .post(`/objects/${objectRes.body.id}/move`)
      .send({ x: 5, y: 1 });
    expect(nonAdjacent.status).toBe(400);
  });

  it("CREATURE moves without stamina cost", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Creature Board" });
    const creature = await request(app).post(`/boards/${boardRes.body.id}/objects`).send({
      ...baseObjectBody,
      x: 0,
      y: 0,
      name: "Rat",
      objectKind: "CREATURE",
      profession: null,
      weapon: "",
      shield: "",
      staminaPoints: 0,
    });
    expect(creature.status).toBe(201);
    const moved = await request(app)
      .post(`/objects/${creature.body.id}/move`)
      .send({ x: 1, y: 0 });
    expect(moved.status).toBe(200);
    expect(moved.body.staminaPoints).toBe(0);
  });

  it("blocks movement into occupied cell", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Collision Board" });
    const basePayload = {
      ...baseObjectBody,
      profession: "paladin" as const,
      weapon: "",
      shield: "",
      hitpoints: 90,
      manaPoints: 40,
      staminaPoints: 2,
      cards: Array.from({ length: 5 }).map((_, i) => ({
        ...cardStub(i),
        description: "",
      })),
    };

    const a = await request(app)
      .post(`/boards/${boardRes.body.id}/objects`)
      .send({ ...basePayload, x: 0, y: 0, name: "A" });
    await request(app)
      .post(`/boards/${boardRes.body.id}/objects`)
      .send({ ...basePayload, x: 1, y: 0, name: "B" });

    const moveRes = await request(app).post(`/objects/${a.body.id}/move`).send({ x: 1, y: 0 });
    expect(moveRes.status).toBe(409);
  });

  it("PLAYER experienceLevel is derived from experiencePoints", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "XP Board" });
    await seedMeleeGear(boardRes.body.id);
    const objectRes = await request(app)
      .post(`/boards/${boardRes.body.id}/objects`)
      .send({
        x: 0,
        y: 0,
        name: "Hero",
        ...baseObjectBody,
        experiencePoints: 230,
        experienceLevel: 1,
      });
    expect(objectRes.status).toBe(201);
    expect(objectRes.body.experienceLevel).toBe(2);
    expect(objectRes.body.attackValue).toBe(12);
    expect(objectRes.body.hitpoints).toBe(115);
    expect(objectRes.body.manaPoints).toBe(25);
  });
});

describe("spawn and loot", () => {
  it("spawns creature from template", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Spawn Board" });
    const tplRes = await request(app).post("/creature-templates").send({
      name: "Orc",
      hitpoints: 40,
      attackValue: 8,
    });
    expect(tplRes.status).toBe(201);

    const spawnRes = await request(app).post(`/boards/${boardRes.body.id}/spawn-creature`).send({
      templateId: tplRes.body.id,
      x: 2,
      y: 3,
    });
    expect(spawnRes.status).toBe(201);
    expect(spawnRes.body.objectKind).toBe("CREATURE");
    expect(spawnRes.body.name).toBe("Orc");
    expect(spawnRes.body.x).toBe(2);
    expect(spawnRes.body.y).toBe(3);
    expect(spawnRes.body.cards).toHaveLength(0);
  });

  it("collect-loot transfers items when capacity allows", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Loot Board" });
    await seedMeleeGear(boardRes.body.id);

    const playerRes = await request(app).post(`/boards/${boardRes.body.id}/objects`).send({
      x: 0,
      y: 0,
      name: "Hero",
      ...baseObjectBody,
      capacityMax: 100,
      inventorySlots: [],
    });
    expect(playerRes.status).toBe(201);

    const tplRes = await request(app).post("/creature-templates").send({ name: "Slime" });
    await request(app).post(`/creature-templates/${tplRes.body.id}/loot`).send({
      itemName: "Gold Coin",
      weight: 10,
      quantity: 2,
    });

    const spawnRes = await request(app).post(`/boards/${boardRes.body.id}/spawn-creature`).send({
      templateId: tplRes.body.id,
      x: 5,
      y: 5,
    });
    expect(spawnRes.status).toBe(201);

    const lootRes = await request(app)
      .post(`/objects/${spawnRes.body.id}/collect-loot`)
      .send({ collectorObjectId: playerRes.body.id });

    expect(lootRes.status).toBe(200);

    const hero = await request(app).get(`/boards/${boardRes.body.id}/objects`);
    const updated = hero.body.find((o: { id: string }) => o.id === playerRes.body.id);
    expect(updated.inventorySlots.length).toBeGreaterThan(0);
    const totalW = updated.inventorySlots.reduce(
      (s: number, sl: { weight: number; quantity: number }) => s + sl.weight * sl.quantity,
      0,
    );
    expect(totalW).toBe(20);
  });

  it("sync accepts GameObject fields and magicAttackValue", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Sync Board" });
    await seedMeleeGear(boardRes.body.id);
    const obj = await request(app).post(`/boards/${boardRes.body.id}/objects`).send({
      x: 0,
      y: 0,
      name: "SyncMe",
      ...baseObjectBody,
      attackValue: 7,
      defenseValue: 2,
    });
    expect(obj.status).toBe(201);

    const syncRes = await request(app)
      .post(`/boards/${boardRes.body.id}/sync`)
      .send({
        objects: [
          {
            id: obj.body.id,
            x: 0,
            y: 0,
            name: "SyncMe",
            objectKind: "PLAYER",
            profession: "guerrero",
            creatureTemplateId: null,
            helmet: "",
            armor: "",
            legs: "",
            boots: "",
            weapon: "Sword",
            shield: "Viking Shield",
            ring: "",
            necklace: "",
            backpackEquipment: "",
            hitpoints: 100,
            manaPoints: 20,
            staminaPoints: 2,
            attackValue: 7,
            defenseValue: 2,
            magicAttackValue: 0,
            swordSkill: 0,
            axeSkill: 0,
            maceSkill: 0,
            distanceSkill: 0,
            shieldingSkill: 0,
            magicLevel: 0,
            experiencePoints: 0,
            experienceLevel: 1,
            gold: 0,
            manaRegen: 0,
            staminaRegen: 0,
            capacityMax: 500,
            spriteUrl: "",
            cards: Array.from({ length: 5 }).map((_, i) => cardStub(i)),
            inventorySlots: [],
          },
        ],
      });
    expect(syncRes.status).toBe(200);
  });
});

describe("card templates and use", () => {
  it("adds a card from template and using it spends mana and removes the card", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Cards Board" });
    await seedMeleeGear(boardRes.body.id);

    const tplRes = await request(app).post("/card-templates").send({
      name: "Slash",
      description: "Test",
      deckCategory: "SPELL_ATTACK",
      damageSkill: "SWORD",
      manaCost: 5,
      staminaCost: 1,
      spellSkillBonus: 3,
    });
    expect(tplRes.status).toBe(201);

    const playerRes = await request(app).post(`/boards/${boardRes.body.id}/objects`).send({
      x: 0,
      y: 0,
      name: "Hero",
      ...baseObjectBody,
      manaPoints: 20,
      staminaPoints: 5,
      swordSkill: 40,
      cards: [],
    });
    expect(playerRes.status).toBe(201);

    const addRes = await request(app)
      .post(`/objects/${playerRes.body.id}/cards/from-template`)
      .send({ templateId: tplRes.body.id });
    expect(addRes.status).toBe(201);
    expect(addRes.body.object.cards).toHaveLength(1);
    const cardId = addRes.body.card.id;

    const useRes = await request(app).post(`/objects/${playerRes.body.id}/cards/${cardId}/use`).send({});
    expect(useRes.status).toBe(200);
    expect(useRes.body.object.cards).toHaveLength(0);
    expect(useRes.body.object.manaPoints).toBe(15);
    expect(useRes.body.object.staminaPoints).toBe(4);
    expect(useRes.body.used.effectivePower).toBe(43);
    expect(useRes.body.used.manaSpent).toBe(5);
    expect(useRes.body.used.staminaSpent).toBe(1);
  });
});

describe("combat", () => {
  it("starts combat, player basic attack, creature counter; blocks patch and exploration move", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Combat Board" });
    await seedMeleeGear(boardRes.body.id);

    const playerRes = await request(app).post(`/boards/${boardRes.body.id}/objects`).send({
      x: 0,
      y: 0,
      name: "Hero",
      ...baseObjectBody,
    });
    expect(playerRes.status).toBe(201);

    const tpl = await request(app).post("/creature-templates").send({
      name: "Rat",
      hitpoints: 50,
      defenseValue: 2,
      attackValue: 5,
    });
    const spawn = await request(app).post(`/boards/${boardRes.body.id}/spawn-creature`).send({
      templateId: tpl.body.id,
      x: 1,
      y: 0,
    });
    expect(spawn.status).toBe(201);

    const start = await request(app).post(`/boards/${boardRes.body.id}/combat/start`).send({});
    expect(start.status).toBe(201);

    const patch = await request(app).patch(`/objects/${playerRes.body.id}`).send({ name: "Renamed" });
    expect(patch.status).toBe(400);

    const moveExpl = await request(app).post(`/objects/${playerRes.body.id}/move`).send({ x: 0, y: 1 });
    expect(moveExpl.status).toBe(400);

    const pTurn = await request(app).post(`/boards/${boardRes.body.id}/combat/turn/player`).send({
      actorId: playerRes.body.id,
      moves: [],
      basicAttack: { kind: "melee", targetId: spawn.body.id },
      cardAction: null,
    });
    expect(pTurn.status).toBe(200);
    const ratAfter = pTurn.body.objects.find((o: { id: string }) => o.id === spawn.body.id);
    expect(ratAfter.hitpoints).toBe(42);

    const cTurn = await request(app).post(`/boards/${boardRes.body.id}/combat/turn/creature`).send({
      actorId: spawn.body.id,
    });
    expect(cTurn.status).toBe(200);
    const heroAfter = cTurn.body.objects.find((o: { id: string }) => o.id === playerRes.body.id);
    expect(heroAfter.hitpoints).toBe(99);
  });

  it("can start combat again after ending previous session on same board", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Restart Combat" });
    await seedMeleeGear(boardRes.body.id);

    const playerRes = await request(app).post(`/boards/${boardRes.body.id}/objects`).send({
      x: 0,
      y: 0,
      name: "Hero",
      ...baseObjectBody,
    });
    const tpl = await request(app).post("/creature-templates").send({
      name: "RestartRat",
      hitpoints: 10,
      defenseValue: 0,
      attackValue: 1,
    });
    await request(app).post(`/boards/${boardRes.body.id}/spawn-creature`).send({
      templateId: tpl.body.id,
      x: 1,
      y: 0,
    });

    const first = await request(app).post(`/boards/${boardRes.body.id}/combat/start`).send({});
    expect(first.status).toBe(201);

    const end = await request(app).post(`/boards/${boardRes.body.id}/combat/end`).send({});
    expect(end.status).toBe(200);

    const second = await request(app).post(`/boards/${boardRes.body.id}/combat/start`).send({});
    expect(second.status).toBe(201);
    expect(second.body.boardId).toBe(boardRes.body.id);
  });

  it("drops ground loot when creature dies and player can collect", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Loot Combat" });
    await seedMeleeGear(boardRes.body.id);

    const playerRes = await request(app).post(`/boards/${boardRes.body.id}/objects`).send({
      x: 0,
      y: 0,
      name: "Hero",
      ...baseObjectBody,
    });

    const tpl = await request(app).post("/creature-templates").send({
      name: "LootRat",
      hitpoints: 8,
      defenseValue: 0,
      attackValue: 1,
    });
    await request(app).post(`/creature-templates/${tpl.body.id}/loot`).send({
      itemName: "Gold",
      weight: 1,
      quantity: 3,
    });

    const spawn = await request(app).post(`/boards/${boardRes.body.id}/spawn-creature`).send({
      templateId: tpl.body.id,
      x: 1,
      y: 0,
    });

    await request(app).post(`/boards/${boardRes.body.id}/combat/start`).send({});

    await request(app).post(`/boards/${boardRes.body.id}/combat/turn/player`).send({
      actorId: playerRes.body.id,
      moves: [],
      basicAttack: { kind: "melee", targetId: spawn.body.id },
      cardAction: null,
    });

    const gl = await request(app).get(`/boards/${boardRes.body.id}/ground-loot`);
    expect(gl.status).toBe(200);
    expect(gl.body.length).toBeGreaterThan(0);

    const col = await request(app).post(`/objects/${playerRes.body.id}/collect-ground-loot`).send({
      x: 1,
      y: 0,
    });
    expect(col.status).toBe(200);
    expect(col.body.player.inventorySlots.length).toBeGreaterThan(0);
  });

  it("grants creature template experience to the player who deals killing blow", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "XP Board" });
    await seedMeleeGear(boardRes.body.id);

    const playerRes = await request(app).post(`/boards/${boardRes.body.id}/objects`).send({
      x: 0,
      y: 0,
      name: "Hero",
      ...baseObjectBody,
      experiencePoints: 10,
    });

    const tpl = await request(app).post("/creature-templates").send({
      name: "XpRat",
      hitpoints: 4,
      defenseValue: 0,
      attackValue: 1,
      experiencePoints: 60,
    });
    const spawn = await request(app).post(`/boards/${boardRes.body.id}/spawn-creature`).send({
      templateId: tpl.body.id,
      x: 1,
      y: 0,
    });
    await request(app).post(`/boards/${boardRes.body.id}/combat/start`).send({});

    const pTurn = await request(app).post(`/boards/${boardRes.body.id}/combat/turn/player`).send({
      actorId: playerRes.body.id,
      moves: [],
      basicAttack: { kind: "melee", targetId: spawn.body.id },
      cardAction: null,
    });
    expect(pTurn.status).toBe(200);
    const hero = pTurn.body.objects.find((o: { id: string }) => o.id === playerRes.body.id);
    expect(hero.experiencePoints).toBe(70);
    expect(pTurn.body.objects.some((o: { id: string }) => o.id === spawn.body.id)).toBe(false);
  });

  it("GET /combat returns ended session so client can show log after wipe", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Ended GET" });
    await seedMeleeGear(boardRes.body.id);

    const playerRes = await request(app).post(`/boards/${boardRes.body.id}/objects`).send({
      x: 0,
      y: 0,
      name: "Hero",
      ...baseObjectBody,
    });

    const tpl = await request(app).post("/creature-templates").send({
      name: "SoloRat",
      hitpoints: 6,
      defenseValue: 0,
      attackValue: 1,
    });
    const spawn = await request(app).post(`/boards/${boardRes.body.id}/spawn-creature`).send({
      templateId: tpl.body.id,
      x: 1,
      y: 0,
    });
    await request(app).post(`/boards/${boardRes.body.id}/combat/start`).send({});

    await request(app).post(`/boards/${boardRes.body.id}/combat/turn/player`).send({
      actorId: playerRes.body.id,
      moves: [],
      basicAttack: { kind: "melee", targetId: spawn.body.id },
      cardAction: null,
    });

    const g = await request(app).get(`/boards/${boardRes.body.id}/combat`);
    expect(g.status).toBe(200);
    expect(g.body.session).toBeDefined();
    expect(g.body.session.status).toBe("ENDED");
    expect(Array.isArray(g.body.session.logEntries)).toBe(true);
  });
});

describe("shared global room (SHARED_BOARD_ID)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("join fails when SHARED_BOARD_ID is not set", async () => {
    vi.stubEnv("SHARED_BOARD_ID", "");
    const res = await request(app).post("/api/sessions/join").send({ username: "a" });
    expect(res.status).toBe(400);
    expect(String(res.body.message ?? "")).toMatch(/configurada|Sala/i);
  });

  it("allows up to 4 joins then rejects; presence lists names", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Room" });
    const boardId = boardRes.body.id as string;
    vi.stubEnv("SHARED_BOARD_ID", boardId);

    const tokens: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await request(app).post("/api/sessions/join").send({ username: `user${i}` });
      expect(r.status).toBe(201);
      tokens.push(r.body.token as string);
    }
    const fifth = await request(app).post("/api/sessions/join").send({ username: "user5" });
    expect(fifth.status).toBe(403);

    const pres = await request(app).get("/api/sessions/presence");
    expect(pres.status).toBe(200);
    expect(pres.body.usernames).toHaveLength(4);
    expect(pres.body.full).toBe(true);

    const auth = { Authorization: `Bearer ${tokens[0]}` };
    const p1 = await request(app)
      .post(`/boards/${boardId}/objects`)
      .set(auth)
      .send({ x: 0, y: 0, name: "P1", ...baseObjectBody });
    expect(p1.status).toBe(201);
    const dup = await request(app)
      .post(`/boards/${boardId}/objects`)
      .set(auth)
      .send({ x: 1, y: 0, name: "P1b", ...baseObjectBody });
    expect(dup.status).toBe(400);
  });

  it("rejects player turn for another session's character", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Turn room" });
    const boardId = boardRes.body.id as string;
    vi.stubEnv("SHARED_BOARD_ID", boardId);

    const j1 = await request(app).post("/api/sessions/join").send({ username: "alice" });
    const j2 = await request(app).post("/api/sessions/join").send({ username: "bob" });
    const t1 = j1.body.token as string;
    const t2 = j2.body.token as string;

    await seedMeleeGear(boardId);

    const p1 = await request(app)
      .post(`/boards/${boardId}/objects`)
      .set({ Authorization: `Bearer ${t1}` })
      .send({ x: 0, y: 0, name: "Alice", ...baseObjectBody });
    expect(p1.status).toBe(201);
    const p2 = await request(app)
      .post(`/boards/${boardId}/objects`)
      .set({ Authorization: `Bearer ${t2}` })
      .send({ x: 1, y: 0, name: "Bob", ...baseObjectBody });
    expect(p2.status).toBe(201);

    const tpl = await request(app).post("/creature-templates").send({
      name: "RatTurn",
      hitpoints: 20,
      defenseValue: 0,
      attackValue: 1,
    });
    const spawn = await request(app)
      .post(`/boards/${boardId}/spawn-creature`)
      .set({ Authorization: `Bearer ${t1}` })
      .send({
        templateId: tpl.body.id,
        x: 2,
        y: 0,
      });
    expect(spawn.status).toBe(201);

    await request(app)
      .post(`/boards/${boardId}/combat/start`)
      .set({ Authorization: `Bearer ${t1}` })
      .send({});

    const wrong = await request(app)
      .post(`/boards/${boardId}/combat/turn/player`)
      .set({ Authorization: `Bearer ${t2}` })
      .send({
        actorId: p1.body.id,
        moves: [],
        basicAttack: null,
        cardAction: null,
      });
    expect(wrong.status).toBe(400);
    expect(String(wrong.body.message ?? "")).toMatch(/personaje|Solo|controlar/i);
  });

  it("writes MatchArchive when combat ends manually", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Archive room" });
    const boardId = boardRes.body.id as string;
    vi.stubEnv("SHARED_BOARD_ID", boardId);

    const j = await request(app).post("/api/sessions/join").send({ username: "solo" });
    const token = j.body.token as string;
    await seedMeleeGear(boardId);
    await request(app)
      .post(`/boards/${boardId}/objects`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ x: 0, y: 0, name: "Hero", ...baseObjectBody });

    const tpl = await request(app).post("/creature-templates").send({
      name: "RatArch",
      hitpoints: 5,
      defenseValue: 0,
      attackValue: 1,
    });
    await request(app)
      .post(`/boards/${boardId}/spawn-creature`)
      .set({ Authorization: `Bearer ${token}` })
      .send({
        templateId: tpl.body.id,
        x: 1,
        y: 0,
      });

    await request(app)
      .post(`/boards/${boardId}/combat/start`)
      .set({ Authorization: `Bearer ${token}` })
      .send({});

    const end = await request(app)
      .post(`/boards/${boardId}/combat/end`)
      .set({ Authorization: `Bearer ${token}` })
      .send({});
    expect(end.status).toBe(200);

    const rows = await prisma.matchArchive.findMany({ where: { boardId } });
    expect(rows.length).toBe(1);
    expect(Array.isArray(rows[0]!.entries)).toBe(true);
    const entries = rows[0]!.entries as unknown[];
    expect(entries.some((e: unknown) => (e as { type?: string }).type === "COMBAT_END")).toBe(true);
  });

  it("bootstrap then PATCH /me sets display name; pending excluded from presence", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Boot" });
    const boardId = boardRes.body.id as string;
    vi.stubEnv("SHARED_BOARD_ID", boardId);

    const boot = await request(app).post("/api/sessions/bootstrap").send({});
    expect(boot.status).toBe(201);
    expect(boot.body.needsUsername).toBe(true);
    const token = boot.body.token as string;

    const presPending = await request(app).get("/api/sessions/presence");
    expect(presPending.body.usernames).toHaveLength(0);

    const me1 = await request(app).get("/api/sessions/me").set({ Authorization: `Bearer ${token}` });
    expect(me1.status).toBe(200);
    expect(me1.body.needsUsername).toBe(true);

    const patch = await request(app)
      .patch("/api/sessions/me")
      .set({ Authorization: `Bearer ${token}` })
      .send({ username: "patchedUser" });
    expect(patch.status).toBe(200);

    const me2 = await request(app).get("/api/sessions/me").set({ Authorization: `Bearer ${token}` });
    expect(me2.body.displayNameSet).toBe(true);
    expect(me2.body.username).toBe("patchedUser");

    const pres = await request(app).get("/api/sessions/presence");
    expect(pres.body.usernames).toContain("patchedUser");
  });

  it("archives room chat into MatchArchive.conversationLog on combat end", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Chat arch" });
    const boardId = boardRes.body.id as string;
    vi.stubEnv("SHARED_BOARD_ID", boardId);

    const j = await request(app).post("/api/sessions/join").send({ username: "chatter" });
    const token = j.body.token as string;
    const sessionId = j.body.sessionId as string;

    await prisma.roomChatMessage.create({
      data: {
        boardId,
        liveSessionId: sessionId,
        username: "chatter",
        body: "msg antes del fin",
      },
    });

    await seedMeleeGear(boardId);
    await request(app)
      .post(`/boards/${boardId}/objects`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ x: 0, y: 0, name: "Hero", ...baseObjectBody });

    const tpl = await request(app).post("/creature-templates").send({
      name: "RatChat",
      hitpoints: 5,
      defenseValue: 0,
      attackValue: 1,
    });
    await request(app)
      .post(`/boards/${boardId}/spawn-creature`)
      .set({ Authorization: `Bearer ${token}` })
      .send({
        templateId: tpl.body.id,
        x: 1,
        y: 0,
      });

    await request(app)
      .post(`/boards/${boardId}/combat/start`)
      .set({ Authorization: `Bearer ${token}` })
      .send({});

    const end = await request(app)
      .post(`/boards/${boardId}/combat/end`)
      .set({ Authorization: `Bearer ${token}` })
      .send({});
    expect(end.status).toBe(200);

    const rows = await prisma.matchArchive.findMany({ where: { boardId } });
    expect(rows.length).toBe(1);
    const log = rows[0]!.conversationLog as unknown[];
    expect(Array.isArray(log)).toBe(true);
    expect(log.some((m: { body?: string }) => m.body === "msg antes del fin")).toBe(true);

    const left = await prisma.roomChatMessage.count({ where: { boardId } });
    expect(left).toBe(0);
  });

  it("rejects lobby-dev chat POST while combat is active", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Lobby block" });
    const boardId = boardRes.body.id as string;
    vi.stubEnv("SHARED_BOARD_ID", boardId);

    const j = await request(app).post("/api/sessions/join").send({ username: "lobbyuser" });
    const token = j.body.token as string;

    await seedMeleeGear(boardId);
    await request(app)
      .post(`/boards/${boardId}/objects`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ x: 0, y: 0, name: "Hero", ...baseObjectBody });

    const tpl = await request(app).post("/creature-templates").send({
      name: "RatLobby",
      hitpoints: 5,
      defenseValue: 0,
      attackValue: 1,
    });
    await request(app)
      .post(`/boards/${boardId}/spawn-creature`)
      .set({ Authorization: `Bearer ${token}` })
      .send({
        templateId: tpl.body.id,
        x: 1,
        y: 0,
      });

    await request(app)
      .post(`/boards/${boardId}/combat/start`)
      .set({ Authorization: `Bearer ${token}` })
      .send({});

    const blocked = await request(app)
      .post("/api/lobby-dev-chat")
      .set({ Authorization: `Bearer ${token}` })
      .send({ body: "no debe pasar" });
    expect(blocked.status).toBe(403);
  });

  it("returns last room chat messages for named session", async () => {
    const boardRes = await request(app).post("/boards").send({ name: "Recent chat" });
    const boardId = boardRes.body.id as string;
    vi.stubEnv("SHARED_BOARD_ID", boardId);

    const j = await request(app).post("/api/sessions/join").send({ username: "reader" });
    const token = j.body.token as string;
    const sessionId = j.body.sessionId as string;

    for (let i = 0; i < 3; i++) {
      await prisma.roomChatMessage.create({
        data: {
          boardId,
          liveSessionId: sessionId,
          username: "reader",
          body: `line ${i}`,
        },
      });
    }

    const recent = await request(app)
      .get("/api/room-chat/recent?limit=30")
      .set({ Authorization: `Bearer ${token}` });
    expect(recent.status).toBe(200);
    expect(Array.isArray(recent.body)).toBe(true);
    expect(recent.body).toHaveLength(3);
    expect(recent.body[2].body).toBe("line 2");
  });
});
