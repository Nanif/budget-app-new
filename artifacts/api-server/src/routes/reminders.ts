import { Router } from "express";
import { db, remindersTable, insertReminderSchema } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function formatReminder(e: typeof remindersTable.$inferSelect) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    dueDate: e.dueDate ?? null,
    isCompleted: e.isCompleted,
    priority: e.priority,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(remindersTable).orderBy(desc(remindersTable.createdAt));
    res.json(rows.map(formatReminder));
  } catch (err) {
    req.log.error({ err }, "Failed to get reminders");
    res.status(500).json({ error: "Failed to get reminders" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertReminderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db.insert(remindersTable).values(parsed.data).returning();
    res.status(201).json(formatReminder(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create reminder");
    res.status(500).json({ error: "Failed to create reminder" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = insertReminderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [updated] = await db.update(remindersTable).set(parsed.data).where(eq(remindersTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(formatReminder(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update reminder");
    res.status(500).json({ error: "Failed to update reminder" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(remindersTable).where(eq(remindersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete reminder");
    res.status(500).json({ error: "Failed to delete reminder" });
  }
});

router.patch("/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(remindersTable).where(eq(remindersTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [updated] = await db
      .update(remindersTable)
      .set({ isCompleted: !existing.isCompleted })
      .where(eq(remindersTable.id, id))
      .returning();
    res.json(formatReminder(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to toggle reminder");
    res.status(500).json({ error: "Failed to toggle reminder" });
  }
});

export default router;
