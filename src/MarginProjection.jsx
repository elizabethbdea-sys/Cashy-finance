import React from "react";

import { calculateMarginProjection } from "./marginProjection.js";
import { getStrings } from "./i18n.js";

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
  settings = { mxn_per_usd: 18.5 },
  language = "en"
}) {
  const copy = getStrings(language);
  const projection = calculateMarginProjection(transactions, upcomingBills, settings);

  return (
    <section aria-labelledby="margin-projection-title">
      <header>
        <h1 id="margin-projection-title">{copy.marginProjection}</h1>
        <h2>{copy.financialRunway}</h2>
        <p>{copy.financialRunwaySubtitle}</p>
        <p>
          {currencyFormatter.format(projection.projectedMargin)}
        </p>
      </header>

      <dl>
        <div>
          <dt>{copy.realIncome}</dt>
          <dd>{currencyFormatter.format(projection.realIncome)}</dd>
        </div>
        <div>
          <dt>{copy.realSpend}</dt>
          <dd>{currencyFormatter.format(projection.realSpend)}</dd>
        </div>
        <div>
          <dt>{copy.upcomingBills}</dt>
          <dd>{currencyFormatter.format(projection.upcomingBillsTotal)}</dd>
        </div>
      </dl>

      <h2>{copy.upcomingBills}</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th scope="col" style={{ padding: "6px 12px 6px 0", textAlign: "left" }}>{copy.name}</th>
            <th scope="col" style={{ padding: "6px 12px", textAlign: "left" }}>{copy.dueDate}</th>
            <th scope="col" style={{ padding: "6px 12px", textAlign: "right" }}>{copy.amount}</th>
            <th scope="col" style={{ padding: "6px 0 6px 12px", textAlign: "left" }}>{copy.recurring}</th>
          </tr>
        </thead>
        <tbody>
          {projection.upcomingBills.map((bill) => (
            <tr key={bill.id}>
              <td style={{ padding: "6px 12px 6px 0" }}>{bill.name}</td>
              <td style={{ padding: "6px 12px" }}>
                {formatDueDate(bill.due_date, copy)}
              </td>
              <td style={{ padding: "6px 12px", textAlign: "right" }}>
                {currencyFormatter.format(Math.abs(bill.amount))}
              </td>
              <td style={{ padding: "6px 0 6px 12px" }}>
                {bill.recurring ? copy.recurring : copy.oneTime}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatDueDate(dueDate, copy) {
  if (!dueDate) {
    return copy.noDateSet;
  }

  const date = new Date(`${dueDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? copy.noDateSet : dateFormatter.format(date);
}
