import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

import { buildWeeklyReview, upsertWeeklyBalance } from "../src/weeklyReview.js";

const weeklySetupData = {
  incomeSources: [
    {
      id: "weekly-client",
      name: "Weekly client",
      amount: 1000,
      cadence: "weekly",
      variability: "fixed"
    }
  ],
  fixedExpenses: [
    {
      id: "studio",
      name: "Studio",
      amount: 300,
      due_day: 5,
      cadence: "weekly"
    }
  ],
  variableExpenseCategories: [
    {
      id: "food",
      name: "Food",
      estimated_amount: 200
    }
  ],
  goalsDebtsUpcomingExpenses: [],
  nextWeekForecast: null
};

const actualTransactions = [
  { id: "income", amount: 1100, category: "income" },
  { id: "rent", amount: -300, category: "fixed_expense" },
  { id: "groceries", amount: -150, category: "variable_expense" },
  { id: "transfer", amount: -500, category: "internal_transfer" }
];

test("weekly review compares forecast vs actual", () => {
  const review = buildWeeklyReview(
    weeklySetupData,
    actualTransactions,
    new Date("2026-07-15T00:00:00")
  );

  assert.equal(review.forecastIncome, 1000);
  assert.equal(review.forecastExpenses, 300 + 200 / 4.3333);
  assert.equal(review.actualIncome, 1100);
  assert.equal(review.actualExpenses, 450);
  assert.equal(review.incomeDelta, 100);
});

test("weekly closing balance carries forward across consecutive weeks", () => {
  const firstWeekLedger = {
    incomeSources: [],
    fixedExpenses: [
      {
        id: "rent",
        name: "Rent",
        amount: 1200,
        currency: "MXN",
        due_date: "2026-07-15",
        type: "regular",
        category: "Housing"
      }
    ],
    debts: [
      {
        id: "mom",
        name: "Mom repayment",
        amount: 300,
        currency: "MXN",
        due_date: "2026-07-16",
        type: "regular",
        category: "Debt payments"
      }
    ],
    goals: [],
    incomeEvents: [
      {
        id: "tempered",
        source: "Tempered",
        expected_date: "2026-07-14",
        expected_amount: 5000,
        currency: "MXN",
        confidence: "confirmed",
        type: "regular",
        category: "Variable/Freelance"
      }
    ],
    currentBalance: {
      amount: 1000,
      currency: "MXN"
    },
    variableExpenseCategories: [],
    weeklyBalances: [],
    settings: {
      mxn_per_usd: 18.5
    }
  };

  const firstReview = buildWeeklyReview(
    firstWeekLedger,
    [],
    new Date("2026-07-17T00:00:00")
  );
  const secondWeekLedger = {
    ...firstWeekLedger,
    fixedExpenses: [
      {
        id: "internet",
        name: "Internet",
        amount: 500,
        currency: "MXN",
        due_date: "2026-07-22",
        type: "regular",
        category: "Subscriptions"
      }
    ],
    debts: [],
    incomeEvents: [
      {
        id: "builders",
        source: "Builders",
        expected_date: "2026-07-21",
        expected_amount: 2000,
        currency: "MXN",
        confidence: "confirmed",
        type: "regular",
        category: "Variable/Freelance"
      }
    ],
    weeklyBalances: upsertWeeklyBalance([], firstReview.weeklyBalance)
  };
  const secondReview = buildWeeklyReview(
    secondWeekLedger,
    [],
    new Date("2026-07-24T00:00:00")
  );

  assert.equal(firstReview.weeklyBalance.week_start, "2026-07-13");
  assert.equal(firstReview.weeklyBalance.starting_balance, 1000);
  assert.equal(firstReview.weeklyBalance.income, 5000);
  assert.equal(firstReview.weeklyBalance.expenses, 1500);
  assert.equal(firstReview.weeklyBalance.closing_balance, 4500);
  assert.equal(secondReview.weeklyBalance.week_start, "2026-07-20");
  assert.equal(secondReview.weeklyBalance.starting_balance, 4500);
  assert.equal(secondReview.weeklyBalance.income, 2000);
  assert.equal(secondReview.weeklyBalance.expenses, 500);
  assert.equal(secondReview.weeklyBalance.closing_balance, 6000);
});

test("weekly review renders a forecast-vs-actual comparison", async () => {
  const bundled = await build({
    stdin: {
      contents: `
        import React from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import WeeklyReview from "./src/WeeklyReview.jsx";

        const setupData = ${JSON.stringify(weeklySetupData)};
        const transactions = ${JSON.stringify(actualTransactions)};

        export const html = renderToStaticMarkup(
          React.createElement(WeeklyReview, {
            setupData,
            transactions,
            onConfirmForecast: () => {}
          })
        );
      `,
      resolveDir: process.cwd(),
      sourcefile: "weekly-review-render-test.jsx"
    },
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["react", "react-dom/server"],
    write: false
  });

  await mkdir(".test-output", { recursive: true });
  const bundlePath = ".test-output/weekly-review-render.mjs";
  await writeFile(bundlePath, bundled.outputFiles[0].text);

  const { html } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);
  await rm(".test-output", { recursive: true, force: true });

  assert.match(html, /Weekly Review/);
  assert.match(html, /Forecast/);
  assert.match(html, /Actual/);
  assert.match(html, /\$1,000\.00/);
  assert.match(html, /\$1,100\.00/);
  assert.match(html, /\$450\.00/);
});

test("weekly review renders Spanish labels", async () => {
  const bundled = await build({
    stdin: {
      contents: `
        import React from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import WeeklyReview from "./src/WeeklyReview.jsx";

        const setupData = ${JSON.stringify(weeklySetupData)};
        const transactions = ${JSON.stringify(actualTransactions)};

        export const html = renderToStaticMarkup(
          React.createElement(WeeklyReview, {
            setupData,
            transactions,
            language: "es",
            onConfirmForecast: () => {}
          })
        );
      `,
      resolveDir: process.cwd(),
      sourcefile: "weekly-review-spanish-render-test.jsx"
    },
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["react", "react-dom/server"],
    write: false
  });

  await mkdir(".test-output", { recursive: true });
  const bundlePath = ".test-output/weekly-review-spanish-render.mjs";
  await writeFile(bundlePath, bundled.outputFiles[0].text);

  const { html } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);
  await rm(".test-output", { recursive: true, force: true });

  assert.match(html, /Revisión semanal/);
  assert.match(html, /Pronóstico/);
  assert.match(html, /Saldo al final de esta semana/);
  assert.match(html, /Confirmar próxima semana/);
});
