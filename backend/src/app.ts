import cors from "cors";
import express from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import {
  createBoardSchema,
  createObjectSchema,
  moveObjectSchema,
  updateBoardSchema,
  updateObjectSchema,
} from "./validation.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
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
    include: { objects: { include: { cards: true }, orderBy: [{ y: "asc" }, { x: "asc" }] } },
  });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });
  res.json(board.objects);
});

app.post("/boards/:id/objects", async (req, res) => {
  const parsed = createObjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ message: "Board no encontrado" });

  try {
    const object = await prisma.gameObject.create({
      data: {
        boardId: req.params.id,
        ...parsed.data,
        cards: {
          create: parsed.data.cards,
        },
      },
      include: { cards: true },
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
  const { cards: _removedCards, ...rest } = payload;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const object = await tx.gameObject.update({
        where: { id: req.params.id },
        data: rest,
      });

      if (cards) {
        await tx.card.deleteMany({ where: { gameObjectId: object.id } });
        await tx.card.createMany({
          data: cards.map((card) => ({
            gameObjectId: object.id,
            name: card.name,
            description: card.description,
          })),
        });
      }

      return tx.gameObject.findUnique({
        where: { id: object.id },
        include: { cards: true },
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

  const distance = Math.abs(object.x - parsed.data.x) + Math.abs(object.y - parsed.data.y);
  if (distance !== 1) {
    return res
      .status(400)
      .json({ message: "Movimiento invalido: solo celdas adyacentes" });
  }

  if (object.staminaPoints <= 0) {
    return res.status(400).json({ message: "Stamina insuficiente" });
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
      staminaPoints: { decrement: 1 },
    },
    include: { cards: true },
  });

  res.json(moved);
});

