export const LANGUAGE_STORAGE_KEY = "cash-flow-clarity:language";

const REQUIRED_ORDER = [
  "incomeSources",
  "currentBalance",
  "fixedExpenses",
  "debts",
  "variableExpenseCategories",
  "goals"
];

const COPY = {
  en: {
    greeting:
      "Hi, I’m your Cash Flow Clarity assistant. I help you understand your money, never miss a payment, get rid of debt, and hit your goals. Share whatever feels natural: income, bills, debts, goals, or what’s been on your mind.",
    questions: {
      incomeSources: "What money usually comes in for you, and about how much?",
      currentBalance: "What’s your current available balance right now? Please include the currency.",
      fixedExpenses: "What bills or payments are due regularly?",
      debts: "Do you owe anyone or have debts you’re paying down?",
      variableExpenseCategories: "What do you usually spend on flexible things like food, transport, kids, or personal spending?",
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
      fixedExpenses: "¿Qué pagos o gastos fijos tienes regularmente?",
      debts: "¿Debes dinero o estás pagando alguna deuda?",
      variableExpenseCategories: "¿Cuánto sueles gastar en cosas variables como comida, transporte, niños o gastos personales?",
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
  return REQUIRED_ORDER.filter((category) => !hasCategory(ledger, category));
}

export function getNextOnboardingMessage(ledger, language = "en", userSaidDone = false) {
  const copy = COPY[language] ?? COPY.en;
  const missing = getMissingOnboardingCategories(ledger);

  if (missing.length === 0 || userSaidDone) {
    return `${copy.confirmation}\n${summarizeForConfirmation(ledger)}`;
  }

  return copy.questions[missing[0]];
}

export function isOnboardingComplete(ledger) {
  return getMissingOnboardingCategories(ledger).length === 0;
}

function hasCategory(ledger, category) {
  if (category === "currentBalance") {
    return Boolean(ledger.currentBalance?.amount || ledger.currentBalance?.amount === 0);
  }

  return Array.isArray(ledger[category]) && ledger[category].length > 0;
}

function summarizeForConfirmation(ledger) {
  const pieces = [];
  if (ledger.incomeSources.length) {
    pieces.push(`Income sources: ${ledger.incomeSources.map((item) => item.name).join(", ")}`);
  }
  if (ledger.currentBalance) {
    pieces.push(`Current balance: ${ledger.currentBalance.amount} ${ledger.currentBalance.currency ?? "MXN"}`);
  }
  if (ledger.fixedExpenses.length) {
    pieces.push(`Fixed expenses: ${ledger.fixedExpenses.map((item) => item.name).join(", ")}`);
  }
  if (ledger.debts.length) {
    pieces.push(`Debts: ${ledger.debts.map((item) => item.name).join(", ")}`);
  }
  if (ledger.variableExpenseCategories.length) {
    pieces.push(`Variable spending: ${ledger.variableExpenseCategories.map((item) => item.name).join(", ")}`);
  }
  if (ledger.goals.length) {
    pieces.push(`Goals: ${ledger.goals.map((item) => item.name).join(", ")}`);
  }

  return pieces.join("\n");
}

function getBrowserLocalStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
