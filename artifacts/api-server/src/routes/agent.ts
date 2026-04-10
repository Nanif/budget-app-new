import { Router } from "express";
import { db, expensesTable, incomesTable, fundsTable, fundBudgetsTable, categoriesTable, debtsTable, assetsTable, assetBalancesTable, systemSettingsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

function getBYID(req: any): number {
  const b = parseInt(String(req.query.bid));
  return isNaN(b) ? DEFAULT_BUDGET_YEAR_ID : b;
}

function fmt(n: number) { return `₪${Math.round(n).toLocaleString("he-IL")}`; }

async function buildContext(budgetYearId: number): Promise<string> {
  const [expenses, incomes, funds, budgets, categories, debts, assets, latestBalances] = await Promise.all([
    db.select().from(expensesTable).where(and(eq(expensesTable.userId, DEFAULT_USER_ID), eq(expensesTable.budgetYearId, budgetYearId))).orderBy(desc(expensesTable.date)),
    db.select().from(incomesTable).where(and(eq(incomesTable.userId, DEFAULT_USER_ID), eq(incomesTable.budgetYearId, budgetYearId))).orderBy(desc(incomesTable.date)),
    db.select().from(fundsTable).where(eq(fundsTable.userId, DEFAULT_USER_ID)).orderBy(fundsTable.sortOrder),
    db.select().from(fundBudgetsTable).where(eq(fundBudgetsTable.budgetYearId, budgetYearId)),
    db.select().from(categoriesTable).where(eq(categoriesTable.userId, DEFAULT_USER_ID)),
    db.select().from(debtsTable).where(eq(debtsTable.userId, DEFAULT_USER_ID)),
    db.select().from(assetsTable).where(eq(assetsTable.userId, DEFAULT_USER_ID)),
    db.execute(sql`SELECT DISTINCT ON (asset_id) * FROM asset_balances ORDER BY asset_id, date DESC`),
  ]);

  const fundMap = Object.fromEntries(funds.map(f => [f.id, f.name]));
  const catMap  = Object.fromEntries(categories.map(c => [c.id, c.name]));

  const totalIncome     = incomes.filter(i => i.entryType === "income").reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalDeductions = incomes.filter(i => i.entryType === "work_deduction").reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalExpenses   = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);

  // ── income by month ──
  const incomeByMonth: Record<string, { income: number; ded: number }> = {};
  for (const i of incomes) {
    const m = i.date.substring(0, 7);
    if (!incomeByMonth[m]) incomeByMonth[m] = { income: 0, ded: 0 };
    if (i.entryType === "income") incomeByMonth[m].income += parseFloat(i.amount);
    else incomeByMonth[m].ded += parseFloat(i.amount);
  }

  // ── expenses by fund ──
  const byFund: Record<string, number> = {};
  for (const e of expenses) {
    const name = e.fundId ? (fundMap[e.fundId] ?? "?") : "ללא קופה";
    byFund[name] = (byFund[name] ?? 0) + parseFloat(e.amount);
  }

  // ── expenses by category ──
  const byCat: Record<string, number> = {};
  for (const e of expenses) {
    if (!e.categoryId) continue;
    const name = catMap[e.categoryId] ?? "?";
    byCat[name] = (byCat[name] ?? 0) + parseFloat(e.amount);
  }

  const lines: string[] = [
    "=== תקציב משפחת אוסטרוב 2026 ===",
    `הכנסות: ${fmt(totalIncome)} | ניכויים: ${fmt(totalDeductions)} | נטו: ${fmt(totalIncome - totalDeductions)}`,
    `הוצאות: ${fmt(totalExpenses)} | יתרה: ${fmt(totalIncome - totalDeductions - totalExpenses)}`,
    "",
    "-- הכנסות לפי חודש --",
    ...Object.entries(incomeByMonth).sort().map(([m, d]) =>
      `${m}: הכנסות ${fmt(d.income)}, ניכויים ${fmt(d.ded)}, נטו ${fmt(d.income - d.ded)}`),
    "",
    "-- הכנסות בפירוט --",
    ...incomes.map(i =>
      `[${i.date}] ${i.entryType === "income" ? "הכנסה" : "ניכוי"} | ${i.description.split("\n\n")[0]} | ${fmt(parseFloat(i.amount))}`),
    "",
    "-- קופות (תקציב vs הוצאה) --",
    ...funds.map(f => {
      const b = budgets.find(x => x.fundId === f.id);
      const budget = b ? parseFloat(b.amount) : 0;
      const spent  = byFund[f.name] ?? 0;
      return `${f.name}: תקציב ${fmt(budget)}, הוצא ${fmt(spent)}, יתרה ${fmt(budget - spent)}`;
    }),
    "",
    "-- הוצאות לפי קטגוריה --",
    ...Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c}: ${fmt(v)}`),
    "",
    "-- הוצאות בפירוט (מקוצר) --",
    ...expenses.map(e => {
      const fund = e.fundId ? (fundMap[e.fundId] ?? "?") : "-";
      const cat  = e.categoryId ? (catMap[e.categoryId] ?? "") : "";
      return `[${e.date}] ${e.description.split("\n\n")[0]} | ${fund}${cat ? "/" + cat : ""} | ${fmt(parseFloat(e.amount))}`;
    }),
    "",
    "-- חובות --",
    ...(debts.length === 0 ? ["אין"] : debts.map(d =>
      `${d.description} ${fmt(parseFloat(d.amount))} (${d.type === "owe" ? "חייבים לנו" : "אנחנו חייבים"})`)),
    "",
    "-- נכסים --",
    ...(assets.length === 0 ? ["אין"] : assets.map(a => {
      const bal = (latestBalances.rows as any[]).find((b: any) => b.asset_id === a.id);
      return `${a.name} | ${a.type}${bal ? " | " + fmt(parseFloat(bal.balance)) : ""}`;
    })),
  ];

  return lines.join("\n");
}

async function getApiKey(): Promise<string> {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  const rows = await db.select({ groqApiKey: systemSettingsTable.groqApiKey })
    .from(systemSettingsTable).where(eq(systemSettingsTable.userId, DEFAULT_USER_ID));
  return rows[0]?.groqApiKey ?? "";
}

// POST /api/agent/key — save API key to DB
router.post("/key", async (req: any, res) => {
  const { key } = req.body as { key: string };
  if (!key?.trim()) { res.status(400).json({ error: "key is required" }); return; }
  try {
    const rows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.userId, DEFAULT_USER_ID));
    if (rows.length === 0) {
      await db.insert(systemSettingsTable).values({ userId: DEFAULT_USER_ID, groqApiKey: key.trim() });
    } else {
      await db.update(systemSettingsTable).set({ groqApiKey: key.trim(), updatedAt: new Date() }).where(eq(systemSettingsTable.userId, DEFAULT_USER_ID));
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/chat — streaming SSE via Groq
router.post("/chat", async (req: any, res) => {
  const apiKey = await getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "GROQ_API_KEY לא מוגדר." });
    return;
  }

  const { message, history = [] } = req.body as { message: string; history: { role: string; content: string }[] };
  if (!message) { res.status(400).json({ error: "message is required" }); return; }

  const budgetYearId = getBYID(req);
  let context = "";
  try {
    context = await buildContext(budgetYearId);
  } catch (err) {
    req.log.error({ err }, "Failed to build context");
  }

  const systemPrompt = `אתה סוכן פיננסי חכם של משפחת אוסטרוב. אתה עוזר לנתח ולהבין את מצב התקציב המשפחתי.

חוקים חשובים:
1. ענה תמיד בעברית.
2. שאלות מידע וניתוח — ענה מיד וישירות, ללא כל בקשת אישור.
3. הוראות לביצוע פעולה (הוספת רשומה, עדכון, מחיקה) — לפני הביצוע פרט את כל פרטי הפעולה ובקש אישור מפורש. נוסח: "⚠️ לפני שאבצע, בוא נוודא: [פרטי הפעולה המלאים]. האם לאשר?"
4. כשאתה מבצע חישובים, הצג את התוצאות בצורה מסודרת.

הנה כל נתוני התקציב העדכניים:
${context}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h: any) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        stream: true,
        max_completion_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      res.write(`data: ${JSON.stringify({ error: `Groq error: ${err}` })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const parsed = JSON.parse(json);
          const text = parsed?.choices?.[0]?.delta?.content;
          if (text) {
            res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
          }
        } catch { /* skip malformed */ }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    req.log.error({ err }, "Agent chat error");
    res.write(`data: ${JSON.stringify({ error: err.message ?? "שגיאה" })}\n\n`);
    res.end();
  }
});

// GET /api/agent/status — check if key is configured
router.get("/status", async (_req, res) => {
  const key = await getApiKey();
  res.json({ configured: !!key });
});

export default router;
