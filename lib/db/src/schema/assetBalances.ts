import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { assetsTable } from "./assets";

export const assetBalancesTable = pgTable("asset_balances", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assetsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
  recordedAt: date("recorded_at").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAssetBalanceSchema = createInsertSchema(assetBalancesTable).omit({ id: true, createdAt: true });
export type InsertAssetBalance = z.infer<typeof insertAssetBalanceSchema>;
export type AssetBalance = typeof assetBalancesTable.$inferSelect;
