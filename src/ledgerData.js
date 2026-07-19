export const LEDGER_STORAGE_KEY = "cash-flow-clarity:ledger";
export const LEGACY_SETUP_STORAGE_KEY = "cash-flow-clarity:setup";

export const emptyLedger = Object.freeze({
  incomeSources: [],
  fixedExpenses: [],
  debts: [],
  goals: [],
  incomeEvents: [],
  currentBalance: null,
  variableExpenseCategories: [],
  weeklyBalances: [],
  onboardingConfirmed: false,
  settings: {
    mxn_per_usd: 18.5,
    language: null
  },
  nextWeekForecast: null
});

export const sampleLedger = {
  incomeSources: [
    {
      id: "client-retainer",
      name: "Client retainer",
      amount: 15000,
      currency: "MXN",
      cadence: "monthly",
      variability: "fixed",
      category: "Fixed"
    }
  ],
  fixedExpenses: [
    {
      id: "rent",
      name: "Rent",
      amount: 12000,
      currency: "MXN",
      due_day: 1,
      cadence: "monthly",
      type: "regular",
      category: "Housing"
    },
    {
      id: "internet",
      name: "Internet",
      amount: 850,
      currency: "MXN",
      due_day: 10,
      cadence: "monthly",
      type: "regular",
      category: "Subscriptions"
    }
  ],
  debts: [],
  goals: [
    {
      id: "tax-reserve",
      name: "Tax reserve",
      target_amount: 20000,
      currency: "MXN",
      target_date: "2026-08-15",
      amount_saved: 5000,
      confidence: "confirmed"
    }
  ],
  incomeEvents: [],
  currentBalance: null,
  variableExpenseCategories: [
    {
      id: "groceries",
      name: "Groceries",
      estimated_amount: 3000
    }
  ],
  weeklyBalances: [],
  onboardingConfirmed: false,
  settings: {
    mxn_per_usd: 18.5,
    language: null
  },
  nextWeekForecast: null
};

export function normalizeLedger(ledger = emptyLedger) {
  return {
    incomeSources: Array.isArray(ledger.incomeSources) ? ledger.incomeSources : [],
    fixedExpenses: withDefaultCurrency(
      Array.isArray(ledger.fixedExpenses) ? ledger.fixedExpenses : []
    ),
    debts: withDefaultCurrency(Array.isArray(ledger.debts) ? ledger.debts : []),
    goals: withDefaultCurrency(Array.isArray(ledger.goals)
      ? ledger.goals
      : Array.isArray(ledger.goalsDebtsUpcomingExpenses)
        ? ledger.goalsDebtsUpcomingExpenses
        : []),
    incomeEvents: withDefaultCurrency(Array.isArray(ledger.incomeEvents) ? ledger.incomeEvents : []),
    currentBalance: ledger.currentBalance ?? null,
    variableExpenseCategories: Array.isArray(ledger.variableExpenseCategories)
      ? ledger.variableExpenseCategories
      : [],
    weeklyBalances: Array.isArray(ledger.weeklyBalances) ? ledger.weeklyBalances : [],
    onboardingConfirmed: Boolean(ledger.onboardingConfirmed),
    settings: {
      mxn_per_usd: Number(ledger.settings?.mxn_per_usd) || 18.5,
      language: ledger.settings?.language ?? null
    },
    nextWeekForecast: ledger.nextWeekForecast ?? null
  };
}

export function saveLedger(ledger, storage = globalThis.localStorage) {
  const normalized = normalizeLedger(ledger);
  storage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function loadLedger(storage = globalThis.localStorage) {
  if (!storage) {
    return null;
  }

  const storedLedger = storage.getItem(LEDGER_STORAGE_KEY);
  if (storedLedger) {
    return normalizeLedger(JSON.parse(storedLedger));
  }

  const legacySetup = storage.getItem(LEGACY_SETUP_STORAGE_KEY);
  if (legacySetup) {
    const migrated = normalizeLedger(JSON.parse(legacySetup));
    saveLedger(migrated, storage);
    return migrated;
  }

  return null;
}

export function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    }
  };
}

export function applyLedgerChanges(ledger, changes) {
  const normalized = normalizeLedger(ledger);

  return normalizeLedger({
    ...normalized,
    ...changes,
    incomeSources: mergeById(normalized.incomeSources, changes?.incomeSources),
    fixedExpenses: mergeById(normalized.fixedExpenses, changes?.fixedExpenses),
    debts: mergeById(normalized.debts, changes?.debts),
    goals: mergeById(normalized.goals, changes?.goals),
    incomeEvents: mergeById(normalized.incomeEvents, changes?.incomeEvents),
    variableExpenseCategories: mergeById(
      normalized.variableExpenseCategories,
      changes?.variableExpenseCategories
    ),
    weeklyBalances: Array.isArray(changes?.weeklyBalances)
      ? changes.weeklyBalances
      : normalized.weeklyBalances,
    onboardingConfirmed:
      changes?.onboardingConfirmed === undefined
        ? normalized.onboardingConfirmed
        : Boolean(changes.onboardingConfirmed),
    settings: {
      ...normalized.settings,
      ...(changes?.settings ?? {})
    },
    currentBalance:
      changes?.currentBalance === undefined ? normalized.currentBalance : changes.currentBalance,
    nextWeekForecast:
      changes?.nextWeekForecast === undefined
        ? normalized.nextWeekForecast
        : changes.nextWeekForecast
  });
}

export function summarizeLedger(ledger) {
  const normalized = normalizeLedger(ledger);
  const combinedTotals = calculateLedgerCombinedTotals(normalized);

  return {
    incomeSources: normalized.incomeSources.map(({ name, amount, currency, cadence, variability, category }) => ({
      name,
      amount,
      currency,
      cadence,
      variability,
      category
    })),
    fixedExpenses: normalized.fixedExpenses.map(({ name, amount, currency, due_day, due_date, cadence, type, category, confidence }) => ({
      name,
      amount,
      currency,
      due_day,
      due_date,
      cadence,
      type,
      category,
      confidence
    })),
    debts: normalized.debts.map(({ name, amount, currency, due_day, due_date, type, category, confidence }) => ({
      name,
      amount,
      currency,
      due_day,
      due_date,
      type,
      category,
      confidence
    })),
    goals: normalized.goals.map(({ name, target_amount, currency, target_date, amount_saved, confidence }) => ({
      name,
      target_amount,
      currency,
      target_date,
      amount_saved,
      confidence
    })),
    incomeEvents: normalized.incomeEvents.map(
      ({ source, expected_date, expected_amount, currency, confidence, type, category }) => ({
        source,
        expected_date,
        expected_amount,
        currency,
        confidence,
        type,
        category
      })
    ),
    currentBalance: normalized.currentBalance,
    weeklyBalances: normalized.weeklyBalances,
    settings: normalized.settings,
    combinedTotals
  };
}

export function toMxn(amount, currency = "MXN", settings = emptyLedger.settings) {
  const numericAmount = Number(amount) || 0;
  return currency === "USD" ? numericAmount * (Number(settings.mxn_per_usd) || 18.5) : numericAmount;
}

export function calculateLedgerCombinedTotals(ledger) {
  const normalized = normalizeLedger(ledger);
  const { settings } = normalized;

  return {
    incomeEventsMxn: normalized.incomeEvents.reduce(
      (total, event) => total + toMxn(event.expected_amount, event.currency, settings),
      0
    ),
    fixedExpensesMxn: normalized.fixedExpenses.reduce(
      (total, expense) => total + toMxn(expense.amount, expense.currency, settings),
      0
    ),
    debtsMxn: normalized.debts.reduce(
      (total, debt) => total + toMxn(debt.amount, debt.currency, settings),
      0
    ),
    currentBalanceMxn: normalized.currentBalance
      ? toMxn(normalized.currentBalance.amount, normalized.currentBalance.currency, settings)
      : 0,
    goalsMxn: normalized.goals.reduce(
      (total, goal) => total + toMxn(goal.target_amount, goal.currency, settings),
      0
    )
  };
}

function withDefaultCurrency(items) {
  return items.map((item) => ({
    currency: "MXN",
    ...item
  }));
}

function mergeById(currentItems, changedItems) {
  if (!Array.isArray(changedItems)) {
    return currentItems;
  }

  const merged = new Map(currentItems.map((item) => [item.id, item]));

  changedItems.forEach((item) => {
    const id = item.id ?? makeId(item);
    merged.set(id, {
      ...(merged.get(id) ?? {}),
      ...item,
      id
    });
  });

  return [...merged.values()];
}

function makeId(item) {
  const base = item.source ?? item.name ?? "ledger-item";
  return `${String(base).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
}
