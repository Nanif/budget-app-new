import { Router } from "express";
import { db, debtsTable, insertDebtSchema } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;

const fmt = (r: any) => ({
  ...r,
  totalAmount:     parseFloat(r.totalAmount),
  remainingAmount: parseFloat(r.remainingAmount),
  interestRate:    parseFloat(r.interestRate),
});

/* Debts are global — not scoped to any budget year */

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(debtsTable)
      .where(eq(debtsTable.userId, DEFAULT_USER_ID))
      .orderBy(desc(debtsTable.createdAt));
    res.json(rows.map(fmt));
  } catch (err) {
    req.log.error({ err }, "Failed to get debts");
    res.status(500).json({ error: "Failed to get debts" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: null };
    const parsed = insertDebtSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [created] = await db.insert(debtsTable).values(parsed.data).returning();
    res.status(201).json(fmt(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create debt");
    res.status(500).json({ error: "Failed to create debt" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body, userId: DEFAULT_USER_ID, budgetYearId: null };
    const parsed = insertDebtSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(debtsTable).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(debtsTable.id, id), eq(debtsTable.userId, DEFAULT_USER_ID))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update debt");
    res.status(500).json({ error: "Failed to update debt" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(debtsTable).where(and(eq(debtsTable.id, id), eq(debtsTable.userId, DEFAULT_USER_ID)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete debt");
    res.status(500).json({ error: "Failed to delete debt" });
  }
});

export default router;
