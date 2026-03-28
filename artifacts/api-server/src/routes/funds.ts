import { Router } from "express";
import { db, fundsTable, insertFundSchema, categoriesTable } from "@workspace/db";
import { eq, and, asc, sql } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

/* ── GET all (active + inactive) ──────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const includeInactive = req.query.all === "true";
    const baseWhere = and(
      eq(fundsTable.userId, DEFAULT_USER_ID),
      eq(fundsTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID),
      ...(includeInactive ? [] : [eq(fundsTable.isActive, true)])
    );
    const rows = await db.select().from(fundsTable)
      .where(baseWhere)
      .orderBy(asc(fundsTable.displayOrder));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get funds");
    res.status(500).json({ error: "Failed to get funds" });
  }
});

/* ── POST ─────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: DEFAULT_BUDGET_YEAR_ID };
    const parsed = insertFundSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(fundsTable).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create fund");
    res.status(500).json({ error: "Failed to create fund" });
  }
});

/* ── PUT ──────────────────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: DEFAULT_BUDGET_YEAR_ID };
    const parsed = insertFundSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(fundsTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update fund");
    res.status(500).json({ error: "Failed to update fund" });
  }
});

/* ── PATCH toggle active ─────────────────────────────────────── */
router.patch("/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [cur] = await db.select({ isActive: fundsTable.isActive })
      .from(fundsTable).where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID)));
    if (!cur) { res.status(404).json({ error: "Not found" }); return; }
    const [updated] = await db.update(fundsTable).set({ isActive: !cur.isActive, updatedAt: new Date() })
      .where(eq(fundsTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to toggle fund");
    res.status(500).json({ error: "Failed to toggle fund" });
  }
});

/* ── PATCH reorder ────────────────────────────────────────────── */
router.patch("/reorder", async (req, res) => {
  try {
    const { orderedIds } = req.body as { orderedIds: number[] };
    if (!Array.isArray(orderedIds)) { res.status(400).json({ error: "orderedIds must be array" }); return; }
    await Promise.all(orderedIds.map((id, idx) =>
      db.update(fundsTable).set({ displayOrder: idx, updatedAt: new Date() })
        .where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID)))
    ));
    const rows = await db.select().from(fundsTable)
      .where(and(eq(fundsTable.userId, DEFAULT_USER_ID), eq(fundsTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID)))
      .orderBy(asc(fundsTable.displayOrder));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to reorder funds");
    res.status(500).json({ error: "Failed to reorder funds" });
  }
});

/* ── DELETE ───────────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(fundsTable).set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete fund");
    res.status(500).json({ error: "Failed to delete fund" });
  }
});

export default router;
