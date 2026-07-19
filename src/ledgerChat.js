import { applyLedgerChanges, summarizeLedger } from "./ledgerData.js";

const LEDGER_CHAT_SYSTEM_PROMPT = `You are the user's Cash Flow Clarity assistant.
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
  "country":"Mexico | United States",
  "cushionPreference":{"amount","currency"},
  "cushionPreferenceSkipped":false,
  "fixedExpenses":[{"id","name","amount","currency","due_day","due_date","cadence","type","category","confidence"}],
  "debts":[{"id","name","amount","currency","due_day","due_date","type","category","confidence"}],
  "goals":[{"id","name","target_amount","currency","target_date","amount_saved","confidence"}],
  "incomeEvents":[{"id","source","expected_date","expected_amount","currency","confidence","type","category"}],
  "variableExpenseCategories":[{"id","name","estimated_amount","category"}],
  "settings":{"mxn_per_usd":18.5}
}

Currencies must be "MXN" or "USD". Preserve the native currency and amount from the user; do not convert stored amounts. If the user omits currency, use the default currency implied by ledgerSummary.country: Mexico = MXN, United States = USD.
Extract MULTIPLE distinct ledger items from one user message. Do not collapse unrelated items into one.
If the user gives a safety cushion/minimum balance preference, store it as cushionPreference with amount and currency. If the user says to skip the cushion, set cushionPreferenceSkipped true.
Use current_date from the user payload as the reference date. Every extracted incomeEvent must include a specific expected_date in YYYY-MM-DD. Every extracted expense or debt must include a specific due_date in YYYY-MM-DD. If the user gives a relative date like "today", "tomorrow", "next Friday", or "in two weeks", resolve it to an actual YYYY-MM-DD date from current_date. If the user gives no date or relative time at all for an income or expense item, default it to current_date so it belongs to the current running week. In the response text, be transparent about the assumption: say "Added to this week's plan" when defaulting, or "Noted for YYYY-MM-DD since you mentioned tomorrow/next Friday/etc." when resolving a relative date.
For incomeEvents and goals, confidence must be one of: confirmed, likely, uncertain, tentative.
Confidence rules: "got paid/received" = confirmed; "will receive/expecting" = likely; "thinking about/considering/tentative" = tentative.
Committed expenses like "need to pay", "need to do groceries", "owe my mom" should become fixedExpenses with cadence "one_time" and type "occasional" unless clearly recurring.
Weekly review unexpected income/expenses should be tagged type "occasional".
Thinking/considering/tentative items are goals, not committed expenses. Use confidence "tentative".
Unknown-amount upcoming items may be goals with target_amount 0, amount_saved 0, and confidence "uncertain".
Expense categories must be one of: Housing, Food, Transportation, Kids/Family, Debt payments, Subscriptions, Personal/Discretionary, Occasional/Unplanned.
Income categories must be one of: Fixed, Variable/Freelance, Occasional.
Type must be one of: regular, occasional.
Onboarding phases are Income, Expenses, then Goals/Debts. During onboarding, extract every distinct item and leave already-covered categories alone. The user may answer one phase with a full paragraph that also covers later phases; capture those later items immediately so the app can skip redundant questions. Onboarding may not finish until these minimum requirements are present: at least one income source, current available balance, and at least one expense from fixedExpenses or variableExpenseCategories. Before finishing onboarding, summarize what was captured and ask the user to confirm it is correct.
For open questions, answer using the full current ledger plus any just-added changes. Reference actual item names, native currencies, and combined MXN totals using settings.mxn_per_usd. Give concrete guidance, not generic advice.`;

export async function processLedgerChatMessage({
  message,
  ledger,
  requestAction = requestLedgerAction,
  currentDate = new Date()
}) {
  if (isCushionSkipMessage(message)) {
    const text = ledger?.settings?.language === "es"
      ? "Omití el colchón de seguridad."
      : "Skipped the safety cushion.";
    const action = {
      action: "update_ledger",
      changes: {
        cushionPreference: null,
        cushionPreferenceSkipped: true
      },
      text
    };

    return {
      action,
      ledger: applyLedgerChanges(ledger, action.changes),
      reply: text
    };
  }

  const referenceDate = normalizeReferenceDate(currentDate);
  const action = await requestAction({
    message,
    ledgerSummary: summarizeLedger(ledger),
    currentDate: referenceDate
  });
  const normalizedAction = normalizeLedgerActionDates(action, referenceDate, ledger?.settings?.language);

  if (normalizedAction.action === "update_ledger") {
    return {
      action: normalizedAction,
      ledger: applyLedgerChanges(ledger, normalizedAction.changes ?? {}),
      reply: normalizedAction.text ?? (
        ledger?.settings?.language === "es" ? "Actualicé el ledger." : "Updated the ledger."
      )
    };
  }

  return {
    action: normalizedAction,
    ledger,
    reply: normalizedAction.text ?? ""
  };
}

function isCushionSkipMessage(message) {
  return /^(skip|omit|omitir|saltar|no gracias|no thanks)$/i.test(String(message ?? "").trim());
}

export async function processWeeklyReviewUnexpectedMessage({
  message,
  ledger,
  requestAction = requestLedgerAction,
  currentDate = new Date()
}) {
  const referenceDate = normalizeReferenceDate(currentDate);
  const action = await requestAction({
    message: `Weekly review unexpected item: ${message}`,
    ledgerSummary: summarizeLedger(ledger),
    currentDate: referenceDate
  });
  const normalizedAction =
    action.action === "update_ledger"
      ? {
          ...normalizeLedgerActionDates(action, referenceDate, ledger?.settings?.language),
          changes: tagUnexpectedChangesAsOccasional(
            normalizeLedgerActionDates(action, referenceDate, ledger?.settings?.language).changes ?? {}
          )
        }
      : normalizeLedgerActionDates(action, referenceDate, ledger?.settings?.language);

  if (normalizedAction.action === "update_ledger") {
    return {
      action: normalizedAction,
      ledger: applyLedgerChanges(ledger, normalizedAction.changes),
      reply: normalizedAction.text ?? (
        ledger?.settings?.language === "es"
          ? "Agregué ese movimiento inesperado."
          : "Added that unexpected item."
      )
    };
  }

  return {
    action: normalizedAction,
    ledger,
    reply: normalizedAction.text ?? ""
  };
}

export async function requestLedgerAction({ message, ledgerSummary, currentDate = normalizeReferenceDate(new Date()) }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const model = import.meta.env.VITE_OPENAI_MODEL ?? "gpt-5.6-terra";

  if (!apiKey) {
    throw new Error("Missing VITE_OPENAI_API_KEY. Add it to .env before using chat.");
  }

  const body = buildLedgerActionRequestBody({ model, message, ledgerSummary, currentDate });
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

export function buildLedgerActionRequestBody({
  model = "gpt-5.6-terra",
  message,
  ledgerSummary,
  currentDate = normalizeReferenceDate(new Date())
}) {
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
          current_date: currentDate,
          ledgerSummary
        })
      }
    ]
  };
}

export function normalizeLedgerActionDates(action, currentDate = new Date(), language = "en") {
  if (action.action !== "update_ledger") {
    return action;
  }

  const referenceDate = normalizeReferenceDate(currentDate);
  const dateNotes = [];
  const normalizeItemDate = (value, defaultNote, relativeLabel) => {
    const resolved = resolveDateText(value, referenceDate);
    if (!value) {
      dateNotes.push(defaultNote);
      return referenceDate;
    }
    if (resolved !== value) {
      dateNotes.push(
        language === "es"
          ? `Anotado para ${resolved} porque mencionaste ${relativeLabel ?? value}.`
          : `Noted for ${resolved} since you mentioned ${relativeLabel ?? value}.`
      );
    }
    return resolved;
  };
  const normalizedChanges = {
    ...action.changes,
    incomeEvents: action.changes?.incomeEvents?.map((event) => ({
      ...event,
      expected_date: normalizeItemDate(
        event.expected_date,
        language === "es" ? "Agregado al plan de esta semana." : "Added to this week's plan.",
        event.expected_date
      )
    })),
    fixedExpenses: action.changes?.fixedExpenses?.map((expense) => ({
      ...expense,
      due_date: normalizeItemDate(
        expense.due_date,
        language === "es" ? "Agregado al plan de esta semana." : "Added to this week's plan.",
        expense.due_date
      )
    })),
    debts: action.changes?.debts?.map((debt) => ({
      ...debt,
      due_date: normalizeItemDate(
        debt.due_date,
        language === "es" ? "Agregado al plan de esta semana." : "Added to this week's plan.",
        debt.due_date
      )
    }))
  };
  const uniqueDateNotes = [...new Set(dateNotes)];

  return {
    ...action,
    changes: normalizedChanges,
    text: [action.text, ...uniqueDateNotes].filter(Boolean).join(" ")
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

function isSpecificDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveDateText(value, referenceDate) {
  if (!value || isSpecificDate(value)) {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  const reference = parseLocalDate(referenceDate);

  if (normalized === "today") {
    return formatDate(reference);
  }
  if (normalized === "tomorrow") {
    return formatDate(addDays(reference, 1));
  }
  if (normalized === "yesterday") {
    return formatDate(addDays(reference, -1));
  }
  if (normalized === "in two weeks" || normalized === "in 2 weeks") {
    return formatDate(addDays(reference, 14));
  }

  const weekdayMatch = normalized.match(/^(this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (weekdayMatch) {
    return formatDate(nextWeekday(reference, weekdayMatch[2], weekdayMatch[1] === "next"));
  }

  return value;
}

function nextWeekday(referenceDate, weekdayName, forceNextWeek = false) {
  const weekdays = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };
  const targetDay = weekdays[weekdayName];
  const daysUntilTarget = (targetDay - referenceDate.getDay() + 7) % 7;
  if (forceNextWeek) {
    return addDays(referenceDate, daysUntilTarget === 0 ? 7 : daysUntilTarget + 7);
  }
  return addDays(referenceDate, daysUntilTarget);
}

function normalizeReferenceDate(date) {
  return typeof date === "string" ? date.slice(0, 10) : formatDate(date);
}

function parseLocalDate(date) {
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  const [year, month, day] = String(date).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
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
