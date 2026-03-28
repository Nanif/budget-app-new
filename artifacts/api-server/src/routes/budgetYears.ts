import { Router } from "express";
import { db, budgetYearsTable, systemSettingsTable, insertBudgetYearSchema } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(budgetYearsTable)
      .where(eq(budgetYearsTable.userId, DEFAULT_USER_ID))
      .orderBy(budgetYearsTable.startDate);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get budget years");
    res.status(500).json({ error: "Failed to get budget years" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertBudgetYearSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(budgetYearsTable).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create budget year");
    res.status(500).json({ error: "Failed to create budget year" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertBudgetYearSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(budgetYearsTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(budgetYearsTable.id, id), eq(budgetYearsTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update budget year");
    res.status(500).json({ error: "Failed to update budget year" });
  }
});

router.post("/:id/activate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(budgetYearsTable).set({ isActive: false, updatedAt: new Date() })
      .where(eq(budgetYearsTable.userId, DEFAULT_USER_ID));
    const [activated] = await db.update(budgetYearsTable).set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(budgetYearsTable.id, id), eq(budgetYearsTable.userId, DEFAULT_USER_ID))).returning();
    if (!activated) { res.status(404).json({ error: "Not found" }); return; }
    await db.update(systemSettingsTable).set({ activeBudgetYearId: id, updatedAt: new Date() })
      .where(eq(systemSettingsTable.userId, DEFAULT_USER_ID));
    res.json(activated);
  } catch (err) {
    req.log.error({ err }, "Failed to activate budget year");
    res.status(500).json({ error: "Failed to activate budget year" });
  }
});

export default router;
