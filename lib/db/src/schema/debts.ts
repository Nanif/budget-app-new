import { pgTable, serial, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const debtsTable = pgTable("debts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  remainingAmount: numeric("remaining_amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default("active"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDebtSchema = createInsertSchema(debtsTable).omit({ id: true, createdAt: true });
export type InsertDebt = z.infer<typeof insertDebtSchema>;
export type Debt = typeof debtsTable.$inferSelect;
