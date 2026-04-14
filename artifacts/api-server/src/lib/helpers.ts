/**
 * Shared API route helpers.
 * Import these instead of re-declaring in every route file.
 */
import type { Request, Response } from "express";

// ── Constants ──────────────────────────────────────────────────────
export const UID = 1;          // DEFAULT_USER_ID  (single-user system)
export const DEFAULT_BID = 1;  // DEFAULT_BUDGET_YEAR_ID

// ── Query helpers ──────────────────────────────────────────────────

/** Read `?bid=N` from query string; falls back to DEFAULT_BID. */
export function getBYID(req: Request): number {
  const b = parseInt(String(req.query.bid));
  return isNaN(b) ? DEFAULT_BID : b;
}

/** Parse an integer route param. */
export function paramInt(req: Request, name: string): number {
  return parseInt(req.params[name]);
}

/** Parse an optional integer query param. Returns undefined if absent/invalid. */
export function queryInt(req: Request, name: string): number | undefined {
  const v = req.query[name];
  if (v === undefined) return undefined;
  const n = parseInt(String(v));
  return isNaN(n) ? undefined : n;
}

// ── Numeric helpers ────────────────────────────────────────────────

/** Parse a Drizzle numeric() string to JS number. */
export function parseNum(v: string | null | undefined): number {
  return v !== null && v !== undefined ? parseFloat(v) : 0;
}

/** Same but can return null for nullable columns. */
export function parseNumNullable(v: string | null | undefined): number | null {
  return v !== null && v !== undefined ? parseFloat(v) : null;
}

// ── Validation ─────────────────────────────────────────────────────

/**
 * Validate `body` with a Drizzle-Zod schema (safeParse interface).
 * Returns the parsed data on success, or sends a 400 and returns null.
 */
export function validate<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: unknown[] } } },
  body: unknown,
  res: Response,
): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({
      error: "Invalid input",
      details: (result as any).error.issues,
    });
    return null;
  }
  return (result as any).data as T;
}

// ── Error handling ─────────────────────────────────────────────────

/**
 * Log and respond with a 500 error.
 */
export function serverError(
  req: Request,
  res: Response,
  err: unknown,
  message: string,
): void {
  (req as any).log?.error?.({ err }, message);
  const errMsg = err instanceof Error ? err.message : String(err);
  const stack  = err instanceof Error ? err.stack  : undefined;
  console.error(`\n[ERROR] ${message}`);
  console.error(`        ${errMsg}`);
  if (stack) console.error(stack);
  res.status(500).json({ error: message, detail: errMsg });
}

/** Respond with a 404. */
export function notFound(res: Response, message = "Not found"): void {
  res.status(404).json({ error: message });
}
