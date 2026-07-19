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
      currentBalance: "What’s your current available balance right now? Please include the currency.",
      expenses: "Now let’s map your expenses — rent, subscriptions, debt payments, groceries, transportation, and anything else you plan for.",
      expensesFollowUp: "Anything else on the expense side — regular bills, variable spending, or upcoming payments?",
      cushionPreference: "What’s the minimum balance you’d like to keep as a safety cushion? You can give a number and currency, or say skip.",
      goals: "Last, any goals, debts, or big upcoming expenses — like a vacation, a car, school costs, or paying off a debt?",
      goalsFollowUp: "Anything else for goals, debts, or big upcoming expenses?"
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
      currentBalance: "¿Cuál es tu saldo disponible actual? Incluye la moneda, por favor.",
      expenses: "Ahora mapeemos tus gastos: renta, suscripciones, pagos de deuda, súper, transporte y cualquier otra cosa que planees.",
      expensesFollowUp: "¿Algo más del lado de gastos: pagos regulares, gasto variable o próximos pagos?",
      cushionPreference: "¿Cuál es el saldo mínimo que quieres mantener como colchón de seguridad? Puedes dar un número y moneda, u omitirlo.",
      goals: "Por último, ¿alguna meta, deuda o gasto grande próximo, como vacaciones, un coche, costos escolares o pagar una deuda?",
      goalsFollowUp: "¿Algo más sobre metas, deudas o gastos grandes próximos?"
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
  return getNextOnboardingUpdate(ledger, language, userSaidDone).message;
}

export function getNextOnboardingUpdate(ledger, language = "en", userSaidDone = false) {
  const copy = COPY[language] ?? COPY.en;
  const progress = normalizeProgress(ledger?.onboardingProgress);
  const hasIncomeData = hasCategory(ledger, "incomeSources") || hasCategory(ledger, "incomeEvents");
  const hasExpenseData = hasCategory(ledger, "expenses");
  const hasGoalsOrDebtsData = hasCategory(ledger, "goals") || hasCategory(ledger, "debts");

  if (!hasIncomeData) {
    return { message: copy.questions.incomeSources, ledger };
  }

  if (!ledger.currentBalance) {
    return { message: copy.questions.currentBalance, ledger };
  }

  if (!hasExpenseData) {
    if (!progress.incomeFollowUpAsked && !hasGoalsOrDebtsData && !userSaidDone) {
      return withProgress(ledger, copy.questions.incomeFollowUp, {
        incomeFollowUpAsked: true
      });
    }
    return { message: copy.questions.expenses, ledger };
  }

  if (!hasGoalsOrDebtsData && !userSaidDone) {
    if (!progress.expensesFollowUpAsked) {
      return withProgress(ledger, copy.questions.expensesFollowUp, {
        expensesFollowUpAsked: true
      });
    }
    return { message: copy.questions.goals, ledger };
  }

  if (
    hasGoalsOrDebtsData &&
    progress.expensesFollowUpAsked &&
    !progress.goalsFollowUpAsked &&
    !userSaidDone
  ) {
    return withProgress(ledger, copy.questions.goalsFollowUp, {
      goalsFollowUpAsked: true
    });
  }

  if (!ledger.cushionPreference && !ledger.cushionPreferenceSkipped) {
    return { message: copy.questions.cushionPreference, ledger };
  }

  if (userSaidDone) {
    return { message: `${copy.confirmation}\n${summarizeForConfirmation(ledger, language)}`, ledger };
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
    goalsFollowUpAsked: Boolean(progress.goalsFollowUpAsked)
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
    pieces.push(`${labels.incomeSources}: ${ledger.incomeSources.map((item) => item.name).join(", ")}`);
  }
  if (ledger.currentBalance) {
    pieces.push(`${labels.currentBalance}: ${ledger.currentBalance.amount} ${ledger.currentBalance.currency ?? "MXN"}`);
  }
  if (ledger.cushionPreference) {
    pieces.push(`${language === "es" ? "Colchón de seguridad" : "Safety cushion"}: ${ledger.cushionPreference.amount} ${ledger.cushionPreference.currency ?? "MXN"}`);
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
