import { Router } from "express";
import { db, savingsTable, insertSavingSchema } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function formatSaving(e: typeof savingsTable.$inferSelect) {
  return {
    id: e.id,
    name: e.name,
    category: e.category,
    type: e.type,
    targetAmount: e.targetAmount ? parseFloat(e.targetAmount) : null,
    currentAmount: parseFloat(e.currentAmount),
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(savingsTable).orderBy(desc(savingsTable.createdAt));
    res.json(rows.map(formatSaving));
  } catch (err) {
    req.log.error({ err }, "Failed to get savings");
    res.status(500).json({ error: "Failed to get savings" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertSavingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db.insert(savingsTable).values(parsed.data).returning();
    res.status(201).json(formatSaving(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create saving");
    res.status(500).json({ error: "Failed to create saving" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = insertSavingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [updated] = await db.update(savingsTable).set(parsed.data).where(eq(savingsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(formatSaving(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update saving");
    res.status(500).json({ error: "Failed to update saving" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(savingsTable).where(eq(savingsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete saving");
    res.status(500).json({ error: "Failed to delete saving" });
  }
});

export default router;
