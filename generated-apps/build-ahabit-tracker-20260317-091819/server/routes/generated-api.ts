import type { Express } from "express";
import { db } from "../db.js";
import { HabitRepository } from "../repositories/generated-repository.js";

export function registerGeneratedRoutes(app: Express): void {
  const repository = new HabitRepository(db);
  app.get("/api/habits", async (req, res) => {
    const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 20;
    return res.json(await repository.list(Number.isFinite(limit) ? limit : 20));
  });
  app.get("/api/habits/:id", async (req, res) => {
    const row = await repository.getById(req.params.id);
    if (!row) return res.status(404).json({ message: "Habit not found" });
    return res.json(row);
  });
  app.post("/api/habits", async (req, res) => res.status(201).json(await repository.create(req.body)));
}