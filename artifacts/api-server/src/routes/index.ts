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
router.use("/dashboard", dashboardRouter);

export default router;
