/**
 * /api/fund-budgets
 * Per-fund monthly budget overrides.
 *
 * A fund has a default annualAllocation / monthlyAllocation on the funds table.
 * fund_budgets rows let you override the allocation for a specific month.
 *
 * Routes:
 *   GET    /api/fund-budgets          list (filter by fundId, year, month)
 *   GET    /api/fund-budgets/:id      get one
 *   POST   /api/fund-budgets          create
 *   PUT    /api/fund-budgets/:id      full update
 *   DELETE /api/fund-budgets/:id      delete
 *
 * Request body (POST / PUT):
 *   fundId          : number   (required) — must belong to this user
 *   periodMonth     : number   1-12 (required)
 *   periodYear      : number   >= 2000 (required)
 *   allocatedAmount : number   >= 0 (required)
 *   notes           : string   (optional)
 *
 * Response: FundBudget { id, fundId, userId, periodMonth, periodYear,
 *                        allocatedAmount, notes, createdAt, updatedAt }
 *   allocatedAmount is returned as a JS number.
 *
 * Validation rules:
 *   - fundId must reference an existing fund owned by the user
 *   - periodMonth must be 1-12
 *   - allocatedAmount must be >= 0
 *
 * Error responses:
 *   400  Invalid input / Fund not found
 *   404  Fund budget not found
 *   500  Internal server error
 */
import { Router } from "express";
import {
  db,
  fundBudgetsTable,
  fundsTable,
  insertFundBudgetSchema,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  UID, getBYID, paramInt, queryInt,
  parseNum, validate, serverError, notFound,
} from "../lib/helpers";

const router = Router();

// ── GET /api/fund-budgets ──────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const fundId  = queryInt(req, "fundId");
    const year    = queryInt(req, "year");
    const month   = queryInt(req, "month");

    // Validate month range if provided
    if (month !== undefined && (month < 1 || month > 12)) {
      res.status(400).json({ error: "month must be 1-12" }); return;
    }

    const conditions: any[] = [eq(fundBudgetsTable.userId, UID)];
    if (fundId !== undefined) conditions.push(eq(fundBudgetsTable.fundId, fundId));
    if (year   !== undefined) conditions.push(eq(fundBudgetsTable.periodYear, year));
    if (month  !== undefined) conditions.push(eq(fundBudgetsTable.periodMonth, month));

    const rows = await db
      .select()
      .from(fundBudgetsTable)
      .where(and(...conditions));

    res.json(rows.map(r => ({ ...r, allocatedAmount: parseNum(r.allocatedAmount) })));
  } catch (err) {
    serverError(req, res, err, "Failed to list fund budgets");
  }
});

// ── GET /api/fund-budgets/:id ──────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = paramInt(req, "id");
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [row] = await db
      .select()
      .from(fundBudgetsTable)
      .where(and(eq(fundBudgetsTable.id, id), eq(fundBudgetsTable.userId, UID)));

    if (!row) { notFound(res); return; }
    res.json({ ...row, allocatedAmount: parseNum(row.allocatedAmount) });
  } catch (err) {
    serverError(req, res, err, "Failed to get fund budget");
  }
});

// ── POST /api/fund-budgets ─────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: UID };
    const data = validate(insertFundBudgetSchema, body, res);
    if (!data) return;

    // Verify fundId belongs to this user
    const [fund] = await db
      .select({ id: fundsTable.id })
      .from(fundsTable)
      .where(and(eq(fundsTable.id, data.fundId), eq(fundsTable.userId, UID)));
    if (!fund) { res.status(400).json({ error: "Fund not found" }); return; }

    const [created] = await db.insert(fundBudgetsTable).values(data).returning();
    res.status(201).json({ ...created, allocatedAmount: parseNum(created.allocatedAmount) });
  } catch (err) {
    serverError(req, res, err, "Failed to create fund budget");
  }
});

// ── PUT /api/fund-budgets/:id ──────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const id = paramInt(req, "id");
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = { ...req.body, userId: UID };
    const data = validate(insertFundBudgetSchema, body, res);
    if (!data) return;

    const [updated] = await db
      .update(fundBudgetsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(fundBudgetsTable.id, id), eq(fundBudgetsTable.userId, UID)))
      .returning();

    if (!updated) { notFound(res); return; }
    res.json({ ...updated, allocatedAmount: parseNum(updated.allocatedAmount) });
  } catch (err) {
    serverError(req, res, err, "Failed to update fund budget");
  }
});

// ── DELETE /api/fund-budgets/:id ───────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = paramInt(req, "id");
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    await db
      .delete(fundBudgetsTable)
      .where(and(eq(fundBudgetsTable.id, id), eq(fundBudgetsTable.userId, UID)));

    res.status(204).send();
  } catch (err) {
    serverError(req, res, err, "Failed to delete fund budget");
  }
});

export default router;
