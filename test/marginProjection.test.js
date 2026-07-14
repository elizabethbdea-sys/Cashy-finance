import assert from "node:assert/strict";
import test from "node:test";

import { calculateMarginProjection } from "../src/marginProjection.js";

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
