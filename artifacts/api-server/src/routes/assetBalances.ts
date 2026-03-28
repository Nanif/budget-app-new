/**
 * /api/asset-balances
 * Historical balance snapshots for an asset (savings account, investment, etc.)
 *
 * Routes:
 *   GET    /api/asset-balances           list (filter by assetId)
 *   GET    /api/asset-balances/latest    one latest record per asset (for current budget year)
 *   GET    /api/asset-balances/:id       get one
 *   POST   /api/asset-balances           record a new balance snapshot
 *   PUT    /api/asset-balances/:id       update a snapshot
 *   DELETE /api/asset-balances/:id       delete
 *
 * Request body (POST / PUT):
 *   assetId    : number   (required) — must belong to this user
 *   balance    : number   (required) — value at recordedAt
 *   recordedAt : string   YYYY-MM-DD (required)
 *   notes      : string   (optional)
 *
 * Response: AssetBalance { id, assetId, userId, balance, recordedAt, notes, createdAt }
 *   balance is returned as a JS number.
 *
 * Side effect on POST:
 *   assets.currentAmount is updated to match the new balance value.
 *
 * Error responses:
 *   400  Invalid input / Asset not found
 *   404  Balance record not found
 *   500  Internal server error
 */
import { Router } from "express";
import {
  db,
  assetBalancesTable,
  assetsTable,
  insertAssetBalanceSchema,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  UID, getBYID, paramInt, queryInt,
  parseNum, validate, serverError, notFound,
} from "../lib/helpers";

const router = Router();

// ── GET /api/asset-balances ────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const assetId = queryInt(req, "assetId");
    const limit   = queryInt(req, "limit") ?? 200;

    const conditions: any[] = [eq(assetBalancesTable.userId, UID)];
    if (assetId !== undefined) conditions.push(eq(assetBalancesTable.assetId, assetId));

    const rows = await db
      .select()
      .from(assetBalancesTable)
      .where(and(...conditions))
      .orderBy(desc(assetBalancesTable.recordedAt))
      .limit(Math.min(limit, 500));

    res.json(rows.map(r => ({ ...r, balance: parseNum(r.balance) })));
  } catch (err) {
    serverError(req, res, err, "Failed to list asset balances");
  }
});

// ── GET /api/asset-balances/latest ────────────────────────────────
/**
 * Returns the most-recent balance record for each asset in the active budget year.
 * Useful for the net-worth summary view.
 *
 * Response: { assetId, balance, recordedAt, id }[]
 */
router.get("/latest", async (req, res) => {
  try {
    const byid = getBYID(req);

    // Get all assets for this user + year
    const assets = await db
      .select({ id: assetsTable.id })
      .from(assetsTable)
      .where(and(eq(assetsTable.userId, UID), eq(assetsTable.budgetYearId, byid)));

    const result = await Promise.all(
      assets.map(async (asset) => {
        const [latest] = await db
          .select()
          .from(assetBalancesTable)
          .where(and(
            eq(assetBalancesTable.assetId, asset.id),
            eq(assetBalancesTable.userId, UID),
          ))
          .orderBy(desc(assetBalancesTable.recordedAt))
          .limit(1);
        if (!latest) return null;
        return {
          id:         latest.id,
          assetId:    asset.id,
          balance:    parseNum(latest.balance),
          recordedAt: latest.recordedAt,
        };
      })
    );

    res.json(result.filter(Boolean));
  } catch (err) {
    serverError(req, res, err, "Failed to get latest asset balances");
  }
});

// ── GET /api/asset-balances/net-worth-history ─────────────────────
/**
 * Returns the net worth timeline computed from all balance snapshots.
 * For each unique snapshot date, computes total assets and total liabilities
 * as of that date (using the latest snapshot on or before each date).
 * Response: { date, totalAssets, totalLiabilities, netWorth }[]
 */
router.get("/net-worth-history", async (req, res) => {
  try {
    const allItems = await db
      .select()
      .from(assetsTable)
      .where(and(eq(assetsTable.userId, UID), eq(assetsTable.isActive, true)));

    const allSnaps = await db
      .select()
      .from(assetBalancesTable)
      .where(eq(assetBalancesTable.userId, UID));

    if (allSnaps.length === 0) { res.json([]); return; }

    const LIAB_TYPES = new Set([
      "mortgage", "bank_loan", "private_loan", "credit_balance", "other_liability",
    ]);

    const dates = [...new Set(allSnaps.map(s => s.recordedAt))].sort();

    const history = dates.map(date => {
      let totalAssets = 0;
      let totalLiabilities = 0;

      for (const item of allItems) {
        const snap = allSnaps
          .filter(s => s.assetId === item.id && s.recordedAt <= date)
          .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
        const val = snap ? parseNum(snap.balance) : parseNum(item.currentAmount);
        if (LIAB_TYPES.has(item.type)) totalLiabilities += val;
        else totalAssets += val;
      }

      return { date, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
    });

    res.json(history);
  } catch (err) {
    serverError(req, res, err, "Failed to get net worth history");
  }
});

// ── GET /api/asset-balances/:id ───────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = paramInt(req, "id");
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [row] = await db
      .select()
      .from(assetBalancesTable)
      .where(and(eq(assetBalancesTable.id, id), eq(assetBalancesTable.userId, UID)));

    if (!row) { notFound(res); return; }
    res.json({ ...row, balance: parseNum(row.balance) });
  } catch (err) {
    serverError(req, res, err, "Failed to get asset balance");
  }
});

// ── POST /api/asset-balances ───────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: UID };
    const data = validate(insertAssetBalanceSchema, body, res);
    if (!data) return;

    // Verify asset belongs to user
    const [asset] = await db
      .select({ id: assetsTable.id })
      .from(assetsTable)
      .where(and(eq(assetsTable.id, data.assetId), eq(assetsTable.userId, UID)));
    if (!asset) { res.status(400).json({ error: "Asset not found" }); return; }

    const [created] = await db.insert(assetBalancesTable).values(data).returning();

    // Keep assets.currentAmount in sync with the newest snapshot
    await db
      .update(assetsTable)
      .set({ currentAmount: String(data.balance), updatedAt: new Date() })
      .where(eq(assetsTable.id, data.assetId));

    res.status(201).json({ ...created, balance: parseNum(created.balance) });
  } catch (err) {
    serverError(req, res, err, "Failed to record asset balance");
  }
});

// ── PUT /api/asset-balances/:id ───────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const id = paramInt(req, "id");
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = { ...req.body, userId: UID };
    const data = validate(insertAssetBalanceSchema, body, res);
    if (!data) return;

    const [updated] = await db
      .update(assetBalancesTable)
      .set(data)
      .where(and(eq(assetBalancesTable.id, id), eq(assetBalancesTable.userId, UID)))
      .returning();

    if (!updated) { notFound(res); return; }
    res.json({ ...updated, balance: parseNum(updated.balance) });
  } catch (err) {
    serverError(req, res, err, "Failed to update asset balance");
  }
});

// ── DELETE /api/asset-balances/:id ────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = paramInt(req, "id");
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    await db
      .delete(assetBalancesTable)
      .where(and(eq(assetBalancesTable.id, id), eq(assetBalancesTable.userId, UID)));

    res.status(204).send();
  } catch (err) {
    serverError(req, res, err, "Failed to delete asset balance");
  }
});

export default router;
