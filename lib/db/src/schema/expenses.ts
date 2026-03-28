import { pgTable, serial, integer, text, numeric, date, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { budgetYearsTable } from "./budgetYears";
import { categoriesTable } from "./categories";
import { fundsTable } from "./funds";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  budgetYearId: integer("budget_year_id").notNull().references(() => budgetYearsTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  fundId: integer("fund_id").references(() => fundsTable.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull().default(""),
  date: date("date").notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringRule: jsonb("recurring_rule"),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const amountField = z.union([z.string(), z.number()]).transform(v => String(v));

export const insertExpenseSchema = createInsertSchema(expensesTable, {
  amount: amountField,
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
