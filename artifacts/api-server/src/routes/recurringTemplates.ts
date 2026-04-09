import { Router } from "express";
import { db, recurringTemplatesTable, incomesTable, titheGivenTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;
function getBYID(req: any): number { const b = parseInt(String(req.query.bid)); return isNaN(b) ? DEFAULT_BUDGET_YEAR_ID : b; }
function parseNum(v: string | null | undefined) { return v ? parseFloat(v) : 0; }

// GET /recurring-templates?type=income|tithe
router.get("/", async (req, res) => {
  try {
    const { type } = req.query;
    const conditions: any[] = [
      eq(recurringTemplatesTable.userId, DEFAULT_USER_ID),
      eq(recurringTemplatesTable.isActive, true),
    ];
    if (type === "income" || type === "tithe") {
      conditions.push(eq(recurringTemplatesTable.type, String(type)));
    }
    const rows = await db
      .select()
      .from(recurringTemplatesTable)
      .where(and(...conditions))
      .orderBy(asc(recurringTemplatesTable.displayOrder), asc(recurringTemplatesTable.createdAt));
    res.json(rows.map(r => ({ ...r, amount: parseNum(r.amount) })));
  } catch (err) {
    req.log.error({ err }, "Failed to get recurring templates");
    res.status(500).json({ error: "Failed to get recurring templates" });
  }
});

// POST /recurring-templates
router.post("/", async (req, res) => {
  try {
    const { type, name, amount, entryType, notes, displayOrder } = req.body;
    if (!type || (type !== "income" && type !== "tithe")) {
      res.status(400).json({ error: "type חייב להיות income או tithe" }); return;
    }
    if (!name?.trim()) { res.status(400).json({ error: "שם הוא שדה חובה" }); return; }
    if (!amount || isNaN(parseFloat(String(amount))) || parseFloat(String(amount)) <= 0) {
      res.status(400).json({ error: "יש להזין סכום חיובי" }); return;
    }
    const [item] = await db.insert(recurringTemplatesTable).values({
      userId: DEFAULT_USER_ID,
      type,
      name: name.trim(),
      amount: String(parseFloat(String(amount))),
      entryType: type === "income" ? (entryType || "income") : "income",
      notes: notes?.trim() || "",
      displayOrder: displayOrder ?? 0,
    }).returning();
    res.status(201).json({ ...item, amount: parseNum(item.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to create recurring template");
    res.status(500).json({ error: "Failed to create recurring template" });
  }
});

// PUT /recurring-templates/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, amount, entryType, notes, displayOrder } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "שם הוא שדה חובה" }); return; }
    if (!amount || isNaN(parseFloat(String(amount))) || parseFloat(String(amount)) <= 0) {
      res.status(400).json({ error: "יש להזין סכום חיובי" }); return;
    }
    const [item] = await db
      .update(recurringTemplatesTable)
      .set({
        name: name.trim(),
        amount: String(parseFloat(String(amount))),
        entryType: entryType || "income",
        notes: notes?.trim() || "",
        displayOrder: displayOrder ?? 0,
        updatedAt: new Date(),
      })
      .where(and(eq(recurringTemplatesTable.id, id), eq(recurringTemplatesTable.userId, DEFAULT_USER_ID)))
      .returning();
    if (!item) { res.status(404).json({ error: "לא נמצא" }); return; }
    res.json({ ...item, amount: parseNum(item.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to update recurring template");
    res.status(500).json({ error: "Failed to update recurring template" });
  }
});

// DELETE /recurring-templates/:id  (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db
      .update(recurringTemplatesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(recurringTemplatesTable.id, id), eq(recurringTemplatesTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete recurring template");
    res.status(500).json({ error: "Failed to delete recurring template" });
  }
});

// POST /recurring-templates/apply — apply selected templates to actual income/tithe entries
// Body: { bid, items: [{ templateId, amount, date }], type: 'income' | 'tithe' }
router.post("/apply", async (req, res) => {
  try {
    const byid = getBYID(req);
    const { items, type } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items חייב להיות מערך לא ריק" }); return;
    }
    if (type !== "income" && type !== "tithe") {
      res.status(400).json({ error: "type חייב להיות income או tithe" }); return;
    }

    const created: any[] = [];

    for (const item of items) {
      const { templateId, amount, date, entryType, name, notes } = item;
      if (!amount || isNaN(parseFloat(String(amount))) || parseFloat(String(amount)) <= 0) continue;
      if (!date) continue;

      if (type === "income") {
        const description = name?.trim() + (notes?.trim() ? "\n\n" + notes.trim() : "");
        const [row] = await db.insert(incomesTable).values({
          userId: DEFAULT_USER_ID,
          budgetYearId: byid,
          amount: String(parseFloat(String(amount))),
          description,
          date,
          entryType: entryType || "income",
        }).returning();
        created.push({ ...row, amount: parseNum(row.amount) });
      } else {
        const [row] = await db.insert(titheGivenTable).values({
          userId: DEFAULT_USER_ID,
          budgetYearId: byid,
          amount: String(parseFloat(String(amount))),
          recipient: name?.trim() || "",
          description: notes?.trim() || "",
          date,
        }).returning();
        created.push({ ...row, amount: parseNum(row.amount) });
      }
    }

    res.status(201).json({ created, count: created.length });
  } catch (err) {
    req.log.error({ err }, "Failed to apply recurring templates");
    res.status(500).json({ error: "Failed to apply recurring templates" });
  }
});

export default router;
