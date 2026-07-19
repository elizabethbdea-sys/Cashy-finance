import React, { useState } from "react";

import LedgerChat from "./LedgerChat.jsx";
import MarginProjection from "./MarginProjection.jsx";
import SetupWizard from "./SetupWizard.jsx";
import WeeklyReview from "./WeeklyReview.jsx";
import { prepareMarginProjection } from "./appFlow.js";
import { upsertWeeklyBalance } from "./weeklyReview.js";
import {
  getAssistantGreeting,
  getNextOnboardingUpdate,
  hasMinimumOnboardingData,
  isOnboardingComplete,
  clearLanguage,
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

const INTRO_STORAGE_KEY = "cash-flow-clarity:intro-seen";

export default function App() {
  const [ledger, setLedger] = useState(() => loadLedger());
  const [language, setLanguage] = useState(() => loadLanguage());
  const [country, setCountry] = useState(() => loadLedger()?.country ?? "Mexico");
  const [hasCountrySelected, setHasCountrySelected] = useState(() => Boolean(loadLedger()?.country));
  const [introSeen, setIntroSeen] = useState(() => loadIntroSeen());
  const [activeScreen, setActiveScreen] = useState("projection");
  const [showStatementPaste, setShowStatementPaste] = useState(false);
  const [rawText, setRawText] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasParsed, setHasParsed] = useState(false);
  const currentLedger = normalizeSetupData({
    ...(ledger ?? emptySetupData),
    country,
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
      country: nextLedger.country ?? country,
      settings: {
        ...nextLedger.settings,
        language
      }
    });
    setLedger(savedLedger);
    if (savedLedger.country) {
      setCountry(savedLedger.country);
      setHasCountrySelected(true);
    }
  }

  function handleLanguageSelect(nextLanguage) {
    saveLanguage(nextLanguage);
    setLanguage(nextLanguage);
    setHasCountrySelected(true);
    handleLedgerChange({
      ...(ledger ?? emptySetupData),
      country,
      settings: {
        ...(ledger?.settings ?? emptySetupData.settings),
        language: nextLanguage
      }
    });
  }

  function handleCountrySelect(nextCountry) {
    setCountry(nextCountry);
    if (language || ledger) {
      handleLedgerChange({
        ...(ledger ?? emptySetupData),
        country: nextCountry,
        settings: {
          ...(ledger?.settings ?? emptySetupData.settings),
          language
        }
      });
    }
  }

  function handleChangeLanguage() {
    clearLanguage();
    clearIntroSeen();
    setLanguage(null);
    setIntroSeen(false);
  }

  function handleAfterAssistantResult(result, userMessage) {
    const nextLedger = result.ledger;
    const userConfirmed = /^(yes|yes,? that's right|correct|looks right|that'?s right|sí|si|correcto|está bien|esta bien)$/i.test(
      userMessage.trim()
    );
    if (
      userConfirmed &&
      hasMinimumOnboardingData(nextLedger) &&
      nextLedger.onboardingProgress?.summaryShown
    ) {
      result.ledger = {
        ...nextLedger,
        onboardingConfirmed: true
      };
      return language === "es"
        ? "Perfecto. Ya quedó confirmado y puedes continuar con tu revisión semanal."
        : "Perfect. That’s confirmed, and you can continue to Weekly Review.";
    }

    const skippedCushion = /^(skip|omit|omitir|saltar|no gracias|no thanks)$/i.test(userMessage.trim());
    if (skippedCushion && hasMinimumOnboardingData(nextLedger) && !nextLedger.cushionPreference) {
      result.ledger = {
        ...nextLedger,
        cushionPreferenceSkipped: true
      };
      return applyOnboardingUpdate(result, true);
    }

    const userSaidDone = /that's everything|that is everything|eso es todo|es todo/i.test(
      `${result.action?.text ?? ""} ${userMessage}`
    );
    return applyOnboardingUpdate(result, userSaidDone);
  }

  function applyOnboardingUpdate(result, userSaidDone) {
    const update = getNextOnboardingUpdate(result.ledger, language, userSaidDone);
    result.ledger = update.ledger;
    return update.message;
  }

  function handleIntroNext() {
    saveIntroSeen();
    setIntroSeen(true);
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

  if (!language || !hasCountrySelected) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>{copy.appTitle}</h1>
        <p>{copy.chooseLanguage}</p>
        <label>
          {copy.country}
          <select
            value={country}
            onChange={(event) => handleCountrySelect(event.target.value)}
            style={{ display: "block", margin: "8px 0 16px" }}
          >
            <option value="Mexico">{copy.mexico}</option>
            <option value="United States">{copy.unitedStates}</option>
          </select>
        </label>
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

  if (!introSeen) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
          <h1>{copy.appTitle}</h1>
          <button type="button" onClick={handleChangeLanguage}>
            {copy.changeLanguage}
          </button>
        </header>
        <section aria-labelledby="intro-title">
          <h2 id="intro-title">{copy.introTitle}</h2>
          <p>{copy.introBody}</p>
          <p>{copy.introRunway}</p>
          <button type="button" onClick={handleIntroNext}>
            {copy.startIntro}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <h1>{copy.appTitle}</h1>
        <button type="button" onClick={handleChangeLanguage}>
          {copy.changeLanguage}
        </button>
      </header>
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

      <p style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setShowStatementPaste((current) => !current)}
          style={{ background: "none", border: 0, color: "#0645ad", cursor: "pointer", padding: 0 }}
        >
          {copy.advancedStatementToggle}
        </button>
      </p>

      {showStatementPaste ? (
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
      ) : null}

      {isLoading ? <p role="status">{copy.parsingStatement}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {activeScreen === "projection" && hasProjectionData ? (
        <MarginProjection
          transactions={projectionTransactions}
          upcomingBills={upcomingBills}
          settings={currentLedger.settings}
          currentBalance={currentLedger.currentBalance}
          cushionPreference={currentLedger.cushionPreference}
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

function loadIntroSeen(storage = getBrowserLocalStorage()) {
  return storage?.getItem(INTRO_STORAGE_KEY) === "true";
}

function saveIntroSeen(storage = getBrowserLocalStorage()) {
  storage?.setItem(INTRO_STORAGE_KEY, "true");
}

function clearIntroSeen(storage = getBrowserLocalStorage()) {
  storage?.removeItem(INTRO_STORAGE_KEY);
}

function getBrowserLocalStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
