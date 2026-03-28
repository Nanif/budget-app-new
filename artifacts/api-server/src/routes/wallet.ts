import { Router } from "express";
import { db, cashEnvelopeTransactionsTable, fundsTable, insertCashEnvelopeTransactionSchema } from "@workspace/db";
import { eq, and, gte, lte, desc, sum, sql } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

function parseNum(v: string | null) { return v ? parseFloat(v) : 0; }

// GET /api/wallet?month=YYYY-MM&fundId=N
router.get("/", async (req, res) => {
  try {
    const { month, fundId } = req.query;
    const conditions: any[] = [
      eq(cashEnvelopeTransactionsTable.userId, DEFAULT_USER_ID),
      eq(cashEnvelopeTransactionsTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID),
    ];
    if (fundId) conditions.push(eq(cashEnvelopeTransactionsTable.fundId, parseInt(String(fundId))));
    if (month) {
      const [y, m] = String(month).split("-");
      const start = `${y}-${m}-01`;
      const end = `${y}-${m}-31`;
      conditions.push(gte(cashEnvelopeTransactionsTable.date, start));
      conditions.push(lte(cashEnvelopeTransactionsTable.date, end));
    }

    const rows = await db
      .select()
      .from(cashEnvelopeTransactionsTable)
      .where(and(...conditions))
      .orderBy(desc(cashEnvelopeTransactionsTable.date));

    // Compute totals
    const deposits = rows.filter(r => r.type === "deposit").reduce((s, r) => s + parseNum(r.amount), 0);
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
    const year = req.query.year ? parseInt(String(req.query.year)) : new Date().getFullYear();
    const rows = await db
      .select({
        month: sql<string>`to_char(${cashEnvelopeTransactionsTable.date}::date, 'YYYY-MM')`,
        type: cashEnvelopeTransactionsTable.type,
        total: sum(cashEnvelopeTransactionsTable.amount),
      })
      .from(cashEnvelopeTransactionsTable)
      .where(and(
        eq(cashEnvelopeTransactionsTable.userId, DEFAULT_USER_ID),
        eq(cashEnvelopeTransactionsTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID),
        sql`EXTRACT(YEAR FROM ${cashEnvelopeTransactionsTable.date}::date) = ${year}`,
      ))
      .groupBy(
        sql`to_char(${cashEnvelopeTransactionsTable.date}::date, 'YYYY-MM')`,
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
    const raw = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: DEFAULT_BUDGET_YEAR_ID };
    const body = Object.fromEntries(Object.entries(raw).filter(([_, v]) => v !== null && v !== ""));
    const parsed = insertCashEnvelopeTransactionSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db.insert(cashEnvelopeTransactionsTable).values(parsed.data).returning();
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
