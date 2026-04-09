import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/* ─── Shared types ──────────────────────────── */
export type NwItem = { name: string; amount: number };
export type NwItems = { debts: NwItem[]; savings: NwItem[] };

/* ─── Enum ──────────────────────────────────── */
export const nwItemTypeEnum = pgEnum("nw_item_type", ["saving", "debt"]);

/* ─── net_worth_records ─────────────────────── */
export const netWorthRecordsTable = pgTable("net_worth_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  recordedAt: text("recorded_at").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── net_worth_items ───────────────────────── */
export const netWorthItemsTable = pgTable("net_worth_items", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id").notNull().references(() => netWorthRecordsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: nwItemTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default("0"),
});

/* ─── Zod schemas ───────────────────────────── */
export const insertNetWorthRecordSchema = createInsertSchema(netWorthRecordsTable)
  .omit({ id: true, createdAt: true });

export const insertNetWorthItemSchema = createInsertSchema(netWorthItemsTable).omit({ id: true });

export type InsertNetWorthRecord = z.infer<typeof insertNetWorthRecordSchema>;
export type NetWorthRecord = typeof netWorthRecordsTable.$inferSelect;
export type NetWorthItem = typeof netWorthItemsTable.$inferSelect;
