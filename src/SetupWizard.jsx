import React, { useState } from "react";

const steps = [
  "Income sources",
  "Fixed expenses",
  "Variable expense categories",
  "Goals, debts, and upcoming expenses"
];

const sectionStyle = { border: "1px solid #ddd", padding: 16, marginTop: 16 };
const rowStyle = { display: "grid", gap: 8, gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 8 };

export default function SetupWizard({ initialSetupData, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [setupData, setSetupData] = useState(initialSetupData);

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

  function handleSave() {
    onComplete(setupData);
  }

  return (
    <section aria-labelledby="setup-title">
      <h1 id="setup-title">Setup</h1>
      <p>Step {stepIndex + 1} of {steps.length}: {steps[stepIndex]}</p>

      {stepIndex === 0 ? (
        <SetupSection
          title="Income sources"
          items={setupData.incomeSources}
          fields={[
            ["name", "Name", "text"],
            ["amount", "Amount", "number"],
            ["cadence", "Cadence", "text"],
            ["variability", "Fixed/variable", "text"]
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
            ["name", "Name", "text"],
            ["amount", "Amount", "number"],
            ["due_day", "Due day", "number"],
            ["cadence", "Cadence", "text"]
          ]}
          onAdd={() =>
            addItem("fixedExpenses", {
              id: `fixed-${Date.now()}`,
              name: "",
              amount: 0,
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
            ["name", "Name", "text"],
            ["estimated_amount", "Estimated amount", "number"]
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
          items={setupData.goalsDebtsUpcomingExpenses}
          fields={[
            ["name", "Name", "text"],
            ["target_amount", "Target amount", "number"],
            ["target_date", "Target date", "date"],
            ["amount_saved", "Amount saved", "number"]
          ]}
          onAdd={() =>
            addItem("goalsDebtsUpcomingExpenses", {
              id: `goal-${Date.now()}`,
              name: "",
              target_amount: 0,
              target_date: new Date().toISOString().slice(0, 10),
              amount_saved: 0
            })
          }
          onChange={(id, field, value) =>
            updateItem("goalsDebtsUpcomingExpenses", id, field, value)
          }
        />
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
          {fields.map(([field, label, type]) => (
            <label key={field}>
              {label}
              <input
                type={type}
                value={item[field]}
                onChange={(event) =>
                  onChange(
                    item.id,
                    field,
                    type === "number" ? Number(event.target.value) : event.target.value
                  )
                }
                style={{ boxSizing: "border-box", display: "block", width: "100%" }}
              />
            </label>
          ))}
        </div>
      ))}
    </section>
  );
}
