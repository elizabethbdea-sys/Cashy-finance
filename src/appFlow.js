import { parseBankStatementText } from "./bankStatementParser.js";
import { calculateMarginProjection } from "./marginProjection.js";

export function prepareMarginProjection(rawText, upcomingBills = []) {
  const result = parseBankStatementText(rawText);

  if (result.transactions.length === 0) {
    throw new Error("No transactions found. Paste statement text with dates and amounts.");
  }

  return {
    transactions: result.transactions,
    projection: calculateMarginProjection(result.transactions, upcomingBills)
  };
}
