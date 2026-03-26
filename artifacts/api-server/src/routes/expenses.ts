import { Router } from "express";
import { db, expensesTable, insertExpenseSchema } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function formatExpense(e: typeof expensesTable.$inferSelect) {
  return {
    id: e.id,
    amount: parseFloat(e.amount),
    category: e.category,
    description: e.description,
    date: e.date,
    isRecurring: e.isRecurring,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(expensesTable).orderBy(desc(expensesTable.date));
    res.json(rows.map(formatExpense));
  } catch (err) {
    req.log.error({ err }, "Failed to get expenses");
    res.status(500).json({ error: "Failed to get expenses" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db.insert(expensesTable).values(parsed.data).returning();
    res.status(201).json(formatExpense(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create expense");
    res.status(500).json({ error: "Failed to create expense" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = insertExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [updated] = await db.update(expensesTable).set(parsed.data).where(eq(expensesTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(formatExpense(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update expense");
    res.status(500).json({ error: "Failed to update expense" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(expensesTable).where(eq(expensesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete expense");
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

export default router;
