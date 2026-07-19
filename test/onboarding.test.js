import assert from "node:assert/strict";
import test from "node:test";

import {
  getMissingMinimumOnboardingCategories,
  getNextOnboardingMessage,
  getNextOnboardingUpdate,
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
    /any other income sources/
  );
});

test("onboarding starts with an explicit income phase prompt", () => {
  const message = getNextOnboardingMessage({
    incomeSources: [],
    incomeEvents: [],
    currentBalance: null,
    fixedExpenses: [],
    variableExpenseCategories: [],
    goals: [],
    debts: []
  });

  assert.match(message, /Let's start with your income/);
});

test("onboarding asks an income follow-up before moving to expenses", () => {
  const update = getNextOnboardingUpdate({
    incomeSources: [{ id: "client", name: "Client", amount: 1000 }],
    incomeEvents: [],
    currentBalance: { amount: 500, currency: "MXN" },
    fixedExpenses: [],
    variableExpenseCategories: [],
    debts: [],
    goals: [],
    onboardingProgress: {}
  });

  assert.match(update.message, /any other income sources/i);
  assert.equal(update.ledger.onboardingProgress.incomeFollowUpAsked, true);
});

test("onboarding moves to expenses after the income follow-up was asked", () => {
  const update = getNextOnboardingUpdate({
    incomeSources: [{ id: "client", name: "Client", amount: 1000 }],
    incomeEvents: [],
    currentBalance: { amount: 500, currency: "MXN" },
    fixedExpenses: [],
    variableExpenseCategories: [],
    debts: [],
    goals: [],
    onboardingProgress: {
      incomeFollowUpAsked: true
    }
  });

  assert.match(update.message, /map your expenses/i);
  assert.equal(update.ledger.onboardingProgress.expensesPrompted, true);
});

test("onboarding keeps full-paragraph data but still advances one phase per turn", () => {
  const update = getNextOnboardingUpdate({
    incomeSources: [{ id: "client", name: "Client", amount: 1000 }],
    incomeEvents: [],
    currentBalance: { amount: 500, currency: "MXN" },
    fixedExpenses: [{ id: "rent", name: "Rent", amount: 300 }],
    variableExpenseCategories: [],
    debts: [{ id: "card", name: "Credit card", amount: 200 }],
    goals: [{ id: "school", name: "School costs", target_amount: 500 }],
    cushionPreferenceSkipped: true,
    onboardingProgress: {}
  });

  assert.match(update.message, /any other income sources/i);
  assert.equal(update.ledger.fixedExpenses.length, 1);
  assert.equal(update.ledger.goals.length, 1);
  assert.doesNotMatch(update.message, /current available balance/i);
});

test("goals and debts phase prompt includes concrete examples", () => {
  const message = getNextOnboardingMessage({
    incomeSources: [{ id: "client", name: "Client", amount: 1000 }],
    incomeEvents: [],
    currentBalance: { amount: 500, currency: "MXN" },
    fixedExpenses: [{ id: "rent", name: "Rent", amount: 300 }],
    variableExpenseCategories: [],
    debts: [],
    goals: [],
    onboardingProgress: {
      incomeFollowUpAsked: true,
      expensesPrompted: true
    }
  });

  assert.match(message, /vacation, a car, school costs, or paying off a debt/);
});

test("onboarding asks optional cushion once after minimum data exists", () => {
  const ledger = {
    incomeSources: [{ id: "client", name: "Client", amount: 1000 }],
    currentBalance: { amount: 500, currency: "MXN" },
    fixedExpenses: [{ id: "rent", name: "Rent", amount: 300 }],
    variableExpenseCategories: [],
    debts: [],
    goals: [],
    onboardingProgress: {
      incomeFollowUpAsked: true,
      expensesPrompted: true,
      goalsPrompted: true,
      balancePrompted: true
    },
    onboardingConfirmed: false
  };

  const message = getNextOnboardingMessage(ledger, "es", true);

  assert.equal(hasMinimumOnboardingData(ledger), true);
  assert.equal(isOnboardingComplete(ledger), false);
  assert.match(message, /colchón de seguridad/);
});

test("skipping optional cushion does not block onboarding confirmation", () => {
  const ledger = {
    incomeSources: [
      { id: "client", name: "Client", amount: 1000, currency: "MXN", cadence: "monthly" },
      { id: "side", name: "Side job", amount: 500, currency: "USD", cadence: "biweekly" }
    ],
    currentBalance: { amount: 500, currency: "MXN" },
    fixedExpenses: [{ id: "rent", name: "Rent", amount: 300 }],
    variableExpenseCategories: [],
    debts: [],
    goals: [],
    cushionPreferenceSkipped: true,
    onboardingProgress: {
      incomeFollowUpAsked: true,
      expensesPrompted: true,
      goalsPrompted: true,
      balancePrompted: true,
      summaryShown: true
    },
    onboardingConfirmed: false
  };

  const message = getNextOnboardingMessage(ledger, "es", true);

  assert.match(message, /Esto fue lo que entendí/);
  assert.match(message, /Fuentes de ingreso: Client/);
  assert.match(message, /1000 MXN, mensual/);
  assert.match(message, /500 USD, quincenal/);
  assert.equal(isOnboardingComplete({ ...ledger, onboardingConfirmed: true }), true);
});

test("onboarding follows the required multi-turn phase sequence", () => {
  const baseLedger = {
    incomeSources: [{ id: "client", name: "Client", amount: 1000 }],
    incomeEvents: [],
    fixedExpenses: [{ id: "rent", name: "Rent", amount: 300 }],
    variableExpenseCategories: [],
    debts: [],
    goals: [{ id: "school", name: "School costs", target_amount: 500 }],
    currentBalance: { amount: 500, currency: "MXN" },
    cushionPreferenceSkipped: true,
    onboardingProgress: {}
  };

  const incomeFollowUp = getNextOnboardingUpdate(baseLedger);
  const expenses = getNextOnboardingUpdate(incomeFollowUp.ledger);
  const goals = getNextOnboardingUpdate(expenses.ledger);
  const balance = getNextOnboardingUpdate(goals.ledger);
  const summary = getNextOnboardingUpdate(balance.ledger);

  assert.match(incomeFollowUp.message, /any other income sources/i);
  assert.match(expenses.message, /map your expenses/i);
  assert.match(goals.message, /vacation, a car, school costs, or paying off a debt/);
  assert.match(balance.message, /current available balance/i);
  assert.match(summary.message, /what I understood/);
});
