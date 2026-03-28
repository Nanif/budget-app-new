import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { budgetYearsTable } from "./budgetYears";
import { fundsTable } from "./funds";

export const fixedItemsTable = pgTable("fixed_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  budgetYearId: integer("budget_year_id").notNull().references(() => budgetYearsTable.id, { onDelete: "cascade" }),
  fundId: integer("fund_id").notNull().references(() => fundsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes").notNull().default(""),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const numField = z.union([z.string(), z.number()]).transform(v => String(v));

export const insertFixedItemSchema = createInsertSchema(fixedItemsTable, {
  monthlyAmount: numField.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertFixedItem = z.infer<typeof insertFixedItemSchema>;
export type FixedItem = typeof fixedItemsTable.$inferSelect;
