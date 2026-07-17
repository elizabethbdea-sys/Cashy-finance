import React, { useState } from "react";

const steps = [
  "Income sources",
  "Fixed expenses",
  "Variable expense categories",
  "Goals, debts, and upcoming expenses"
];

const sectionStyle = { border: "1px solid #ddd", padding: 16, marginTop: 16 };
const rowStyle = { display: "grid", gap: 8, gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 8 };
const cadenceOptions = [
  { label: "Weekly", value: "weekly" },
  { label: "Biweekly", value: "biweekly" },
  { label: "Monthly", value: "monthly" }
];
const variabilityOptions = [
  { label: "Fixed", value: "fixed" },
  { label: "Variable", value: "variable" }
];
const currencyOptions = [
  { label: "MXN", value: "MXN" },
  { label: "USD", value: "USD" }
];

export default function SetupWizard({ initialSetupData, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [setupData, setSetupData] = useState(initialSetupData);
  const [error, setError] = useState("");

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

  function handleSave() {
    const invalidGoal = setupData.goals.find(
      (goal) =>
        !isNumericValue(goal.target_amount) ||
        !isNumericValue(goal.amount_saved)
    );

    if (invalidGoal) {
      setError("Goals/debts need numeric target amount and amount saved values.");
      return;
    }

    setError("");
    onComplete(setupData);
  }

  return (
    <section aria-labelledby="setup-title">
      <h1 id="setup-title">Setup</h1>
      <p>Step {stepIndex + 1} of {steps.length}: {steps[stepIndex]}</p>
      {error ? <p role="alert">{error}</p> : null}

      {stepIndex === 0 ? (
        <SetupSection
          title="Income sources"
          items={setupData.incomeSources}
          fields={[
            { name: "name", label: "Name", type: "text" },
            { name: "amount", label: "Amount", type: "number" },
            { name: "cadence", label: "Cadence", type: "select", options: cadenceOptions },
            { name: "variability", label: "Fixed/variable", type: "select", options: variabilityOptions }
          ]}
          onAdd={() =>
            addItem("incomeSources", {
              id: `income-${Date.now()}`,
              name: "",
              amount: 0,
              cadence: "monthly",
              variability: "fixed"
            })
          }
          onChange={(id, field, value) => updateItem("incomeSources", id, field, value)}
        />
      ) : null}

      {stepIndex === 1 ? (
        <SetupSection
          title="Fixed expenses"
          items={setupData.fixedExpenses}
          fields={[
            { name: "name", label: "Name", type: "text" },
            { name: "amount", label: "Amount", type: "number" },
            { name: "currency", label: "Currency", type: "select", options: currencyOptions },
            { name: "due_day", label: "Due day", type: "number" },
            { name: "cadence", label: "Cadence", type: "select", options: cadenceOptions }
          ]}
          onAdd={() =>
            addItem("fixedExpenses", {
              id: `fixed-${Date.now()}`,
              name: "",
              amount: 0,
              currency: "MXN",
              due_day: 1,
              cadence: "monthly"
            })
          }
          onChange={(id, field, value) => updateItem("fixedExpenses", id, field, value)}
        />
      ) : null}

      {stepIndex === 2 ? (
        <SetupSection
          title="Variable expense categories"
          items={setupData.variableExpenseCategories}
          fields={[
            { name: "name", label: "Name", type: "text" },
            { name: "estimated_amount", label: "Estimated amount", type: "number" }
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
          title="Goals, debts, and upcoming expenses"
          items={setupData.goals}
          fields={[
            { name: "name", label: "Name", type: "text" },
            { name: "target_amount", label: "Target amount", type: "number", required: true },
            { name: "currency", label: "Currency", type: "select", options: currencyOptions },
            { name: "target_date", label: "Target date", type: "date" },
            { name: "amount_saved", label: "Amount saved", type: "number", required: true }
          ]}
          onAdd={() =>
            addItem("goals", {
              id: `goal-${Date.now()}`,
              name: "",
              target_amount: 0,
              currency: "MXN",
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
          <legend>Settings</legend>
          <label>
            MXN per USD
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
          Back
        </button>
        {stepIndex < steps.length - 1 ? (
          <button type="button" onClick={() => setStepIndex(stepIndex + 1)}>
            Next
          </button>
        ) : (
          <button type="button" onClick={handleSave}>
            Save setup
          </button>
        )}
      </div>
    </section>
  );
}

function SetupSection({ title, items, fields, onAdd, onChange }) {
  return (
    <section style={sectionStyle}>
      <h2>{title}</h2>
      <button type="button" onClick={onAdd}>Add</button>
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
