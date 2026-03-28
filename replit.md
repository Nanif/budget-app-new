# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind + shadcn/ui + RTL + Hebrew

## Project: ניהול תקציב אישי (Personal Budget Manager)

A full Hebrew RTL personal budget management web app built around the user's specific budget workflow.

### Fund Behavior System (5 types)
1. `fixed_monthly` — קבועות: fixed monthly expenses, framework only
2. `cash_monthly` — שוטף: monthly cash envelope, deposit-tracking wallet
3. `annual_categorized` — מעגל השנה: annual budget with category tracking
4. `annual_large` — הוצאות גדולות: large purchases, annual budget
5. `non_budget` — קופות חיצוניות: off-budget funds with depleting initial balance

### Page/Route Structure
| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Dashboard — fund status overview |
| `/budget` | Budget | Annual budget setup, fund definitions |
| `/cash` | CashWallet | Monthly cash wallet deposits/withdrawals |
| `/annual` | AnnualExpenses | מעגל השנה with categories |
| `/large` | LargeExpenses | Large purchase tracking |
| `/external` | ExternalFunds | Off-budget (non_budget) funds |
| `/incomes` | Incomes | Income + work deductions (net income) |
| `/charity` | Charity | Tithe/charity with % of net income |
| `/debts` | Debts | Debt management |
| `/savings` | Savings | Savings goals and assets |
| `/notes` | Notes | Sticky notes with tabs |
| `/reminders` | Reminders | Task/reminder manager |
| `/categories` | Categories | Expense categories |
| `/settings` | Settings | System settings |

### Key Architecture Decisions
- **Single user**: All routes hardcode `DEFAULT_USER_ID = 1`, `DEFAULT_BUDGET_YEAR_ID = 1`
- **Numeric fields**: Drizzle `numeric()` returns strings — always `parseFloat()` in frontend
- **API base**: API server on port 8080, Vite dev at 24432 (nginx proxy at 80)
- **DB migrations**: Direct SQL `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- **Wallet**: `cashEnvelopeTransactionsTable` stores deposits/withdrawals for `cash_monthly` funds

### API Routes
- `GET/PUT /api/budget-year` — budget year config (totalBudget, tithePercentage)
- `GET /api/funds?all=true` — all funds (active + inactive)
- `GET /api/wallet?month=YYYY-MM&fundId=N` — wallet transactions + totals
- `POST /api/wallet` — add wallet transaction (type: deposit|withdrawal)
- `DELETE /api/wallet/:id` — delete transaction
- `GET /api/expenses?fundId=N` — expenses filtered by fund
- `GET /api/expenses/summary?fundId=N` — total + byCategory breakdown
- `GET /api/incomes/summary` — totalIncome, totalDeductions, netIncome
- `GET /api/charity` — all charity/tithe entries

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── budget-app/         # React+Vite frontend (previewPath: "/")
│   └── api-server/         # Express API server
├── lib/
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## DB Schema (key tables)

- `budget_years`: id, name, totalBudget, tithePercentage
- `funds`: id, name, fundBehavior, colorClass, monthlyAllocation, annualAllocation, initialBalance, includeInBudget, displayOrder
- `incomes`: id, amount, source, description, date, entryType (income|work_deduction)
- `expenses`: id, amount, description, date, fundId, categoryId, paymentMethod
- `cash_envelope_transactions`: id, fundId, type (deposit|withdrawal), amount, date, description
- `charity`: id, amount, recipient, description, date, isTithe

## Development

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/budget-app run dev

# DB connection
DATABASE_URL env var (auto-configured by Replit)
```

## Ports

- API server: process.env.PORT (assigned by Replit)
- Frontend: process.env.PORT (assigned by Replit)
- Both proxied through nginx at port 80
