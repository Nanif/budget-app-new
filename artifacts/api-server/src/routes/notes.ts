import { Router } from "express";
import { db, notesTable, noteTabsTable, insertNoteSchema } from "@workspace/db";
import { eq, desc, and, ne } from "drizzle-orm";

const SYSTEM_NOTE_TITLES = ["__SPREADSHEET_DATA__"];

const router = Router();
const DEFAULT_USER_ID = 1;

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: notesTable.id,
        userId: notesTable.userId,
        tabId: notesTable.tabId,
        title: notesTable.title,
        content: notesTable.content,
        color: notesTable.color,
        isPinned: notesTable.isPinned,
        sortOrder: notesTable.sortOrder,
        createdAt: notesTable.createdAt,
        updatedAt: notesTable.updatedAt,
        tabName: noteTabsTable.name,
        tabColor: noteTabsTable.color,
      })
      .from(notesTable)
      .leftJoin(noteTabsTable, eq(notesTable.tabId, noteTabsTable.id))
      .where(and(
        eq(notesTable.userId, DEFAULT_USER_ID),
        ne(notesTable.title, SYSTEM_NOTE_TITLES[0]),
      ))
      .orderBy(desc(notesTable.isPinned), notesTable.sortOrder, desc(notesTable.updatedAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get notes");
    res.status(500).json({ error: "Failed to get notes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertNoteSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(notesTable).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create note");
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.patch("/reorder", async (req, res) => {
  try {
    const items: { id: number; sortOrder: number }[] = req.body;
    if (!Array.isArray(items)) { res.status(400).json({ error: "Expected array" }); return; }
    await Promise.all(
      items.map(({ id, sortOrder }) =>
        db.update(notesTable).set({ sortOrder })
          .where(and(eq(notesTable.id, id), eq(notesTable.userId, DEFAULT_USER_ID)))
      )
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reorder notes");
    res.status(500).json({ error: "Failed to reorder notes" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertNoteSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(notesTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update note");
    res.status(500).json({ error: "Failed to update note" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(notesTable).where(and(eq(notesTable.id, id), eq(notesTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete note");
    res.status(500).json({ error: "Failed to delete note" });
  }
});

export default router;
