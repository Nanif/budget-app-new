import { defineConfig } from "drizzle-kit";
import path from "path";

function buildCredentials() {
  if (process.env.DB_HOST) {
    return {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "6543"),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "postgres",
      ssl: { rejectUnauthorized: false },
    };
  }

  const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database connection configured.\n" +
      "Option A: Set SUPABASE_DATABASE_URL or DATABASE_URL\n" +
      "Option B: Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME"
    );
  }

  return {
    url,
    ssl: !!process.env.SUPABASE_DATABASE_URL,
  };
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: buildCredentials() as any,
});
