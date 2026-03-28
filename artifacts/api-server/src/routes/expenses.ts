import { Router } from "express";
import { db, expensesTable, categoriesTable, insertExpenseSchema } from "@workspace/db";
import { eq, desc, and, sum } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

function parseNum(v: string | null) { return v ? parseFloat(v) : 0; }

// GET /api/expenses?fundId=N
router.get("/", async (req, res) => {
  try {
    const { fundId } = req.query;
    const conditions: any[] = [
      eq(expensesTable.userId, DEFAULT_USER_ID),
      eq(expensesTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID),
    ];
    if (fundId) conditions.push(eq(expensesTable.fundId, parseInt(String(fundId))));

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
        createdAt: expensesTable.createdAt,
        updatedAt: expensesTable.updatedAt,
        categoryName: categoriesTable.name,
        categoryColor: categoriesTable.color,
      })
      .from(expensesTable)
      .leftJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
      .where(and(...conditions))
      .orderBy(desc(expensesTable.date));

    res.json(rows.map(r => ({ ...r, amount: parseNum(r.amount) })));
  } catch (err) {
    req.log.error({ err }, "Failed to get expenses");
    res.status(500).json({ error: "Failed to get expenses" });
  }
});

// GET /api/expenses/by-fund — total spent per fund
router.get("/by-fund", async (req, res) => {
  try {
    const rows = await db
      .select({
        fundId: expensesTable.fundId,
        total: sum(expensesTable.amount),
      })
      .from(expensesTable)
      .where(and(
        eq(expensesTable.userId, DEFAULT_USER_ID),
        eq(expensesTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID),
      ))
      .groupBy(expensesTable.fundId);
    res.json(rows.map(r => ({ fundId: r.fundId, total: parseNum(r.total ?? null) })));
  } catch (err) {
    req.log.error({ err }, "Failed to get expenses by fund");
    res.status(500).json({ error: "Failed to get expenses by fund" });
  }
});

// GET /api/expenses/summary?fundId=N
router.get("/summary", async (req, res) => {
  try {
    const { fundId } = req.query;
    const conditions: any[] = [
      eq(expensesTable.userId, DEFAULT_USER_ID),
      eq(expensesTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID),
    ];
    if (fundId) conditions.push(eq(expensesTable.fundId, parseInt(String(fundId))));

    const [totals] = await db.select({ total: sum(expensesTable.amount) })
      .from(expensesTable).where(and(...conditions));

    const byCat = await db
      .select({
        categoryId: expensesTable.categoryId,
        categoryName: categoriesTable.name,
        categoryColor: categoriesTable.color,
        total: sum(expensesTable.amount),
      })
      .from(expensesTable)
      .leftJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
      .where(and(...conditions))
      .groupBy(expensesTable.categoryId, categoriesTable.name, categoriesTable.color);

    res.json({
      total: parseNum(totals?.total ?? null),
      byCategory: byCat.map(r => ({ ...r, total: parseNum(r.total ?? null) })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get summary" });
  }
});

// POST /api/expenses
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
    res.status(201).json({ ...created, amount: parseNum(created.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to create expense");
    res.status(500).json({ error: "Failed to create expense" });
  }
});

// PUT /api/expenses/:id
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
    const [updated] = await db.update(expensesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(expensesTable.id, id), eq(expensesTable.userId, DEFAULT_USER_ID)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, amount: parseNum(updated.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to update expense");
    res.status(500).json({ error: "Failed to update expense" });
  }
});

// DELETE /api/expenses/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(expensesTable)
      .where(and(eq(expensesTable.id, id), eq(expensesTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete expense");
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

export default router;
