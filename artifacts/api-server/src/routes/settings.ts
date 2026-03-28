import { Router } from "express";
import { db, systemSettingsTable, insertSystemSettingsSchema } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;

async function getOrCreateSettings() {
  const rows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.userId, DEFAULT_USER_ID));
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(systemSettingsTable).values({ userId: DEFAULT_USER_ID }).returning();
  return created;
}

function formatSettings(s: typeof systemSettingsTable.$inferSelect) {
  return {
    ...s,
    monthlyBudget: parseFloat(s.monthlyBudget),
    tithePercentage: parseFloat(s.tithePercentage),
    incomeBaseForTithe: parseFloat(s.incomeBaseForTithe),
  };
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
    const settings = await getOrCreateSettings();
    const body = { ...req.body, userId: DEFAULT_USER_ID };
    const parsed = insertSystemSettingsSchema.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const [updated] = await db.update(systemSettingsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(systemSettingsTable.id, settings.id)).returning();
    res.json(formatSettings(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
