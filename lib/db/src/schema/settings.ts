import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  currency: text("currency").notNull().default("ILS"),
  monthlyBudget: numeric("monthly_budget", { precision: 12, scale: 2 }).notNull().default("0"),
  incomeForTithe: numeric("income_for_tithe", { precision: 12, scale: 2 }).notNull().default("0"),
  tithePercentage: numeric("tithe_percentage", { precision: 5, scale: 2 }).notNull().default("10"),
  userName: text("user_name").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
