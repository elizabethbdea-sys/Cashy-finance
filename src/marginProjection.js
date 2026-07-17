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

function getSortableDueTime(dueDate) {
  if (!dueDate) {
    return Number.POSITIVE_INFINITY;
  }

  const time = new Date(`${dueDate}T00:00:00`).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}
