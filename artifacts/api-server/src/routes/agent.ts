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

async function buildContext(budgetYearId: number): Promise<string> {
  const [expenses, incomes, funds, budgets, categories, debts, assets, latestBalances] = await Promise.all([
    db.select().from(expensesTable).where(and(eq(expensesTable.userId, DEFAULT_USER_ID), eq(expensesTable.budgetYearId, budgetYearId))).orderBy(desc(expensesTable.date)),
    db.select().from(incomesTable).where(and(eq(incomesTable.userId, DEFAULT_USER_ID), eq(incomesTable.budgetYearId, budgetYearId))).orderBy(desc(incomesTable.date)),
    db.select().from(fundsTable).where(eq(fundsTable.userId, DEFAULT_USER_ID)).orderBy(fundsTable.sortOrder),
    db.select().from(fundBudgetsTable).where(eq(fundBudgetsTable.budgetYearId, budgetYearId)),
    db.select().from(categoriesTable).where(eq(categoriesTable.userId, DEFAULT_USER_ID)),
    db.select().from(debtsTable).where(eq(debtsTable.userId, DEFAULT_USER_ID)),
    db.select().from(assetsTable).where(eq(assetsTable.userId, DEFAULT_USER_ID)),
    db.execute(sql`
      SELECT DISTINCT ON (asset_id) *
      FROM asset_balances
      ORDER BY asset_id, date DESC
    `),
  ]);

  const totalIncome = incomes.filter(i => i.entryType === "income").reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalDeductions = incomes.filter(i => i.entryType === "work_deduction").reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);

  const fundMap = Object.fromEntries(funds.map(f => [f.id, f.name]));
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  const expensesByFund: Record<string, number> = {};
  for (const e of expenses) {
    const name = e.fundId ? (fundMap[e.fundId] ?? "לא ידוע") : "ללא קופה";
    expensesByFund[name] = (expensesByFund[name] ?? 0) + parseFloat(e.amount);
  }

  const lines: string[] = [
    "=== נתוני תקציב משפחת אוסטרוב 2026 ===",
    "",
    `סה"כ הכנסות: ₪${totalIncome.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`,
    `סה"כ ניכויי הוצאות עבודה: ₪${totalDeductions.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`,
    `הכנסה נטו: ₪${(totalIncome - totalDeductions).toLocaleString("he-IL", { maximumFractionDigits: 0 })}`,
    `סה"כ הוצאות: ₪${totalExpenses.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`,
    "",
    "--- הכנסות לפי חודש ---",
  ];

  const incomeByMonth: Record<string, { income: number; deduction: number }> = {};
  for (const i of incomes) {
    const month = i.date.substring(0, 7);
    if (!incomeByMonth[month]) incomeByMonth[month] = { income: 0, deduction: 0 };
    if (i.entryType === "income") incomeByMonth[month].income += parseFloat(i.amount);
    else incomeByMonth[month].deduction += parseFloat(i.amount);
  }
  for (const [month, data] of Object.entries(incomeByMonth).sort()) {
    lines.push(`  ${month}: הכנסות ₪${data.income.toLocaleString("he-IL", { maximumFractionDigits: 0 })}, ניכויים ₪${data.deduction.toLocaleString("he-IL", { maximumFractionDigits: 0 })}, נטו ₪${(data.income - data.deduction).toLocaleString("he-IL", { maximumFractionDigits: 0 })}`);
  }

  lines.push("", "--- הכנסות בפירוט ---");
  for (const i of incomes) {
    const desc = i.description.split("\n\n")[0];
    const type = i.entryType === "income" ? "הכנסה" : "ניכוי";
    lines.push(`  [${i.date}] ${type} | ${desc} | ₪${parseFloat(i.amount).toLocaleString("he-IL", { maximumFractionDigits: 0 })}`);
  }

  lines.push("", "--- קופות ותקציב ---");
  for (const f of funds) {
    const fundBudget = budgets.find(b => b.fundId === f.id);
    const spent = expensesByFund[f.name] ?? 0;
    const budget = fundBudget ? parseFloat(fundBudget.amount) : 0;
    lines.push(`  ${f.name} | תקציב ₪${budget.toLocaleString("he-IL", { maximumFractionDigits: 0 })} | הוצא ₪${spent.toLocaleString("he-IL", { maximumFractionDigits: 0 })} | יתרה ₪${(budget - spent).toLocaleString("he-IL", { maximumFractionDigits: 0 })}`);
  }

  lines.push("", "--- הוצאות לפי קופה ---");
  for (const [fundName, amount] of Object.entries(expensesByFund).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${fundName}: ₪${amount.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`);
  }

  lines.push("", "--- הוצאות בפירוט ---");
  for (const e of expenses) {
    const desc = e.description.split("\n\n")[0];
    const fund = e.fundId ? (fundMap[e.fundId] ?? "לא ידוע") : "ללא קופה";
    const cat = e.categoryId ? (catMap[e.categoryId] ?? "") : "";
    const notes = e.description.includes("\n\n") ? ` | הערה: ${e.description.split("\n\n")[1]}` : "";
    lines.push(`  [${e.date}] ${desc} | קופה: ${fund}${cat ? ` | קטגוריה: ${cat}` : ""} | ₪${parseFloat(e.amount).toLocaleString("he-IL", { maximumFractionDigits: 0 })}${notes}`);
  }

  lines.push("", "--- חובות ---");
  if (debts.length === 0) lines.push("  אין חובות");
  for (const d of debts) {
    lines.push(`  ${d.description} | ₪${parseFloat(d.amount).toLocaleString("he-IL", { maximumFractionDigits: 0 })} | ${d.type === "owe" ? "חייבים לנו" : "אנחנו חייבים"}`);
  }

  lines.push("", "--- נכסים והתחייבויות ---");
  if (assets.length === 0) lines.push("  אין נכסים");
  for (const a of assets) {
    const bal = (latestBalances.rows as any[]).find((b: any) => b.asset_id === a.id);
    const balStr = bal ? ` | יתרה נוכחית: ₪${parseFloat(bal.balance).toLocaleString("he-IL", { maximumFractionDigits: 0 })}` : "";
    lines.push(`  ${a.name} | ${a.type}${balStr}`);
  }

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
2. כאשר מבקשים ממך לבצע פעולה (הוספה, עדכון, מחיקה) — ציין בדיוק מה אתה מתכוון לעשות ובקש אישור מפורש לפני הביצוע. תגיד: "⚠️ לפני שאבצע, בוא נוודא: [פרטי הפעולה המלאים]. האם לאשר?"
3. אתה יכול לענות על שאלות ולנתח נתונים בחופשיות.
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
        max_completion_tokens: 8192,
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
