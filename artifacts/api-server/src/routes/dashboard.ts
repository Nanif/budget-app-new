import { Router } from "express";
import { db, expensesTable, incomesTable, titheGivenTable, debtsTable, assetsTable, tasksTable, systemSettingsTable, categoriesTable } from "@workspace/db";
import { desc, gte, lte, and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

router.get("/summary", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const userFilter = eq(expensesTable.userId, DEFAULT_USER_ID);
    const yearFilter = eq(expensesTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID);

    const [expenseSum] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(expensesTable)
      .where(and(userFilter, yearFilter, gte(expensesTable.date, startOfMonth), lte(expensesTable.date, endOfMonth)));

    const [incomeSum] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(incomesTable)
      .where(and(eq(incomesTable.userId, DEFAULT_USER_ID), eq(incomesTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID), gte(incomesTable.date, startOfMonth), lte(incomesTable.date, endOfMonth)));

    const [charitySum] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(titheGivenTable)
      .where(and(eq(titheGivenTable.userId, DEFAULT_USER_ID), eq(titheGivenTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID), gte(titheGivenTable.date, startOfMonth), lte(titheGivenTable.date, endOfMonth)));

    const [debtSum] = await db
      .select({ total: sql<string>`COALESCE(SUM(remaining_amount), 0)` })
      .from(debtsTable)
      .where(and(eq(debtsTable.userId, DEFAULT_USER_ID), eq(debtsTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID), eq(debtsTable.status, "active")));

    const [assetsSum] = await db
      .select({ total: sql<string>`COALESCE(SUM(current_amount), 0)` })
      .from(assetsTable)
      .where(and(eq(assetsTable.userId, DEFAULT_USER_ID), eq(assetsTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID)));

    const settingsRows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.userId, DEFAULT_USER_ID));
    const settings = settingsRows[0];
    const monthlyBudget = settings ? parseFloat(settings.monthlyBudget) : 0;

    const recentExpenses = await db
      .select({
        id: expensesTable.id,
        amount: expensesTable.amount,
        description: expensesTable.description,
        date: expensesTable.date,
        paymentMethod: expensesTable.paymentMethod,
        categoryName: categoriesTable.name,
        categoryColor: categoriesTable.color,
        categoryIcon: categoriesTable.icon,
      })
      .from(expensesTable)
      .leftJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
      .where(and(userFilter, yearFilter))
      .orderBy(desc(expensesTable.date))
      .limit(5);

    const upcomingTasks = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.userId, DEFAULT_USER_ID), sql`status != 'done'`))
      .orderBy(tasksTable.dueDate)
      .limit(5);

    const expensesByCategory = await db
      .select({
        categoryName: sql<string>`COALESCE(c.name, 'ללא קטגוריה')`,
        categoryColor: sql<string>`COALESCE(c.color, '#94a3b8')`,
        total: sql<string>`COALESCE(SUM(e.amount), 0)`,
      })
      .from(sql`expenses e`)
      .leftJoin(sql`categories c ON e.category_id = c.id`)
      .where(sql`e.user_id = ${DEFAULT_USER_ID} AND e.budget_year_id = ${DEFAULT_BUDGET_YEAR_ID} AND e.date >= ${startOfMonth} AND e.date <= ${endOfMonth}`)
      .groupBy(sql`c.name, c.color`);

    const totalIncome = parseFloat(incomeSum.total);
    const totalExpenses = parseFloat(expenseSum.total);
    const totalCharity = parseFloat(charitySum.total);
    const totalDebts = parseFloat(debtSum.total);
    const totalAssets = parseFloat(assetsSum.total);
    const balance = totalIncome - totalExpenses - totalCharity;

    res.json({
      totalIncome,
      totalExpenses,
      totalCharity,
      totalDebts,
      totalAssets,
      balance,
      monthlyBudget,
      recentExpenses: recentExpenses.map(e => ({ ...e, amount: parseFloat(e.amount) })),
      upcomingTasks,
      expensesByCategory: expensesByCategory.map(e => ({ ...e, total: parseFloat(e.total) })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

export default router;
