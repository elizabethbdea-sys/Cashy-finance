import React from "react";

import { calculateMarginProjection } from "./marginProjection.js";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

export default function MarginProjection({
  transactions,
  upcomingBills = [],
  settings = { mxn_per_usd: 18.5 }
}) {
  const projection = calculateMarginProjection(transactions, upcomingBills, settings);

  return (
    <section aria-labelledby="margin-projection-title">
      <header>
        <h1 id="margin-projection-title">Margin Projection</h1>
        <p>
          {currencyFormatter.format(projection.projectedMargin)}
        </p>
      </header>

      <dl>
        <div>
          <dt>Real income</dt>
          <dd>{currencyFormatter.format(projection.realIncome)}</dd>
        </div>
        <div>
          <dt>Real spend</dt>
          <dd>{currencyFormatter.format(projection.realSpend)}</dd>
        </div>
        <div>
          <dt>Upcoming bills</dt>
          <dd>{currencyFormatter.format(projection.upcomingBillsTotal)}</dd>
        </div>
      </dl>

      <h2>Upcoming bills</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th scope="col" style={{ padding: "6px 12px 6px 0", textAlign: "left" }}>Name</th>
            <th scope="col" style={{ padding: "6px 12px", textAlign: "left" }}>Due date</th>
            <th scope="col" style={{ padding: "6px 12px", textAlign: "right" }}>Amount</th>
            <th scope="col" style={{ padding: "6px 0 6px 12px", textAlign: "left" }}>Recurring</th>
          </tr>
        </thead>
        <tbody>
          {projection.upcomingBills.map((bill) => (
            <tr key={bill.id}>
              <td style={{ padding: "6px 12px 6px 0" }}>{bill.name}</td>
              <td style={{ padding: "6px 12px" }}>
                {formatDueDate(bill.due_date)}
              </td>
              <td style={{ padding: "6px 12px", textAlign: "right" }}>
                {currencyFormatter.format(Math.abs(bill.amount))}
              </td>
              <td style={{ padding: "6px 0 6px 12px" }}>
                {bill.recurring ? "Recurring" : "One-time"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatDueDate(dueDate) {
  if (!dueDate) {
    return "No date set";
  }

  const date = new Date(`${dueDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "No date set" : dateFormatter.format(date);
}
