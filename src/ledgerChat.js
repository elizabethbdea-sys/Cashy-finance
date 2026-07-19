import { applyLedgerChanges, getDefaultCurrencyForCountry, summarizeLedger } from "./ledgerData.js";

const LEDGER_CHAT_SYSTEM_PROMPT = `You are the user's Cash Flow Clarity assistant.
You help maintain a personal finance ledger through warm, practical conversation.
Use "Burn Rate" as the name for the core runway metric in both English and Spanish. In Spanish, keep the phrase "Burn Rate" recognizable.
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
Onboarding phases are Income, Income follow-up, Expenses, Goals/Debts, Current balance, Cushion, then Summary/Confirm. During onboarding, extract every distinct item and leave already-covered categories alone. The user may answer one phase with a full paragraph that also covers later phases; capture those later items immediately, but do not answer by bundling multiple next-phase questions together. The app will ask one phase at a time. Onboarding may not finish until these minimum requirements are present: at least one income source, current available balance, and at least one expense from fixedExpenses or variableExpenseCategories. Before finishing onboarding, summarize what was captured and ask the user to confirm it is correct.
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
  const localAction =
    requestAction === requestLedgerAction
      ? createLocalOnboardingAction(message, ledger, referenceDate)
      : null;
  if (localAction) {
    return {
      action: localAction,
      ledger: applyLedgerChanges(ledger, localAction.changes),
      reply: localAction.text ?? ""
    };
  }

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

function createLocalOnboardingAction(message, ledger = {}, currentDate) {
  if (ledger.onboardingConfirmed) {
    return null;
  }

  const text = String(message ?? "").trim();
  const lower = text.toLowerCase();
  const language = ledger?.settings?.language === "es" ? "es" : "en";
  const emptyUpdateText = language === "es" ? "Anotado." : "Got it.";

  if (/^(no|none|nope|nothing else|ninguno|ninguna|nada más|nada mas)\b/i.test(text)) {
    return {
      action: "update_ledger",
      changes: {},
      text: emptyUpdateText
    };
  }

  if (/^(yes|correct|looks right|sí|si|correcto|está bien|esta bien)$/i.test(text)) {
    return {
      action: "update_ledger",
      changes: {},
      text: emptyUpdateText
    };
  }

  const amount = extractFirstAmount(text);
  if (amount === null) {
    return null;
  }

  const currency = extractCurrency(text) ?? getDefaultCurrencyForCountry(ledger.country);
  const progress = ledger.onboardingProgress ?? {};

  if (progress.cushionPrompted || /cushion|colch[oó]n|safety|minimum|mínimo|minimo/.test(lower)) {
    return {
      action: "update_ledger",
      changes: {
        cushionPreference: { amount, currency },
        cushionPreferenceSkipped: false
      },
      text: language === "es" ? "Guardé tu colchón de seguridad." : "Saved your safety cushion."
    };
  }

  if (progress.balancePrompted || /balance|available|saldo|disponible/.test(lower)) {
    return {
      action: "update_ledger",
      changes: {
        currentBalance: { amount, currency }
      },
      text: language === "es" ? "Guardé tu saldo actual." : "Saved your current balance."
    };
  }

  if (progress.goalsPrompted || /goal|meta|vacation|school|debt|deuda|car|coche|pagar|pay off/.test(lower)) {
    const name = inferGoalName(text);
    return {
      action: "update_ledger",
      changes: {
        goals: [
          {
            id: `goal-${slugify(name)}-${currentDate}`,
            name,
            target_amount: amount,
            currency,
            target_date: currentDate,
            amount_saved: 0,
            confidence: "confirmed"
          }
        ]
      },
      text: language === "es" ? "Guardé esa meta." : "Saved that goal."
    };
  }

  if (isIncomeMessage(lower)) {
    const incomeItems = extractIncomeItems(text, amount, currency, currentDate);
    return {
      action: "update_ledger",
      changes: {
        incomeSources: incomeItems.map(({ incomeSource }) => incomeSource),
        incomeEvents: incomeItems.map(({ incomeEvent }) => incomeEvent)
      },
      text: language === "es"
        ? `Guardé ${incomeItems.length === 1 ? "ese ingreso" : "esos ingresos"}.`
        : `Saved ${incomeItems.length === 1 ? "that income" : "those income sources"}.`
    };
  }

  if (progress.expensesPrompted || /\b(?:rent|renta|grocer|s[uú]per|expense|gasto|bill|pago|subscription|suscripci[oó]n|gasolina|super|s[uú]per|luz|agua|megacable)\b/.test(lower)) {
    const expenses = extractExpenseItems(text, amount, currency, currentDate);
    return {
      action: "update_ledger",
      changes: {
        fixedExpenses: expenses
      },
      text: language === "es"
        ? `Guardé ${expenses.length === 1 ? "ese gasto" : "esos gastos"}.`
        : `Saved ${expenses.length === 1 ? "that expense" : "those expenses"}.`
    };
  }

  return null;
}

function isIncomeMessage(lowerText) {
  return /\b(?:income|ingresos?|paid|paycheck|salary|salario|get|recibo|empresa|trabajo|freelance)\b|(?:me\s+paga|me\s+pag[aó]|from\s+)/i.test(lowerText);
}

function extractIncomeItems(text, fallbackAmount, fallbackCurrency, currentDate) {
  const normalized = normalizeCurrencyWords(text);
  const knownItems = extractKnownSpanishIncomeItems(normalized, fallbackCurrency, currentDate);
  if (knownItems.length > 0) {
    return knownItems;
  }

  const items = [];
  const sourcePatterns = [
    /(?:empresa\s+llamada|company\s+called|from|de)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+?)\s+(?:que\s+me\s+paga|pays?\s+me|me\s+paga|paga|pays?|for|por)\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?/gi,
    /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+?)\s+(?:me\s+paga|pays?\s+me|paga|pays?)\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?/gi
  ];

  for (const pattern of sourcePatterns) {
    for (const match of normalized.matchAll(pattern)) {
      const name = cleanInferredName(match[1]);
      const amount = Number(String(match[2]).replace(/,/g, ""));
      if (name && Number.isFinite(amount)) {
        items.push(
          makeIncomeItem(
            name,
            amount,
            normalizeCurrencyToken(match[3]) ?? fallbackCurrency,
            match[0],
            currentDate
          )
        );
      }
    }
    if (items.length > 0) {
      break;
    }
  }

  addSpecificIncomeItem(items, normalized, {
    name: "Second job",
    pattern: /(?:segundo\s+trabajo|second\s+job)[^\d]*(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?[^,.]*/i,
    fallbackCurrency,
    currentDate
  });
  addSpecificIncomeItem(items, normalized, {
    name: "Pensión alimenticia",
    pattern: /pensi[oó]n\s+alimenticia[^\d]*(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?[^,.]*/i,
    fallbackCurrency,
    currentDate
  });

  if (items.length > 0) {
    return dedupeIncomeItemsByName(items);
  }

  const name = inferIncomeName(text);
  return [makeIncomeItem(name, fallbackAmount, fallbackCurrency, text, currentDate)];
}

function extractKnownSpanishIncomeItems(text, fallbackCurrency, currentDate) {
  const items = [];
  const normalized = normalizeCurrencyWords(text);

  const temperedMatch = normalized.match(/(?:tempered)[\s\S]*?(?:(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?))?[\s\S]*?(?:al\s+mes|mensual|mes)/i);
  if (temperedMatch) {
    const amount = extractAmountNear(normalized, /tempered/i) ?? (Number(temperedMatch[1]) || 2000);
    const currency = normalizeCurrencyToken(temperedMatch[2]) ?? currencyNear(normalized, /tempered/i) ?? fallbackCurrency;
    items.push(makeIncomeItem("Tempered", amount, currency, "tempered al mes mensual", currentDate));
  }

  const secondJobMatch = normalized.match(/(?:otra\s+empresa|segundo\s+trabajo|second\s+job)[\s\S]*?(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?[\s\S]*?(?:viernes\s+si\s+y\s+un\s+viernes\s+no|quincenal(?:[\s\S]*?viernes)?|biweekly(?:[\s\S]*?friday)?|viernes)/i);
  if (secondJobMatch) {
    items.push(
      makeIncomeItem(
        "Second job",
        Number(String(secondJobMatch[1]).replace(/,/g, "")),
        normalizeCurrencyToken(secondJobMatch[2]) ?? fallbackCurrency,
        secondJobMatch[0],
        currentDate
      )
    );
  }

  const pensionItem = extractIncomeItemNearKeyword(normalized, /pensi[oó]n\s+alimenticia/i, "Pensión alimenticia", fallbackCurrency, currentDate);
  if (pensionItem) {
    items.push(pensionItem);
  }

  return dedupeIncomeItemsByName(items);
}

function extractIncomeItemNearKeyword(text, keywordPattern, name, fallbackCurrency, currentDate) {
  const keywordMatch = text.match(keywordPattern);
  if (!keywordMatch) {
    return null;
  }

  const start = Math.max(0, keywordMatch.index - 120);
  const end = Math.min(text.length, keywordMatch.index + keywordMatch[0].length + 120);
  const nearby = text.slice(start, end);
  const amountMatches = [...nearby.matchAll(/(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?/gi)];
  const closestAmount = amountMatches
    .map((match) => ({
      match,
      distance: Math.abs(start + match.index - keywordMatch.index)
    }))
    .sort((left, right) => left.distance - right.distance)[0]?.match;

  if (!closestAmount) {
    return null;
  }

  const amount = Number(String(closestAmount[1]).replace(/,/g, ""));
  if (!Number.isFinite(amount)) {
    return null;
  }

  const contextStart = Math.max(0, closestAmount.index - 20);
  const contextEnd = Math.min(nearby.length, closestAmount.index + closestAmount[0].length + 100);
  const localContext = nearby.slice(contextStart, contextEnd);

  return makeIncomeItem(
    name,
    amount,
    normalizeCurrencyToken(closestAmount[2]) ?? currencyNear(localContext, /./) ?? fallbackCurrency,
    localContext,
    currentDate
  );
}

function extractExpenseItems(text, fallbackAmount, fallbackCurrency, currentDate) {
  const normalized = normalizeCurrencyWords(text);
  const knownExpenses = [
    {
      name: "Gasolina",
      pattern: /gasolina\s*\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?[^,.]*/i,
      category: "Transportation"
    },
    {
      name: "Super",
      pattern: /(?:\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?[^,.]*?(?:super|súper)|(?:super|súper)[^,.]*?\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?)[^,.]*/i,
      category: "Food"
    },
    {
      name: "Luz",
      pattern: /luz\s*(?:cada\s+dos\s+meses\s*)?\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?[^,.]*/i,
      category: "Housing",
      cadence: "bimonthly"
    },
    {
      name: "Agua",
      pattern: /agua\s*\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?[^,.]*/i,
      category: "Housing"
    },
    {
      name: "Megacable",
      pattern: /megacable\s*\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(usd|mxn|dolares|dólares|dollars?|pesos?)?[^,.]*/i,
      category: "Subscriptions"
    }
  ];

  const expenses = knownExpenses
    .map((definition) => {
      const match = normalized.match(definition.pattern);
      if (!match) {
        return null;
      }
      const amountValue = match[1] ?? match[3];
      const currencyValue = match[2] ?? match[4];
      return makeExpenseItem({
        name: definition.name,
        amount: Number(String(amountValue).replace(/,/g, "")),
        currency: normalizeCurrencyToken(currencyValue) ?? fallbackCurrency,
        context: match[0],
        currentDate,
        category: definition.category,
        cadence: definition.cadence
      });
    })
    .filter(Boolean);

  if (expenses.length > 0) {
    return expenses;
  }

  const name = inferExpenseName(text);
  return [
    makeExpenseItem({
      name,
      amount: fallbackAmount,
      currency: fallbackCurrency,
      context: text,
      currentDate,
      category: inferExpenseCategory(name)
    })
  ];
}

function makeExpenseItem({ name, amount, currency, context, currentDate, category, cadence }) {
  return {
    id: `expense-${slugify(name)}-${currentDate}`,
    name,
    amount,
    currency,
    due_date: currentDate,
    cadence: cadence ?? inferCadence(context),
    type: "regular",
    category,
    confidence: "confirmed"
  };
}

function extractAmountNear(text, pattern) {
  const match = text.match(pattern);
  if (!match) {
    return null;
  }
  const nearby = text.slice(match.index, match.index + 180);
  const amountMatch = nearby.match(/(\d[\d,]*(?:\.\d{1,2})?)\s*(?:usd|mxn|dolares|dólares|dollars?|pesos?)?/i);
  return amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;
}

function currencyNear(text, pattern) {
  const match = text.match(pattern);
  if (!match) {
    return null;
  }
  const nearby = text.slice(match.index, match.index + 180);
  const currencyMatch = nearby.match(/\b(usd|mxn|dolares|dólares|dollars?|pesos?)\b/i);
  return normalizeCurrencyToken(currencyMatch?.[1]);
}

function addSpecificIncomeItem(items, text, { name, pattern, fallbackCurrency, currentDate }) {
  const match = text.match(pattern);
  if (!match) {
    return;
  }

  const amount = Number(String(match[1]).replace(/,/g, ""));
  if (!Number.isFinite(amount)) {
    return;
  }

  items.push(makeIncomeItem(name, amount, normalizeCurrencyToken(match[2]) ?? fallbackCurrency, match[0], currentDate));
}

function makeIncomeItem(name, amount, currency, text, currentDate) {
  const cadence = inferCadence(text);
  const expectedDate = inferExpectedDate(text, currentDate);
  const slug = slugify(name);

  return {
    incomeSource: {
      id: `income-${slug}-${currentDate}`,
      name,
      amount,
      currency,
      cadence,
      variability: /variable|freelance/i.test(text) ? "variable" : "fixed",
      category: /variable|freelance/i.test(text) ? "Variable/Freelance" : "Fixed"
    },
    incomeEvent: {
      id: `income-event-${slug}-${expectedDate}`,
      source: name,
      expected_date: expectedDate,
      expected_amount: amount,
      currency,
      confidence: "confirmed",
      type: "regular",
      category: /variable|freelance/i.test(text) ? "Variable/Freelance" : "Fixed"
    }
  };
}

function dedupeIncomeItemsByName(items) {
  return [...new Map(items.map((item) => [item.incomeSource.name.toLowerCase(), item])).values()];
}

function extractFirstAmount(text) {
  const match = String(text).match(/(?:[$]\s*)?(\d[\d,]*(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function extractCurrency(text) {
  if (/\busd\b|dollars?|d[oó][ˊ'’´`]?lares?/i.test(normalizeCurrencyWords(text))) {
    return "USD";
  }
  if (/\bmxn\b|pesos?/i.test(text)) {
    return "MXN";
  }
  return null;
}

function normalizeCurrencyToken(value) {
  if (!value) {
    return null;
  }
  return /usd|dollars?|dolares|dólares/i.test(value) ? "USD" : "MXN";
}

function normalizeCurrencyWords(text) {
  return String(text)
    .replace(/d[oó][ˊ'’´`]?lares?/gi, " dolares ")
    .replace(/dollars?/gi, " dollars ")
    .replace(/pesos?/gi, " pesos ")
    .replace(/\b(usd|mxn)\b/gi, " $1 ");
}

function inferCadence(text) {
  if (/biweekly|quincenal|viernes\s+si\s+y\s+un\s+viernes\s+no/i.test(text)) {
    return "biweekly";
  }
  if (/cada\s+dos\s+meses|bimonthly/i.test(text)) {
    return "bimonthly";
  }
  if (/weekly|semanal|semana/i.test(text)) {
    return "weekly";
  }
  return "monthly";
}

function inferExpectedDate(text, currentDate) {
  if (/viernes|friday/i.test(text)) {
    return formatDate(nextWeekday(parseLocalDate(currentDate), "friday"));
  }
  return currentDate;
}

function inferIncomeName(text) {
  const calledMatch = String(text).match(/\b(?:empresa\s+llamada|company\s+called)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)/i);
  if (calledMatch?.[1]) {
    return cleanInferredName(calledMatch[1]) || "Income";
  }
  const fromMatch = String(text).match(/\b(?:from|de)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+)/i);
  return cleanInferredName(fromMatch?.[1]) || "Income";
}

function inferExpenseName(text) {
  if (/rent|renta/i.test(text)) return "Rent";
  if (/grocer|s[uú]per/i.test(text)) return "Groceries";
  if (/youtube/i.test(text)) return "YouTube";
  return cleanInferredName(text.replace(/[$]?\d[\d,]*(?:\.\d{1,2})?/g, "")) || "Expense";
}

function inferGoalName(text) {
  if (/school|escuela|colegio/i.test(text)) return "School costs";
  if (/vacation|vacaciones/i.test(text)) return "Vacation";
  if (/debt|deuda|card|tarjeta/i.test(text)) return "Debt payoff";
  return cleanInferredName(text.replace(/[$]?\d[\d,]*(?:\.\d{1,2})?/g, "")) || "Goal";
}

function inferExpenseCategory(name) {
  if (/rent|renta/i.test(name)) return "Housing";
  if (/grocer|s[uú]per/i.test(name)) return "Food";
  if (/youtube|subscription|suscrip/i.test(name)) return "Subscriptions";
  return "Personal/Discretionary";
}

function cleanInferredName(value = "") {
  return String(value)
    .replace(/^.*\b(?:llamada|called)\s+/i, "")
    .replace(/\b(monthly|weekly|biweekly|mensual|semanal|quincenal|income|ingreso|salary|salario)\b/gi, "")
    .replace(/\b(?:que\s+me\s+paga|me\s+paga|pays?\s+me|paga|pays?|for|por)\b.*$/gi, "")
    .replace(/\b(usd|mxn|dollars?|pesos?)\b/gi, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
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
