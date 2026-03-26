import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savingsTable = pgTable("savings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull().default("savings"),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSavingSchema = createInsertSchema(savingsTable).omit({ id: true, createdAt: true });
export type InsertSaving = z.infer<typeof insertSavingSchema>;
export type Saving = typeof savingsTable.$inferSelect;
