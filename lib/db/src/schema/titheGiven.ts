import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { budgetYearsTable } from "./budgetYears";

export const titheGivenTable = pgTable("tithe_given", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  budgetYearId: integer("budget_year_id").notNull().references(() => budgetYearsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  recipient: text("recipient").notNull(),
  description: text("description").notNull().default(""),
  date: date("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const numericField = z.union([z.string(), z.number()]).transform(v => String(v));

export const insertTitheGivenSchema = createInsertSchema(titheGivenTable, {
  amount: numericField,
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTitheGiven = z.infer<typeof insertTitheGivenSchema>;
export type TitheGiven = typeof titheGivenTable.$inferSelect;
