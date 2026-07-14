const CATEGORY = Object.freeze({
  INCOME: "income",
  FIXED_EXPENSE: "fixed_expense",
  VARIABLE_EXPENSE: "variable_expense",
  INTERNAL_TRANSFER: "internal_transfer"
});

const MONTHS = Object.freeze({
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
});

const MONEY_PATTERN =
  /(?:^|[\s|])(?<amount>[+-]?\(?\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?\)?)(?:\s*(?<marker>CR|DR|CREDIT|DEBIT))?(?=$|[\s|])/gi;

const DATE_PATTERNS = [
  /\b(?<year>\d{4})[-/.](?<month>\d{1,2})[-/.](?<day>\d{1,2})\b/,
  /\b(?<month>\d{1,2})[-/.](?<day>\d{1,2})(?:[-/.](?<year>\d{2,4}))?\b/,
  /\b(?<monthName>jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(?<day>\d{1,2})(?:,\s*(?<year>\d{4}))?\b/i
];

const FIXED_EXPENSE_PATTERNS = [
  /\brent\b/,
  /\bmortgage\b/,
  /\bhoa\b/,
  /\binsurance\b/,
  /\btuition\b/,
  /\bdaycare\b/,
  /\bchild\s*care\b/,
  /\bloan\b/,
  /\bauto\s*pay\b/,
  /\bautopay\b/,
  /\bsubscription\b/,
  /\brecurring\b/,
  /\bmembership\b/,
  /\bnetflix\b/,
  /\bspotify\b/,
  /\badobe\b/,
  /\bgym\b/,
  /\butilities?\b/,
  /\belectric\b/,
  /\bwater\b/,
  /\bgas\b/,
  /\binternet\b/,
  /\bphone\b/,
  /\bwireless\b/
];

const INCOME_PATTERNS = [
  /\bpayroll\b/,
  /\bsalary\b/,
  /\bwages?\b/,
  /\bdirect\s+dep(?:osit)?\b/,
  /\bdeposit\b/,
  /\binterest\b/,
  /\bdividend\b/,
  /\brefund\b/,
  /\breimbursement\b/,
  /\bclient\s+payment\b/,
  /\bcustomer\s+payment\b/,
  /\binvoice\s+payment\b/,
  /\birs\b/,
  /\btax\s+refund\b/,
  /\bssa\b/,
  /\bsocial\s+security\b/,
  /\bbenefit\b/,
  /\bpension\b/
];

const TRANSFER_PATTERNS = [
  /\btransfer\b/,
  /\bxfer\b/,
  /\bacct\s*to\s*acct\b/,
  /\baccount\s*to\s*account\b/,
  /\bonline\s+banking\b/,
  /\binternal\b/,
  /\bbetween\s+accounts\b/,
  /\bfrom\s+(checking|savings|brokerage|wallet|cash|bank)\b/,
  /\bto\s+(checking|savings|brokerage|wallet|cash|bank)\b/,
  /\b(checking|savings)\s+(?:acct|account)\b/,
  /\b(?:acct|account)\s*(?:ending\s*)?(?:x{2,}|\*{2,}|#)?\d{3,4}\b/,
  /\bvenmo\b.*\b(cashout|cash\s*out|transfer)\b/,
  /\bcash\s*app\b.*\b(cashout|cash\s*out|transfer|instant\s+deposit)\b/,
  /\bpaypal\b.*\b(transfer|withdrawal|instant\s+transfer)\b/,
  /\bapple\s+cash\b.*\btransfer\b/,
  /\brobinhood\b.*\btransfer\b/,
  /\bcoinbase\b.*\btransfer\b/
];

const EXTERNAL_PERSON_TO_PERSON_PATTERNS = [
  /\bzelle\b\s+(from|to)\s+[a-z]+/i,
  /\bvenmo\b\s+(payment|from|to)\s+[a-z]+/i,
  /\bcash\s*app\b\s+(payment|from|to)\s+[a-z]+/i
];

/**
 * @typedef {"income" | "fixed_expense" | "variable_expense" | "internal_transfer"} TransactionCategory
 *
 * @typedef {object} ParsedTransaction
 * @property {string | null} date ISO-like transaction date when present.
 * @property {string} description Cleaned statement description.
 * @property {number} amount Positive for money in, negative for money out.
 * @property {TransactionCategory} category Cash-flow category.
 * @property {string | null} currency Currency code inferred from the line.
 * @property {string} raw Original statement line.
 *
 * @typedef {object} ParseResult
 * @property {ParsedTransaction[]} transactions
 * @property {{ transaction_count: number, internal_transfer_count: number }} meta
 */

/**
 * Extract transactions from raw bank statement text and categorize each item.
 *
 * Internal transfers are intentionally classified before income or expense so
 * account-to-account movement does not inflate real cash flow.
 *
 * @param {string} rawText
 * @returns {ParseResult}
 */
export function parseBankStatementText(rawText) {
  if (typeof rawText !== "string") {
    throw new TypeError("parseBankStatementText expects raw statement text.");
  }

  const transactions = rawText
    .split(/\r?\n/)
    .map((line) => parseTransactionLine(line))
    .filter(Boolean);

  return {
    transactions,
    meta: {
      transaction_count: transactions.length,
      internal_transfer_count: transactions.filter(
        (transaction) => transaction.category === CATEGORY.INTERNAL_TRANSFER
      ).length
    }
  };
}

/**
 * @param {string} line
 * @returns {ParsedTransaction | null}
 */
function parseTransactionLine(line) {
  const raw = line.trim();
  if (!raw || isLikelyNonTransactionLine(raw)) {
    return null;
  }

  const dateMatch = findDate(raw);
  const moneyMatches = [...raw.matchAll(MONEY_PATTERN)];

  if (!dateMatch || moneyMatches.length === 0) {
    return null;
  }

  const amountMatch = chooseTransactionAmount(raw, moneyMatches);
  const amount = normalizeAmount(amountMatch.groups?.amount ?? "", raw, amountMatch.groups?.marker);

  if (!Number.isFinite(amount) || amount === 0) {
    return null;
  }

  const description = cleanDescription(raw, dateMatch, amountMatch);
  const category = categorizeTransaction(description, amount);

  return {
    date: dateMatch.isoDate,
    description,
    amount,
    category,
    currency: inferCurrency(raw),
    raw
  };
}

function isLikelyNonTransactionLine(line) {
  return /\b(opening|closing|available|current|ending)\s+balance\b/i.test(line);
}

function findDate(line) {
  for (const pattern of DATE_PATTERNS) {
    const match = line.match(pattern);
    if (!match?.groups) {
      continue;
    }

    const year = normalizeYear(match.groups.year);
    const month = match.groups.monthName
      ? MONTHS[match.groups.monthName.toLowerCase().replace(".", "")]
      : Number(match.groups.month);
    const day = Number(match.groups.day);

    if (!isValidDateParts(year, month, day)) {
      continue;
    }

    return {
      match,
      isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    };
  }

  return null;
}

function normalizeYear(year) {
  if (!year) {
    return new Date().getFullYear();
  }

  const numericYear = Number(year);
  if (year.length === 2) {
    return numericYear >= 70 ? 1900 + numericYear : 2000 + numericYear;
  }

  return numericYear;
}

function isValidDateParts(year, month, day) {
  if (!year || !month || !day || month > 12 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function chooseTransactionAmount(line, moneyMatches) {
  const balanceIndex = line.search(/\b(balance|running\s+bal)\b/i);
  const candidates =
    balanceIndex === -1
      ? moneyMatches
      : moneyMatches.filter((match) => match.index < balanceIndex);

  return candidates.at(-1) ?? moneyMatches.at(-1);
}

function normalizeAmount(value, line, marker) {
  const trimmed = value.trim();
  const hasParens = trimmed.startsWith("(") && trimmed.endsWith(")");
  const numericValue = Number(trimmed.replace(/[($),\s]/g, ""));

  if (!Number.isFinite(numericValue)) {
    return Number.NaN;
  }

  const upperMarker = marker?.toUpperCase();
  const debitCue = /\b(withdrawal|purchase|payment|debit|fee|pos|ach debit|autopay|check paid)\b/i.test(
    line
  );
  const creditCue =
    /\b(deposit|credit|payroll|interest|refund|ach credit)\b/i.test(line) ||
    /\b(client|customer|invoice)\s+payment\b/i.test(line);

  if (hasParens || upperMarker === "DR" || upperMarker === "DEBIT") {
    return -Math.abs(numericValue);
  }

  if (upperMarker === "CR" || upperMarker === "CREDIT" || trimmed.startsWith("+")) {
    return Math.abs(numericValue);
  }

  if (trimmed.startsWith("-")) {
    return -Math.abs(numericValue);
  }

  if (/\btransfer\b/i.test(line) && /\bto\s+(checking|savings|brokerage|wallet|cash|bank|acct|account)\b/i.test(line)) {
    return -Math.abs(numericValue);
  }

  if (/\btransfer\b/i.test(line) && /\bfrom\s+(checking|savings|brokerage|wallet|cash|bank|acct|account)\b/i.test(line)) {
    return Math.abs(numericValue);
  }

  if (debitCue && !creditCue) {
    return -Math.abs(numericValue);
  }

  return Math.abs(numericValue);
}

function cleanDescription(line, dateMatch, amountMatch) {
  return line
    .replace(dateMatch.match[0], " ")
    .replace(amountMatch[0], " ")
    .replace(/\b(CR|DR|CREDIT|DEBIT)\b/gi, " ")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categorizeTransaction(description, amount) {
  const normalized = description.toLowerCase();

  if (isInternalTransfer(description)) {
    return CATEGORY.INTERNAL_TRANSFER;
  }

  if (amount > 0 && INCOME_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return CATEGORY.INCOME;
  }

  if (amount > 0) {
    return CATEGORY.INCOME;
  }

  if (FIXED_EXPENSE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return CATEGORY.FIXED_EXPENSE;
  }

  return CATEGORY.VARIABLE_EXPENSE;
}

function isInternalTransfer(description) {
  const normalized = description.toLowerCase();
  const hasTransferCue = TRANSFER_PATTERNS.some((pattern) => pattern.test(normalized));
  const looksLikePersonToPerson =
    EXTERNAL_PERSON_TO_PERSON_PATTERNS.some((pattern) => pattern.test(description)) &&
    !/\b(my|own|self|me|checking|savings|acct|account|bank)\b/i.test(description);

  return hasTransferCue && !looksLikePersonToPerson;
}

function inferCurrency(line) {
  if (line.includes("$")) {
    return "USD";
  }

  return null;
}

export { CATEGORY };
