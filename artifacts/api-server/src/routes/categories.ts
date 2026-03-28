import { Router } from "express";
import { db, categoriesTable, insertCategorySchema } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(categoriesTable)
      .where(and(eq(categoriesTable.userId, DEFAULT_USER_ID), eq(categoriesTable.isActive, true)))
      .orderBy(categoriesTable.sortOrder);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get categories");
    res.status(500).json({ error: "Failed to get categories" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertCategorySchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(categoriesTable).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create category");
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID };
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

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(categoriesTable).set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, DEFAULT_USER_ID), eq(categoriesTable.isSystem, false)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete category");
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
