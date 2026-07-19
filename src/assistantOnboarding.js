export const LANGUAGE_STORAGE_KEY = "cash-flow-clarity:language";

const OPTIONAL_ORDER = [
  "debts",
  "goals"
];

const MINIMUM_ORDER = [
  "incomeSources",
  "currentBalance",
  "expenses"
];

const COPY = {
  en: {
    greeting:
      "Hi, I’m your Cash Flow Clarity assistant. I help you understand your money, never miss a payment, get rid of debt, and hit your goals. Share whatever feels natural: income, bills, debts, goals, or what’s been on your mind.",
    questions: {
      incomeSources: "What money usually comes in for you, and about how much?",
      currentBalance: "What’s your current available balance right now? Please include the currency.",
      expenses: "What regular or flexible expenses should I plan for?",
      debts: "Do you owe anyone or have debts you’re paying down?",
      goals: "What goals or upcoming expenses do you want to plan for?"
    },
    confirmation:
      "Here’s what I understood. Does this look right, or should I change anything before we continue?",
    done: "That’s everything I need for now. I’ll use this ledger to help you plan."
  },
  es: {
    greeting:
      "Hola, soy tu asistente de Cash Flow Clarity. Te ayudo a entender tu dinero, no olvidar pagos, salir de deudas y avanzar hacia tus metas. Cuéntame como te salga natural: ingresos, pagos, deudas, metas o lo que tengas en mente.",
    questions: {
      incomeSources: "¿Qué dinero te entra normalmente y más o menos cuánto?",
      currentBalance: "¿Cuál es tu saldo disponible actual? Incluye la moneda, por favor.",
      expenses: "¿Qué gastos regulares o variables debo planear?",
      debts: "¿Debes dinero o estás pagando alguna deuda?",
      goals: "¿Qué metas o gastos próximos quieres planear?"
    },
    confirmation:
      "Esto fue lo que entendí. ¿Está bien o quieres que cambie algo antes de seguir?",
    done: "Con esto tengo suficiente por ahora. Usaré este ledger para ayudarte a planear."
  }
};

export function loadLanguage(storage = getBrowserLocalStorage()) {
  return storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
}

export function saveLanguage(language, storage = getBrowserLocalStorage()) {
  storage?.setItem(LANGUAGE_STORAGE_KEY, language);
  return language;
}

export function getAssistantGreeting(language = "en") {
  return COPY[language]?.greeting ?? COPY.en.greeting;
}

export function getMissingOnboardingCategories(ledger) {
  return [...MINIMUM_ORDER, ...OPTIONAL_ORDER].filter((category) => !hasCategory(ledger, category));
}

export function getMissingMinimumOnboardingCategories(ledger) {
  return MINIMUM_ORDER.filter((category) => !hasCategory(ledger, category));
}

export function getNextOnboardingMessage(ledger, language = "en", userSaidDone = false) {
  const copy = COPY[language] ?? COPY.en;
  const missingMinimum = getMissingMinimumOnboardingCategories(ledger);

  if (missingMinimum.length > 0) {
    return copy.questions[missingMinimum[0]];
  }

  if (userSaidDone) {
    return `${copy.confirmation}\n${summarizeForConfirmation(ledger, language)}`;
  }

  const missingOptional = OPTIONAL_ORDER.filter((category) => !hasCategory(ledger, category));
  return missingOptional.length > 0 ? copy.questions[missingOptional[0]] : `${copy.confirmation}\n${summarizeForConfirmation(ledger, language)}`;
}

export function isOnboardingComplete(ledger) {
  return Boolean(ledger.onboardingConfirmed) && getMissingMinimumOnboardingCategories(ledger).length === 0;
}

export function hasMinimumOnboardingData(ledger) {
  return getMissingMinimumOnboardingCategories(ledger).length === 0;
}

function hasCategory(ledger, category) {
  if (category === "currentBalance") {
    return Boolean(ledger.currentBalance?.amount || ledger.currentBalance?.amount === 0);
  }
  if (category === "expenses") {
    return (
      (Array.isArray(ledger.fixedExpenses) && ledger.fixedExpenses.length > 0) ||
      (Array.isArray(ledger.variableExpenseCategories) && ledger.variableExpenseCategories.length > 0)
    );
  }

  return Array.isArray(ledger[category]) && ledger[category].length > 0;
}

function summarizeForConfirmation(ledger, language = "en") {
  const labels =
    language === "es"
      ? {
          incomeSources: "Fuentes de ingreso",
          currentBalance: "Saldo actual",
          fixedExpenses: "Gastos fijos",
          debts: "Deudas",
          variableSpending: "Gasto variable",
          goals: "Metas"
        }
      : {
          incomeSources: "Income sources",
          currentBalance: "Current balance",
          fixedExpenses: "Fixed expenses",
          debts: "Debts",
          variableSpending: "Variable spending",
          goals: "Goals"
        };
  const pieces = [];
  if (ledger.incomeSources.length) {
    pieces.push(`${labels.incomeSources}: ${ledger.incomeSources.map((item) => item.name).join(", ")}`);
  }
  if (ledger.currentBalance) {
    pieces.push(`${labels.currentBalance}: ${ledger.currentBalance.amount} ${ledger.currentBalance.currency ?? "MXN"}`);
  }
  if (ledger.fixedExpenses.length) {
    pieces.push(`${labels.fixedExpenses}: ${ledger.fixedExpenses.map((item) => item.name).join(", ")}`);
  }
  if (ledger.debts.length) {
    pieces.push(`${labels.debts}: ${ledger.debts.map((item) => item.name).join(", ")}`);
  }
  if (ledger.variableExpenseCategories.length) {
    pieces.push(`${labels.variableSpending}: ${ledger.variableExpenseCategories.map((item) => item.name).join(", ")}`);
  }
  if (ledger.goals.length) {
    pieces.push(`${labels.goals}: ${ledger.goals.map((item) => item.name).join(", ")}`);
  }

  return pieces.join("\n");
}

function getBrowserLocalStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
