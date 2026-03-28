import { pgTable, serial, integer, text, numeric, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const budgetYearsTable = pgTable("budget_years", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  notes: text("notes").notNull().default(""),
  totalBudget: numeric("total_budget", { precision: 12, scale: 2 }).notNull().default("0"),
  tithePercentage: numeric("tithe_percentage", { precision: 5, scale: 2 }).notNull().default("10"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const numField = z.union([z.string(), z.number()]).transform(v => String(v));

export const insertBudgetYearSchema = createInsertSchema(budgetYearsTable, {
  totalBudget: numField.optional(),
  tithePercentage: numField.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertBudgetYear = z.infer<typeof insertBudgetYearSchema>;
export type BudgetYear = typeof budgetYearsTable.$inferSelect;
