import { Router } from "express";
import { db, settingsTable, insertSettingsSchema } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function formatSettings(e: typeof settingsTable.$inferSelect) {
  return {
    id: e.id,
    currency: e.currency,
    monthlyBudget: parseFloat(e.monthlyBudget),
    incomeForTithe: parseFloat(e.incomeForTithe),
    tithePercentage: parseFloat(e.tithePercentage),
    userName: e.userName,
  };
}

async function getOrCreateSettings() {
  const rows = await db.select().from(settingsTable);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created;
}

router.get("/", async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(formatSettings(settings));
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Failed to get settings" });
  }
});

router.put("/", async (req, res) => {
  try {
    const parsed = insertSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const settings = await getOrCreateSettings();
    const [updated] = await db
      .update(settingsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(settingsTable.id, settings.id))
      .returning();
    res.json(formatSettings(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
