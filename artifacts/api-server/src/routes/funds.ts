import { Router } from "express";
import { db, fundsTable, insertFundSchema, expensesTable } from "@workspace/db";
import { eq, and, asc, sql } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;
function getBYID(req: any): number { const b = parseInt(String(req.query.bid)); return isNaN(b) ? DEFAULT_BUDGET_YEAR_ID : b; }

/* ── GET summary (per-fund stats) ─────────────────────────────── */
router.get("/summary", async (req, res) => {
  try {
    const byid = getBYID(req);
    const funds = await db.select().from(fundsTable)
      .where(and(eq(fundsTable.userId, DEFAULT_USER_ID), eq(fundsTable.budgetYearId, byid), eq(fundsTable.isActive, true)))
      .orderBy(asc(fundsTable.displayOrder));

    const spentRows = await db.select({
      fundId: expensesTable.fundId,
      total: sql<string>`COALESCE(SUM(amount), 0)`,
    }).from(expensesTable)
      .where(and(eq(expensesTable.userId, DEFAULT_USER_ID), eq(expensesTable.budgetYearId, byid)))
      .groupBy(expensesTable.fundId);

    const spentMap: Record<number, number> = {};
    for (const r of spentRows) { if (r.fundId) spentMap[r.fundId] = parseFloat(r.total); }

    const summary = funds.map(fund => {
      const monthly = parseFloat(fund.monthlyAllocation);
      const annual  = parseFloat(fund.annualAllocation);
      const initial = parseFloat(fund.initialBalance);
      let budgetAmount = 0;
      if (fund.fundBehavior === "fixed_monthly" || fund.fundBehavior === "cash_monthly") {
        budgetAmount = monthly * 12;
      } else if (fund.fundBehavior === "annual_categorized" || fund.fundBehavior === "annual_large") {
        budgetAmount = annual;
      } else if (fund.fundBehavior === "non_budget") {
        budgetAmount = initial;
      }
      const actualAmount = spentMap[fund.id] || 0;
      const remaining    = budgetAmount - actualAmount;
      const usagePercent = budgetAmount > 0 ? Math.min(100, (actualAmount / budgetAmount) * 100) : 0;
      const status: "ok" | "warning" | "over" =
        usagePercent >= 100 ? "over" : usagePercent >= 80 ? "warning" : "ok";
      return {
        id: fund.id, name: fund.name, colorClass: fund.colorClass,
        fundBehavior: fund.fundBehavior, description: fund.description,
        monthlyAllocation: monthly, annualAllocation: annual, initialBalance: initial,
        budgetAmount, actualAmount, remaining,
        usagePercent: Math.round(usagePercent), status,
      };
    });
    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Failed to get fund summary");
    res.status(500).json({ error: "Failed to get fund summary" });
  }
});

/* ── GET all (active + inactive) ──────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const includeInactive = req.query.all === "true";
    const baseWhere = and(
      eq(fundsTable.userId, DEFAULT_USER_ID),
      eq(fundsTable.budgetYearId, getBYID(req)),
      ...(includeInactive ? [] : [eq(fundsTable.isActive, true)])
    );
    const rows = await db.select().from(fundsTable)
      .where(baseWhere)
      .orderBy(asc(fundsTable.displayOrder));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get funds");
    res.status(500).json({ error: "Failed to get funds" });
  }
});

/* ── POST ─────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: getBYID(req) };
    const parsed = insertFundSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(fundsTable).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create fund");
    res.status(500).json({ error: "Failed to create fund" });
  }
});

/* ── PUT ──────────────────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: getBYID(req) };
    const parsed = insertFundSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(fundsTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update fund");
    res.status(500).json({ error: "Failed to update fund" });
  }
});

/* ── PATCH toggle active ─────────────────────────────────────── */
router.patch("/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [cur] = await db.select({ isActive: fundsTable.isActive })
      .from(fundsTable).where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID)));
    if (!cur) { res.status(404).json({ error: "Not found" }); return; }
    const [updated] = await db.update(fundsTable).set({ isActive: !cur.isActive, updatedAt: new Date() })
      .where(eq(fundsTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to toggle fund");
    res.status(500).json({ error: "Failed to toggle fund" });
  }
});

/* ── PATCH reorder ────────────────────────────────────────────── */
router.patch("/reorder", async (req, res) => {
  try {
    const { orderedIds } = req.body as { orderedIds: number[] };
    if (!Array.isArray(orderedIds)) { res.status(400).json({ error: "orderedIds must be array" }); return; }
    await Promise.all(orderedIds.map((id, idx) =>
      db.update(fundsTable).set({ displayOrder: idx, updatedAt: new Date() })
        .where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID)))
    ));
    const rows = await db.select().from(fundsTable)
      .where(and(eq(fundsTable.userId, DEFAULT_USER_ID), eq(fundsTable.budgetYearId, getBYID(req))))
      .orderBy(asc(fundsTable.displayOrder));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to reorder funds");
    res.status(500).json({ error: "Failed to reorder funds" });
  }
});

/* ── DELETE ───────────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(fundsTable).set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete fund");
    res.status(500).json({ error: "Failed to delete fund" });
  }
});

export default router;
