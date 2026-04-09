import { Router } from "express";
import { db, netWorthRecordsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;

function fmt(r: any) {
  const items = r.items as { debts: {name:string;amount:number}[]; savings: {name:string;amount:number}[] };
  const totalDebts    = items.debts.reduce((s: number, d: any) => s + d.amount, 0);
  const totalSavings  = items.savings.reduce((s: number, d: any) => s + d.amount, 0);
  return {
    ...r,
    items,
    totalDebts,
    totalSavings,
    netWorth: totalSavings - totalDebts,
  };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(netWorthRecordsTable)
      .where(eq(netWorthRecordsTable.userId, DEFAULT_USER_ID))
      .orderBy(desc(netWorthRecordsTable.recordedAt));
    res.json(rows.map(fmt));
  } catch (err) {
    req.log.error({ err }, "Failed to get net worth records");
    res.status(500).json({ error: "Failed to get net worth records" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { recordedAt, items } = req.body;
    if (!recordedAt || !items) {
      res.status(400).json({ error: "recordedAt and items are required" });
      return;
    }
    const [created] = await db.insert(netWorthRecordsTable).values({
      userId: DEFAULT_USER_ID,
      recordedAt,
      items,
    }).returning();
    res.status(201).json(fmt(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create net worth record");
    res.status(500).json({ error: "Failed to create net worth record" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(netWorthRecordsTable)
      .where(eq(netWorthRecordsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete net worth record");
    res.status(500).json({ error: "Failed to delete net worth record" });
  }
});

export default router;
