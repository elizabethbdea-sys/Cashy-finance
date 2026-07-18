import { toMxn } from "./ledgerData.js";

const WEEKLY_DIVISORS = {
  weekly: 1,
  biweekly: 2,
  semimonthly: 2.1667,
  monthly: 4.3333,
  quarterly: 13,
  annual: 52,
  yearly: 52,
  one_time: 1
};

export function convertSetupToUpcomingBills(setupData, referenceDate = new Date()) {
  const fixedExpenseBills = (setupData.fixedExpenses ?? []).map((expense) => ({
    id: `fixed-${expense.id}`,
    name: expense.name,
    amount: Number(expense.amount) || 0,
    currency: expense.currency ?? "MXN",
    due_date: expense.due_date ?? nextDueDateFromDay(Number(expense.due_day), referenceDate),
    recurring: expense.cadence !== "one_time",
    source_type: "fixed_expense"
  }));

  const goalBills = getGoals(setupData).map((goal) => ({
    id: `goal-${goal.id}`,
    name: goal.name,
    amount: Math.max(0, (Number(goal.target_amount) || 0) - (Number(goal.amount_saved) || 0)),
    currency: goal.currency ?? "MXN",
    due_date: goal.target_date,
    recurring: false,
    source_type: "goal"
  }));

  return [...fixedExpenseBills, ...goalBills].filter((bill) => bill.amount > 0);
}

export function calculateSetupForecast(setupData, referenceDate = new Date()) {
  const settings = setupData.settings ?? { mxn_per_usd: 18.5 };
  const forecastIncome = (setupData.incomeSources ?? []).reduce(
    (total, source) => total + toWeeklyAmount(source.amount, source.cadence),
    0
  );
  const fixedSpend = (setupData.fixedExpenses ?? []).reduce(
    (total, expense) =>
      total + toWeeklyAmount(toMxn(expense.amount, expense.currency, settings), expense.cadence),
    0
  );
  const variableSpend = (setupData.variableExpenseCategories ?? []).reduce(
    (total, category) => total + toWeeklyAmount(category.estimated_amount, "monthly"),
    0
  );
  const goalSpend = getGoals(setupData).reduce(
    (total, goal) => total + weeklyGoalContribution(goal, referenceDate, settings),
    0
  );

  return {
    forecastIncome,
    forecastExpenses: fixedSpend + variableSpend + goalSpend,
    fixedSpend,
    variableSpend,
    goalSpend
  };
}

function getGoals(setupData) {
  return setupData.goals ?? setupData.goalsDebtsUpcomingExpenses ?? [];
}

export function toWeeklyAmount(amount, cadence = "monthly") {
  const divisor = WEEKLY_DIVISORS[cadence] ?? WEEKLY_DIVISORS.monthly;
  return (Number(amount) || 0) / divisor;
}

function weeklyGoalContribution(goal, referenceDate, settings) {
  const remaining = Math.max(
    0,
    toMxn(goal.target_amount, goal.currency, settings) - toMxn(goal.amount_saved, goal.currency, settings)
  );
  if (remaining === 0 || !goal.target_date) {
    return 0;
  }

  const targetDate = new Date(`${goal.target_date}T00:00:00`);
  const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksRemaining = Math.max(
    1,
    Math.ceil((targetDate.getTime() - referenceDate.getTime()) / millisecondsPerWeek)
  );

  return remaining / weeksRemaining;
}

function nextDueDateFromDay(dueDay, referenceDate) {
  const safeDueDay = Math.min(31, Math.max(1, dueDay || 1));
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const dueThisMonth = buildDate(year, month, safeDueDay);

  if (dueThisMonth >= startOfDay(referenceDate)) {
    return formatDate(dueThisMonth);
  }

  return formatDate(buildDate(year, month + 1, safeDueDay));
}

function buildDate(year, month, day) {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDayOfMonth));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
