import { Router } from "express";
import { db, charityTable, insertCharitySchema } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function formatCharity(e: typeof charityTable.$inferSelect) {
  return {
    id: e.id,
    amount: parseFloat(e.amount),
    recipient: e.recipient,
    description: e.description,
    date: e.date,
    isTithe: e.isTithe,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(charityTable).orderBy(desc(charityTable.date));
    res.json(rows.map(formatCharity));
  } catch (err) {
    req.log.error({ err }, "Failed to get charity entries");
    res.status(500).json({ error: "Failed to get charity entries" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertCharitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db.insert(charityTable).values(parsed.data).returning();
    res.status(201).json(formatCharity(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create charity entry");
    res.status(500).json({ error: "Failed to create charity entry" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = insertCharitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [updated] = await db.update(charityTable).set(parsed.data).where(eq(charityTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(formatCharity(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update charity entry");
    res.status(500).json({ error: "Failed to update charity entry" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(charityTable).where(eq(charityTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete charity entry");
    res.status(500).json({ error: "Failed to delete charity entry" });
  }
});

export default router;
