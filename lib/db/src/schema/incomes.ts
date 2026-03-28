import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { budgetYearsTable } from "./budgetYears";

/**
 * entry_type: 'income' = regular income, 'work_deduction' = work expense that reduces net income
 */
export const incomesTable = pgTable("incomes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  budgetYearId: integer("budget_year_id").notNull().references(() => budgetYearsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  source: text("source").notNull(),
  description: text("description").notNull().default(""),
  date: date("date").notNull(),
  entryType: text("entry_type").notNull().default("income"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const amountField = z.union([z.string(), z.number()]).transform(v => String(v));

export const insertIncomeSchema = createInsertSchema(incomesTable, {
  amount: amountField,
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type Income = typeof incomesTable.$inferSelect;
