import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryStorage, emptyLedger } from "../src/ledgerData.js";
import {
  buildLedgerActionRequestBody,
  getStableSafetyIdentifier,
  processLedgerChatMessage,
  processWeeklyReviewUnexpectedMessage
} from "../src/ledgerChat.js";

test("sample natural-language income update modifies the ledger", async () => {
  const result = await processLedgerChatMessage({
    message: "got paid $2000 from Tempered today",
    ledger: emptyLedger,
    requestAction: async () => ({
      action: "update_ledger",
      text: "Added the Tempered payment.",
      changes: {
        incomeEvents: [
          {
            id: "tempered-2026-07-15",
            source: "Tempered",
            expected_date: "2026-07-15",
            expected_amount: 2000,
            currency: "MXN",
            confidence: "confirmed",
            type: "occasional",
            category: "Occasional"
          }
        ]
      }
    })
  });

  assert.equal(result.reply, "Added the Tempered payment.");
  assert.deepEqual(result.ledger.incomeEvents, [
    {
      id: "tempered-2026-07-15",
      source: "Tempered",
      expected_date: "2026-07-15",
      expected_amount: 2000,
      currency: "MXN",
      confidence: "confirmed",
      type: "occasional",
      category: "Occasional"
    }
  ]);
});

test("messy multi-item finance message applies all extracted ledger changes", async () => {
  const message = "Got paid $16700 MXN from Tempered and $1600 MXN allowance this week, receiving $500 USD from Builders tomorrow (not yet confirmed). Need to do $3000 MXN groceries, pay $160 MXN YouTube, owe my mom $270 MXN. Considering $1000 MXN summer courses per kid (2 kids) — tentative. Also have school supplies/uniforms due next month, amount unknown yet.";

  const result = await processLedgerChatMessage({
    message,
    ledger: emptyLedger,
    requestAction: async () => ({
      action: "update_ledger",
      text: "Added 3 income events, 3 committed expenses, and 2 tentative goals.",
      changes: {
        incomeEvents: [
          {
            id: "tempered-2026-07-16",
            source: "Tempered",
            expected_date: "2026-07-16",
            expected_amount: 16700,
            currency: "MXN",
            confidence: "confirmed",
            type: "occasional",
            category: "Occasional"
          },
          {
            id: "allowance-2026-07-16",
            source: "Allowance",
            expected_date: "2026-07-16",
            expected_amount: 1600,
            currency: "MXN",
            confidence: "confirmed",
            type: "occasional",
            category: "Occasional"
          },
          {
            id: "builders-2026-07-17",
            source: "Builders",
            expected_date: "2026-07-17",
            expected_amount: 500,
            currency: "USD",
            confidence: "likely",
            type: "occasional",
            category: "Occasional"
          }
        ],
        fixedExpenses: [
          {
            id: "groceries-2026-07-16",
            name: "Groceries",
            amount: 3000,
            currency: "MXN",
            due_day: 16,
            due_date: "2026-07-16",
            cadence: "one_time",
            type: "occasional",
            category: "Food"
          },
          {
            id: "youtube-2026-07-16",
            name: "YouTube",
            amount: 160,
            currency: "MXN",
            due_day: 16,
            due_date: "2026-07-16",
            cadence: "one_time",
            type: "occasional",
            category: "Subscriptions"
          },
          {
            id: "mom-2026-07-16",
            name: "Mom repayment",
            amount: 270,
            currency: "MXN",
            due_day: 16,
            due_date: "2026-07-16",
            cadence: "one_time",
            type: "occasional",
            category: "Debt payments"
          }
        ],
        goals: [
          {
            id: "summer-courses",
            name: "Summer courses for 2 kids",
            target_amount: 2000,
            currency: "MXN",
            target_date: "2026-08-16",
            amount_saved: 0,
            confidence: "tentative"
          },
          {
            id: "school-supplies-uniforms",
            name: "School supplies and uniforms",
            target_amount: 0,
            currency: "MXN",
            target_date: "2026-08-16",
            amount_saved: 0,
            confidence: "uncertain"
          }
        ]
      }
    })
  });

  assert.equal(result.ledger.incomeEvents.length, 3);
  assert.deepEqual(
    result.ledger.incomeEvents.map(({ source, expected_amount, currency, confidence, type, category }) => ({
      source,
      expected_amount,
      currency,
      confidence,
      type,
      category
    })),
    [
      {
        source: "Tempered",
        expected_amount: 16700,
        currency: "MXN",
        confidence: "confirmed",
        type: "occasional",
        category: "Occasional"
      },
      {
        source: "Allowance",
        expected_amount: 1600,
        currency: "MXN",
        confidence: "confirmed",
        type: "occasional",
        category: "Occasional"
      },
      {
        source: "Builders",
        expected_amount: 500,
        currency: "USD",
        confidence: "likely",
        type: "occasional",
        category: "Occasional"
      }
    ]
  );
  assert.deepEqual(
    result.ledger.fixedExpenses.map(({ name, amount, currency, cadence, type, category }) => ({
      name,
      amount,
      currency,
      cadence,
      type,
      category
    })),
    [
      {
        name: "Groceries",
        amount: 3000,
        currency: "MXN",
        cadence: "one_time",
        type: "occasional",
        category: "Food"
      },
      {
        name: "YouTube",
        amount: 160,
        currency: "MXN",
        cadence: "one_time",
        type: "occasional",
        category: "Subscriptions"
      },
      {
        name: "Mom repayment",
        amount: 270,
        currency: "MXN",
        cadence: "one_time",
        type: "occasional",
        category: "Debt payments"
      }
    ]
  );
  assert.deepEqual(
    result.ledger.goals.map(({ name, target_amount, currency, confidence }) => ({
      name,
      target_amount,
      currency,
      confidence
    })),
    [
      {
        name: "Summer courses for 2 kids",
        target_amount: 2000,
        currency: "MXN",
        confidence: "tentative"
      },
      {
        name: "School supplies and uniforms",
        target_amount: 0,
        currency: "MXN",
        confidence: "uncertain"
      }
    ]
  );
});

test("weekly review unexpected expense is tagged occasional automatically", async () => {
  const result = await processWeeklyReviewUnexpectedMessage({
    message: "Had to spend $450 MXN on medicine unexpectedly",
    ledger: emptyLedger,
    requestAction: async () => ({
      action: "update_ledger",
      changes: {
        fixedExpenses: [
          {
            id: "medicine-2026-07-16",
            name: "Medicine",
            amount: 450,
            currency: "MXN",
            due_day: 16,
            due_date: "2026-07-16",
            cadence: "one_time",
            category: "Personal/Discretionary"
          }
        ]
      }
    })
  });

  assert.equal(result.ledger.fixedExpenses[0].type, "occasional");
  assert.equal(result.ledger.fixedExpenses[0].category, "Personal/Discretionary");
});

test("date-less ledger updates default to the current running week", async () => {
  const result = await processLedgerChatMessage({
    message: "got paid $2000 from Tempered",
    ledger: emptyLedger,
    currentDate: "2026-07-17",
    requestAction: async () => ({
      action: "update_ledger",
      text: "Added the payment.",
      changes: {
        incomeEvents: [
          {
            id: "tempered-undated",
            source: "Tempered",
            expected_amount: 2000,
            currency: "MXN",
            confidence: "confirmed",
            type: "occasional",
            category: "Occasional"
          }
        ]
      }
    })
  });

  assert.equal(result.action.action, "update_ledger");
  assert.equal(result.ledger.incomeEvents[0].expected_date, "2026-07-17");
  assert.match(result.reply, /Added to this week's plan/);
});

test("relative ledger dates resolve to actual dates before logging", async () => {
  const result = await processLedgerChatMessage({
    message: "receiving $500 USD from Builders next Friday",
    ledger: emptyLedger,
    currentDate: "2026-07-17",
    requestAction: async () => ({
      action: "update_ledger",
      text: "Added Builders.",
      changes: {
        incomeEvents: [
          {
            id: "builders-tomorrow",
            source: "Builders",
            expected_date: "next Friday",
            expected_amount: 500,
            currency: "USD",
            confidence: "likely",
            type: "occasional",
            category: "Occasional"
          }
        ]
      }
    })
  });

  assert.equal(result.ledger.incomeEvents[0].expected_date, "2026-07-24");
  assert.match(result.reply, /Noted for 2026-07-24 since you mentioned next Friday/);
});

test("country sets the default currency for ledger chat entries with omitted currency", async () => {
  const result = await processLedgerChatMessage({
    message: "got paid 1200 from Acme today",
    ledger: {
      ...emptyLedger,
      country: "United States"
    },
    currentDate: "2026-07-17",
    requestAction: async () => ({
      action: "update_ledger",
      text: "Added Acme.",
      changes: {
        incomeEvents: [
          {
            id: "acme-2026-07-17",
            source: "Acme",
            expected_date: "today",
            expected_amount: 1200,
            confidence: "confirmed",
            type: "occasional",
            category: "Occasional"
          }
        ]
      }
    })
  });

  assert.equal(result.ledger.incomeEvents[0].currency, "USD");
  assert.equal(result.ledger.incomeEvents[0].expected_date, "2026-07-17");
});

test("ledger chat can store a safety cushion preference", async () => {
  const result = await processLedgerChatMessage({
    message: "I want to keep a 5000 MXN safety cushion",
    ledger: {
      ...emptyLedger,
      country: "Mexico"
    },
    requestAction: async () => ({
      action: "update_ledger",
      text: "Saved your safety cushion.",
      changes: {
        cushionPreference: {
          amount: 5000,
          currency: "MXN"
        }
      }
    })
  });

  assert.deepEqual(result.ledger.cushionPreference, {
    amount: 5000,
    currency: "MXN"
  });
  assert.equal(result.ledger.cushionPreferenceSkipped, false);
});

test("ledger chat skips safety cushion locally without calling the API", async () => {
  const result = await processLedgerChatMessage({
    message: "skip",
    ledger: {
      ...emptyLedger,
      cushionPreference: { amount: 5000, currency: "MXN" }
    },
    requestAction: async () => {
      throw new Error("API should not be called for cushion skip.");
    }
  });

  assert.equal(result.ledger.cushionPreference, null);
  assert.equal(result.ledger.cushionPreferenceSkipped, true);
  assert.match(result.reply, /Skipped the safety cushion/);
});

test("ledger chat request body uses terra model, medium reasoning, and stable safety identifier", () => {
  const safetyIdentifier = getStableSafetyIdentifier(createMemoryStorage());
  const body = buildLedgerActionRequestBody({
    message: "will Builders pay late?",
    ledgerSummary: { incomeEvents: [] }
  });

  assert.equal(body.model, "gpt-5.6-terra");
  assert.deepEqual(body.reasoning, { effort: "medium" });
  assert.match(body.input[1].content, /"current_date":/);
  assert.equal(typeof body.safety_identifier, "string");
  assert.ok(body.safety_identifier.length <= 64);
  assert.match(safetyIdentifier, /^local-/);
});
