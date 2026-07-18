import React, { useState } from "react";

import { processWeeklyReviewUnexpectedMessage } from "./ledgerChat.js";
import { buildWeeklyReview } from "./weeklyReview.js";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

export default function WeeklyReview({ setupData, transactions, onConfirmForecast, onLedgerChange }) {
  const review = buildWeeklyReview(setupData, transactions);
  const [nextWeekForecast, setNextWeekForecast] = useState(
    setupData.nextWeekForecast ?? review.nextWeekForecast
  );
  const [unexpectedText, setUnexpectedText] = useState("");
  const [unexpectedReply, setUnexpectedReply] = useState("");
  const [unexpectedError, setUnexpectedError] = useState("");

  function updateForecast(field, value) {
    setNextWeekForecast((current) => ({
      ...current,
      [field]: Number(value)
    }));
  }

  async function handleUnexpectedSubmit(event) {
    event.preventDefault();
    const trimmed = unexpectedText.trim();
    if (!trimmed) {
      return;
    }

    setUnexpectedError("");
    try {
      const result = await processWeeklyReviewUnexpectedMessage({
        message: trimmed,
        ledger: setupData
      });
      onLedgerChange?.(result.ledger);
      setUnexpectedReply(result.reply);
      setUnexpectedText("");
    } catch (error) {
      setUnexpectedError(
        error instanceof Error ? error.message : "Unable to process that unexpected item."
      );
    }
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

      <p>
        Balance at end of this week:{" "}
        <strong>{currencyFormatter.format(review.weeklyBalance.closing_balance)}</strong>
      </p>

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
        <button type="button" onClick={() => onConfirmForecast(nextWeekForecast, review.weeklyBalance)}>
          Confirm next week
        </button>
      </fieldset>

      <form onSubmit={handleUnexpectedSubmit} style={{ marginTop: 16 }}>
        <label htmlFor="unexpected-weekly-review">
          Anything unexpected this week — income or expenses you didn't plan for?
        </label>
        <textarea
          id="unexpected-weekly-review"
          value={unexpectedText}
          onChange={(event) => setUnexpectedText(event.target.value)}
          rows={3}
          style={{ boxSizing: "border-box", display: "block", marginTop: 8, width: "100%" }}
        />
        <button type="submit" style={{ marginTop: 8 }}>
          Add unexpected item
        </button>
        {unexpectedReply ? <p>{unexpectedReply}</p> : null}
        {unexpectedError ? <p role="alert">{unexpectedError}</p> : null}
      </form>
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
