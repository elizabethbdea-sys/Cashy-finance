import { calculateSetupForecast } from "./setupProjection.js";
import { toMxn } from "./ledgerData.js";

export function calculateActuals(transactions) {
  return transactions.reduce(
    (totals, transaction) => {
      if (transaction.category === "income") {
        totals.actualIncome += Math.abs(transaction.amount);
      }

      if (transaction.category === "fixed_expense" || transaction.category === "variable_expense") {
        totals.actualExpenses += Math.abs(transaction.amount);
      }

      return totals;
    },
    { actualIncome: 0, actualExpenses: 0 }
  );
}

export function buildWeeklyReview(setupData, transactions, referenceDate = new Date()) {
  const forecast = calculateSetupForecast(setupData, referenceDate);
  const actuals = calculateActuals(transactions);
  const weeklyBalance = calculateWeeklyClosingBalance(setupData, transactions, referenceDate);

  return {
    forecastIncome: forecast.forecastIncome,
    forecastExpenses: forecast.forecastExpenses,
    actualIncome: actuals.actualIncome,
    actualExpenses: actuals.actualExpenses,
    incomeDelta: actuals.actualIncome - forecast.forecastIncome,
    expenseDelta: actuals.actualExpenses - forecast.forecastExpenses,
    weeklyBalance,
    nextWeekForecast: {
      income: actuals.actualIncome || forecast.forecastIncome,
      expenses: actuals.actualExpenses || forecast.forecastExpenses
    }
  };
}

export function calculateWeeklyClosingBalance(setupData, transactions = [], referenceDate = new Date()) {
  const settings = setupData.settings ?? { mxn_per_usd: 18.5 };
  const weekStart = startOfWeek(referenceDate);
  const weekEnd = addDays(weekStart, 6);
  const weekStartText = formatDate(weekStart);
  const previousBalance = getPreviousClosingBalance(setupData, weekStart);
  const income = datedIncomeForWeek(setupData, transactions, weekStart, weekEnd, settings);
  const expenses = datedExpensesForWeek(setupData, transactions, weekStart, weekEnd, settings);
  const closingBalance = previousBalance + income - expenses;

  return {
    week_start: weekStartText,
    week_end: formatDate(weekEnd),
    starting_balance: previousBalance,
    income,
    expenses,
    closing_balance: closingBalance,
    currency: setupData.currentBalance?.currency ?? "MXN"
  };
}

export function upsertWeeklyBalance(weeklyBalances = [], weeklyBalance) {
  const balances = Array.isArray(weeklyBalances) ? weeklyBalances : [];
  return [
    ...balances.filter((balance) => balance.week_start !== weeklyBalance.week_start),
    weeklyBalance
  ].sort((left, right) => left.week_start.localeCompare(right.week_start));
}

function getPreviousClosingBalance(setupData, weekStart) {
  const settings = setupData.settings ?? { mxn_per_usd: 18.5 };
  const previousBalances = (setupData.weeklyBalances ?? [])
    .filter((balance) => balance.week_start < formatDate(weekStart))
    .sort((left, right) => right.week_start.localeCompare(left.week_start));

  if (previousBalances.length > 0) {
    return Number(previousBalances[0].closing_balance) || 0;
  }

  return setupData.currentBalance
    ? toMxn(setupData.currentBalance.amount, setupData.currentBalance.currency, settings)
    : 0;
}

function datedIncomeForWeek(setupData, transactions, weekStart, weekEnd, settings) {
  const ledgerIncome = (setupData.incomeEvents ?? [])
    .filter((event) => event.expected_date && isWithinWeek(event.expected_date, weekStart, weekEnd))
    .reduce(
      (total, event) => total + toMxn(event.expected_amount, event.currency, settings),
      0
    );
  const transactionIncome = transactions
    .filter((transaction) => transaction.category === "income")
    .filter((transaction) => transaction.date && isWithinWeek(transaction.date, weekStart, weekEnd))
    .reduce((total, transaction) => total + toMxn(Math.abs(transaction.amount), transaction.currency, settings), 0);

  return ledgerIncome + transactionIncome;
}

function datedExpensesForWeek(setupData, transactions, weekStart, weekEnd, settings) {
  const fixedExpenses = (setupData.fixedExpenses ?? [])
    .filter((expense) => expense.due_date && isWithinWeek(expense.due_date, weekStart, weekEnd))
    .reduce((total, expense) => total + toMxn(expense.amount, expense.currency, settings), 0);
  const debts = (setupData.debts ?? [])
    .filter((debt) => debt.due_date && isWithinWeek(debt.due_date, weekStart, weekEnd))
    .reduce((total, debt) => total + toMxn(debt.amount, debt.currency, settings), 0);
  const transactionExpenses = transactions
    .filter((transaction) => transaction.category === "fixed_expense" || transaction.category === "variable_expense")
    .filter((transaction) => transaction.date && isWithinWeek(transaction.date, weekStart, weekEnd))
    .reduce((total, transaction) => total + toMxn(Math.abs(transaction.amount), transaction.currency, settings), 0);

  return fixedExpenses + debts + transactionExpenses;
}

function isWithinWeek(dateText, weekStart, weekEnd) {
  const date = parseLocalDate(dateText);
  return date >= weekStart && date <= weekEnd;
}

function startOfWeek(referenceDate) {
  const date = parseLocalDate(referenceDate);
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

function parseLocalDate(date) {
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  const [year, month, day] = String(date).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
