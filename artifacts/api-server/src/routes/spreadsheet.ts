import { Router } from "express";
import { db, notesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const SPREADSHEET_TITLE = "__SPREADSHEET_DATA__";

router.get("/", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.userId, DEFAULT_USER_ID), eq(notesTable.title, SPREADSHEET_TITLE)));

    if (!row) { res.json({ data: null }); return; }
    res.json({ data: JSON.parse(row.content) });
  } catch (err) {
    req.log.error({ err }, "Failed to get spreadsheet");
    res.status(500).json({ error: "Failed to get spreadsheet" });
  }
});

// POST is used by navigator.sendBeacon (beforeunload saves)
router.post("/", async (req, res) => {
  return handleSave(req, res);
});

router.put("/", async (req, res) => {
  return handleSave(req, res);
});

async function handleSave(req: any, res: any) {
  try {
    const { data } = req.body;
    const content = JSON.stringify(data);

    const [existing] = await db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.userId, DEFAULT_USER_ID), eq(notesTable.title, SPREADSHEET_TITLE)));

    if (existing) {
      await db.update(notesTable)
        .set({ content, updatedAt: new Date() })
        .where(eq(notesTable.id, existing.id));
    } else {
      await db.insert(notesTable).values({
        userId: DEFAULT_USER_ID,
        title: SPREADSHEET_TITLE,
        content,
        color: "#ffffff",
      });
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save spreadsheet");
    res.status(500).json({ error: "Failed to save spreadsheet" });
  }
});

export default router;
