import { Router } from "express";
import { db, tasksTable, insertTaskSchema } from "@workspace/db";
import { eq, desc, and, ne } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(tasksTable)
      .where(eq(tasksTable.userId, DEFAULT_USER_ID))
      .orderBy(desc(tasksTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get tasks");
    res.status(500).json({ error: "Failed to get tasks" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertTaskSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(tasksTable).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create task");
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertTaskSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(tasksTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update task");
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete task");
    res.status(500).json({ error: "Failed to delete task" });
  }
});

router.patch("/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.userId, DEFAULT_USER_ID)));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const newStatus = existing.status === "done" ? "open" : "done";
    const [updated] = await db.update(tasksTable)
      .set({ status: newStatus, completedAt: newStatus === "done" ? new Date() : null, updatedAt: new Date() })
      .where(eq(tasksTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to toggle task");
    res.status(500).json({ error: "Failed to toggle task" });
  }
});

export default router;
