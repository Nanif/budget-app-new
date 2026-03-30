import { Router } from "express";
import { db, assetsTable, insertAssetSchema } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;

const fmt = (r: any) => ({
  ...r,
  currentAmount: parseFloat(r.currentAmount),
  targetAmount:  r.targetAmount ? parseFloat(r.targetAmount) : null,
});

/* Assets are global — not scoped to any budget year */

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(assetsTable)
      .where(eq(assetsTable.userId, DEFAULT_USER_ID))
      .orderBy(desc(assetsTable.createdAt));
    res.json(rows.map(fmt));
  } catch (err) {
    req.log.error({ err }, "Failed to get assets");
    res.status(500).json({ error: "Failed to get assets" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: null };
    const parsed = insertAssetSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(assetsTable).values(parsed.data).returning();
    res.status(201).json(fmt(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create asset");
    res.status(500).json({ error: "Failed to create asset" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: null };
    const parsed = insertAssetSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(assetsTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(assetsTable.id, id), eq(assetsTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(updated));
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
