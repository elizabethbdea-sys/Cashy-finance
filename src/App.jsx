import React, { useState } from "react";

import LedgerChat from "./LedgerChat.jsx";
import MarginProjection from "./MarginProjection.jsx";
import SetupWizard from "./SetupWizard.jsx";
import WeeklyReview from "./WeeklyReview.jsx";
import { prepareMarginProjection } from "./appFlow.js";
import {
  getCashyGreeting,
  getNextOnboardingMessage,
  loadLanguage,
  saveLanguage
} from "./cashyOnboarding.js";
import { convertSetupToUpcomingBills } from "./setupProjection.js";
import {
  ledgerToProjectionTransactions
} from "./marginProjection.js";
import {
  emptySetupData,
  normalizeSetupData,
  saveWeeklyReview
} from "./setupData.js";
import { loadLedger, saveLedger } from "./ledgerData.js";

export default function App() {
  const [ledger, setLedger] = useState(() => loadLedger());
  const [language, setLanguage] = useState(() => loadLanguage());
  const [activeScreen, setActiveScreen] = useState("projection");
  const [rawText, setRawText] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasParsed, setHasParsed] = useState(false);
  const currentLedger = normalizeSetupData({
    ...(ledger ?? emptySetupData),
    settings: {
      ...(ledger?.settings ?? emptySetupData.settings),
      language
    }
  });
  const upcomingBills = convertSetupToUpcomingBills(currentLedger);
  const ledgerTransactions = ledgerToProjectionTransactions(currentLedger);
  const projectionTransactions = [...ledgerTransactions, ...transactions];
  const hasLedgerData =
    currentLedger.incomeSources.length > 0 ||
    currentLedger.fixedExpenses.length > 0 ||
    currentLedger.goals.length > 0 ||
    currentLedger.incomeEvents.length > 0 ||
    currentLedger.variableExpenseCategories.length > 0;
  const hasProjectionData =
    hasParsed || upcomingBills.length > 0 || ledgerTransactions.length > 0;

  function handleSetupComplete(nextSetupData) {
    const savedLedger = saveLedger({
      ...nextSetupData,
      settings: {
        ...nextSetupData.settings,
        language
      }
    });
    setLedger(savedLedger);
    setActiveScreen("projection");
  }

  function handleConfirmForecast(nextWeekForecast) {
    const nextSetupData = normalizeSetupData({
      ...currentLedger,
      nextWeekForecast
    });

    saveLedger(nextSetupData);
    saveWeeklyReview({
      confirmed_at: new Date().toISOString(),
      nextWeekForecast
    });
    setLedger(nextSetupData);
  }

  function handleLedgerChange(nextLedger) {
    const savedLedger = saveLedger({
      ...nextLedger,
      settings: {
        ...nextLedger.settings,
        language
      }
    });
    setLedger(savedLedger);
  }

  function handleLanguageSelect(nextLanguage) {
    saveLanguage(nextLanguage);
    setLanguage(nextLanguage);
    if (ledger) {
      handleLedgerChange({
        ...ledger,
        settings: {
          ...ledger.settings,
          language: nextLanguage
        }
      });
    }
  }

  function handleAfterCashyResult(result) {
    const userSaidDone = /that's everything|that is everything|eso es todo|es todo/i.test(
      result.action?.text ?? ""
    );
    return getNextOnboardingMessage(result.ledger, language, userSaidDone);
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

  if (!language) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Cashy — clear money, clear mind</h1>
        <p>Choose your language / Elige tu idioma</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => handleLanguageSelect("en")}>
            English
          </button>
          <button type="button" onClick={() => handleLanguageSelect("es")}>
            Español
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Cashy — clear money, clear mind</h1>
      <LedgerChat
        ledger={currentLedger}
        onLedgerChange={handleLedgerChange}
        placeholder="Tell me about your money — income, upcoming bills, anything on your mind"
        initialAssistantMessage={getCashyGreeting(language)}
        onAfterResult={handleAfterCashyResult}
      />

      <p style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setActiveScreen("setup")}
          style={{ background: "none", border: 0, color: "#0645ad", cursor: "pointer", padding: 0 }}
        >
          Prefer a form?
        </button>
      </p>

      <nav style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setActiveScreen("projection")}>
          Projection
        </button>
        <button type="button" onClick={() => setActiveScreen("review")}>
          Weekly Review
        </button>
      </nav>

      {activeScreen === "setup" ? (
        <SetupWizard
          initialSetupData={currentLedger}
          onComplete={handleSetupComplete}
        />
      ) : null}

      <form onSubmit={handleSubmit}>
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

      {activeScreen === "projection" && hasProjectionData ? (
        <MarginProjection
          transactions={projectionTransactions}
          upcomingBills={upcomingBills}
          settings={currentLedger.settings}
        />
      ) : null}

      {activeScreen === "projection" && !hasProjectionData && !hasLedgerData ? (
        <p>Chat with me above to get started.</p>
      ) : null}

      {activeScreen === "review" ? (
        <WeeklyReview
          setupData={currentLedger}
          transactions={transactions}
          onConfirmForecast={handleConfirmForecast}
          onLedgerChange={handleLedgerChange}
        />
      ) : null}
    </main>
  );
}
