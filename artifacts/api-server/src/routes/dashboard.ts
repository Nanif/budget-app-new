import { Router } from "express";
import { db, expensesTable, incomesTable, charityTable, debtsTable, savingsTable, remindersTable, settingsTable } from "@workspace/db";
import { desc, gte, lte, and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const [expenseSum] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(expensesTable)
      .where(and(gte(expensesTable.date, startOfMonth), lte(expensesTable.date, endOfMonth)));

    const [incomeSum] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(incomesTable)
      .where(and(gte(incomesTable.date, startOfMonth), lte(incomesTable.date, endOfMonth)));

    const [charitySum] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(charityTable)
      .where(and(gte(charityTable.date, startOfMonth), lte(charityTable.date, endOfMonth)));

    const [debtSum] = await db
      .select({ total: sql<string>`COALESCE(SUM(remaining_amount), 0)` })
      .from(debtsTable)
      .where(eq(debtsTable.status, "active"));

    const [savingsSum] = await db
      .select({ total: sql<string>`COALESCE(SUM(current_amount), 0)` })
      .from(savingsTable);

    const settingsRows = await db.select().from(settingsTable);
    const settings = settingsRows[0];
    const monthlyBudget = settings ? parseFloat(settings.monthlyBudget) : 0;

    const recentExpenses = await db
      .select()
      .from(expensesTable)
      .orderBy(desc(expensesTable.date))
      .limit(5);

    const upcomingReminders = await db
      .select()
      .from(remindersTable)
      .where(eq(remindersTable.isCompleted, false))
      .orderBy(remindersTable.dueDate)
      .limit(5);

    const totalIncome = parseFloat(incomeSum.total);
    const totalExpenses = parseFloat(expenseSum.total);
    const totalCharity = parseFloat(charitySum.total);
    const totalDebts = parseFloat(debtSum.total);
    const totalSavings = parseFloat(savingsSum.total);
    const balance = totalIncome - totalExpenses - totalCharity;

    res.json({
      totalIncome,
      totalExpenses,
      totalCharity,
      totalDebts,
      totalSavings,
      balance,
      monthlyBudget,
      recentExpenses: recentExpenses.map((e) => ({
        id: e.id,
        amount: parseFloat(e.amount),
        category: e.category,
        description: e.description,
        date: e.date,
        isRecurring: e.isRecurring,
        createdAt: e.createdAt.toISOString(),
      })),
      upcomingReminders: upcomingReminders.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        dueDate: r.dueDate ?? null,
        isCompleted: r.isCompleted,
        priority: r.priority,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

export default router;
