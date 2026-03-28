import { Router } from "express";
import { db, incomesTable, insertIncomeSchema } from "@workspace/db";
import { eq, desc, and, sum, sql } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

function parseNum(v: string | null) { return v ? parseFloat(v) : 0; }

// GET /api/incomes?type=income|work_deduction
router.get("/", async (req, res) => {
  try {
    const { type } = req.query;
    const conditions: any[] = [
      eq(incomesTable.userId, DEFAULT_USER_ID),
      eq(incomesTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID),
    ];
    if (type && (type === "income" || type === "work_deduction")) {
      conditions.push(eq(incomesTable.entryType, String(type)));
    }
    const rows = await db.select().from(incomesTable)
      .where(and(...conditions))
      .orderBy(desc(incomesTable.date));
    res.json(rows.map(r => ({ ...r, amount: parseNum(r.amount) })));
  } catch (err) {
    req.log.error({ err }, "Failed to get incomes");
    res.status(500).json({ error: "Failed to get incomes" });
  }
});

// GET /api/incomes/summary — income, deductions, net, tithe needed
router.get("/summary", async (req, res) => {
  try {
    const rows = await db
      .select({
        entryType: incomesTable.entryType,
        total: sum(incomesTable.amount),
      })
      .from(incomesTable)
      .where(and(
        eq(incomesTable.userId, DEFAULT_USER_ID),
        eq(incomesTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID),
      ))
      .groupBy(incomesTable.entryType);

    const incomeTotal = rows.find(r => r.entryType === "income");
    const deductionTotal = rows.find(r => r.entryType === "work_deduction");

    const totalIncome = parseNum(incomeTotal?.total ?? null);
    const totalDeductions = parseNum(deductionTotal?.total ?? null);
    const netIncome = totalIncome - totalDeductions;

    // Get monthly breakdown
    const monthly = await db
      .select({
        month: sql<string>`to_char(${incomesTable.date}::date, 'YYYY-MM')`,
        entryType: incomesTable.entryType,
        total: sum(incomesTable.amount),
      })
      .from(incomesTable)
      .where(and(
        eq(incomesTable.userId, DEFAULT_USER_ID),
        eq(incomesTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID),
      ))
      .groupBy(
        sql`to_char(${incomesTable.date}::date, 'YYYY-MM')`,
        incomesTable.entryType,
      )
      .orderBy(sql`to_char(${incomesTable.date}::date, 'YYYY-MM')`);

    res.json({
      totalIncome, totalDeductions, netIncome,
      monthly: monthly.map(r => ({ ...r, total: parseNum(r.total ?? null) })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get income summary");
    res.status(500).json({ error: "Failed to get income summary" });
  }
});

// POST /api/incomes
router.post("/", async (req, res) => {
  try {
    const raw = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: DEFAULT_BUDGET_YEAR_ID };
    const body = Object.fromEntries(Object.entries(raw).filter(([_, v]) => v !== null && v !== ""));
    const parsed = insertIncomeSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db.insert(incomesTable).values(parsed.data).returning();
    res.status(201).json({ ...created, amount: parseNum(created.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to create income");
    res.status(500).json({ error: "Failed to create income" });
  }
});

// PUT /api/incomes/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const raw = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: DEFAULT_BUDGET_YEAR_ID };
    const body = Object.fromEntries(Object.entries(raw).filter(([_, v]) => v !== null && v !== ""));
    const parsed = insertIncomeSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [updated] = await db.update(incomesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(incomesTable.id, id), eq(incomesTable.userId, DEFAULT_USER_ID)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, amount: parseNum(updated.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to update income");
    res.status(500).json({ error: "Failed to update income" });
  }
});

// DELETE /api/incomes/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(incomesTable)
      .where(and(eq(incomesTable.id, id), eq(incomesTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete income");
    res.status(500).json({ error: "Failed to delete income" });
  }
});

export default router;
