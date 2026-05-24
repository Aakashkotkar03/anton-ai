// electron/handlers/contextManager.js — Context window tracking + auto-summarisation
// Implements PRD Layers 2 and 3:
//   Layer 2 — Sliding window with pinned system prompt + bridge turns
//   Layer 3 — Hierarchical auto-summarisation at 85% fill
//
// Token counting uses the ~4 chars/token heuristic (fast, no tokeniser needed).
// Accurate enough for context management — exact counts come from llama-server.

const { getDb } = require('../db');
const { chat: llamaChat, getContextInfo } = require('./llama');
const { getSystemPrompt } = require('./promptEngine');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CHARS_PER_TOKEN = 4;           // heuristic: ~4 chars per token
const SUMMARISE_THRESHOLD = 0.85;    // trigger at 85% context fill
const SUMMARISE_OLDEST_RATIO = 0.40; // summarise oldest 40% of turns
const RESPONSE_RESERVE = 2048;       // tokens reserved for model response
const BRIDGE_TURNS = 2;              // keep 2 turns as continuity bridge
const SUMMARY_INJECT_LABEL = '--- EARLIER CONVERSATION SUMMARY ---';

// ---------------------------------------------------------------------------
// estimateTokens — fast heuristic token count
// ---------------------------------------------------------------------------
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ---------------------------------------------------------------------------
// estimateMessagesTokens — total tokens across an array of messages
// ---------------------------------------------------------------------------
function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  let total = 0;
  for (const msg of messages) {
    // Role label + content + formatting overhead (~4 tokens per message)
    total += estimateTokens(msg.content || '') + 4;
  }
  return total;
}

// ---------------------------------------------------------------------------
// shouldSummarise — check if we've crossed the 85% threshold
// ---------------------------------------------------------------------------
function shouldSummarise(currentTokens, effectiveCtx) {
  if (!effectiveCtx || effectiveCtx <= 0) return false;
  return (currentTokens / effectiveCtx) > SUMMARISE_THRESHOLD;
}

// ---------------------------------------------------------------------------
// getContextFill — return current usage as fraction and absolute values
// ---------------------------------------------------------------------------
function getContextFill(messages, systemPrompt) {
  const ctxInfo = getContextInfo();
  const effective = ctxInfo.effective || 4096;

  const systemTokens = estimateTokens(systemPrompt || '');
  const messagesTokens = estimateMessagesTokens(messages);
  const usedTokens = systemTokens + messagesTokens;
  const availableTokens = effective - RESPONSE_RESERVE;

  return {
    usedTokens,
    totalTokens: effective,
    availableTokens: Math.max(0, availableTokens - usedTokens),
    fillRatio: usedTokens / effective,
    shouldSummarise: shouldSummarise(usedTokens, effective),
    reservedForResponse: RESPONSE_RESERVE,
  };
}

// ---------------------------------------------------------------------------
// buildContextWindow — Layer 2 sliding window with pinned zones
// ---------------------------------------------------------------------------
// Returns the messages array trimmed to fit the effective context,
// with system prompt pinned, optional summary injected, and bridge turns.
//
// Layout:
//   [PINNED: System prompt]                 ← never evicted
//   [PINNED: Summary block if exists]       ← injected by Layer 3
//   [BRIDGE: 2 oldest evicted turns]        ← continuity bridge
//   [SLIDING: Most recent N turns]          ← fills remaining budget
//   [RESERVE: Response budget]              ← 2048 tokens
//
function buildContextWindow(messages, systemPrompt, existingSummary) {
  const ctxInfo = getContextInfo();
  const effective = ctxInfo.effective || 4096;

  const systemTokens = estimateTokens(systemPrompt || '');
  const summaryTokens = existingSummary ? estimateTokens(existingSummary) + 10 : 0;
  const budget = effective - RESPONSE_RESERVE - systemTokens - summaryTokens;

  if (budget <= 0) {
    // Context too small even for system prompt — return last message only
    return {
      messages: messages.slice(-1),
      summary: existingSummary,
      evictedCount: messages.length - 1,
    };
  }

  // Try to fit all messages
  const totalTokens = estimateMessagesTokens(messages);
  if (totalTokens <= budget) {
    // Everything fits — no eviction needed
    return {
      messages,
      summary: existingSummary,
      evictedCount: 0,
    };
  }

  // Need to evict: keep the most recent turns that fit within budget
  const result = [];
  let usedTokens = 0;

  // Walk backwards from the newest message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content || '') + 4;
    if (usedTokens + msgTokens > budget) {
      break;
    }
    result.unshift(messages[i]);
    usedTokens += msgTokens;
  }

  const evictedCount = messages.length - result.length;

  // Add bridge turns (condensed oldest evicted turns for continuity)
  if (evictedCount > 0) {
    const bridgeStart = Math.max(0, messages.length - result.length - BRIDGE_TURNS);
    const bridgeEnd = messages.length - result.length;
    const bridgeTurns = messages.slice(bridgeStart, bridgeEnd);

    // Only add bridge if there's room
    const bridgeTokens = estimateMessagesTokens(bridgeTurns);
    if (usedTokens + bridgeTokens <= budget) {
      result.unshift(...bridgeTurns);
    }
  }

  return {
    messages: result,
    summary: existingSummary,
    evictedCount,
  };
}

// ---------------------------------------------------------------------------
// summariseOldMessages — Layer 3 auto-summarisation
// ---------------------------------------------------------------------------
// Takes the oldest 40% of messages, asks the model to summarise them,
// returns the summary + the remaining messages to keep.
//
async function summariseOldMessages(messages) {
  if (!messages || messages.length < 4) {
    // Too few messages to summarise
    return { summary: null, retainedMessages: messages };
  }

  // Take oldest 40% of messages
  const cutoff = Math.ceil(messages.length * SUMMARISE_OLDEST_RATIO);
  const toSummarise = messages.slice(0, cutoff);
  const toRetain = messages.slice(cutoff);

  // Build the text to summarise
  const conversationText = toSummarise
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');

  // Get the auto-summarise prompt
  const summaryPrompt = getSystemPrompt('auto-summarise');

  try {
    const result = await llamaChat(
      [{ role: 'user', content: conversationText }],
      summaryPrompt,
      {
        temperature: 0.3,  // low temperature for factual summary
        maxTokens: 300,    // 120 words ≈ ~160 tokens, leave room
      }
    );

    const summaryText = result?.content || '';

    if (!summaryText || summaryText.length < 10) {
      console.warn('[contextManager] Summarisation returned empty — keeping all messages.');
      return { summary: null, retainedMessages: messages };
    }

    console.log(
      `[contextManager] Summarised ${cutoff} messages → ${estimateTokens(summaryText)} tokens`
    );

    // Save summary to SQLite (if we have a conversation ID)
    // This is called by the chat handler which passes the conversation context

    return {
      summary: summaryText,
      retainedMessages: toRetain,
      summarisedCount: cutoff,
      summarisedTurnRange: { start: 0, end: cutoff - 1 },
    };
  } catch (err) {
    console.error('[contextManager] Summarisation failed:', err.message);
    // Non-fatal — return messages unchanged
    return { summary: null, retainedMessages: messages };
  }
}

// ---------------------------------------------------------------------------
// saveSummary — persist a summary to SQLite
// ---------------------------------------------------------------------------
function saveSummary(conversationId, summaryText, turnStart, turnEnd) {
  try {
    const db = getDb();
    const id = `summary_${conversationId}_${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO context_summaries
        (id, conversation_id, summary_text, turn_range_start, turn_range_end)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, conversationId, summaryText, turnStart, turnEnd);
    console.log(`[contextManager] Summary saved for conversation ${conversationId}`);
  } catch (err) {
    console.error('[contextManager] Failed to save summary:', err.message);
  }
}

// ---------------------------------------------------------------------------
// getLatestSummary — retrieve the most recent summary for a conversation
// ---------------------------------------------------------------------------
function getLatestSummary(conversationId) {
  try {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT summary_text FROM context_summaries
         WHERE conversation_id = ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(conversationId);
    return row?.summary_text || null;
  } catch (err) {
    console.error('[contextManager] Failed to read summary:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// injectSummaryMessage — build a summary message for the context window
// ---------------------------------------------------------------------------
function injectSummaryMessage(summaryText) {
  return {
    role: 'system',
    content: `${SUMMARY_INJECT_LABEL}\n${summaryText}`,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  estimateTokens,
  estimateMessagesTokens,
  shouldSummarise,
  getContextFill,
  buildContextWindow,
  summariseOldMessages,
  saveSummary,
  getLatestSummary,
  injectSummaryMessage,
};
