import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { budgetYearsTable } from "./budgetYears";
import { fundsTable } from "./funds";

export const cashEnvelopeTransactionsTable = pgTable("cash_envelope_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  budgetYearId: integer("budget_year_id").notNull().references(() => budgetYearsTable.id, { onDelete: "cascade" }),
  fundId: integer("fund_id").references(() => fundsTable.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull().default(""),
  date: date("date").notNull(),
  activeMonth: text("active_month"),
  relatedExpenseId: integer("related_expense_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCashEnvelopeTransactionSchema = createInsertSchema(cashEnvelopeTransactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCashEnvelopeTransaction = z.infer<typeof insertCashEnvelopeTransactionSchema>;
export type CashEnvelopeTransaction = typeof cashEnvelopeTransactionsTable.$inferSelect;
