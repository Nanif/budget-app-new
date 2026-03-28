/**
 * /api/auth
 * Single-user authentication stub.
 *
 * This is a single-user system (user_id = 1 always).
 * The auth layer provides a consistent "/me" endpoint and login/logout stubs
 * for future extensibility when multi-user auth is needed.
 *
 * Routes:
 *   GET  /api/auth/me       returns the current user profile
 *   POST /api/auth/login    always succeeds (no credentials required)
 *   POST /api/auth/logout   always succeeds
 *
 * GET /api/auth/me response:
 *   { id, name, email, role, locale, createdAt }
 *
 * POST /api/auth/login response:
 *   { ok: true, userId: 1 }
 *
 * POST /api/auth/logout response:
 *   204 No Content
 *
 * Future: replace login/logout stubs with JWT / session when multi-user is needed.
 */
import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UID, serverError } from "../lib/helpers";

const router = Router();

// ── GET /api/auth/me ───────────────────────────────────────────────
router.get("/me", async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, UID))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id:        user.id,
      name:      user.displayName || user.email,
      email:     user.email,
      role:      "owner",
      locale:    user.locale,
      isActive:  user.isActive,
      createdAt: user.createdAt?.toISOString() ?? null,
    });
  } catch (err) {
    serverError(req, res, err, "Failed to get user profile");
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────
router.post("/login", (_req, res) => {
  res.json({ ok: true, userId: UID });
});

// ── POST /api/auth/logout ──────────────────────────────────────────
router.post("/logout", (_req, res) => {
  res.status(204).send();
});

export default router;
