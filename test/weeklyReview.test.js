import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

import { buildWeeklyReview } from "../src/weeklyReview.js";

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
