import React, { useState } from "react";

import LedgerChat from "./LedgerChat.jsx";
import MarginProjection from "./MarginProjection.jsx";
import SetupWizard from "./SetupWizard.jsx";
import WeeklyReview from "./WeeklyReview.jsx";
import { prepareMarginProjection } from "./appFlow.js";
import { upsertWeeklyBalance } from "./weeklyReview.js";
import {
  getAssistantGreeting,
  getNextOnboardingMessage,
  hasMinimumOnboardingData,
  isOnboardingComplete,
  loadLanguage,
  saveLanguage
} from "./assistantOnboarding.js";
import { getStrings } from "./i18n.js";
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
  const copy = getStrings(language ?? "en");
  const onboardingComplete = isOnboardingComplete(currentLedger);
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
      onboardingConfirmed: hasMinimumOnboardingData(nextSetupData),
      settings: {
        ...nextSetupData.settings,
        language
      }
    });
    setLedger(savedLedger);
    setActiveScreen("projection");
  }

  function handleConfirmForecast(nextWeekForecast, weeklyBalance) {
    const nextSetupData = normalizeSetupData({
      ...currentLedger,
      nextWeekForecast,
      weeklyBalances: weeklyBalance
        ? upsertWeeklyBalance(currentLedger.weeklyBalances, weeklyBalance)
        : currentLedger.weeklyBalances
    });

    saveLedger(nextSetupData);
    saveWeeklyReview({
      confirmed_at: new Date().toISOString(),
      nextWeekForecast,
      weeklyBalance
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

  function handleAfterAssistantResult(result, userMessage) {
    const userConfirmed = /^(yes|yes,? that's right|correct|looks right|that'?s right|sí|si|correcto|está bien|esta bien)$/i.test(
      userMessage.trim()
    );
    if (userConfirmed && hasMinimumOnboardingData(currentLedger)) {
      result.ledger = {
        ...result.ledger,
        onboardingConfirmed: true
      };
      return language === "es"
        ? "Perfecto. Ya quedó confirmado y puedes continuar con tu revisión semanal."
        : "Perfect. That’s confirmed, and you can continue to Weekly Review.";
    }

    const userSaidDone = /that's everything|that is everything|eso es todo|es todo/i.test(
      `${result.action?.text ?? ""} ${userMessage}`
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
      setError(
        parseError instanceof Error && /No transactions found/i.test(parseError.message)
          ? copy.noTransactions
          : copy.parseError
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (!language) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>{copy.appTitle}</h1>
        <p>{copy.chooseLanguage}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => handleLanguageSelect("en")}>
            {copy.english}
          </button>
          <button type="button" onClick={() => handleLanguageSelect("es")}>
            {copy.spanish}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>{copy.appTitle}</h1>
      <LedgerChat
        ledger={currentLedger}
        onLedgerChange={handleLedgerChange}
        placeholder={copy.chatPlaceholder}
        initialAssistantMessage={getAssistantGreeting(language)}
        onAfterResult={handleAfterAssistantResult}
        language={language}
      />

      <p style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setActiveScreen("setup")}
          style={{ background: "none", border: 0, color: "#0645ad", cursor: "pointer", padding: 0 }}
        >
          {copy.preferForm}
        </button>
      </p>

      <nav style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setActiveScreen("projection")}>
          {copy.projectionNav}
        </button>
        {onboardingComplete ? (
          <button type="button" onClick={() => setActiveScreen("review")}>
            {copy.weeklyReviewNav}
          </button>
        ) : null}
      </nav>

      {activeScreen === "setup" ? (
        <SetupWizard
          initialSetupData={currentLedger}
          onComplete={handleSetupComplete}
          language={language}
        />
      ) : null}

      <form onSubmit={handleSubmit}>
        <label htmlFor="statement-text" style={{ display: "block", marginTop: 16 }}>
          {copy.rawStatementText}
        </label>
        <textarea
          id="statement-text"
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          rows={10}
          placeholder={copy.statementPlaceholder}
          style={{ boxSizing: "border-box", display: "block", marginTop: 8, width: "100%" }}
        />

        <button type="submit" disabled={isLoading || rawText.trim().length === 0} style={{ marginTop: 12 }}>
          {isLoading ? copy.parsing : copy.parseStatement}
        </button>
      </form>

      {isLoading ? <p role="status">{copy.parsingStatement}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {activeScreen === "projection" && hasProjectionData ? (
        <MarginProjection
          transactions={projectionTransactions}
          upcomingBills={upcomingBills}
          settings={currentLedger.settings}
          language={language}
        />
      ) : null}

      {activeScreen === "projection" && !hasProjectionData && !hasLedgerData ? (
        <p>{copy.emptyProjection}</p>
      ) : null}

      {activeScreen === "review" && onboardingComplete ? (
        <WeeklyReview
          setupData={currentLedger}
          transactions={transactions}
          onConfirmForecast={handleConfirmForecast}
          onLedgerChange={handleLedgerChange}
          language={language}
        />
      ) : null}
    </main>
  );
}
