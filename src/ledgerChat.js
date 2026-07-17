import { applyLedgerChanges, summarizeLedger } from "./ledgerData.js";

const LEDGER_CHAT_SYSTEM_PROMPT = `You are Crys — clear money, clear mind.
You help maintain a personal finance ledger through warm, practical conversation.
Return only valid JSON. Do not include markdown.
If the user is giving a ledger update, return:
{"action":"update_ledger","changes":{...},"text":"brief confirmation"}
If the user asks a question that does not require changing the ledger, return:
{"action":"answer","text":"..."}
If a message contains both updates and a question, include all extracted updates in changes and include specific guidance in text.
Use the user's selected language from ledgerSummary.settings.language.

Ledger shape:
{
  "incomeSources":[{"id","name","amount","currency","cadence","variability","category"}],
  "currentBalance":{"amount","currency"},
  "fixedExpenses":[{"id","name","amount","currency","due_day","cadence","type","category"}],
  "debts":[{"id","name","amount","currency","due_day","type","category"}],
  "goals":[{"id","name","target_amount","currency","target_date","amount_saved","confidence"}],
  "incomeEvents":[{"id","source","expected_date","expected_amount","currency","confidence","type","category"}],
  "variableExpenseCategories":[{"id","name","estimated_amount","category"}],
  "settings":{"mxn_per_usd":18.5}
}

Currencies must be "MXN" or "USD". Preserve the native currency and amount from the user; do not convert stored amounts.
Extract MULTIPLE distinct ledger items from one user message. Do not collapse unrelated items into one.
For incomeEvents and goals, confidence must be one of: confirmed, likely, uncertain, tentative.
Confidence rules: "got paid/received" = confirmed; "will receive/expecting" = likely; "thinking about/considering/tentative" = tentative.
Committed expenses like "need to pay", "need to do groceries", "owe my mom" should become fixedExpenses with cadence "one_time" and type "occasional" unless clearly recurring.
Weekly review unexpected income/expenses should be tagged type "occasional".
Thinking/considering/tentative items are goals, not committed expenses. Use confidence "tentative".
Unknown-amount upcoming items may be goals with target_amount 0, amount_saved 0, and confidence "uncertain".
Expense categories must be one of: Housing, Food, Transportation, Kids/Family, Debt payments, Subscriptions, Personal/Discretionary, Occasional/Unplanned.
Income categories must be one of: Fixed, Variable/Freelance, Occasional.
Type must be one of: regular, occasional.
Required onboarding categories: incomeSources, currentBalance, fixedExpenses, debts, variableExpenseCategories, goals.
During onboarding, extract every distinct item and leave already-covered categories alone.
For open questions, answer using the full current ledger plus any just-added changes. Reference actual item names, native currencies, and combined MXN totals using settings.mxn_per_usd. Give concrete guidance, not generic advice.`;

export async function processLedgerChatMessage({
  message,
  ledger,
  requestAction = requestLedgerAction
}) {
  const action = await requestAction({
    message,
    ledgerSummary: summarizeLedger(ledger)
  });

  if (action.action === "update_ledger") {
    return {
      action,
      ledger: applyLedgerChanges(ledger, action.changes ?? {}),
      reply: action.text ?? "Updated the ledger."
    };
  }

  return {
    action,
    ledger,
    reply: action.text ?? ""
  };
}

export async function processWeeklyReviewUnexpectedMessage({
  message,
  ledger,
  requestAction = requestLedgerAction
}) {
  const action = await requestAction({
    message: `Weekly review unexpected item: ${message}`,
    ledgerSummary: summarizeLedger(ledger)
  });
  const normalizedAction =
    action.action === "update_ledger"
      ? {
          ...action,
          changes: tagUnexpectedChangesAsOccasional(action.changes ?? {})
        }
      : action;

  if (normalizedAction.action === "update_ledger") {
    return {
      action: normalizedAction,
      ledger: applyLedgerChanges(ledger, normalizedAction.changes),
      reply: normalizedAction.text ?? "Added that unexpected item."
    };
  }

  return {
    action: normalizedAction,
    ledger,
    reply: normalizedAction.text ?? ""
  };
}

export async function requestLedgerAction({ message, ledgerSummary }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const model = import.meta.env.VITE_OPENAI_MODEL ?? "gpt-5.6-terra";

  if (!apiKey) {
    throw new Error("Missing VITE_OPENAI_API_KEY. Add it to .env before using chat.");
  }

  const body = buildLedgerActionRequestBody({ model, message, ledgerSummary });
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const data = await response.json();
  return parseLedgerAction(extractResponseText(data));
}

export function buildLedgerActionRequestBody({ model = "gpt-5.6-terra", message, ledgerSummary }) {
  return {
    model,
    reasoning: {
      effort: "medium"
    },
    safety_identifier: getStableSafetyIdentifier(),
    input: [
      {
        role: "system",
        content: LEDGER_CHAT_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: JSON.stringify({
          message,
          ledgerSummary
        })
      }
    ]
  };
}

export function parseLedgerAction(text) {
  const parsed = JSON.parse(text);
  if (parsed.action !== "update_ledger" && parsed.action !== "answer") {
    throw new Error("OpenAI returned an unsupported ledger action.");
  }

  return parsed;
}

export function getStableSafetyIdentifier(storage = getBrowserLocalStorage()) {
  const storageKey = "cash-flow-clarity:safety-identifier";
  const existing = storage?.getItem(storageKey);
  if (existing) {
    return existing.slice(0, 64);
  }

  const source = "cash-flow-clarity-local-user";
  const hash = hashString(source);
  const identifier = `local-${hash}`.slice(0, 64);
  storage?.setItem(storageKey, identifier);
  return identifier;
}

function getBrowserLocalStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function hashString(value) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function tagUnexpectedChangesAsOccasional(changes) {
  return {
    ...changes,
    fixedExpenses: changes.fixedExpenses?.map((expense) => ({
      category: expense.category ?? "Occasional/Unplanned",
      ...expense,
      type: "occasional"
    })),
    incomeEvents: changes.incomeEvents?.map((event) => ({
      category: event.category ?? "Occasional",
      ...event,
      type: "occasional"
    })),
    debts: changes.debts?.map((debt) => ({
      category: debt.category ?? "Debt payments",
      ...debt,
      type: "occasional"
    }))
  };
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const text = data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("OpenAI response did not include text.");
  }

  return text;
}
