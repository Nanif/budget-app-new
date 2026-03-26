import { pgTable, serial, text, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  dueDate: date("due_date"),
  isCompleted: boolean("is_completed").notNull().default(false),
  priority: text("priority").notNull().default("medium"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReminderSchema = createInsertSchema(remindersTable).omit({ id: true, createdAt: true });
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof remindersTable.$inferSelect;
