import { Router } from "express";
import { db, categoriesTable, insertCategorySchema, fundsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

/* ── GET (all or active only, optional fundId filter) ─────────── */
router.get("/", async (req, res) => {
  try {
    const includeInactive = req.query.all === "true";
    const fundId = req.query.fundId ? parseInt(req.query.fundId as string) : undefined;

    const conditions = [
      eq(categoriesTable.userId, DEFAULT_USER_ID),
      ...(includeInactive ? [] : [eq(categoriesTable.isActive, true)]),
      ...(fundId !== undefined ? [eq(categoriesTable.fundId, fundId)] : []),
    ];

    const rows = await db
      .select({
        id: categoriesTable.id,
        userId: categoriesTable.userId,
        budgetYearId: categoriesTable.budgetYearId,
        fundId: categoriesTable.fundId,
        name: categoriesTable.name,
        type: categoriesTable.type,
        color: categoriesTable.color,
        icon: categoriesTable.icon,
        isSystem: categoriesTable.isSystem,
        isActive: categoriesTable.isActive,
        sortOrder: categoriesTable.sortOrder,
        createdAt: categoriesTable.createdAt,
        updatedAt: categoriesTable.updatedAt,
        fundName: fundsTable.name,
        fundColor: fundsTable.colorClass,
      })
      .from(categoriesTable)
      .leftJoin(fundsTable, eq(categoriesTable.fundId, fundsTable.id))
      .where(and(...conditions))
      .orderBy(asc(categoriesTable.sortOrder));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get categories");
    res.status(500).json({ error: "Failed to get categories" });
  }
});

/* ── POST ─────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const raw = { ...req.body, userId: DEFAULT_USER_ID };
    const body = Object.fromEntries(Object.entries(raw).filter(([_, v]) => v !== null && v !== ""));
    const parsed = insertCategorySchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(categoriesTable).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create category");
    res.status(500).json({ error: "Failed to create category" });
  }
});

/* ── PUT ──────────────────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const raw = { ...req.body, userId: DEFAULT_USER_ID };
    const body = Object.fromEntries(Object.entries(raw).filter(([_, v]) => v !== null && v !== ""));
    const parsed = insertCategorySchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(categoriesTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update category");
    res.status(500).json({ error: "Failed to update category" });
  }
});

/* ── PATCH toggle active ─────────────────────────────────────── */
router.patch("/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [cur] = await db.select({ isActive: categoriesTable.isActive })
      .from(categoriesTable).where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, DEFAULT_USER_ID)));
    if (!cur) { res.status(404).json({ error: "Not found" }); return; }
    const [updated] = await db.update(categoriesTable).set({ isActive: !cur.isActive, updatedAt: new Date() })
      .where(eq(categoriesTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to toggle category");
    res.status(500).json({ error: "Failed to toggle category" });
  }
});

/* ── DELETE (soft – marks inactive) ─────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [cat] = await db.select({ id: categoriesTable.id })
      .from(categoriesTable).where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, DEFAULT_USER_ID)));
    if (!cat) { res.status(404).json({ error: "Not found" }); return; }
    await db.update(categoriesTable).set({ isActive: false, updatedAt: new Date() })
      .where(eq(categoriesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete category");
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
