import { Router } from "express";
import { db, expensesTable, categoriesTable, insertExpenseSchema } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: expensesTable.id,
        userId: expensesTable.userId,
        budgetYearId: expensesTable.budgetYearId,
        categoryId: expensesTable.categoryId,
        fundId: expensesTable.fundId,
        amount: expensesTable.amount,
        description: expensesTable.description,
        date: expensesTable.date,
        paymentMethod: expensesTable.paymentMethod,
        isRecurring: expensesTable.isRecurring,
        receiptUrl: expensesTable.receiptUrl,
        createdAt: expensesTable.createdAt,
        updatedAt: expensesTable.updatedAt,
        categoryName: categoriesTable.name,
        categoryColor: categoriesTable.color,
        categoryIcon: categoriesTable.icon,
      })
      .from(expensesTable)
      .leftJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
      .where(and(
        eq(expensesTable.userId, DEFAULT_USER_ID),
        eq(expensesTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID)
      ))
      .orderBy(desc(expensesTable.date));

    res.json(rows.map(r => ({ ...r, amount: parseFloat(r.amount) })));
  } catch (err) {
    req.log.error({ err }, "Failed to get expenses");
    res.status(500).json({ error: "Failed to get expenses" });
  }
});

router.post("/", async (req, res) => {
  try {
    const raw = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: DEFAULT_BUDGET_YEAR_ID };
    const body = Object.fromEntries(Object.entries(raw).filter(([_, v]) => v !== null && v !== ""));
    const parsed = insertExpenseSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db.insert(expensesTable).values(parsed.data).returning();
    res.status(201).json({ ...created, amount: parseFloat(created.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to create expense");
    res.status(500).json({ error: "Failed to create expense" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const raw = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: DEFAULT_BUDGET_YEAR_ID };
    const body = Object.fromEntries(Object.entries(raw).filter(([_, v]) => v !== null && v !== ""));
    const parsed = insertExpenseSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [updated] = await db.update(expensesTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(expensesTable.id, id), eq(expensesTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, amount: parseFloat(updated.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to update expense");
    res.status(500).json({ error: "Failed to update expense" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(expensesTable).where(and(eq(expensesTable.id, id), eq(expensesTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete expense");
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

export default router;
