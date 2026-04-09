import { Router } from "express";
import { db, netWorthRecordsTable, netWorthItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;

/* ── Build the API response shape from joined rows ── */
function buildRecord(record: typeof netWorthRecordsTable.$inferSelect, items: (typeof netWorthItemsTable.$inferSelect)[]) {
  const debts   = items.filter(i => i.type === "debt")
    .map(i => ({ name: i.name, amount: parseFloat(i.amount as string) }));
  const savings = items.filter(i => i.type === "saving")
    .map(i => ({ name: i.name, amount: parseFloat(i.amount as string) }));

  const totalDebts   = debts.reduce((s, d) => s + d.amount, 0);
  const totalSavings = savings.reduce((s, d) => s + d.amount, 0);

  return {
    id:           record.id,
    userId:       record.userId,
    recordedAt:   record.recordedAt,
    createdAt:    record.createdAt,
    items:        { debts, savings },
    totalDebts,
    totalSavings,
    netWorth: totalSavings - totalDebts,
  };
}

/* GET /api/net-worth-records */
router.get("/", async (req, res) => {
  try {
    const records = await db
      .select()
      .from(netWorthRecordsTable)
      .where(eq(netWorthRecordsTable.userId, DEFAULT_USER_ID))
      .orderBy(desc(netWorthRecordsTable.recordedAt));

    const result = await Promise.all(
      records.map(async rec => {
        const items = await db
          .select()
          .from(netWorthItemsTable)
          .where(eq(netWorthItemsTable.recordId, rec.id));
        return buildRecord(rec, items);
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get net worth records");
    res.status(500).json({ error: "Failed to get net worth records" });
  }
});

/* POST /api/net-worth-records */
router.post("/", async (req, res) => {
  try {
    const { recordedAt, items } = req.body as {
      recordedAt: string;
      items: { debts: { name: string; amount: number }[]; savings: { name: string; amount: number }[] };
    };

    if (!recordedAt || !items) {
      res.status(400).json({ error: "recordedAt and items are required" });
      return;
    }

    const [created] = await db
      .insert(netWorthRecordsTable)
      .values({ userId: DEFAULT_USER_ID, recordedAt, items: { debts: [], savings: [] } })
      .returning();

    const itemRows = [
      ...(items.debts   || []).map(d => ({ recordId: created.id, name: d.name, type: "debt"   as const, amount: String(d.amount) })),
      ...(items.savings || []).map(s => ({ recordId: created.id, name: s.name, type: "saving" as const, amount: String(s.amount) })),
    ];

    const insertedItems = itemRows.length > 0
      ? await db.insert(netWorthItemsTable).values(itemRows).returning()
      : [];

    res.status(201).json(buildRecord(created, insertedItems));
  } catch (err) {
    req.log.error({ err }, "Failed to create net worth record");
    res.status(500).json({ error: "Failed to create net worth record" });
  }
});

/* DELETE /api/net-worth-records/:id */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(netWorthRecordsTable).where(eq(netWorthRecordsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete net worth record");
    res.status(500).json({ error: "Failed to delete net worth record" });
  }
});

export default router;
