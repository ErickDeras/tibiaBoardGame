import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
beforeEach(async () => {
    await prisma.card.deleteMany();
    await prisma.gameObject.deleteMany();
    await prisma.board.deleteMany();
});
describe("board/object api", () => {
    it("creates a board and object", async () => {
        const boardRes = await request(app).post("/boards").send({ name: "Tablero test" });
        expect(boardRes.status).toBe(201);
        const objectRes = await request(app)
            .post(`/boards/${boardRes.body.id}/objects`)
            .send({
            x: 0,
            y: 0,
            name: "Knight",
            profession: "guerrero",
            helmet: "",
            armor: "",
            legs: "",
            boots: "",
            weapon: "Sword",
            shield: "Viking Shield",
            ring: "",
            necklace: "",
            backpack: "",
            hitpoints: 100,
            manaPoints: 20,
            staminaPoints: 2,
            spriteUrl: "",
            cards: Array.from({ length: 5 }).map((_, i) => ({
                name: `Card ${i + 1}`,
                description: `Desc ${i + 1}`,
            })),
        });
        expect(objectRes.status).toBe(201);
        expect(objectRes.body.cards).toHaveLength(5);
    });
    it("moves only to adjacent cell and consumes stamina", async () => {
        const boardRes = await request(app).post("/boards").send({ name: "Move Board" });
        const objectRes = await request(app)
            .post(`/boards/${boardRes.body.id}/objects`)
            .send({
            x: 1,
            y: 1,
            name: "Mage",
            profession: "mago",
            helmet: "",
            armor: "",
            legs: "",
            boots: "",
            weapon: "Wand",
            shield: "Spellbook",
            ring: "",
            necklace: "",
            backpack: "",
            hitpoints: 70,
            manaPoints: 120,
            staminaPoints: 1,
            spriteUrl: "",
            cards: Array.from({ length: 5 }).map((_, i) => ({
                name: `Card ${i + 1}`,
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
    it("blocks movement into occupied cell", async () => {
        const boardRes = await request(app).post("/boards").send({ name: "Collision Board" });
        const basePayload = {
            profession: "paladin",
            helmet: "",
            armor: "",
            legs: "",
            boots: "",
            weapon: "",
            shield: "",
            ring: "",
            necklace: "",
            backpack: "",
            hitpoints: 90,
            manaPoints: 40,
            staminaPoints: 2,
            spriteUrl: "",
            cards: Array.from({ length: 5 }).map((_, i) => ({
                name: `Card ${i + 1}`,
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
});
