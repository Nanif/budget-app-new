import { Router } from "express";
import { db, fixedItemsTable, fundsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;
function getBYID(req: any): number { const b = parseInt(String(req.query.bid)); return isNaN(b) ? DEFAULT_BUDGET_YEAR_ID : b; }
function parseNum(v: string | null | undefined) { return v ? parseFloat(v) : 0; }

// GET /fixed-items?bid=X&fundId=N  — list active items for a fund
// GET /fixed-items?bid=X           — list items for the first fixed_monthly fund in the year
router.get("/", async (req, res) => {
  try {
    const byid = getBYID(req);

    let fundId: number | null = req.query.fundId ? parseInt(String(req.query.fundId)) : null;

    if (!fundId) {
      const [fund] = await db
        .select({ id: fundsTable.id })
        .from(fundsTable)
        .where(and(
          eq(fundsTable.userId, DEFAULT_USER_ID),
          eq(fundsTable.budgetYearId, byid),
          eq(fundsTable.fundBehavior, "fixed_monthly"),
          eq(fundsTable.isActive, true),
        ))
        .limit(1);
      fundId = fund?.id ?? null;
    }

    if (!fundId) { res.json({ fund: null, items: [], totals: { monthly: 0, annual: 0 } }); return; }

    const [fund] = await db.select().from(fundsTable)
      .where(and(eq(fundsTable.id, fundId), eq(fundsTable.userId, DEFAULT_USER_ID)));

    const items = await db
      .select()
      .from(fixedItemsTable)
      .where(and(
        eq(fixedItemsTable.fundId, fundId),
        eq(fixedItemsTable.userId, DEFAULT_USER_ID),
        eq(fixedItemsTable.isActive, true),
      ))
      .orderBy(asc(fixedItemsTable.displayOrder), asc(fixedItemsTable.createdAt));

    const parsed = items.map(i => ({ ...i, monthlyAmount: parseNum(i.monthlyAmount) }));
    const monthly = parsed.reduce((s, i) => s + i.monthlyAmount, 0);

    res.json({
      fund: fund ? { ...fund, monthlyAllocation: parseNum(fund.monthlyAllocation), annualAllocation: parseNum(fund.annualAllocation) } : null,
      items: parsed,
      totals: { monthly, annual: monthly * 12 },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get fixed items");
    res.status(500).json({ error: "Failed to get fixed items" });
  }
});

// POST /fixed-items
router.post("/", async (req, res) => {
  try {
    const byid = getBYID(req);
    const { name, monthlyAmount, notes, fundId, displayOrder } = req.body;

    if (!name?.trim()) { res.status(400).json({ error: "שם הרכיב נדרש" }); return; }
    if (!fundId) { res.status(400).json({ error: "fundId נדרש" }); return; }

    const [item] = await db.insert(fixedItemsTable).values({
      userId: DEFAULT_USER_ID,
      budgetYearId: byid,
      fundId: parseInt(String(fundId)),
      name: name.trim(),
      monthlyAmount: String(monthlyAmount || "0"),
      notes: notes?.trim() || "",
      displayOrder: displayOrder ?? 0,
    }).returning();

    res.status(201).json({ ...item, monthlyAmount: parseNum(item.monthlyAmount) });
  } catch (err) {
    req.log.error({ err }, "Failed to create fixed item");
    res.status(500).json({ error: "Failed to create fixed item" });
  }
});

// PUT /fixed-items/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, monthlyAmount, notes, displayOrder } = req.body;

    if (!name?.trim()) { res.status(400).json({ error: "שם הרכיב נדרש" }); return; }

    const [item] = await db
      .update(fixedItemsTable)
      .set({
        name: name.trim(),
        monthlyAmount: String(monthlyAmount || "0"),
        notes: notes?.trim() || "",
        displayOrder: displayOrder ?? 0,
        updatedAt: new Date(),
      })
      .where(and(eq(fixedItemsTable.id, id), eq(fixedItemsTable.userId, DEFAULT_USER_ID)))
      .returning();

    if (!item) { res.status(404).json({ error: "לא נמצא" }); return; }
    res.json({ ...item, monthlyAmount: parseNum(item.monthlyAmount) });
  } catch (err) {
    req.log.error({ err }, "Failed to update fixed item");
    res.status(500).json({ error: "Failed to update fixed item" });
  }
});

// DELETE /fixed-items/:id  (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db
      .update(fixedItemsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(fixedItemsTable.id, id), eq(fixedItemsTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete fixed item");
    res.status(500).json({ error: "Failed to delete fixed item" });
  }
});

export default router;
