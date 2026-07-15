import assert from "node:assert/strict";
import test from "node:test";

import {
  SETUP_STORAGE_KEY,
  createMemoryStorage,
  loadSetupData,
  sampleSetupData,
  saveSetupData
} from "../src/setupData.js";

test("setup data saves and loads from localStorage correctly", () => {
  const storage = createMemoryStorage();

  const saved = saveSetupData(sampleSetupData, storage);
  const loaded = loadSetupData(storage);

  assert.deepEqual(loaded, saved);
  assert.deepEqual(JSON.parse(storage.getItem(SETUP_STORAGE_KEY)), saved);
});
