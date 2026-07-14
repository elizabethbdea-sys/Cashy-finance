import assert from "node:assert/strict";
import test from "node:test";

import { parseBankStatementText } from "../src/bankStatementParser.js";

test("extracts transactions and assigns requested categories", () => {
  const rawText = `
    BANK STATEMENT
    Opening balance $1,000.00
    2026-06-01 ACME PAYROLL DIRECT DEP $3,250.00 CR
    2026-06-02 ONLINE TRANSFER TO SAVINGS ACCT 1234 $500.00
    06/03/2026 RENT AUTOPAY -$1,800.00
    Jun 04, 2026 WHOLE FOODS MARKET $83.42 DEBIT
    Closing balance $1,866.58
  `;

  const result = parseBankStatementText(rawText);

  assert.equal(result.meta.transaction_count, 4);
  assert.deepEqual(
    result.transactions.map((transaction) => transaction.category),
    ["income", "internal_transfer", "fixed_expense", "variable_expense"]
  );
  assert.equal(result.transactions[1].amount, -500);
  assert.equal(result.meta.internal_transfer_count, 1);
});

test("does not treat obvious person-to-person transfers as internal transfers", () => {
  const rawText = "2026-06-10 Zelle from Maria Lopez $120.00 CR";

  const result = parseBankStatementText(rawText);

  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].category, "income");
});

test("flags same-owner fintech cash outs as internal transfers", () => {
  const rawText = `
    2026-06-11 VENMO CASHOUT TRANSFER TO CHECKING $250.00 CR
    2026-06-12 CASH APP INSTANT DEPOSIT TO BANK $75.00 CR
    2026-06-13 PAYPAL TRANSFER WITHDRAWAL TO ACCOUNT 9876 $40.00 CR
  `;

  const result = parseBankStatementText(rawText);

  assert.deepEqual(
    result.transactions.map((transaction) => transaction.category),
    ["internal_transfer", "internal_transfer", "internal_transfer"]
  );
});

test("ignores lines without both a date and an amount", () => {
  const result = parseBankStatementText(`
    Statement Period: June 2026
    Customer Service: 555-1212
    2026-06-20 Coffee Shop $4.50 DEBIT
  `);

  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].description, "Coffee Shop");
});

test("parses realistic plain-number amounts and client payments as income", () => {
  const rawText = `
    2026-07-01  RENT PAYMENT  -12000.00
    2026-07-02  TRANSFER TO NU ACCOUNT  -5000.00
    2026-07-03  CLIENT PAYMENT ESLEA  15000.00
    2026-07-05  GROCERY STORE  -850.00
    2026-07-06  TRANSFER FROM MERCADO PAGO  5000.00
  `;

  const result = parseBankStatementText(rawText);

  assert.equal(result.meta.transaction_count, 5);
  assert.deepEqual(
    result.transactions.map((transaction) => transaction.category),
    [
      "fixed_expense",
      "internal_transfer",
      "income",
      "variable_expense",
      "internal_transfer"
    ]
  );
  assert.equal(result.transactions[2].description, "CLIENT PAYMENT ESLEA");
  assert.equal(result.transactions[2].amount, 15000);
});
