import React, { useState } from "react";

import { processWeeklyReviewUnexpectedMessage } from "./ledgerChat.js";
import { buildWeeklyReview } from "./weeklyReview.js";
import { getStrings } from "./i18n.js";

export default function WeeklyReview({ setupData, transactions, onConfirmForecast, onLedgerChange, language = "en" }) {
  const copy = getStrings(language);
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
        error instanceof Error ? error.message : copy.unexpectedError
      );
    }
  }

  return (
    <section aria-labelledby="weekly-review-title" style={{ marginTop: 32 }}>
      <h1 id="weekly-review-title">{copy.weeklyReview}</h1>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th scope="col" style={{ padding: "6px 12px 6px 0", textAlign: "left" }}>{copy.metric}</th>
            <th scope="col" style={{ padding: "6px 12px", textAlign: "right" }}>{copy.forecast}</th>
            <th scope="col" style={{ padding: "6px 12px", textAlign: "right" }}>{copy.actual}</th>
            <th scope="col" style={{ padding: "6px 0 6px 12px", textAlign: "right" }}>{copy.delta}</th>
          </tr>
        </thead>
        <tbody>
          <ReviewRow
            label={copy.income}
            forecast={review.forecastIncome}
            actual={review.actualIncome}
            delta={review.incomeDelta}
          />
          <ReviewRow
            label={copy.expenses}
            forecast={review.forecastExpenses}
            actual={review.actualExpenses}
            delta={review.expenseDelta}
          />
        </tbody>
      </table>

      <p>
        {copy.balanceAtEndOfWeek}{" "}
        <strong>{formatCurrency(review.weeklyBalance.closing_balance)}</strong>
      </p>

      <fieldset style={{ border: "1px solid #ddd", marginTop: 16, padding: 16 }}>
        <legend>{copy.nextWeekForecast}</legend>
        <label>
          {copy.income}
          <input
            type="number"
            value={nextWeekForecast.income}
            onChange={(event) => updateForecast("income", event.target.value)}
            style={{ display: "block", marginBottom: 8 }}
          />
        </label>
        <label>
          {copy.expenses}
          <input
            type="number"
            value={nextWeekForecast.expenses}
            onChange={(event) => updateForecast("expenses", event.target.value)}
            style={{ display: "block", marginBottom: 8 }}
          />
        </label>
        <button type="button" onClick={() => onConfirmForecast(nextWeekForecast, review.weeklyBalance)}>
          {copy.confirmNextWeek}
        </button>
      </fieldset>

      <form onSubmit={handleUnexpectedSubmit} style={{ marginTop: 16 }}>
        <label htmlFor="unexpected-weekly-review">
          {copy.unexpectedPrompt}
        </label>
        <textarea
          id="unexpected-weekly-review"
          value={unexpectedText}
          onChange={(event) => setUnexpectedText(event.target.value)}
          rows={3}
          style={{ boxSizing: "border-box", display: "block", marginTop: 8, width: "100%" }}
        />
        <button type="submit" style={{ marginTop: 8 }}>
          {copy.addUnexpectedItem}
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
        {formatCurrency(forecast)}
      </td>
      <td style={{ padding: "6px 12px", textAlign: "right" }}>
        {formatCurrency(actual)}
      </td>
      <td style={{ padding: "6px 0 6px 12px", textAlign: "right" }}>
        {formatCurrency(delta)}
      </td>
    </tr>
  );
}

function formatCurrency(amount, currency = "MXN") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code"
  }).format(Number(amount) || 0);
}
