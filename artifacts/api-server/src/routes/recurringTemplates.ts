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

const MONTHS_HE = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];
function hebrewMonthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTHS_HE[d.getMonth()]}`;
}

// POST /recurring-templates/apply
// Combines all selected items into a single transaction per entryType group (income) or one for tithe.
// Body: { items: [{ templateId, amount, date, entryType, name, notes }], type: 'income' | 'tithe' }
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

    // Filter valid items only
    const valid = items.filter(
      (i: any) => i.amount && !isNaN(parseFloat(String(i.amount))) && parseFloat(String(i.amount)) > 0 && i.date
    );
    if (valid.length === 0) {
      res.status(400).json({ error: "לא נמצאו פריטים תקינים" }); return;
    }

    const date = valid[0].date;
    const monthLabel = hebrewMonthLabel(date);
    const created: any[] = [];

    if (type === "income") {
      // Group by entryType — create one transaction per group
      const groups: Record<string, typeof valid> = {};
      for (const item of valid) {
        const et = item.entryType || "income";
        if (!groups[et]) groups[et] = [];
        groups[et].push(item);
      }

      for (const [entryType, groupItems] of Object.entries(groups)) {
        const totalAmount = groupItems.reduce((s: number, i: any) => s + parseFloat(String(i.amount)), 0);
        const entryLabel = entryType === "work_deduction" ? "ניכויים" : "הכנסות";
        const transactionName = `קבועות ${entryLabel} - ${monthLabel}`;
        const noteLines = groupItems.map(
          (i: any) => `• ${i.name}${i.notes ? ` (${i.notes})` : ""}: ₪${parseFloat(String(i.amount)).toLocaleString("he-IL")}`
        );
        const description = transactionName + "\n\n" + noteLines.join("\n");

        const [row] = await db.insert(incomesTable).values({
          userId: DEFAULT_USER_ID,
          budgetYearId: byid,
          amount: String(totalAmount),
          description,
          date,
          entryType,
        }).returning();
        created.push({ ...row, amount: parseNum(row.amount) });
      }
    } else {
      // Tithe — one combined transaction
      const totalAmount = valid.reduce((s: number, i: any) => s + parseFloat(String(i.amount)), 0);
      const recipient = `קבועות - ${monthLabel}`;
      const noteLines = valid.map(
        (i: any) => `• ${i.name}${i.notes ? ` (${i.notes})` : ""}: ₪${parseFloat(String(i.amount)).toLocaleString("he-IL")}`
      );
      const description = noteLines.join("\n");

      const [row] = await db.insert(titheGivenTable).values({
        userId: DEFAULT_USER_ID,
        budgetYearId: byid,
        amount: String(totalAmount),
        recipient,
        description,
        date,
      }).returning();
      created.push({ ...row, amount: parseNum(row.amount) });
    }

    res.status(201).json({ created, count: created.length });
  } catch (err) {
    req.log.error({ err }, "Failed to apply recurring templates");
    res.status(500).json({ error: "Failed to apply recurring templates" });
  }
});

export default router;
