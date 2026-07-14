import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { prepareMarginProjection } from "../src/appFlow.js";

test("pasted sample statement text renders MarginProjection with correct totals", async () => {
  const rawText = `
    2026-06-01 ACME PAYROLL DIRECT DEP $3,200.00 CR
    2026-06-02 ONLINE TRANSFER TO SAVINGS ACCT 1234 $500.00
    2026-06-03 RENT AUTOPAY -$1,500.00
    2026-06-04 GROCERY STORE $225.75 DEBIT
  `;
  const upcomingBills = [
    {
      id: "internet",
      name: "Internet",
      amount: 80,
      due_date: "2026-07-15",
      recurring: true
    },
    {
      id: "car-insurance",
      name: "Car insurance",
      amount: 120.25,
      due_date: "2026-07-05",
      recurring: true
    }
  ];

  const prepared = prepareMarginProjection(rawText, upcomingBills);
  const bundled = await build({
    entryPoints: ["src/MarginProjection.jsx"],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false
  });

  const componentModuleUrl = `data:text/javascript;base64,${Buffer.from(
    bundled.outputFiles[0].text
  ).toString("base64")}`;
  const { default: MarginProjection } = await import(componentModuleUrl);
  const html = renderToStaticMarkup(
    React.createElement(MarginProjection, {
      transactions: prepared.transactions,
      upcomingBills
    })
  );

  assert.equal(prepared.transactions.length, 4);
  assert.match(html, /Margin Projection/);
  assert.match(html, /\$3,200\.00/);
  assert.match(html, /\$1,725\.75/);
  assert.match(html, /\$200\.25/);
  assert.match(html, /\$1,274\.00/);
  assert.match(html, /<th[^>]*>Name<\/th>/);
  assert.match(html, /<td[^>]*>Car insurance<\/td>/);
  assert.match(html, /<td[^>]*>\$120\.25<\/td>/);
  assert.ok(html.indexOf("Car insurance") < html.indexOf("Internet"));
});

test("empty parsed statements return a friendly error", () => {
  assert.throws(
    () => prepareMarginProjection("Statement period: June 2026"),
    /No transactions found/
  );
});

test("realistic client payment sample produces nonzero real income", () => {
  const rawText = `
    2026-07-01  RENT PAYMENT  -12000.00
    2026-07-02  TRANSFER TO NU ACCOUNT  -5000.00
    2026-07-03  CLIENT PAYMENT ESLEA  15000.00
    2026-07-05  GROCERY STORE  -850.00
    2026-07-06  TRANSFER FROM MERCADO PAGO  5000.00
  `;

  const prepared = prepareMarginProjection(rawText, []);

  assert.equal(prepared.projection.realIncome, 15000);
  assert.equal(prepared.projection.realSpend, 12850);
  assert.equal(prepared.projection.upcomingBillsTotal, 0);
  assert.equal(prepared.projection.projectedMargin, 2150);
});
