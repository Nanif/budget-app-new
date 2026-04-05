import { Router } from "express";
import { db, cashEnvelopeTransactionsTable, fundsTable } from "@workspace/db";
import { eq, and, desc, sum, sql } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;
function getBYID(req: any): number { const b = parseInt(String(req.query.bid)); return isNaN(b) ? DEFAULT_BUDGET_YEAR_ID : b; }

function parseNum(v: string | null) { return v ? parseFloat(v) : 0; }

// GET /api/wallet?month=YYYY-MM&fundId=N
router.get("/", async (req, res) => {
  try {
    const { month, fundId } = req.query;
    const conditions: any[] = [
      eq(cashEnvelopeTransactionsTable.userId, DEFAULT_USER_ID),
      eq(cashEnvelopeTransactionsTable.budgetYearId, getBYID(req)),
    ];
    if (fundId) conditions.push(eq(cashEnvelopeTransactionsTable.fundId, parseInt(String(fundId))));
    if (month) {
      conditions.push(eq(cashEnvelopeTransactionsTable.activeMonth, String(month)));
    }

    const rows = await db
      .select()
      .from(cashEnvelopeTransactionsTable)
      .where(and(...conditions))
      .orderBy(desc(cashEnvelopeTransactionsTable.date));

    const deposits    = rows.filter(r => r.type === "deposit").reduce((s, r) => s + parseNum(r.amount), 0);
    const withdrawals = rows.filter(r => r.type === "withdrawal").reduce((s, r) => s + parseNum(r.amount), 0);

    res.json({
      transactions: rows.map(r => ({ ...r, amount: parseNum(r.amount) })),
      totals: { deposits, withdrawals, net: deposits - withdrawals },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get wallet transactions");
    res.status(500).json({ error: "Failed to get wallet transactions" });
  }
});

// GET /api/wallet/summary?year=YYYY — monthly breakdown
router.get("/summary", async (req, res) => {
  try {
    const year = req.query.year ? String(req.query.year) : String(new Date().getFullYear());
    const rows = await db
      .select({
        month: cashEnvelopeTransactionsTable.activeMonth,
        type:  cashEnvelopeTransactionsTable.type,
        total: sum(cashEnvelopeTransactionsTable.amount),
      })
      .from(cashEnvelopeTransactionsTable)
      .where(and(
        eq(cashEnvelopeTransactionsTable.userId, DEFAULT_USER_ID),
        eq(cashEnvelopeTransactionsTable.budgetYearId, getBYID(req)),
        sql`${cashEnvelopeTransactionsTable.activeMonth} LIKE ${year + "-%"}`,
      ))
      .groupBy(
        cashEnvelopeTransactionsTable.activeMonth,
        cashEnvelopeTransactionsTable.type,
      );
    res.json(rows.map(r => ({ ...r, total: parseFloat(r.total || "0") })));
  } catch (err) {
    res.status(500).json({ error: "Failed to get wallet summary" });
  }
});

// POST /api/wallet
router.post("/", async (req, res) => {
  try {
    const { fundId, type, amount, description, date, activeMonth } = req.body;

    if (!type || amount === undefined || amount === null || !date) {
      res.status(400).json({ error: "חסרים שדות: type, amount, date" });
      return;
    }
    const amountNum = parseFloat(String(amount));
    if (isNaN(amountNum) || amountNum <= 0) {
      res.status(400).json({ error: "סכום לא תקין" });
      return;
    }

    const [created] = await db.insert(cashEnvelopeTransactionsTable).values({
      userId: DEFAULT_USER_ID,
      budgetYearId: getBYID(req),
      fundId: fundId ? parseInt(String(fundId)) : null,
      type: String(type),
      amount: String(amountNum),
      description: description ? String(description) : (type === "deposit" ? "הפקדה" : "משיכה"),
      date: String(date),
      activeMonth: activeMonth ? String(activeMonth) : null,
    }).returning();

    res.status(201).json({ ...created, amount: parseNum(created.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to create wallet transaction");
    res.status(500).json({ error: "Failed to create wallet transaction" });
  }
});

// DELETE /api/wallet/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(cashEnvelopeTransactionsTable)
      .where(and(
        eq(cashEnvelopeTransactionsTable.id, id),
        eq(cashEnvelopeTransactionsTable.userId, DEFAULT_USER_ID),
      ));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete wallet transaction");
    res.status(500).json({ error: "Failed to delete wallet transaction" });
  }
});

export default router;
