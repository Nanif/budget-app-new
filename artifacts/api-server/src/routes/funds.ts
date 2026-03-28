import { Router } from "express";
import { db, fundsTable, insertFundSchema, fundBudgetsTable, expensesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(fundsTable)
      .where(and(eq(fundsTable.userId, DEFAULT_USER_ID), eq(fundsTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID)))
      .orderBy(fundsTable.sortOrder);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get funds");
    res.status(500).json({ error: "Failed to get funds" });
  }
});

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

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(fundsTable).where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete fund");
    res.status(500).json({ error: "Failed to delete fund" });
  }
});

export default router;
