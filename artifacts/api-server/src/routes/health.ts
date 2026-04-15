import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

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

export default router;
