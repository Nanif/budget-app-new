import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { fundsTable } from "./funds";

export const fundBudgetsTable = pgTable("fund_budgets", {
  id: serial("id").primaryKey(),
  fundId: integer("fund_id").notNull().references(() => fundsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  periodMonth: integer("period_month").notNull(),
  periodYear: integer("period_year").notNull(),
  allocatedAmount: numeric("allocated_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFundBudgetSchema = createInsertSchema(fundBudgetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFundBudget = z.infer<typeof insertFundBudgetSchema>;
export type FundBudget = typeof fundBudgetsTable.$inferSelect;
