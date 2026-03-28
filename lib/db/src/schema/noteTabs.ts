import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const noteTabsTable = pgTable("note_tabs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#fbbf24"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNoteTabSchema = createInsertSchema(noteTabsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNoteTab = z.infer<typeof insertNoteTabSchema>;
export type NoteTab = typeof noteTabsTable.$inferSelect;
