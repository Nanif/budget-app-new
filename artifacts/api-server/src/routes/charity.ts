import { Router } from "express";
import { db, titheGivenTable, insertTitheGivenSchema } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;
function getBYID(req: any): number { const b = parseInt(String(req.query.bid)); return isNaN(b) ? DEFAULT_BUDGET_YEAR_ID : b; }

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(titheGivenTable)
      .where(and(eq(titheGivenTable.userId, DEFAULT_USER_ID), eq(titheGivenTable.budgetYearId, getBYID(req))))
      .orderBy(desc(titheGivenTable.date));
    res.json(rows.map(r => ({ ...r, amount: parseFloat(r.amount), tithePercent: r.tithePercent ? parseFloat(r.tithePercent) : null })));
  } catch (err) {
    req.log.error({ err }, "Failed to get charity entries");
    res.status(500).json({ error: "Failed to get charity entries" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: getBYID(req) };
    const parsed = insertTitheGivenSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(titheGivenTable).values(parsed.data).returning();
    res.status(201).json({ ...created, amount: parseFloat(created.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to create charity entry");
    res.status(500).json({ error: "Failed to create charity entry" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: getBYID(req) };
    const parsed = insertTitheGivenSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(titheGivenTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(titheGivenTable.id, id), eq(titheGivenTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, amount: parseFloat(updated.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to update charity entry");
    res.status(500).json({ error: "Failed to update charity entry" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(titheGivenTable).where(and(eq(titheGivenTable.id, id), eq(titheGivenTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete charity entry");
    res.status(500).json({ error: "Failed to delete charity entry" });
  }
});

export default router;
