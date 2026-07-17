import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { calculateMarginProjection } from "../src/marginProjection.js";
import { convertSetupToUpcomingBills } from "../src/setupProjection.js";
import { sampleSetupData } from "../src/setupData.js";

test("calculates projected margin from real income, real spend, and upcoming bills", () => {
  const transactions = [
    { id: "payroll", amount: 3200, category: "income" },
    { id: "rent-paid", amount: -1500, category: "fixed_expense" },
    { id: "groceries", amount: -225.75, category: "variable_expense" },
    { id: "ignored-transfer", amount: 500, category: "internal_transfer" }
  ];
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

  const projection = calculateMarginProjection(transactions, upcomingBills);

  assert.equal(projection.realIncome, 3200);
  assert.equal(projection.realSpend, 1725.75);
  assert.equal(projection.upcomingBillsTotal, 200.25);
  assert.equal(projection.projectedMargin, 1274);
  assert.deepEqual(
    projection.upcomingBills.map((bill) => bill.id),
    ["car-insurance", "internet"]
  );
});

test("calculates margin using setup-derived fixed expenses and goals", () => {
  const transactions = [{ id: "income", amount: 30000, category: "income" }];
  const upcomingBills = convertSetupToUpcomingBills(
    sampleSetupData,
    new Date("2026-07-15T00:00:00")
  );

  const projection = calculateMarginProjection(transactions, upcomingBills);

  assert.equal(projection.upcomingBillsTotal, 27850);
  assert.equal(projection.projectedMargin, 2150);
  assert.deepEqual(
    projection.upcomingBills.map((bill) => bill.name),
    ["Rent", "Internet", "Tax reserve"]
  );
});

test("MarginProjection renders with current ledger-shaped bills including open-ended goals", async () => {
  const currentLedger = {
    incomeSources: [
      {
        id: "tempered",
        name: "Tempered",
        amount: 16700,
        currency: "MXN",
        cadence: "monthly",
        variability: "variable",
        category: "Variable/Freelance"
      }
    ],
    currentBalance: {
      amount: 4200,
      currency: "MXN"
    },
    fixedExpenses: [
      {
        id: "youtube",
        name: "YouTube",
        amount: 160,
        currency: "MXN",
        due_day: 16,
        cadence: "one_time",
        type: "occasional",
        category: "Subscriptions"
      }
    ],
    goals: [
      {
        id: "school-supplies",
        name: "School supplies and uniforms",
        target_amount: 2500,
        currency: "MXN",
        amount_saved: 0,
        confidence: "uncertain"
      }
    ],
    incomeEvents: [
      {
        id: "builders",
        source: "Builders",
        expected_date: "2026-07-17",
        expected_amount: 500,
        currency: "USD",
        confidence: "likely",
        type: "occasional",
        category: "Occasional"
      }
    ],
    variableExpenseCategories: [
      {
        id: "groceries",
        name: "Groceries",
        estimated_amount: 3000,
        category: "Food"
      }
    ],
    settings: {
      mxn_per_usd: 18.5
    }
  };
  const upcomingBills = convertSetupToUpcomingBills(
    currentLedger,
    new Date("2026-07-15T00:00:00")
  );
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
      transactions: undefined,
      upcomingBills,
      settings: currentLedger.settings
    })
  );

  assert.match(html, /Margin Projection/);
  assert.match(html, /YouTube/);
  assert.match(html, /School supplies and uniforms/);
  assert.match(html, /No date set/);
  assert.match(html, /\$2,660\.00/);
});
