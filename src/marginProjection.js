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
 */
export function calculateMarginProjection(transactions, upcomingBills = []) {
  const realIncome = transactions
    .filter((transaction) => transaction.category === "income")
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);

  const realSpend = transactions
    .filter((transaction) => SPEND_CATEGORIES.has(transaction.category))
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);

  const sortedUpcomingBills = [...upcomingBills].sort(
    (left, right) => new Date(left.due_date).getTime() - new Date(right.due_date).getTime()
  );

  const upcomingBillsTotal = sortedUpcomingBills.reduce(
    (total, bill) => total + Math.abs(bill.amount),
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
