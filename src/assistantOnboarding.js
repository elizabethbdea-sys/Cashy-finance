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
      "Let's start with your income — tell me all your income sources, fixed or variable, and how often you get them.",
    questions: {
      incomeSources: "Let's start with your income — tell me all your income sources, fixed or variable, and how often you get them.",
      incomeFollowUp: "Anything else I should know — any other income sources?",
      incomeRequired: "I still need at least one income source before we keep going. What money usually comes in, and how often?",
      expenses: "Now let’s map your expenses — rent, subscriptions, debt payments, groceries, transportation, and anything else you plan for.",
      expensesRequired: "I still need at least one expense to build your Burn Rate. What regular or flexible spending should I include?",
      currentBalance: "What’s your current available balance right now? This helps calculate your Burn Rate. Please include the currency.",
      cushionPreference: "What’s the minimum balance you’d like to keep as a safety cushion? You can give a number and currency, or say skip.",
      goals: "Last, any goals, debts, or big upcoming expenses — like a vacation, a car, school costs, or paying off a debt?",
      balanceRequired: "I still need your current available balance before I can show your Burn Rate. About how much is available right now?"
    },
    confirmation:
      "Here’s what I understood. Does this look right, or should I change anything before we continue?",
    done: "That’s everything I need for now. I’ll use this ledger to help you plan."
  },
  es: {
    greeting:
      "Empecemos con tus ingresos: cuéntame todas tus fuentes de ingreso, fijas o variables, y cada cuándo las recibes.",
    questions: {
      incomeSources: "Empecemos con tus ingresos: cuéntame todas tus fuentes de ingreso, fijas o variables, y cada cuándo las recibes.",
      incomeFollowUp: "¿Hay algo más que deba saber: alguna otra fuente de ingreso?",
      incomeRequired: "Todavía necesito al menos una fuente de ingreso antes de seguir. ¿Qué dinero te entra y cada cuándo?",
      expenses: "Ahora mapeemos tus gastos: renta, suscripciones, pagos de deuda, súper, transporte y cualquier otra cosa que planees.",
      expensesRequired: "Todavía necesito al menos un gasto para calcular tu Burn Rate. ¿Qué gastos regulares o variables debo incluir?",
      currentBalance: "¿Cuál es tu saldo disponible actual? Esto ayuda a calcular tu Burn Rate. Incluye la moneda, por favor.",
      cushionPreference: "¿Cuál es el saldo mínimo que quieres mantener como colchón de seguridad? Puedes dar un número y moneda, u omitirlo.",
      goals: "Por último, ¿alguna meta, deuda o gasto grande próximo, como vacaciones, un coche, costos escolares o pagar una deuda?",
      balanceRequired: "Todavía necesito tu saldo disponible actual antes de mostrar tu Burn Rate. ¿Más o menos cuánto tienes disponible ahora?"
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

export function clearLanguage(storage = getBrowserLocalStorage()) {
  storage?.removeItem(LANGUAGE_STORAGE_KEY);
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
  return getNextOnboardingUpdate(ledger, language, userSaidDone).message;
}

export function getNextOnboardingUpdate(ledger, language = "en", userSaidDone = false) {
  const copy = COPY[language] ?? COPY.en;
  const progress = normalizeProgress(ledger?.onboardingProgress);
  const hasIncomeData = hasCategory(ledger, "incomeSources") || hasCategory(ledger, "incomeEvents");
  const hasExpenseData = hasCategory(ledger, "expenses");

  if (!hasIncomeData) {
    return { message: progress.incomeFollowUpAsked ? copy.questions.incomeRequired : copy.questions.incomeSources, ledger };
  }

  if (!progress.incomeFollowUpAsked) {
    return withProgress(ledger, copy.questions.incomeFollowUp, {
      incomeFollowUpAsked: true
    });
  }

  if (!progress.expensesPrompted) {
    return withProgress(ledger, copy.questions.expenses, {
      expensesPrompted: true
    });
  }

  if (!hasExpenseData) {
    return { message: copy.questions.expensesRequired, ledger };
  }

  if (!progress.goalsPrompted) {
    return withProgress(ledger, copy.questions.goals, {
      goalsPrompted: true
    });
  }

  if (!progress.balancePrompted) {
    return withProgress(ledger, copy.questions.currentBalance, {
      balancePrompted: true
    });
  }

  if (!ledger.currentBalance) {
    return { message: copy.questions.balanceRequired, ledger };
  }

  if (!ledger.cushionPreference && !ledger.cushionPreferenceSkipped) {
    return withProgress(ledger, copy.questions.cushionPreference, {
      cushionPrompted: true
    });
  }

  if (!progress.summaryShown || userSaidDone) {
    return withProgress(ledger, `${copy.confirmation}\n${summarizeForConfirmation(ledger, language)}`, {
      summaryShown: true
    });
  }

  return { message: `${copy.confirmation}\n${summarizeForConfirmation(ledger, language)}`, ledger };
}

export function isOnboardingComplete(ledger) {
  return Boolean(ledger.onboardingConfirmed) && getMissingMinimumOnboardingCategories(ledger).length === 0;
}

export function hasMinimumOnboardingData(ledger) {
  return getMissingMinimumOnboardingCategories(ledger).length === 0;
}

function hasCategory(ledger, category) {
  if (!ledger) {
    return false;
  }
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

function withProgress(ledger, message, progressPatch) {
  return {
    message,
    ledger: {
      ...ledger,
      onboardingProgress: {
        ...normalizeProgress(ledger?.onboardingProgress),
        ...progressPatch
      }
    }
  };
}

function normalizeProgress(progress = {}) {
  return {
    incomeFollowUpAsked: Boolean(progress.incomeFollowUpAsked),
    expensesFollowUpAsked: Boolean(progress.expensesFollowUpAsked),
    expensesPrompted: Boolean(progress.expensesPrompted),
    goalsPrompted: Boolean(progress.goalsPrompted),
    balancePrompted: Boolean(progress.balancePrompted),
    cushionPrompted: Boolean(progress.cushionPrompted),
    summaryShown: Boolean(progress.summaryShown)
  };
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
    pieces.push(`${labels.incomeSources}: ${ledger.incomeSources.map(formatIncomeSource).join(", ")}`);
  }
  if (ledger.currentBalance) {
    pieces.push(`${labels.currentBalance}: ${ledger.currentBalance.amount} ${ledger.currentBalance.currency ?? "MXN"}`);
  }
  if (ledger.cushionPreference) {
    pieces.push(`${language === "es" ? "Colchón de seguridad" : "Safety cushion"}: ${ledger.cushionPreference.amount} ${ledger.cushionPreference.currency ?? "MXN"}`);
  }
  if (ledger.fixedExpenses.length) {
    pieces.push(`${labels.fixedExpenses}: ${ledger.fixedExpenses.map(formatExpense).join(", ")}`);
  }
  if (ledger.debts.length) {
    pieces.push(`${labels.debts}: ${ledger.debts.map(formatExpense).join(", ")}`);
  }
  if (ledger.variableExpenseCategories.length) {
    pieces.push(`${labels.variableSpending}: ${ledger.variableExpenseCategories.map((item) => item.name).join(", ")}`);
  }
  if (ledger.goals.length) {
    pieces.push(`${labels.goals}: ${ledger.goals.map(formatGoal).join(", ")}`);
  }

  return pieces.join("\n");
}

function formatIncomeSource(item) {
  return `${item.name} (${item.amount} ${item.currency ?? "MXN"}${item.cadence ? `, ${item.cadence}` : ""})`;
}

function formatExpense(item) {
  return `${item.name} (${item.amount} ${item.currency ?? "MXN"})`;
}

function formatGoal(item) {
  return `${item.name} (${item.target_amount ?? item.amount ?? 0} ${item.currency ?? "MXN"})`;
}

function getBrowserLocalStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
