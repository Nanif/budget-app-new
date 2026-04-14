import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function buildConnectionConfig(): pg.PoolConfig {
  const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  const isSupabase = !!process.env.SUPABASE_DATABASE_URL;

  if (process.env.DB_HOST) {
    return {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "6543"),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "postgres",
      ssl: { rejectUnauthorized: false },
      keepAlive: true,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
    };
  }

  if (!url) {
    throw new Error(
      "No database connection configured.\n" +
      "Option A: Set SUPABASE_DATABASE_URL (password must be URL-encoded: & → %26, % → %25)\n" +
      "Option B: Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME separately (recommended for Windows)",
    );
  }

  return {
    connectionString: url,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    keepAlive: true,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  };
}

export const pool = new Pool(buildConnectionConfig());

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
