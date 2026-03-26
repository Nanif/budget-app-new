import { Router } from "express";
import { db, notesTable, insertNoteSchema } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function formatNote(e: typeof notesTable.$inferSelect) {
  return {
    id: e.id,
    title: e.title,
    content: e.content,
    color: e.color,
    isPinned: e.isPinned,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(notesTable).orderBy(desc(notesTable.isPinned), desc(notesTable.updatedAt));
    res.json(rows.map(formatNote));
  } catch (err) {
    req.log.error({ err }, "Failed to get notes");
    res.status(500).json({ error: "Failed to get notes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db.insert(notesTable).values(parsed.data).returning();
    res.status(201).json(formatNote(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create note");
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = insertNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [updated] = await db
      .update(notesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(notesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(formatNote(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update note");
    res.status(500).json({ error: "Failed to update note" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(notesTable).where(eq(notesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete note");
    res.status(500).json({ error: "Failed to delete note" });
  }
});

export default router;
