import { Router } from "express";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const ROOTS: Record<string, string> = {
  client: "/home/runner/workspace/artifacts/budget-app/src",
  server: "/home/runner/workspace/artifacts/api-server/src",
};

const IGNORE = new Set([".DS_Store", "node_modules", ".git", "dist", "build"]);

function safePath(root: string, relPath: string): string {
  const full = path.resolve(root, relPath.replace(/^\/+/, ""));
  if (!full.startsWith(root)) throw new Error("Invalid path");
  return full;
}

// GET /api/dev/files?root=client|server&path=relative/path
router.get("/files", async (req, res) => {
  try {
    const rootKey = String(req.query.root || "client");
    const relPath  = String(req.query.path  || "");
    const rootDir  = ROOTS[rootKey];
    if (!rootDir) return res.status(400).json({ error: "Unknown root" });

    const fullPath = relPath ? safePath(rootDir, relPath) : rootDir;
    const info = await stat(fullPath);

    if (info.isDirectory()) {
      const entries = await readdir(fullPath, { withFileTypes: true });
      const items = entries
        .filter(e => !IGNORE.has(e.name) && !e.name.startsWith("."))
        .map(e => ({
          name: e.name,
          path: relPath ? `${relPath}/${e.name}` : e.name,
          isDir: e.isDirectory(),
          ext:   e.isFile() ? path.extname(e.name).slice(1) : undefined,
        }))
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      return res.json({ type: "dir", items });
    }

    const content = await readFile(fullPath, "utf-8");
    return res.json({ type: "file", content, name: path.basename(fullPath) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/dev/db/tables
router.get("/db/tables", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    res.json((result.rows as any[]).map(r => r.table_name as string));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dev/db/table/:name?page=1&limit=50
router.get("/db/table/:name", async (req, res) => {
  try {
    const name   = req.params.name.replace(/[^a-z0-9_]/gi, "");
    const page   = Math.max(1, parseInt(String(req.query.page  || "1")));
    const limit  = Math.min(200, parseInt(String(req.query.limit || "50")));
    const offset = (page - 1) * limit;

    const [dataRes, countRes, colRes] = await Promise.all([
      db.execute(sql.raw(`SELECT * FROM "${name}" LIMIT ${limit} OFFSET ${offset}`)),
      db.execute(sql.raw(`SELECT COUNT(*) AS total FROM "${name}"`)),
      db.execute(sql.raw(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${name}'
        ORDER BY ordinal_position
      `)),
    ]);

    res.json({
      rows:    dataRes.rows,
      total:   parseInt(String((countRes.rows[0] as any).total)),
      columns: (colRes.rows as any[]).map(c => ({ name: c.column_name, type: c.data_type })),
      page,
      limit,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
