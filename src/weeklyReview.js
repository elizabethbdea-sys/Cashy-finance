import { calculateSetupForecast } from "./setupProjection.js";

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

  return {
    forecastIncome: forecast.forecastIncome,
    forecastExpenses: forecast.forecastExpenses,
    actualIncome: actuals.actualIncome,
    actualExpenses: actuals.actualExpenses,
    incomeDelta: actuals.actualIncome - forecast.forecastIncome,
    expenseDelta: actuals.actualExpenses - forecast.forecastExpenses,
    nextWeekForecast: {
      income: actuals.actualIncome || forecast.forecastIncome,
      expenses: actuals.actualExpenses || forecast.forecastExpenses
    }
  };
}
