import React, { useState } from "react";

import MarginProjection from "./MarginProjection.jsx";
import SetupWizard from "./SetupWizard.jsx";
import WeeklyReview from "./WeeklyReview.jsx";
import { prepareMarginProjection } from "./appFlow.js";
import { convertSetupToUpcomingBills } from "./setupProjection.js";
import {
  emptySetupData,
  loadSetupData,
  normalizeSetupData,
  saveSetupData,
  saveWeeklyReview
} from "./setupData.js";

export default function App() {
  const [setupData, setSetupData] = useState(() => loadSetupData());
  const [activeScreen, setActiveScreen] = useState("projection");
  const [rawText, setRawText] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasParsed, setHasParsed] = useState(false);
  const upcomingBills = setupData ? convertSetupToUpcomingBills(setupData) : [];

  function handleSetupComplete(nextSetupData) {
    const savedSetupData = saveSetupData(nextSetupData);
    setSetupData(savedSetupData);
    setActiveScreen("projection");
  }

  function handleConfirmForecast(nextWeekForecast) {
    const nextSetupData = normalizeSetupData({
      ...setupData,
      nextWeekForecast
    });

    saveSetupData(nextSetupData);
    saveWeeklyReview({
      confirmed_at: new Date().toISOString(),
      nextWeekForecast
    });
    setSetupData(nextSetupData);
  }

  async function handleFileChange(event) {
    const [file] = event.target.files ?? [];
    if (!file) {
      return;
    }

    const text = await file.text();
    setRawText(text);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setHasParsed(false);
    setIsLoading(true);

    try {
      await Promise.resolve();
      const prepared = prepareMarginProjection(rawText, upcomingBills);
      setTransactions(prepared.transactions);
      setHasParsed(true);
    } catch (parseError) {
      setTransactions([]);
      setError(parseError instanceof Error ? parseError.message : "Unable to parse statement text.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!setupData) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <SetupWizard
          initialSetupData={normalizeSetupData(emptySetupData)}
          onComplete={handleSetupComplete}
        />
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <nav style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setActiveScreen("projection")}>
          Projection
        </button>
        <button type="button" onClick={() => setActiveScreen("review")}>
          Weekly Review
        </button>
      </nav>

      <form onSubmit={handleSubmit}>
        <h1>Cash Flow Clarity</h1>

        <label htmlFor="statement-file">Statement file</label>
        <input
          id="statement-file"
          type="file"
          accept=".txt,.pdf,text/plain,application/pdf"
          onChange={handleFileChange}
        />

        <label htmlFor="statement-text" style={{ display: "block", marginTop: 16 }}>
          Raw statement text
        </label>
        <textarea
          id="statement-text"
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          rows={10}
          placeholder="Paste bank statement text with dates, descriptions, and amounts."
          style={{ boxSizing: "border-box", display: "block", marginTop: 8, width: "100%" }}
        />

        <button type="submit" disabled={isLoading || rawText.trim().length === 0} style={{ marginTop: 12 }}>
          {isLoading ? "Parsing..." : "Parse statement"}
        </button>
      </form>

      {isLoading ? <p role="status">Parsing statement...</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {activeScreen === "projection" && hasParsed ? (
        <MarginProjection transactions={transactions} upcomingBills={upcomingBills} />
      ) : null}

      {activeScreen === "review" ? (
        <WeeklyReview
          setupData={setupData}
          transactions={transactions}
          onConfirmForecast={handleConfirmForecast}
        />
      ) : null}
    </main>
  );
}
