import { Router } from "express";
import { db, assetsTable, insertAssetSchema } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;
function getBYID(req: any): number { const b = parseInt(String(req.query.bid)); return isNaN(b) ? DEFAULT_BUDGET_YEAR_ID : b; }

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(assetsTable)
      .where(and(eq(assetsTable.userId, DEFAULT_USER_ID), eq(assetsTable.budgetYearId, getBYID(req))))
      .orderBy(desc(assetsTable.createdAt));
    res.json(rows.map(r => ({
      ...r,
      currentAmount: parseFloat(r.currentAmount),
      targetAmount: r.targetAmount ? parseFloat(r.targetAmount) : null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get assets");
    res.status(500).json({ error: "Failed to get assets" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: getBYID(req) };
    const parsed = insertAssetSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(assetsTable).values(parsed.data).returning();
    res.status(201).json({ ...created, currentAmount: parseFloat(created.currentAmount), targetAmount: created.targetAmount ? parseFloat(created.targetAmount) : null });
  } catch (err) {
    req.log.error({ err }, "Failed to create asset");
    res.status(500).json({ error: "Failed to create asset" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: getBYID(req) };
    const parsed = insertAssetSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(assetsTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(assetsTable.id, id), eq(assetsTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, currentAmount: parseFloat(updated.currentAmount), targetAmount: updated.targetAmount ? parseFloat(updated.targetAmount) : null });
  } catch (err) {
    req.log.error({ err }, "Failed to update asset");
    res.status(500).json({ error: "Failed to update asset" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(assetsTable).where(and(eq(assetsTable.id, id), eq(assetsTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete asset");
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

export default router;
