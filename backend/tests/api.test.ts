import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
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
});
