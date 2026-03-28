import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { budgetYearsTable } from "./budgetYears";

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  budgetYearId: integer("budget_year_id").notNull().references(() => budgetYearsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("savings"),
  category: text("category").notNull().default(""),
  currency: text("currency").notNull().default("ILS"),
  targetAmount: numeric("target_amount", { precision: 14, scale: 2 }),
  currentAmount: numeric("current_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  institution: text("institution"),
  accountNumber: text("account_number"),
  notes: text("notes").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const numericField = z.union([z.string(), z.number()]).transform(v => String(v));

export const insertAssetSchema = createInsertSchema(assetsTable, {
  currentAmount: numericField.optional(),
  targetAmount: numericField.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;
