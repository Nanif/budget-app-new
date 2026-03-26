import { pgTable, serial, text, numeric, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const charityTable = pgTable("charity", {
  id: serial("id").primaryKey(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  recipient: text("recipient").notNull(),
  description: text("description").notNull(),
  date: date("date").notNull(),
  isTithe: boolean("is_tithe").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCharitySchema = createInsertSchema(charityTable).omit({ id: true, createdAt: true });
export type InsertCharity = z.infer<typeof insertCharitySchema>;
export type CharityEntry = typeof charityTable.$inferSelect;
