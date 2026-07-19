import { toMxn } from "./ledgerData.js";

const SPEND_CATEGORIES = new Set(["fixed_expense", "variable_expense"]);

/**
 * @typedef {object} Transaction
 * @property {number} amount
 * @property {"income" | "fixed_expense" | "variable_expense" | "internal_transfer"} category
 *
 * @typedef {object} UpcomingBill
 * @property {string} id
 * @property {string} name
 * @property {number} amount
 * @property {string} due_date
 * @property {boolean} recurring
 */

/**
 * Calculate real income, real spend, upcoming bills, and projected margin.
 *
 * The caller should already exclude internal transfers, but this function also
 * ignores them defensively so own-account movement never affects the margin.
 *
 * @param {Transaction[]} transactions
 * @param {UpcomingBill[]} upcomingBills
 * @param {{ mxn_per_usd?: number }} settings
 */
export function calculateMarginProjection(transactions = [], upcomingBills = [], settings = { mxn_per_usd: 18.5 }) {
  const normalizedTransactions = Array.isArray(transactions) ? transactions : [];
  const normalizedUpcomingBills = Array.isArray(upcomingBills) ? upcomingBills : [];

  const realIncome = normalizedTransactions
    .filter((transaction) => transaction.category === "income")
    .reduce(
      (total, transaction) => total + Math.abs(toMxn(transaction.amount, transaction.currency, settings)),
      0
    );

  const realSpend = normalizedTransactions
    .filter((transaction) => SPEND_CATEGORIES.has(transaction.category))
    .reduce(
      (total, transaction) => total + Math.abs(toMxn(transaction.amount, transaction.currency, settings)),
      0
    );

  const sortedUpcomingBills = [...normalizedUpcomingBills].sort(
    (left, right) => getSortableDueTime(left.due_date) - getSortableDueTime(right.due_date)
  );

  const upcomingBillsTotal = sortedUpcomingBills.reduce(
    (total, bill) => total + Math.abs(toMxn(bill.amount, bill.currency, settings)),
    0
  );

  return {
    realIncome,
    realSpend,
    upcomingBillsTotal,
    projectedMargin: realIncome - realSpend - upcomingBillsTotal,
    upcomingBills: sortedUpcomingBills
  };
}

export function calculateFinancialRunway({
  projection,
  currentBalance,
  cushionPreference,
  settings = { mxn_per_usd: 18.5 },
  periodDays = 7
} = {}) {
  if (!projection || !currentBalance || !cushionPreference) {
    return null;
  }

  const balanceMxn = toMxn(currentBalance.amount, currentBalance.currency, settings);
  const cushionMxn = toMxn(cushionPreference.amount, cushionPreference.currency, settings);
  const periodBurn = Math.max(0, -projection.projectedMargin);

  if (balanceMxn <= cushionMxn) {
    return {
      daysUntilCushion: 0,
      willHitCushion: true
    };
  }

  if (periodBurn <= 0) {
    return {
      daysUntilCushion: null,
      willHitCushion: false
    };
  }

  return {
    daysUntilCushion: Math.ceil((balanceMxn - cushionMxn) / (periodBurn / periodDays)),
    willHitCushion: true
  };
}

export function ledgerToProjectionTransactions(ledger = {}) {
  return [
    ...ledgerIncomeEventsToTransactions(ledger.incomeEvents),
    ...ledgerExpensesToTransactions(ledger.fixedExpenses, "fixed_expense"),
    ...ledgerExpensesToTransactions(ledger.debts, "fixed_expense")
  ];
}

function getSortableDueTime(dueDate) {
  if (!dueDate) {
    return Number.POSITIVE_INFINITY;
  }

  const time = new Date(`${dueDate}T00:00:00`).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function ledgerIncomeEventsToTransactions(incomeEvents) {
  if (!Array.isArray(incomeEvents)) {
    return [];
  }

  return incomeEvents
    .filter((event) => event.confidence === "confirmed")
    .map((event) => ({
      id: `ledger-income-${event.id}`,
      description: event.source,
      amount: Number(event.expected_amount) || 0,
      currency: event.currency ?? "MXN",
      category: "income",
      source_type: "ledger_income_event"
    }));
}

function ledgerExpensesToTransactions(expenses, category) {
  if (!Array.isArray(expenses)) {
    return [];
  }

  return expenses
    .filter((expense) => expense.type === "regular")
    .filter((expense) => expense.confidence === undefined || expense.confidence === "confirmed")
    .map((expense) => ({
      id: `ledger-expense-${expense.id}`,
      description: expense.name,
      amount: -(Number(expense.amount) || 0),
      currency: expense.currency ?? "MXN",
      category,
      source_type: "ledger_expense"
    }));
}
