/**
 * API Router — all routes registered here.
 *
 * Route map:
 *
 *  Auth
 *    /auth                → auth.ts            (GET /me, POST /login, POST /logout)
 *
 *  Budget years
 *    /budget-years        → budgetYears.ts     (CRUD + POST/:id/activate)
 *    /budget-year         → budget-year.ts     (GET/PUT single-year settings)
 *
 *  Funds & budgets
 *    /funds               → funds.ts           (CRUD, PATCH toggle, PATCH reorder)
 *    /fund-budgets        → fundBudgets.ts     (CRUD — per-fund monthly overrides)
 *
 *  Transactions
 *    /expenses            → expenses.ts        (CRUD, GET /by-fund, GET /summary)
 *    /incomes             → incomes.ts         (CRUD, GET /summary)
 *    /wallet              → wallet.ts          (cash_envelope_transactions: CRUD, GET /summary)
 *    /cash-transactions   → wallet.ts          (alias for /wallet)
 *
 *  Charity / tithe
 *    /charity             → charity.ts         (CRUD — tithe_given table)
 *    /tithe-given         → charity.ts         (alias for /charity)
 *
 *  Debts
 *    /debts               → debts.ts           (CRUD)
 *
 *  Assets & balances
 *    /savings             → savings.ts         (assets table CRUD)
 *    /assets              → savings.ts         (alias for /savings)
 *    /asset-balances      → assetBalances.ts   (balance snapshots CRUD, GET /latest)
 *
 *  Categories
 *    /categories          → categories.ts      (CRUD)
 *
 *  Notes
 *    /notes               → notes.ts           (CRUD)
 *    /note-tabs           → noteTabs.ts        (CRUD)
 *
 *  Tasks / reminders
 *    /reminders           → reminders.ts       (tasks table CRUD)
 *    /tasks               → reminders.ts       (alias for /reminders)
 *
 *  Dashboard
 *    /dashboard           → dashboard.ts       (GET /summary, GET /annual)
 *
 *  Settings
 *    /settings            → settings.ts        (GET/PUT system settings)
 *
 *  Health
 *    /health              → health.ts          (GET /health)
 */
import { Router } from "express";

import healthRouter        from "./health";
import authRouter          from "./auth";
import budgetYearsRouter   from "./budgetYears";
import budgetYearRouter    from "./budget-year";
import fundsRouter         from "./funds";
import fundBudgetsRouter   from "./fundBudgets";
import expensesRouter      from "./expenses";
import incomesRouter       from "./incomes";
import walletRouter        from "./wallet";
import charityRouter       from "./charity";
import debtsRouter         from "./debts";
import savingsRouter       from "./savings";
import assetBalancesRouter from "./assetBalances";
import categoriesRouter    from "./categories";
import notesRouter         from "./notes";
import noteTabsRouter      from "./noteTabs";
import remindersRouter     from "./reminders";
import dashboardRouter     from "./dashboard";
import settingsRouter      from "./settings";
import fixedItemsRouter    from "./fixedItems";
import devRouter           from "./dev";

const router = Router();

// Health
router.use(healthRouter);

// Auth
router.use("/auth", authRouter);

// Budget years
router.use("/budget-years", budgetYearsRouter);
router.use("/budget-year",  budgetYearRouter);

// Funds & monthly budgets
router.use("/funds",        fundsRouter);
router.use("/fund-budgets", fundBudgetsRouter);

// Transactions
router.use("/expenses",          expensesRouter);
router.use("/incomes",           incomesRouter);
router.use("/wallet",            walletRouter);
router.use("/cash-transactions", walletRouter);   // alias

// Charity / tithe
router.use("/charity",     charityRouter);
router.use("/tithe-given", charityRouter);        // alias

// Debts
router.use("/debts", debtsRouter);

// Assets & balance history
router.use("/savings",        savingsRouter);
router.use("/assets",         savingsRouter);     // alias
router.use("/asset-balances", assetBalancesRouter);

// Categories
router.use("/categories", categoriesRouter);

// Notes
router.use("/notes",     notesRouter);
router.use("/note-tabs", noteTabsRouter);

// Tasks
router.use("/reminders", remindersRouter);
router.use("/tasks",     remindersRouter);        // alias

// Dashboard & analytics
router.use("/dashboard", dashboardRouter);

// Fixed items (קבועות)
router.use("/fixed-items", fixedItemsRouter);

// Settings
router.use("/settings", settingsRouter);

// Dev panel (file viewer + DB viewer)
router.use("/dev", devRouter);

export default router;
