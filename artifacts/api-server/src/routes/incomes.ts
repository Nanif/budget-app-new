import { Router } from "express";
import { db, incomesTable, categoriesTable, insertIncomeSchema } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: incomesTable.id,
        userId: incomesTable.userId,
        budgetYearId: incomesTable.budgetYearId,
        categoryId: incomesTable.categoryId,
        amount: incomesTable.amount,
        source: incomesTable.source,
        description: incomesTable.description,
        date: incomesTable.date,
        isTaxable: incomesTable.isTaxable,
        isRecurring: incomesTable.isRecurring,
        createdAt: incomesTable.createdAt,
        updatedAt: incomesTable.updatedAt,
        categoryName: categoriesTable.name,
        categoryColor: categoriesTable.color,
      })
      .from(incomesTable)
      .leftJoin(categoriesTable, eq(incomesTable.categoryId, categoriesTable.id))
      .where(and(eq(incomesTable.userId, DEFAULT_USER_ID), eq(incomesTable.budgetYearId, DEFAULT_BUDGET_YEAR_ID)))
      .orderBy(desc(incomesTable.date));
    res.json(rows.map(r => ({ ...r, amount: parseFloat(r.amount) })));
  } catch (err) {
    req.log.error({ err }, "Failed to get incomes");
    res.status(500).json({ error: "Failed to get incomes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const raw = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: DEFAULT_BUDGET_YEAR_ID };
    const body = Object.fromEntries(Object.entries(raw).filter(([_, v]) => v !== null && v !== ""));
    const parsed = insertIncomeSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(incomesTable).values(parsed.data).returning();
    res.status(201).json({ ...created, amount: parseFloat(created.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to create income");
    res.status(500).json({ error: "Failed to create income" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const raw = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: DEFAULT_BUDGET_YEAR_ID };
    const body = Object.fromEntries(Object.entries(raw).filter(([_, v]) => v !== null && v !== ""));
    const parsed = insertIncomeSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(incomesTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(incomesTable.id, id), eq(incomesTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, amount: parseFloat(updated.amount) });
  } catch (err) {
    req.log.error({ err }, "Failed to update income");
    res.status(500).json({ error: "Failed to update income" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(incomesTable).where(and(eq(incomesTable.id, id), eq(incomesTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete income");
    res.status(500).json({ error: "Failed to delete income" });
  }
});

export default router;
