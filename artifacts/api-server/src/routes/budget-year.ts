import { Router } from "express";
import { db, budgetYearsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

// GET current budget year config
router.get("/", async (req, res) => {
  try {
    const [year] = await db
      .select()
      .from(budgetYearsTable)
      .where(eq(budgetYearsTable.id, DEFAULT_BUDGET_YEAR_ID));
    if (!year) { res.status(404).json({ error: "Budget year not found" }); return; }
    res.json({
      ...year,
      totalBudget: parseFloat(year.totalBudget || "0"),
      tithePercentage: parseFloat(year.tithePercentage || "10"),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get budget year");
    res.status(500).json({ error: "Failed to get budget year" });
  }
});

// PUT update budget year settings
router.put("/", async (req, res) => {
  try {
    const { name, totalBudget, tithePercentage, notes } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (totalBudget !== undefined) updateData.totalBudget = String(totalBudget);
    if (tithePercentage !== undefined) updateData.tithePercentage = String(tithePercentage);
    if (notes !== undefined) updateData.notes = notes;

    const [updated] = await db
      .update(budgetYearsTable)
      .set(updateData)
      .where(eq(budgetYearsTable.id, DEFAULT_BUDGET_YEAR_ID))
      .returning();
    res.json({
      ...updated,
      totalBudget: parseFloat(updated.totalBudget || "0"),
      tithePercentage: parseFloat(updated.tithePercentage || "10"),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update budget year");
    res.status(500).json({ error: "Failed to update budget year" });
  }
});

export default router;
