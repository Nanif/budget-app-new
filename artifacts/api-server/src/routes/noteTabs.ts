import { Router } from "express";
import { db, noteTabsTable, insertNoteTabSchema } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(noteTabsTable)
      .where(eq(noteTabsTable.userId, DEFAULT_USER_ID))
      .orderBy(noteTabsTable.sortOrder);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get note tabs");
    res.status(500).json({ error: "Failed to get note tabs" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertNoteTabSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(noteTabsTable).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create note tab");
    res.status(500).json({ error: "Failed to create note tab" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertNoteTabSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(noteTabsTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(noteTabsTable.id, id), eq(noteTabsTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update note tab");
    res.status(500).json({ error: "Failed to update note tab" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(noteTabsTable).where(and(eq(noteTabsTable.id, id), eq(noteTabsTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete note tab");
    res.status(500).json({ error: "Failed to delete note tab" });
  }
});

export default router;
