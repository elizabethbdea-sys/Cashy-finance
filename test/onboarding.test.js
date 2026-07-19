import assert from "node:assert/strict";
import test from "node:test";

import {
  getMissingMinimumOnboardingCategories,
  getNextOnboardingMessage,
  hasMinimumOnboardingData,
  isOnboardingComplete
} from "../src/assistantOnboarding.js";

test("onboarding minimum requires income, current balance, and an expense", () => {
  const partialLedger = {
    incomeSources: [{ id: "client", name: "Client", amount: 1000 }],
    currentBalance: null,
    fixedExpenses: [],
    variableExpenseCategories: []
  };

  assert.deepEqual(getMissingMinimumOnboardingCategories(partialLedger), [
    "currentBalance",
    "expenses"
  ]);
  assert.equal(hasMinimumOnboardingData(partialLedger), false);
  assert.match(
    getNextOnboardingMessage(partialLedger, "en", true),
    /current available balance/
  );
});

test("onboarding summarizes for confirmation after minimum data exists", () => {
  const ledger = {
    incomeSources: [{ id: "client", name: "Client", amount: 1000 }],
    currentBalance: { amount: 500, currency: "MXN" },
    fixedExpenses: [{ id: "rent", name: "Rent", amount: 300 }],
    variableExpenseCategories: [],
    debts: [],
    goals: [],
    onboardingConfirmed: false
  };

  const message = getNextOnboardingMessage(ledger, "es", true);

  assert.equal(hasMinimumOnboardingData(ledger), true);
  assert.equal(isOnboardingComplete(ledger), false);
  assert.match(message, /Esto fue lo que entendí/);
  assert.match(message, /Fuentes de ingreso: Client/);
  assert.equal(isOnboardingComplete({ ...ledger, onboardingConfirmed: true }), true);
});
