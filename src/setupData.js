import {
  LEDGER_STORAGE_KEY,
  createMemoryStorage,
  emptyLedger,
  loadLedger,
  normalizeLedger,
  sampleLedger,
  saveLedger
} from "./ledgerData.js";

export const SETUP_STORAGE_KEY = LEDGER_STORAGE_KEY;
export const REVIEW_STORAGE_KEY = "cash-flow-clarity:weekly-review";
export const emptySetupData = emptyLedger;
export const sampleSetupData = sampleLedger;

export function normalizeSetupData(setupData = emptySetupData) {
  return normalizeLedger(setupData);
}

export function saveSetupData(setupData, storage = globalThis.localStorage) {
  return saveLedger(setupData, storage);
}

export function loadSetupData(storage = globalThis.localStorage) {
  return loadLedger(storage);
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

export { createMemoryStorage };
