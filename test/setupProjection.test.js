import assert from "node:assert/strict";
import test from "node:test";

import { convertSetupToUpcomingBills } from "../src/setupProjection.js";
import { sampleSetupData } from "../src/setupData.js";

test("convertSetupToUpcomingBills produces bills from fixed expenses and goals", () => {
  const referenceDate = new Date("2026-07-15T00:00:00");

  const bills = convertSetupToUpcomingBills(sampleSetupData, referenceDate);

  assert.deepEqual(
    bills.map((bill) => ({
      id: bill.id,
      name: bill.name,
      amount: bill.amount,
      due_date: bill.due_date,
      recurring: bill.recurring,
      source_type: bill.source_type
    })),
    [
      {
        id: "fixed-rent",
        name: "Rent",
        amount: 12000,
        due_date: "2026-08-01",
        recurring: true,
        source_type: "fixed_expense"
      },
      {
        id: "fixed-internet",
        name: "Internet",
        amount: 850,
        due_date: "2026-08-10",
        recurring: true,
        source_type: "fixed_expense"
      },
      {
        id: "goal-tax-reserve",
        name: "Tax reserve",
        amount: 15000,
        due_date: "2026-08-15",
        recurring: false,
        source_type: "goal"
      }
    ]
  );
});
