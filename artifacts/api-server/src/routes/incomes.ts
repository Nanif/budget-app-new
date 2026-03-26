import { Router } from "express";
import { db, incomesTable, insertIncomeSchema } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function formatIncome(e: typeof incomesTable.$inferSelect) {
  return {
    id: e.id,
    amount: parseFloat(e.amount),
    source: e.source,
    description: e.description,
    date: e.date,
    isRecurring: e.isRecurring,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(incomesTable).orderBy(desc(incomesTable.date));
    res.json(rows.map(formatIncome));
  } catch (err) {
    req.log.error({ err }, "Failed to get incomes");
    res.status(500).json({ error: "Failed to get incomes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertIncomeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db.insert(incomesTable).values(parsed.data).returning();
    res.status(201).json(formatIncome(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create income");
    res.status(500).json({ error: "Failed to create income" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = insertIncomeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [updated] = await db.update(incomesTable).set(parsed.data).where(eq(incomesTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(formatIncome(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update income");
    res.status(500).json({ error: "Failed to update income" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(incomesTable).where(eq(incomesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete income");
    res.status(500).json({ error: "Failed to delete income" });
  }
});

export default router;
