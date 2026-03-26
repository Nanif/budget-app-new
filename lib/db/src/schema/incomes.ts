import { pgTable, serial, text, numeric, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const incomesTable = pgTable("incomes", {
  id: serial("id").primaryKey(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  source: text("source").notNull(),
  description: text("description").notNull(),
  date: date("date").notNull(),
  isRecurring: boolean("is_recurring").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIncomeSchema = createInsertSchema(incomesTable).omit({ id: true, createdAt: true });
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type Income = typeof incomesTable.$inferSelect;
