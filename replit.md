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
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind + shadcn/ui + RTL + Hebrew

## Project: ניהול תקציב אישי (Personal Budget Manager)

A full Hebrew RTL personal budget management web app with 10 modules:
1. דף בית (Home) - Comprehensive home dashboard with 4 widgets: מעשרות, חובות, תזכורות, פתקים; quick-add for tasks & charity
2. דשבורד (Dashboard) - Full annual budget dashboard: KPI cards, monthly area chart, fund status, category pie, annual summary, anomaly detection
3. הוצאות (Expenses) - Full CRUD expense tracking
4. הכנסות (Incomes) - Full CRUD income tracking
5. צדקה ומעשרות (Charity) - Charitable giving tracker
6. חובות (Debts) - Debt management (owed/owing)
7. חסכונות ונכסים (Savings) - Savings goals and assets
8. פתקים (Notes) - Sticky notes
9. תזכורות ומשימות (Reminders) - Task manager with priorities
10. הגדרות (Settings) - User preferences

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── budget-app/         # React+Vite frontend (previewPath: "/")
│   └── api-server/         # Express API server
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

Tables: `expenses`, `incomes`, `charity`, `debts`, `savings`, `notes`, `reminders`, `settings`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/budget-app` (`@workspace/budget-app`)

React + Vite frontend. Full Hebrew RTL. Pages in `src/pages/`, components in `src/components/`.
Key dependencies: recharts, lucide-react, framer-motion, date-fns, wouter, @tanstack/react-query, shadcn/ui

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/` for all 10 budget modules + dashboard.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Schema files for all budget tables.
- `pnpm --filter @workspace/db run push` — push schema to DB

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec with full budget management API. Run codegen:
- `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` / `lib/api-client-react`

Generated Zod schemas and React Query hooks from the OpenAPI spec.
