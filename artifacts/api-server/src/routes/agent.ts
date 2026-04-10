import { Router } from "express";
import { db, expensesTable, incomesTable, fundsTable, categoriesTable, netWorthRecordsTable, netWorthItemsTable, systemSettingsTable, budgetYearsTable, cashEnvelopeTransactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();
const DEFAULT_USER_ID = 1;
const DEFAULT_BUDGET_YEAR_ID = 1;

function getBYID(req: any): number {
  const b = parseInt(String(req.query.bid));
  return isNaN(b) ? DEFAULT_BUDGET_YEAR_ID : b;
}

function fmt(n: number) { return `₪${Math.round(n).toLocaleString("he-IL")}`; }

async function buildContext(budgetYearId: number): Promise<string> {
  const [expenses, incomes, funds, categories, nwRecords, nwItems, budgetYears, cashTxns] = await Promise.all([
    db.select().from(expensesTable).where(and(eq(expensesTable.userId, DEFAULT_USER_ID), eq(expensesTable.budgetYearId, budgetYearId))).orderBy(desc(expensesTable.date)),
    db.select().from(incomesTable).where(and(eq(incomesTable.userId, DEFAULT_USER_ID), eq(incomesTable.budgetYearId, budgetYearId))).orderBy(desc(incomesTable.date)),
    db.select().from(fundsTable).where(eq(fundsTable.userId, DEFAULT_USER_ID)).orderBy(fundsTable.displayOrder),
    db.select().from(categoriesTable).where(eq(categoriesTable.userId, DEFAULT_USER_ID)),
    db.select().from(netWorthRecordsTable).where(eq(netWorthRecordsTable.userId, DEFAULT_USER_ID)).orderBy(desc(netWorthRecordsTable.recordedAt)),
    db.select().from(netWorthItemsTable),
    db.select().from(budgetYearsTable).where(eq(budgetYearsTable.id, budgetYearId)),
    db.select().from(cashEnvelopeTransactionsTable).where(and(eq(cashEnvelopeTransactionsTable.userId, DEFAULT_USER_ID), eq(cashEnvelopeTransactionsTable.budgetYearId, budgetYearId))),
  ]);

  const budgetYearName = budgetYears[0]?.name ?? `שנה ${budgetYearId}`;

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

  // ── expenses by month ──
  const byMonth: Record<string, number> = {};
  for (const e of expenses) {
    const m = e.date.substring(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + parseFloat(e.amount);
  }

  const lines: string[] = [
    `=== ${budgetYearName} ===`,
    `סה"כ הכנסות: ${fmt(totalIncome)} | ניכויים: ${fmt(totalDeductions)} | נטו: ${fmt(totalIncome - totalDeductions)}`,
    `סה"כ הוצאות: ${fmt(totalExpenses)} | יתרה: ${fmt(totalIncome - totalDeductions - totalExpenses)}`,
    "",
    "-- הוצאות לפי קטגוריה (סיכום שנתי) --",
    ...(Object.entries(byCat).length === 0
      ? ["אין נתוני קטגוריות"]
      : Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `  ${c}: ${fmt(v)}`)),
    "",
    "-- קופות (תקציב vs הוצאה) --",
    ...funds.map(f => {
      const annual  = parseFloat(f.annualAllocation ?? "0");
      const monthly = parseFloat(f.monthlyAllocation ?? "0");
      const budget  = annual > 0 ? annual : monthly * 12;
      const spent   = byFund[f.name] ?? 0;
      const tag     = monthly > 0 && annual === 0 ? ` (חודשי: ${fmt(monthly)})` : "";
      return `  ${f.name}: תקציב שנתי ${fmt(budget)}${tag}, הוצא ${fmt(spent)}, יתרה ${fmt(budget - spent)}`;
    }),
    "",
    "-- קופות מזומן (ניתן ונותר לתת) --",
    ...(() => {
      const byCash: Record<number, { deposited: number; withdrawn: number }> = {};
      for (const t of cashTxns) {
        if (!byCash[t.fundId]) byCash[t.fundId] = { deposited: 0, withdrawn: 0 };
        if (t.type === "deposit")    byCash[t.fundId].deposited  += parseFloat(t.amount);
        if (t.type === "withdrawal") byCash[t.fundId].withdrawn  += parseFloat(t.amount);
      }
      if (Object.keys(byCash).length === 0) return ["  אין נתוני מזומן"];
      return Object.entries(byCash).map(([fid, d]) => {
        const name = fundMap[Number(fid)] ?? `קופה ${fid}`;
        const balance = d.deposited - d.withdrawn;
        return `  ${name}: הופקד ${fmt(d.deposited)}, ניתן ${fmt(d.withdrawn)}, נותר ${fmt(balance)}`;
      });
    })(),
    "",
    "-- הכנסות לפי חודש --",
    ...Object.entries(incomeByMonth).sort().map(([m, d]) =>
      `  ${m}: הכנסות ${fmt(d.income)}, ניכויים ${fmt(d.ded)}, נטו ${fmt(d.income - d.ded)}`),
    "",
    "-- הוצאות לפי חודש --",
    ...Object.entries(byMonth).sort().map(([m, v]) => `  ${m}: ${fmt(v)}`),
    "",
    "-- הוצאות בפירוט --",
    ...expenses.slice(0, 80).map(e => {
      const fund = e.fundId ? (fundMap[e.fundId] ?? "?") : "-";
      const cat  = e.categoryId ? (catMap[e.categoryId] ?? "") : "";
      return `  [${e.date}] ${e.description.split("\n\n")[0]} | ${fund}${cat ? "/" + cat : ""} | ${fmt(parseFloat(e.amount))}`;
    }),
    "",
    "-- שווי נקי (עדכון אחרון) --",
    ...(nwRecords.length === 0 ? ["  אין רשומות"] : (() => {
      const latest = nwRecords[0];
      const items = nwItems.filter(i => i.recordId === latest.id);
      const savings = items.filter(i => i.type === "saving");
      const debts   = items.filter(i => i.type === "debt");
      const totalSavings = savings.reduce((s, i) => s + parseFloat(i.amount), 0);
      const totalDebts   = debts.reduce((s, i) => s + parseFloat(i.amount), 0);
      return [
        `  תאריך עדכון: ${latest.recordedAt}`,
        `  סה"כ חסכונות: ${fmt(totalSavings)}`,
        ...savings.map(i => `    - ${i.name}: ${fmt(parseFloat(i.amount))}`),
        `  סה"כ התחייבויות: ${fmt(totalDebts)}`,
        ...debts.map(i => `    - ${i.name}: ${fmt(parseFloat(i.amount))}`),
        `  שווי נקי: ${fmt(totalSavings - totalDebts)}`,
      ];
    })()),
    "",
    "-- היסטוריית שווי נקי --",
    ...nwRecords.slice(0, 6).map(r => {
      const items = nwItems.filter(i => i.recordId === r.id);
      const s = items.filter(i => i.type === "saving").reduce((t, i) => t + parseFloat(i.amount), 0);
      const d = items.filter(i => i.type === "debt").reduce((t, i) => t + parseFloat(i.amount), 0);
      return `  ${r.recordedAt}: חסכונות ${fmt(s)}, התחייבויות ${fmt(d)}, נקי ${fmt(s - d)}`;
    }),
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

  const systemPrompt = `אתה סוכן פיננסי חכם של משפחת אוסטרוב. כל הנתונים הדרושים לך נמצאים בהקשר למטה.

חוקים מחייבים:
1. ענה תמיד בעברית.
2. לשאלות על נתונים — חפש תשובה בהקשר ותן אותה מיד. אסור לבקש מהמשתמש נתונים שכבר קיימים בהקשר.
   - שאלות על ביגוד → חפש בסעיף "הוצאות לפי קטגוריה": ביגוד יוסי + ביגוד נעמי + ביגוד ילדים
   - שאלות על הכנסות → חפש בסעיף "הכנסות לפי חודש"
   - שאלות על קופה → חפש בסעיף "קופות"
3. לפעולות כתיבה (הוספה/עדכון/מחיקה) — פרט את הפעולה ובקש אישור לפני ביצוע.
4. בחישובים — הצג פירוט + סכום.

נתוני התקציב:
${context}

[סוף הנתונים — ענה על השאלה לפי הנתונים שלמעלה]`;

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
