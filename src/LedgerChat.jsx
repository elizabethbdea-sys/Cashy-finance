import React, { useState } from "react";

import { processLedgerChatMessage } from "./ledgerChat.js";

export default function LedgerChat({
  ledger,
  onLedgerChange,
  placeholder = "e.g. got paid $2000 from Tempered today",
  initialAssistantMessage = "",
  onAfterResult
}) {
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState(() =>
    initialAssistantMessage ? [{ role: "assistant", text: initialAssistantMessage }] : []
  );
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    setError("");
    setIsSending(true);
    setMessage("");

    try {
      const result = await processLedgerChatMessage({
        message: trimmedMessage,
        ledger
      });
      const followUp = onAfterResult?.(result);

      onLedgerChange(result.ledger);
      setChatLog((current) => [
        ...current,
        { role: "user", text: trimmedMessage },
        { role: "assistant", text: [result.reply, followUp].filter(Boolean).join("\n\n") }
      ]);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unable to process that message.");
      setMessage(trimmedMessage);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section aria-labelledby="ledger-chat-title" style={{ marginTop: 32 }}>
      <h2 id="ledger-chat-title">Your Cash Flow Clarity assistant</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={placeholder}
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={isSending}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <ol>
        {chatLog.map((entry, index) => (
          <li key={`${entry.role}-${index}`}>
            <strong>{entry.role === "user" ? "You" : "Assistant"}:</strong> {entry.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
