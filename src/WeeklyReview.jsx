import React, { useState } from "react";

import { buildWeeklyReview } from "./weeklyReview.js";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

export default function WeeklyReview({ setupData, transactions, onConfirmForecast }) {
  const review = buildWeeklyReview(setupData, transactions);
  const [nextWeekForecast, setNextWeekForecast] = useState(
    setupData.nextWeekForecast ?? review.nextWeekForecast
  );

  function updateForecast(field, value) {
    setNextWeekForecast((current) => ({
      ...current,
      [field]: Number(value)
    }));
  }

  return (
    <section aria-labelledby="weekly-review-title" style={{ marginTop: 32 }}>
      <h1 id="weekly-review-title">Weekly Review</h1>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th scope="col" style={{ padding: "6px 12px 6px 0", textAlign: "left" }}>Metric</th>
            <th scope="col" style={{ padding: "6px 12px", textAlign: "right" }}>Forecast</th>
            <th scope="col" style={{ padding: "6px 12px", textAlign: "right" }}>Actual</th>
            <th scope="col" style={{ padding: "6px 0 6px 12px", textAlign: "right" }}>Delta</th>
          </tr>
        </thead>
        <tbody>
          <ReviewRow
            label="Income"
            forecast={review.forecastIncome}
            actual={review.actualIncome}
            delta={review.incomeDelta}
          />
          <ReviewRow
            label="Expenses"
            forecast={review.forecastExpenses}
            actual={review.actualExpenses}
            delta={review.expenseDelta}
          />
        </tbody>
      </table>

      <fieldset style={{ border: "1px solid #ddd", marginTop: 16, padding: 16 }}>
        <legend>Next week's forecast</legend>
        <label>
          Income
          <input
            type="number"
            value={nextWeekForecast.income}
            onChange={(event) => updateForecast("income", event.target.value)}
            style={{ display: "block", marginBottom: 8 }}
          />
        </label>
        <label>
          Expenses
          <input
            type="number"
            value={nextWeekForecast.expenses}
            onChange={(event) => updateForecast("expenses", event.target.value)}
            style={{ display: "block", marginBottom: 8 }}
          />
        </label>
        <button type="button" onClick={() => onConfirmForecast(nextWeekForecast)}>
          Confirm next week
        </button>
      </fieldset>
    </section>
  );
}

function ReviewRow({ label, forecast, actual, delta }) {
  return (
    <tr>
      <td style={{ padding: "6px 12px 6px 0" }}>{label}</td>
      <td style={{ padding: "6px 12px", textAlign: "right" }}>
        {currencyFormatter.format(forecast)}
      </td>
      <td style={{ padding: "6px 12px", textAlign: "right" }}>
        {currencyFormatter.format(actual)}
      </td>
      <td style={{ padding: "6px 0 6px 12px", textAlign: "right" }}>
        {currencyFormatter.format(delta)}
      </td>
    </tr>
  );
}
