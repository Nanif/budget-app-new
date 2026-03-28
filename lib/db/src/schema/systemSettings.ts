import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const systemSettingsTable = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  currency: text("currency").notNull().default("ILS"),
  locale: text("locale").notNull().default("he-IL"),
  monthlyBudget: numeric("monthly_budget", { precision: 12, scale: 2 }).notNull().default("0"),
  tithePercentage: numeric("tithe_percentage", { precision: 5, scale: 2 }).notNull().default("10.00"),
  incomeBaseForTithe: numeric("income_base_for_tithe", { precision: 12, scale: 2 }).notNull().default("0"),
  activeBudgetYearId: integer("active_budget_year_id"),
  dateFormat: text("date_format").notNull().default("DD/MM/YYYY"),
  firstDayOfWeek: integer("first_day_of_week").notNull().default(0),
  showDecimal: boolean("show_decimal").notNull().default(true),
  darkMode: boolean("dark_mode").notNull().default(false),
  userName: text("user_name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const numericField = z.union([z.string(), z.number()]).transform(v => String(v));

export const insertSystemSettingsSchema = createInsertSchema(systemSettingsTable, {
  monthlyBudget: numericField.optional(),
  tithePercentage: numericField.optional(),
  incomeBaseForTithe: numericField.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type SystemSettings = typeof systemSettingsTable.$inferSelect;
