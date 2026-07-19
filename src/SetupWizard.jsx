import React, { useState } from "react";

import { getStrings } from "./i18n.js";
import { getDefaultCurrencyForCountry } from "./ledgerData.js";

const sectionStyle = { border: "1px solid #ddd", padding: 16, marginTop: 16 };
const rowStyle = { display: "grid", gap: 8, gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 8 };
const currencyOptions = [
  { label: "MXN", value: "MXN" },
  { label: "USD", value: "USD" }
];

export default function SetupWizard({ initialSetupData, onComplete, language = "en" }) {
  const copy = getStrings(language);
  const steps = [
    copy.incomeSources,
    copy.fixedExpenses,
    copy.variableExpenseCategories,
    copy.goalsDebtsUpcoming
  ];
  const cadenceOptions = [
    { label: copy.weekly, value: "weekly" },
    { label: copy.biweekly, value: "biweekly" },
    { label: copy.monthly, value: "monthly" }
  ];
  const variabilityOptions = [
    { label: copy.fixed, value: "fixed" },
    { label: copy.variable, value: "variable" }
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const [setupData, setSetupData] = useState(initialSetupData);
  const [error, setError] = useState("");
  const defaultCurrency = getDefaultCurrencyForCountry(setupData.country);

  function addItem(collectionName, item) {
    setSetupData((current) => ({
      ...current,
      [collectionName]: [...current[collectionName], item]
    }));
  }

  function updateItem(collectionName, id, field, value) {
    setSetupData((current) => ({
      ...current,
      [collectionName]: current[collectionName].map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  }

  function updateSettings(field, value) {
    setSetupData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [field]: value
      }
    }));
  }

  function updateCurrentBalance(field, value) {
    setSetupData((current) => ({
      ...current,
      currentBalance: {
        amount: 0,
        currency: getDefaultCurrencyForCountry(current.country),
        ...(current.currentBalance ?? {}),
        [field]: value
      }
    }));
  }

  function updateCushionPreference(field, value) {
    setSetupData((current) => ({
      ...current,
      cushionPreference: {
        amount: 0,
        currency: current.currentBalance?.currency ?? getDefaultCurrencyForCountry(current.country),
        ...(current.cushionPreference ?? {}),
        [field]: value
      },
      cushionPreferenceSkipped: false
    }));
  }

  function skipCushionPreference() {
    setSetupData((current) => ({
      ...current,
      cushionPreference: null,
      cushionPreferenceSkipped: true
    }));
  }

  function handleSave() {
    const invalidGoal = setupData.goals.find(
      (goal) =>
        !isNumericValue(goal.target_amount) ||
        !isNumericValue(goal.amount_saved)
    );

    if (invalidGoal) {
      setError(copy.invalidGoal);
      return;
    }

    setError("");
    onComplete(setupData);
  }

  return (
    <section aria-labelledby="setup-title">
      <h1 id="setup-title">{copy.setup}</h1>
      <p>{copy.step} {stepIndex + 1} {copy.of} {steps.length}: {steps[stepIndex]}</p>
      {error ? <p role="alert">{error}</p> : null}

      {stepIndex === 0 ? (
        <fieldset style={{ border: "1px solid #ddd", marginTop: 16, padding: 16 }}>
          <legend>{copy.currentBalance}</legend>
          <label>
            {copy.amount}
            <input
              type="number"
              value={setupData.currentBalance?.amount ?? ""}
              onChange={(event) => updateCurrentBalance("amount", normalizeNumberInput(event.target.value))}
              style={{ boxSizing: "border-box", display: "block", width: 160 }}
            />
          </label>
          <label>
            {copy.currency}
            <select
              value={setupData.currentBalance?.currency ?? defaultCurrency}
              onChange={(event) => updateCurrentBalance("currency", event.target.value)}
              style={{ boxSizing: "border-box", display: "block", width: 160 }}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      ) : null}

      {stepIndex === 0 ? (
        <fieldset style={{ border: "1px solid #ddd", marginTop: 16, padding: 16 }}>
          <legend>{copy.cushionPreference}</legend>
          <p>{copy.cushionPreferencePrompt}</p>
          <label>
            {copy.amount}
            <input
              type="number"
              value={setupData.cushionPreference?.amount ?? ""}
              onChange={(event) => updateCushionPreference("amount", normalizeNumberInput(event.target.value))}
              style={{ boxSizing: "border-box", display: "block", width: 160 }}
            />
          </label>
          <label>
            {copy.currency}
            <select
              value={setupData.cushionPreference?.currency ?? setupData.currentBalance?.currency ?? defaultCurrency}
              onChange={(event) => updateCushionPreference("currency", event.target.value)}
              style={{ boxSizing: "border-box", display: "block", width: 160 }}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={skipCushionPreference} style={{ marginTop: 8 }}>
            {copy.cushionPreferenceSkip}
          </button>
        </fieldset>
      ) : null}

      {stepIndex === 0 ? (
        <SetupSection
          title={copy.incomeSources}
          addLabel={copy.add}
          items={setupData.incomeSources}
          fields={[
            { name: "name", label: copy.name, type: "text" },
            { name: "amount", label: copy.amount, type: "number" },
            { name: "cadence", label: copy.cadence, type: "select", options: cadenceOptions },
            { name: "variability", label: copy.fixedVariable, type: "select", options: variabilityOptions }
          ]}
          onAdd={() =>
            addItem("incomeSources", {
              id: `income-${Date.now()}`,
              name: "",
              amount: 0,
              cadence: "monthly",
              variability: "fixed",
              currency: defaultCurrency
            })
          }
          onChange={(id, field, value) => updateItem("incomeSources", id, field, value)}
        />
      ) : null}

      {stepIndex === 1 ? (
        <SetupSection
          title={copy.fixedExpenses}
          addLabel={copy.add}
          items={setupData.fixedExpenses}
          fields={[
            { name: "name", label: copy.name, type: "text" },
            { name: "amount", label: copy.amount, type: "number" },
            { name: "currency", label: copy.currency, type: "select", options: currencyOptions },
            { name: "due_day", label: copy.dueDay, type: "number" },
            { name: "cadence", label: copy.cadence, type: "select", options: cadenceOptions }
          ]}
          onAdd={() =>
            addItem("fixedExpenses", {
              id: `fixed-${Date.now()}`,
              name: "",
              amount: 0,
              currency: defaultCurrency,
              due_day: 1,
              cadence: "monthly"
            })
          }
          onChange={(id, field, value) => updateItem("fixedExpenses", id, field, value)}
        />
      ) : null}

      {stepIndex === 2 ? (
        <SetupSection
          title={copy.variableExpenseCategories}
          addLabel={copy.add}
          items={setupData.variableExpenseCategories}
          fields={[
            { name: "name", label: copy.name, type: "text" },
            { name: "estimated_amount", label: copy.estimatedAmount, type: "number" }
          ]}
          onAdd={() =>
            addItem("variableExpenseCategories", {
              id: `variable-${Date.now()}`,
              name: "",
              estimated_amount: 0
            })
          }
          onChange={(id, field, value) =>
            updateItem("variableExpenseCategories", id, field, value)
          }
        />
      ) : null}

      {stepIndex === 3 ? (
        <SetupSection
          title={copy.goalsDebtsUpcoming}
          addLabel={copy.add}
          items={setupData.goals}
          fields={[
            { name: "name", label: copy.name, type: "text" },
            { name: "target_amount", label: copy.targetAmount, type: "number", required: true },
            { name: "currency", label: copy.currency, type: "select", options: currencyOptions },
            { name: "target_date", label: copy.targetDate, type: "date" },
            { name: "amount_saved", label: copy.amountSaved, type: "number", required: true }
          ]}
          onAdd={() =>
            addItem("goals", {
              id: `goal-${Date.now()}`,
              name: "",
              target_amount: 0,
              currency: defaultCurrency,
              target_date: new Date().toISOString().slice(0, 10),
              amount_saved: 0
            })
          }
          onChange={(id, field, value) =>
            updateItem("goals", id, field, value)
          }
        />
      ) : null}

      {stepIndex === 3 ? (
        <fieldset style={{ border: "1px solid #ddd", marginTop: 16, padding: 16 }}>
          <legend>{copy.settings}</legend>
          <label>
            {copy.mxnPerUsd}
            <input
              type="number"
              value={setupData.settings?.mxn_per_usd ?? 18.5}
              onChange={(event) => updateSettings("mxn_per_usd", Number(event.target.value))}
              style={{ boxSizing: "border-box", display: "block", width: 160 }}
            />
          </label>
        </fieldset>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex(stepIndex - 1)}>
          {copy.back}
        </button>
        {stepIndex < steps.length - 1 ? (
          <button type="button" onClick={() => setStepIndex(stepIndex + 1)}>
            {copy.next}
          </button>
        ) : (
          <button type="button" onClick={handleSave}>
            {copy.saveSetup}
          </button>
        )}
      </div>
    </section>
  );
}

function SetupSection({ title, addLabel, items, fields, onAdd, onChange }) {
  return (
    <section style={sectionStyle}>
      <h2>{title}</h2>
      <button type="button" onClick={onAdd}>{addLabel}</button>
      {items.map((item) => (
        <div key={item.id} style={rowStyle}>
          {fields.map((field) => (
            <SetupField
              key={field.name}
              field={field}
              item={item}
              onChange={onChange}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

function SetupField({ field, item, onChange }) {
  const value = item[field.name];

  return (
    <label>
      {field.label}
      {field.type === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(item.id, field.name, event.target.value)}
          style={{ boxSizing: "border-box", display: "block", width: "100%" }}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type}
          required={field.required}
          value={value}
          onChange={(event) =>
            onChange(
              item.id,
              field.name,
              field.type === "number" ? normalizeNumberInput(event.target.value) : event.target.value
            )
          }
          style={{ boxSizing: "border-box", display: "block", width: "100%" }}
        />
      )}
    </label>
  );
}

function normalizeNumberInput(value) {
  return value === "" ? "" : Number(value);
}

function isNumericValue(value) {
  return value !== "" && Number.isFinite(Number(value));
}
