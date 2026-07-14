export const SETUP_STORAGE_KEY = "cash-flow-clarity:setup";
export const REVIEW_STORAGE_KEY = "cash-flow-clarity:weekly-review";

export const emptySetupData = Object.freeze({
  incomeSources: [],
  fixedExpenses: [],
  variableExpenseCategories: [],
  goalsDebtsUpcomingExpenses: [],
  nextWeekForecast: null
});

export const sampleSetupData = {
  incomeSources: [
    {
      id: "client-retainer",
      name: "Client retainer",
      amount: 15000,
      cadence: "monthly",
      variability: "fixed"
    }
  ],
  fixedExpenses: [
    {
      id: "rent",
      name: "Rent",
      amount: 12000,
      due_day: 1,
      cadence: "monthly"
    },
    {
      id: "internet",
      name: "Internet",
      amount: 850,
      due_day: 10,
      cadence: "monthly"
    }
  ],
  variableExpenseCategories: [
    {
      id: "groceries",
      name: "Groceries",
      estimated_amount: 3000
    }
  ],
  goalsDebtsUpcomingExpenses: [
    {
      id: "tax-reserve",
      name: "Tax reserve",
      target_amount: 20000,
      target_date: "2026-08-15",
      amount_saved: 5000
    }
  ],
  nextWeekForecast: null
};

export function normalizeSetupData(setupData = emptySetupData) {
  return {
    incomeSources: Array.isArray(setupData.incomeSources) ? setupData.incomeSources : [],
    fixedExpenses: Array.isArray(setupData.fixedExpenses) ? setupData.fixedExpenses : [],
    variableExpenseCategories: Array.isArray(setupData.variableExpenseCategories)
      ? setupData.variableExpenseCategories
      : [],
    goalsDebtsUpcomingExpenses: Array.isArray(setupData.goalsDebtsUpcomingExpenses)
      ? setupData.goalsDebtsUpcomingExpenses
      : [],
    nextWeekForecast: setupData.nextWeekForecast ?? null
  };
}

export function saveSetupData(setupData, storage = globalThis.localStorage) {
  const normalized = normalizeSetupData(setupData);
  storage.setItem(SETUP_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function loadSetupData(storage = globalThis.localStorage) {
  if (!storage) {
    return null;
  }

  const stored = storage.getItem(SETUP_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  return normalizeSetupData(JSON.parse(stored));
}

export function saveWeeklyReview(reviewData, storage = globalThis.localStorage) {
  storage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviewData));
  return reviewData;
}

export function loadWeeklyReview(storage = globalThis.localStorage) {
  if (!storage) {
    return null;
  }

  const stored = storage.getItem(REVIEW_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
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
