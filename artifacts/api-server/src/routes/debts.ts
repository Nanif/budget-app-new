import { Router } from "express";
import { db, debtsTable, insertDebtSchema } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function formatDebt(e: typeof debtsTable.$inferSelect) {
  return {
    id: e.id,
    name: e.name,
    type: e.type,
    totalAmount: parseFloat(e.totalAmount),
    remainingAmount: parseFloat(e.remainingAmount),
    dueDate: e.dueDate ?? null,
    status: e.status,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(debtsTable).orderBy(desc(debtsTable.createdAt));
    res.json(rows.map(formatDebt));
  } catch (err) {
    req.log.error({ err }, "Failed to get debts");
    res.status(500).json({ error: "Failed to get debts" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertDebtSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db.insert(debtsTable).values(parsed.data).returning();
    res.status(201).json(formatDebt(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create debt");
    res.status(500).json({ error: "Failed to create debt" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = insertDebtSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [updated] = await db.update(debtsTable).set(parsed.data).where(eq(debtsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(formatDebt(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update debt");
    res.status(500).json({ error: "Failed to update debt" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(debtsTable).where(eq(debtsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete debt");
    res.status(500).json({ error: "Failed to delete debt" });
  }
});

export default router;
