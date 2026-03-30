import { Router } from "express";
import { db, fundsTable, insertFundSchema, expensesTable, cashEnvelopeTransactionsTable } from "@workspace/db";
import { eq, and, asc, sql, isNull, or, inArray } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;
function getBYID(req: any): number { const b = parseInt(String(req.query.bid)); return isNaN(b) ? DEFAULT_BUDGET_YEAR_ID : b; }

const MONTHLY_BEHAVIORS  = new Set(["fixed_monthly", "expense_monthly", "cash_monthly"]);
const NON_BUDGET_BEHAVIORS = new Set(["non_budget", "fixed_non_budget", "expense_non_budget"]);

/* ── GET summary (per-fund stats) ─────────────────────────────── */
router.get("/summary", async (req, res) => {
  try {
    const byid = getBYID(req);
    const funds = await db.select().from(fundsTable)
      .where(and(
        eq(fundsTable.userId, DEFAULT_USER_ID),
        or(eq(fundsTable.budgetYearId, byid), isNull(fundsTable.budgetYearId)),
        eq(fundsTable.isActive, true)
      ))
      .orderBy(asc(fundsTable.displayOrder));

    /* IDs of global (cross-year) funds — no budget year */
    const globalIds = funds.filter(f => f.budgetYearId === null).map(f => f.id);

    const [spentYear, cetYear, spentGlobal, cetGlobal] = await Promise.all([
      /* year-scoped expenses */
      db.select({
        fundId: expensesTable.fundId,
        total: sql<string>`COALESCE(SUM(amount), 0)`,
        cnt:   sql<string>`COUNT(*)`,
      }).from(expensesTable)
        .where(and(eq(expensesTable.userId, DEFAULT_USER_ID), eq(expensesTable.budgetYearId, byid)))
        .groupBy(expensesTable.fundId),

      /* year-scoped CET */
      db.select({
        fundId: cashEnvelopeTransactionsTable.fundId,
        cnt:    sql<string>`COUNT(*)`,
      }).from(cashEnvelopeTransactionsTable)
        .where(and(eq(cashEnvelopeTransactionsTable.userId, DEFAULT_USER_ID), eq(cashEnvelopeTransactionsTable.budgetYearId, byid)))
        .groupBy(cashEnvelopeTransactionsTable.fundId),

      /* global fund expenses — ALL years combined */
      globalIds.length > 0
        ? db.select({
            fundId: expensesTable.fundId,
            total: sql<string>`COALESCE(SUM(amount), 0)`,
            cnt:   sql<string>`COUNT(*)`,
          }).from(expensesTable)
            .where(and(eq(expensesTable.userId, DEFAULT_USER_ID), inArray(expensesTable.fundId, globalIds)))
            .groupBy(expensesTable.fundId)
        : Promise.resolve([]),

      /* global fund CET — ALL years combined */
      globalIds.length > 0
        ? db.select({
            fundId: cashEnvelopeTransactionsTable.fundId,
            cnt:    sql<string>`COUNT(*)`,
          }).from(cashEnvelopeTransactionsTable)
            .where(and(eq(cashEnvelopeTransactionsTable.userId, DEFAULT_USER_ID), inArray(cashEnvelopeTransactionsTable.fundId, globalIds)))
            .groupBy(cashEnvelopeTransactionsTable.fundId)
        : Promise.resolve([]),
    ]);

    const spentMap: Record<number, number> = {};
    const expCntMap: Record<number, number> = {};
    for (const r of [...spentYear, ...spentGlobal]) {
      if (r.fundId) { spentMap[r.fundId] = parseFloat(r.total); expCntMap[r.fundId] = parseInt(r.cnt); }
    }
    const cetCntMap: Record<number, number> = {};
    for (const r of [...cetYear, ...cetGlobal]) { if (r.fundId) cetCntMap[r.fundId] = parseInt(r.cnt); }

    const summary = funds.map(fund => {
      const monthly = parseFloat(fund.monthlyAllocation);
      const annual  = parseFloat(fund.annualAllocation);
      const initial = parseFloat(fund.initialBalance);
      let budgetAmount = 0;
      if      (MONTHLY_BEHAVIORS.has(fund.fundBehavior))    budgetAmount = monthly * 12;
      else if (NON_BUDGET_BEHAVIORS.has(fund.fundBehavior)) budgetAmount = initial;
      else                                                    budgetAmount = annual;

      const actualAmount = spentMap[fund.id] || 0;
      const remaining    = budgetAmount - actualAmount;
      const usagePercent = budgetAmount > 0 ? Math.min(100, (actualAmount / budgetAmount) * 100) : 0;
      const status: "ok" | "warning" | "over" =
        usagePercent >= 100 ? "over" : usagePercent >= 80 ? "warning" : "ok";
      const hasTxn = (expCntMap[fund.id] || 0) > 0 || (cetCntMap[fund.id] || 0) > 0;
      const isGlobal = fund.budgetYearId === null;

      return {
        id: fund.id, name: fund.name, colorClass: fund.colorClass,
        fundBehavior: fund.fundBehavior, description: fund.description,
        monthlyAllocation: monthly, annualAllocation: annual, initialBalance: initial,
        budgetAmount, actualAmount, remaining,
        usagePercent: Math.round(usagePercent), status, hasTxn, isGlobal,
      };
    });
    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Failed to get fund summary");
    res.status(500).json({ error: "Failed to get fund summary" });
  }
});

/* ── default funds seeded per budget year ────────────────────── */
const DEFAULT_YEAR_FUNDS = [
  { name: "קופת שוטף",          fundBehavior: "cash_monthly",       colorClass: "#f59e0b", monthlyAllocation: "0", annualAllocation: "0", initialBalance: "0", includeInBudget: true,  displayOrder: 0, isDefault: true },
  { name: "קופת קבועות",        fundBehavior: "fixed_monthly",      colorClass: "#3b82f6", monthlyAllocation: "0", annualAllocation: "0", initialBalance: "0", includeInBudget: true,  displayOrder: 1, isDefault: true },
  { name: "קופת משכנתא וחובות", fundBehavior: "fixed_monthly",      colorClass: "#8b5cf6", monthlyAllocation: "0", annualAllocation: "0", initialBalance: "0", includeInBudget: true,  displayOrder: 2, isDefault: true },
  { name: "קופת מעגל שנה",      fundBehavior: "annual_categorized", colorClass: "#10b981", monthlyAllocation: "0", annualAllocation: "0", initialBalance: "0", includeInBudget: true,  displayOrder: 3, isDefault: true },
];

/* ── global (cross-year) default funds — created once per user ── */
const DEFAULT_GLOBAL_FUNDS = [
  { name: "עודפים", fundBehavior: "expense_non_budget", colorClass: "#06b6d4", monthlyAllocation: "0", annualAllocation: "0", initialBalance: "0", includeInBudget: false, displayOrder: 99, isDefault: true },
];

async function seedDefaultFunds(byid: number) {
  await db.insert(fundsTable).values(
    DEFAULT_YEAR_FUNDS.map(f => ({ ...f, userId: DEFAULT_USER_ID, budgetYearId: byid, isActive: true, description: "" }))
  );
}

async function seedGlobalFunds() {
  const existing = await db.select({ name: fundsTable.name }).from(fundsTable)
    .where(and(eq(fundsTable.userId, DEFAULT_USER_ID), isNull(fundsTable.budgetYearId)));
  const existingNames = new Set(existing.map(r => r.name));
  const toInsert = DEFAULT_GLOBAL_FUNDS
    .filter(f => !existingNames.has(f.name))
    .map(f => ({ ...f, userId: DEFAULT_USER_ID, budgetYearId: null, isActive: true, description: "" }));
  if (toInsert.length > 0) await db.insert(fundsTable).values(toInsert);
}

/* ── GET all (active + inactive) ──────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const byid = getBYID(req);
    const includeInactive = req.query.all === "true";
    const activeClause = includeInactive ? [] : [eq(fundsTable.isActive, true)];

    /* Seed per-year funds if this year has none */
    const yearCount = await db.select({ n: sql<string>`COUNT(*)` }).from(fundsTable)
      .where(and(eq(fundsTable.userId, DEFAULT_USER_ID), eq(fundsTable.budgetYearId, byid)));
    if (parseInt(yearCount[0].n) === 0) await seedDefaultFunds(byid);

    /* Seed global funds once if they don't exist */
    await seedGlobalFunds();

    const rows = await db.select().from(fundsTable)
      .where(and(
        eq(fundsTable.userId, DEFAULT_USER_ID),
        or(eq(fundsTable.budgetYearId, byid), isNull(fundsTable.budgetYearId)),
        ...activeClause
      ))
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
    /* Non-budget funds are global (cross-year) — no budget year */
    const isNonBudget = NON_BUDGET_BEHAVIORS.has(req.body?.fundBehavior);
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: isNonBudget ? null : getBYID(req) };
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
    const [existing] = await db.select({ isDefault: fundsTable.isDefault, name: fundsTable.name, budgetYearId: fundsTable.budgetYearId })
      .from(fundsTable).where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID)));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    /* budgetYearId depends on the NEW behavior being saved */
    const newBehavior = req.body?.fundBehavior ?? "";
    const willBeNonBudget = NON_BUDGET_BEHAVIORS.has(newBehavior);
    const budgetYearId = willBeNonBudget ? null : (existing.budgetYearId ?? getBYID(req));
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId };
    if (existing.isDefault) { body.name = existing.name; }
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
    const byid = getBYID(req);
    const rows = await db.select().from(fundsTable)
      .where(and(eq(fundsTable.userId, DEFAULT_USER_ID), or(eq(fundsTable.budgetYearId, byid), isNull(fundsTable.budgetYearId))))
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
    const [fund] = await db.select({ isDefault: fundsTable.isDefault })
      .from(fundsTable).where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID)));
    if (fund?.isDefault) {
      res.status(403).json({ error: "לא ניתן למחוק קופה ברירת מחדל" });
      return;
    }
    await db.update(fundsTable).set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(fundsTable.id, id), eq(fundsTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete fund");
    res.status(500).json({ error: "Failed to delete fund" });
  }
});

export default router;
