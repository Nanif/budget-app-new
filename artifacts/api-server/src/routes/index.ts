import { Router } from "express";
import healthRouter from "./health";
import expensesRouter from "./expenses";
import incomesRouter from "./incomes";
import charityRouter from "./charity";
import debtsRouter from "./debts";
import savingsRouter from "./savings";
import notesRouter from "./notes";
import remindersRouter from "./reminders";
import settingsRouter from "./settings";
import categoriesRouter from "./categories";
import noteTabsRouter from "./noteTabs";
import fundsRouter from "./funds";
import budgetYearRouter from "./budget-year";
import budgetYearsRouter from "./budgetYears";
import walletRouter from "./wallet";
import dashboardRouter from "./dashboard";

const router = Router();

router.use(healthRouter);
router.use("/expenses", expensesRouter);
router.use("/incomes", incomesRouter);
router.use("/charity", charityRouter);
router.use("/debts", debtsRouter);
router.use("/savings", savingsRouter);
router.use("/notes", notesRouter);
router.use("/reminders", remindersRouter);
router.use("/settings", settingsRouter);
router.use("/categories", categoriesRouter);
router.use("/note-tabs", noteTabsRouter);
router.use("/funds", fundsRouter);
router.use("/budget-year", budgetYearRouter);
router.use("/budget-years", budgetYearsRouter);
router.use("/wallet", walletRouter);
router.use("/dashboard", dashboardRouter);

export default router;
