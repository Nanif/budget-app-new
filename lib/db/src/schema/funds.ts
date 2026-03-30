import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { budgetYearsTable } from "./budgetYears";

/**
 * fund_behavior values:
 *   fixed_monthly     - קופת קבועות: no transactions, only budget definition
 *   cash_monthly      - קופת שוטף: cash wallet, track deposits/withdrawals
 *   annual_categorized - קופת מעגל השנה: track expenses with categories
 *   annual_large      - קופת הוצאות גדולות: track large expenses
 *   non_budget        - קופות מחוץ לתקציב (בונוס/עודפים): depleting balance
 */
export const fundsTable = pgTable("funds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  budgetYearId: integer("budget_year_id").notNull().references(() => budgetYearsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fundBehavior: text("fund_behavior").notNull().default("annual_large"),
  description: text("description").notNull().default(""),
  colorClass: text("color_class").notNull().default("#6366f1"),
  includeInBudget: boolean("include_in_budget").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  monthlyAllocation: numeric("monthly_allocation", { precision: 12, scale: 2 }).notNull().default("0"),
  annualAllocation: numeric("annual_allocation", { precision: 12, scale: 2 }).notNull().default("0"),
  initialBalance: numeric("initial_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const numField = z.union([z.string(), z.number()]).transform(v => String(v));

export const insertFundSchema = createInsertSchema(fundsTable, {
  monthlyAllocation: numField.optional(),
  annualAllocation: numField.optional(),
  initialBalance: numField.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertFund = z.infer<typeof insertFundSchema>;
export type Fund = typeof fundsTable.$inferSelect;
