import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export type NwItem = { name: string; amount: number };
export type NwItems = { debts: NwItem[]; savings: NwItem[] };

export const netWorthRecordsTable = pgTable("net_worth_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  recordedAt: text("recorded_at").notNull(),
  items: jsonb("items").notNull().default({ debts: [], savings: [] }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNetWorthRecordSchema = createInsertSchema(netWorthRecordsTable, {
  items: z.object({
    debts: z.array(z.object({ name: z.string(), amount: z.number() })),
    savings: z.array(z.object({ name: z.string(), amount: z.number() })),
  }),
}).omit({ id: true, createdAt: true });

export type InsertNetWorthRecord = z.infer<typeof insertNetWorthRecordSchema>;
export type NetWorthRecord = typeof netWorthRecordsTable.$inferSelect;
