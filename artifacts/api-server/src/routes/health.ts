import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

const KEY_TABLES = [
  "budget_years",
  "funds",
  "expenses",
  "incomes",
  "categories",
  "users",
];

router.get("/healthz", async (_req, res) => {
  let dbStatus: "ok" | "error" = "ok";
  let dbError: string | undefined;

  try {
    await pool.query("SELECT 1");
  } catch (err: any) {
    dbStatus = "error";
    dbError = err?.message ?? "unknown error";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";

  res.status(dbStatus === "ok" ? 200 : 503).json({
    status,
    db: dbStatus,
    ...(dbError ? { dbError } : {}),
    timestamp: new Date().toISOString(),
  });
});

router.get("/db-health", async (_req, res) => {
  const results: Record<string, { exists: boolean; rowCount?: number; error?: string }> = {};
  let allOk = true;

  for (const table of KEY_TABLES) {
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      const exists = rows[0].count > 0;

      if (exists) {
        const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
        results[table] = { exists: true, rowCount: countRows[0].count };
      } else {
        results[table] = { exists: false };
        allOk = false;
      }
    } catch (err: any) {
      results[table] = { exists: false, error: err?.message ?? "unknown error" };
      allOk = false;
    }
  }

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    tables: results,
    timestamp: new Date().toISOString(),
  });
});

export default router;
