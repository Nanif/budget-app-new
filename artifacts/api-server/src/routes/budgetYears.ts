import { Router } from "express";
import { db, budgetYearsTable, systemSettingsTable, insertBudgetYearSchema, fundsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { serverError } from "../lib/helpers";

const DEFAULT_YEAR_FUNDS = [
  { name: "קופת שוטף",          fundBehavior: "cash_monthly",       colorClass: "#f59e0b", monthlyAllocation: "0", annualAllocation: "0", initialBalance: "0", includeInBudget: true,  displayOrder: 0, isDefault: true },
  { name: "קופת קבועות",        fundBehavior: "fixed_monthly",      colorClass: "#3b82f6", monthlyAllocation: "0", annualAllocation: "0", initialBalance: "0", includeInBudget: true,  displayOrder: 1, isDefault: true },
  { name: "קופת משכנתא וחובות", fundBehavior: "fixed_monthly",      colorClass: "#8b5cf6", monthlyAllocation: "0", annualAllocation: "0", initialBalance: "0", includeInBudget: true,  displayOrder: 2, isDefault: true },
  { name: "קופת מעגל שנה",      fundBehavior: "annual_categorized", colorClass: "#10b981", monthlyAllocation: "0", annualAllocation: "0", initialBalance: "0", includeInBudget: true,  displayOrder: 3, isDefault: true },
];

async function seedDefaultFunds(userId: number, byid: number) {
  const existing = await db.select({ n: sql<string>`COUNT(*)` }).from(fundsTable)
    .where(and(eq(fundsTable.userId, userId), eq(fundsTable.budgetYearId, byid)));
  if (parseInt(existing[0].n) === 0) {
    await db.insert(fundsTable).values(
      DEFAULT_YEAR_FUNDS.map(f => ({ ...f, userId, budgetYearId: byid, isActive: true, description: "" }))
    );
  }
}

const router = Router();
const DEFAULT_USER_ID = 1;

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(budgetYearsTable)
      .where(eq(budgetYearsTable.userId, DEFAULT_USER_ID))
      .orderBy(budgetYearsTable.startDate);
    res.json(rows);
  } catch (err) {
    serverError(req, res, err, "Failed to get budget years");
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertBudgetYearSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(budgetYearsTable).values(parsed.data).returning();
    await seedDefaultFunds(DEFAULT_USER_ID, created.id);
    res.status(201).json(created);
  } catch (err) {
    serverError(req, res, err, "Failed to create budget year");
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
    serverError(req, res, err, "Failed to update budget year");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const all = await db.select().from(budgetYearsTable).where(eq(budgetYearsTable.userId, DEFAULT_USER_ID));
    if (all.length <= 1) { res.status(400).json({ error: "לא ניתן למחוק את שנת התקציב האחרונה" }); return; }
    const [deleted] = await db.delete(budgetYearsTable)
      .where(and(eq(budgetYearsTable.id, id), eq(budgetYearsTable.userId, DEFAULT_USER_ID))).returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    serverError(req, res, err, "Failed to delete budget year");
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
    serverError(req, res, err, "Failed to activate budget year");
  }
});

export default router;
