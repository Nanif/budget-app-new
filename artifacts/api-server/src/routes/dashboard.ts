import { Router } from "express";
import {
  db, expensesTable, incomesTable, titheGivenTable, debtsTable,
  assetsTable, tasksTable, systemSettingsTable, categoriesTable,
  fundsTable, fundBudgetsTable,
} from "@workspace/db";
import { desc, gte, lte, and, eq, sql } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;
function getBYID(req: any): number { const b = parseInt(String(req.query.bid)); return isNaN(b) ? DEFAULT_BUDGET_YEAR_ID : b; }

/* ─── Monthly summary (current month) ──────────────────────────── */
router.get("/summary", async (req, res) => {
  try {
    const byid = getBYID(req);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const userFilter = eq(expensesTable.userId, DEFAULT_USER_ID);
    const yearFilter = eq(expensesTable.budgetYearId, byid);

    const [expenseSum] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(expensesTable).where(and(userFilter, yearFilter, gte(expensesTable.date, startOfMonth), lte(expensesTable.date, endOfMonth)));

    const [incomeSum] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(incomesTable).where(and(eq(incomesTable.userId, DEFAULT_USER_ID), eq(incomesTable.budgetYearId, byid), gte(incomesTable.date, startOfMonth), lte(incomesTable.date, endOfMonth)));

    const [charitySum] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(titheGivenTable).where(and(eq(titheGivenTable.userId, DEFAULT_USER_ID), eq(titheGivenTable.budgetYearId, byid), gte(titheGivenTable.date, startOfMonth), lte(titheGivenTable.date, endOfMonth)));

    const [debtSum] = await db.select({ total: sql<string>`COALESCE(SUM(remaining_amount), 0)` })
      .from(debtsTable).where(and(eq(debtsTable.userId, DEFAULT_USER_ID), eq(debtsTable.budgetYearId, byid), eq(debtsTable.status, "active")));

    const [assetsSum] = await db.select({ total: sql<string>`COALESCE(SUM(current_amount), 0)` })
      .from(assetsTable).where(and(eq(assetsTable.userId, DEFAULT_USER_ID), eq(assetsTable.budgetYearId, byid)));

    const settingsRows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.userId, DEFAULT_USER_ID));
    const settings = settingsRows[0];
    const monthlyBudget = settings ? parseFloat(settings.monthlyBudget) : 0;

    const recentExpenses = await db.select({
      id: expensesTable.id, amount: expensesTable.amount, description: expensesTable.description,
      date: expensesTable.date,
      categoryName: categoriesTable.name, categoryColor: categoriesTable.color, categoryIcon: categoriesTable.icon,
    }).from(expensesTable).leftJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
      .where(and(userFilter, yearFilter)).orderBy(desc(expensesTable.date)).limit(5);

    const upcomingTasks = await db.select().from(tasksTable)
      .where(and(eq(tasksTable.userId, DEFAULT_USER_ID), sql`status != 'done'`))
      .orderBy(tasksTable.dueDate).limit(5);

    const expensesByCategory = await db.select({
      categoryName: sql<string>`COALESCE(c.name, 'ללא קטגוריה')`,
      categoryColor: sql<string>`COALESCE(c.color, '#94a3b8')`,
      total: sql<string>`COALESCE(SUM(e.amount), 0)`,
    }).from(sql`expenses e`).leftJoin(sql`categories c ON e.category_id = c.id`)
      .where(sql`e.user_id = ${DEFAULT_USER_ID} AND e.budget_year_id = ${byid} AND e.date >= ${startOfMonth} AND e.date <= ${endOfMonth}`)
      .groupBy(sql`c.name, c.color`);

    const totalIncome = parseFloat(incomeSum.total);
    const totalExpenses = parseFloat(expenseSum.total);
    const totalCharity = parseFloat(charitySum.total);
    const totalDebts = parseFloat(debtSum.total);
    const totalAssets = parseFloat(assetsSum.total);
    const balance = totalIncome - totalExpenses - totalCharity;

    res.json({
      totalIncome, totalExpenses, totalCharity, totalDebts, totalAssets, balance, monthlyBudget,
      recentExpenses: recentExpenses.map(e => ({ ...e, amount: parseFloat(e.amount) })),
      upcomingTasks,
      expensesByCategory: expensesByCategory.map(e => ({ ...e, total: parseFloat(e.total) })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

/* ─── Annual dashboard ──────────────────────────────────────────── */
router.get("/annual", async (req, res) => {
  try {
    const byid = getBYID(req);
    const now = new Date();
    const year = parseInt((req.query.year as string) || String(now.getFullYear()));
    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;

    /* ── Totals ── */
    const [expTotal] = await db.select({ total: sql<string>`COALESCE(SUM(amount),0)` })
      .from(expensesTable)
      .where(and(eq(expensesTable.userId, DEFAULT_USER_ID), eq(expensesTable.budgetYearId, byid), gte(expensesTable.date, startOfYear), lte(expensesTable.date, endOfYear)));

    const [incTotal] = await db.select({ total: sql<string>`COALESCE(SUM(amount),0)` })
      .from(incomesTable)
      .where(and(eq(incomesTable.userId, DEFAULT_USER_ID), eq(incomesTable.budgetYearId, byid), gte(incomesTable.date, startOfYear), lte(incomesTable.date, endOfYear)));

    const [charTotal] = await db.select({ total: sql<string>`COALESCE(SUM(amount),0)` })
      .from(titheGivenTable)
      .where(and(eq(titheGivenTable.userId, DEFAULT_USER_ID), eq(titheGivenTable.budgetYearId, byid), gte(titheGivenTable.date, startOfYear), lte(titheGivenTable.date, endOfYear)));

    /* ── Settings (annual budget = monthlyBudget * 12) ── */
    const settingsRows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.userId, DEFAULT_USER_ID));
    const settings = settingsRows[0];
    const monthlyBudget = settings ? parseFloat(settings.monthlyBudget) : 0;
    const annualBudget = monthlyBudget * 12;

    /* ── Monthly breakdown ── */
    const monthlyExpenses = await db.select({
      month: sql<number>`EXTRACT(MONTH FROM date)::int`,
      total: sql<string>`COALESCE(SUM(amount),0)`,
    }).from(expensesTable)
      .where(and(eq(expensesTable.userId, DEFAULT_USER_ID), eq(expensesTable.budgetYearId, byid), gte(expensesTable.date, startOfYear), lte(expensesTable.date, endOfYear)))
      .groupBy(sql`EXTRACT(MONTH FROM date)`);

    const monthlyIncomes = await db.select({
      month: sql<number>`EXTRACT(MONTH FROM date)::int`,
      total: sql<string>`COALESCE(SUM(amount),0)`,
    }).from(incomesTable)
      .where(and(eq(incomesTable.userId, DEFAULT_USER_ID), eq(incomesTable.budgetYearId, byid), gte(incomesTable.date, startOfYear), lte(incomesTable.date, endOfYear)))
      .groupBy(sql`EXTRACT(MONTH FROM date)`);

    const HEB_MONTHS = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
    const expMap = Object.fromEntries(monthlyExpenses.map(r => [r.month, parseFloat(r.total)]));
    const incMap = Object.fromEntries(monthlyIncomes.map(r => [r.month, parseFloat(r.total)]));

    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: HEB_MONTHS[i],
      monthNum: i + 1,
      income: incMap[i + 1] || 0,
      expenses: expMap[i + 1] || 0,
      budget: monthlyBudget,
    }));

    /* ── Category breakdown (annual) ── */
    const categoryBreakdown = await db.select({
      categoryId: sql<number | null>`c.id`,
      categoryName: sql<string>`COALESCE(c.name, 'ללא קטגוריה')`,
      categoryColor: sql<string>`COALESCE(c.color, '#94a3b8')`,
      total: sql<string>`COALESCE(SUM(e.amount), 0)`,
    }).from(sql`expenses e`)
      .leftJoin(sql`categories c ON e.category_id = c.id`)
      .where(sql`e.user_id = ${DEFAULT_USER_ID} AND e.budget_year_id = ${byid} AND e.date >= ${startOfYear} AND e.date <= ${endOfYear}`)
      .groupBy(sql`c.id, c.name, c.color`)
      .orderBy(sql`SUM(e.amount) DESC`);

    /* ── Fund status ── */
    const funds = await db.select().from(fundsTable)
      .where(and(eq(fundsTable.userId, DEFAULT_USER_ID), eq(fundsTable.budgetYearId, byid), eq(fundsTable.isActive, true)))
      .orderBy(fundsTable.sortOrder);

    const fundExpenses = await db.select({
      fundId: expensesTable.fundId,
      total: sql<string>`COALESCE(SUM(amount), 0)`,
    }).from(expensesTable)
      .where(and(eq(expensesTable.userId, DEFAULT_USER_ID), eq(expensesTable.budgetYearId, byid), gte(expensesTable.date, startOfYear), lte(expensesTable.date, endOfYear)))
      .groupBy(expensesTable.fundId);

    const fundBudgetRows = await db.select().from(fundBudgetsTable)
      .where(and(eq(fundBudgetsTable.userId, DEFAULT_USER_ID), eq(fundBudgetsTable.periodYear, year)));

    const fundExpMap: Record<number, number> = {};
    for (const fe of fundExpenses) {
      if (fe.fundId) fundExpMap[fe.fundId] = parseFloat(fe.total);
    }
    const fundBudgetMap: Record<number, number> = {};
    for (const fb of fundBudgetRows) {
      fundBudgetMap[fb.fundId] = (fundBudgetMap[fb.fundId] || 0) + parseFloat(fb.allocatedAmount);
    }

    const fundStatus = funds.map(fund => {
      const budgetAmount = fundBudgetMap[fund.id] || 0;
      const actualAmount = fundExpMap[fund.id] || 0;
      const remaining = budgetAmount - actualAmount;
      const usagePercent = budgetAmount > 0 ? Math.min(100, (actualAmount / budgetAmount) * 100) : 0;
      const status: "ok" | "warning" | "over" =
        usagePercent >= 100 ? "over" : usagePercent >= 80 ? "warning" : "ok";
      return { ...fund, budgetAmount, actualAmount, remaining, usagePercent: Math.round(usagePercent), status };
    });

    /* ── Anomalies ── */
    const catTotals = categoryBreakdown.map(c => parseFloat(c.total));
    const avgSpend = catTotals.length ? catTotals.reduce((a, b) => a + b, 0) / catTotals.length : 0;
    const anomalies = categoryBreakdown
      .filter(c => parseFloat(c.total) > avgSpend * 1.5 && parseFloat(c.total) > 500)
      .map(c => ({ ...c, total: parseFloat(c.total) }));

    const totalIncome = parseFloat(incTotal.total);
    const totalExpenses = parseFloat(expTotal.total);
    const totalCharity = parseFloat(charTotal.total);
    const annualBalance = totalIncome - totalExpenses - totalCharity;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    res.json({
      year, annualBudget, totalIncome, totalExpenses, totalCharity, annualBalance,
      savingsRate: Math.round(savingsRate * 10) / 10,
      monthlyData,
      categoryBreakdown: categoryBreakdown.map(c => ({ ...c, total: parseFloat(c.total) })),
      fundStatus,
      anomalies,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get annual dashboard");
    res.status(500).json({ error: "Failed to get annual dashboard" });
  }
});

export default router;
