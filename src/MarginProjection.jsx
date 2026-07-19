import React from "react";

import { calculateFinancialRunway, calculateMarginProjection } from "./marginProjection.js";
import { getStrings } from "./i18n.js";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

export default function MarginProjection({
  transactions,
  upcomingBills = [],
  settings = { mxn_per_usd: 18.5 },
  currentBalance = null,
  cushionPreference = null,
  language = "en"
}) {
  const copy = getStrings(language);
  const projection = calculateMarginProjection(transactions, upcomingBills, settings);
  const runway = calculateFinancialRunway({
    projection,
    currentBalance,
    cushionPreference,
    settings
  });
  const runwaySubtitle = getRunwaySubtitle({ copy, runway, cushionPreference });

  return (
    <section aria-labelledby="margin-projection-title">
      <header>
        <h1 id="margin-projection-title">{copy.marginProjection}</h1>
        <h2>{copy.financialRunway}</h2>
        <p>{runwaySubtitle}</p>
        <p>
          {formatCurrency(projection.projectedMargin, "MXN")}
        </p>
      </header>

      <dl>
        <div>
          <dt>{copy.realIncome}</dt>
          <dd>{formatCurrency(projection.realIncome, "MXN")}</dd>
        </div>
        <div>
          <dt>{copy.realSpend}</dt>
          <dd>{formatCurrency(projection.realSpend, "MXN")}</dd>
        </div>
        <div>
          <dt>{copy.upcomingBills}</dt>
          <dd>{formatCurrency(projection.upcomingBillsTotal, "MXN")}</dd>
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
                {formatCurrency(Math.abs(bill.amount), bill.currency ?? "MXN")}
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

function getRunwaySubtitle({ copy, runway, cushionPreference }) {
  if (!cushionPreference || !runway) {
    return copy.financialRunwaySubtitle;
  }

  if (!runway.willHitCushion) {
    return copy.runwayNoBurn;
  }

  return copy.runwayToCushion
    .replace("{amount}", formatCurrency(cushionPreference.amount, cushionPreference.currency))
    .replace("{days}", String(runway.daysUntilCushion));
}

function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code"
  }).format(Number(amount) || 0);
}

function formatDueDate(dueDate, copy) {
  if (!dueDate) {
    return copy.noDateSet;
  }

  const date = new Date(`${dueDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? copy.noDateSet : dateFormatter.format(date);
}
