// electron/handlers/promptEngine.js — Prompt formatting + persona system prompts
// Handles 18 prompt modes (chat, email, clipboard, document, context management)
// and 4 chat template formats (Llama, ChatML, Phi, OpenAI-compatible).
//
// Two responsibilities:
//   1. getSystemPrompt(mode, options) — returns the system prompt string
//   2. formatForModel(messages, systemPrompt, chatTemplate) — formats for the model
//
// Note: llama-server's /v1/chat/completions endpoint handles most template
// formatting automatically. formatForModel() is a fallback for raw /completion
// calls and for models that need explicit template wrapping.

// ---------------------------------------------------------------------------
// PERSONA PROMPTS — injected as system prompt in chat mode
// ---------------------------------------------------------------------------
const PERSONAS = {
  general:
    'You are Anton AI, a helpful and knowledgeable assistant. ' +
    'Answer clearly and concisely. If you are unsure, say so. ' +
    'Return ONLY the result.',

  coder:
    'You are Anton AI in Coder mode. You are an expert software engineer. ' +
    'Write clean, well-commented code. Explain your reasoning step by step. ' +
    'Use the most appropriate language for the task. Follow best practices. ' +
    'Return ONLY the result.',

  writer:
    'You are Anton AI in Writer mode. You are a skilled writer and editor. ' +
    'Help with drafting, editing, and improving text. Match the user\'s tone. ' +
    'Be creative when asked, precise when needed. ' +
    'Return ONLY the result.',

  analyst:
    'You are Anton AI in Analyst mode. You are a data analyst and researcher. ' +
    'Break down complex topics clearly. Use structured analysis. ' +
    'When given data, identify patterns, trends, and insights. ' +
    'Return ONLY the result.',
};

// ---------------------------------------------------------------------------
// MODE PROMPTS — all 18 prompt modes from the PRD
// ---------------------------------------------------------------------------
const MODE_PROMPTS = {
  // --- Chat (persona-driven) ---
  chat: null, // resolved from PERSONAS at runtime

  // --- Email Assistant (Feature 6) ---
  'email-reply':
    'Generate exactly 3 reply drafts for the email below. ' +
    'Label each: PROFESSIONAL:\n FRIENDLY:\n BRIEF:\n ' +
    'Return ONLY the 3 drafts, nothing else.',

  'email-fix':
    'Fix grammar, tone, and clarity of this email. ' +
    'Return ONLY the corrected email.',

  'email-expand':
    'Expand these bullet points into a professional email. ' +
    'Subject on first line as SUBJECT: ' +
    'Return ONLY the email.',

  'email-summarise':
    'Summarise this email thread. Return exactly in this format: ' +
    'SUMMARY: (3 lines) then ACTION_ITEMS: (bulleted) then OPEN_QUESTIONS: (bulleted). ' +
    'Return ONLY the result.',

  'email-subjects':
    'Generate 3 short subject lines for this email. ' +
    'Return ONLY the 3 subject lines, one per line.',

  // --- Clipboard AI (Feature 4) ---
  'clipboard-improve':
    'Fix grammar, improve clarity, preserve the author\'s voice. ' +
    'Return ONLY the improved text.',

  'clipboard-shorten':
    'Condense to 1–2 sentences. Preserve key meaning. ' +
    'Return ONLY the condensed text.',

  'clipboard-formal':
    'Rewrite in professional business tone. ' +
    'Return ONLY the rewritten text.',

  'clipboard-casual':
    'Rewrite in friendly conversational tone. ' +
    'Return ONLY the rewritten text.',

  'clipboard-translate':
    'Auto-detect source language. Translate to {language}. ' +
    'Return ONLY the translation.',

  'clipboard-explain':
    'Plain-English explanation of jargon or complex text. ' +
    'Return ONLY the explanation.',

  'clipboard-continue':
    'Continue the text naturally, matching tone and style. ' +
    'Return ONLY the continuation.',

  // --- Document Intelligence (Feature 3) ---
  'doc-summarise':
    'Summarise this document. Return exactly in this format:\n' +
    'TITLE: [one line]\n' +
    'SUMMARY:\n• [bullet 1]\n• [bullet 2] (5 bullets maximum)\n' +
    'KEY_FACTS:\n• [fact 1 — dates, numbers, names, decisions] (up to 8 facts)\n' +
    'Return ONLY the result.',

  'doc-ask':
    'Answer the question using ONLY the document sections below. ' +
    'Include a [Source:] block quoting the relevant passage verbatim. ' +
    'If the answer is not in the sections: say so clearly. ' +
    'Return ONLY the result.',

  // --- Context Management (Layer 3 + Layer 5) ---
  'auto-summarise':
    'Summarise the following conversation excerpt in 120 words or fewer. ' +
    'Focus on: key facts established, decisions made, specific details ' +
    '(names, numbers, dates). ' +
    'Return ONLY the summary.',

  'context-distill':
    'You are a context compressor. Compress the following long conversation ' +
    'into a dense knowledge block of 300 words or fewer. Include: all facts, ' +
    'all decisions, all open questions, all names, numbers, and specific details. ' +
    'Structured format preferred. ' +
    'Return ONLY the compressed knowledge block.',
};

// ---------------------------------------------------------------------------
// getSystemPrompt — returns the system prompt for a given mode
// ---------------------------------------------------------------------------
function getSystemPrompt(mode, options = {}) {
  // Chat mode uses persona
  if (mode === 'chat') {
    const personaName = options.persona || 'general';
    const persona = PERSONAS[personaName];

    if (!persona) {
      console.warn(`[promptEngine] Unknown persona '${personaName}' — using general.`);
      return PERSONAS.general;
    }

    // Custom persona: user-provided system prompt
    if (personaName === 'custom' && options.customPrompt) {
      // 🔒 Cap custom prompt length to prevent context overflow
      const capped = options.customPrompt.slice(0, 2000);
      return capped + '\nReturn ONLY the result.';
    }

    return persona;
  }

  // All other modes
  const prompt = MODE_PROMPTS[mode];

  if (!prompt) {
    console.warn(`[promptEngine] Unknown mode '${mode}' — using general chat.`);
    return PERSONAS.general;
  }

  // Template substitution for translate mode
  if (mode === 'clipboard-translate' && options.language) {
    return prompt.replace('{language}', options.language);
  }

  // Doc-ask mode: inject document chunks into prompt
  if (mode === 'doc-ask' && options.documentChunks) {
    return prompt + '\n\n[DOCUMENT SECTIONS:\n' + options.documentChunks + '\n]';
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// detectChatTemplate — detect the chat template format from GGUF metadata
// ---------------------------------------------------------------------------
function detectChatTemplate(metadata) {
  // llama-server auto-detects templates via GGUF metadata key
  // 'tokenizer.chat_template'. We read it here for our own formatting needs.
  const template = metadata?.['tokenizer.chat_template'] || '';

  if (template.includes('[INST]')) {
    return 'llama';    // Llama 2/3, Mistral instruct format
  }
  if (template.includes('<|im_start|>')) {
    return 'chatml';   // ChatML — Qwen, Yi, many others
  }
  if (template.includes('<|user|>')) {
    return 'phi';      // Microsoft Phi format
  }

  // Default: use OpenAI messages format (llama-server handles this natively)
  return 'openai';
}

// ---------------------------------------------------------------------------
// formatForModel — format messages for a specific chat template
// ---------------------------------------------------------------------------
// Note: When using llama-server's /v1/chat/completions endpoint,
// the server handles template formatting automatically from GGUF metadata.
// This function is used for:
//   - Raw /completion endpoint calls
//   - Clipboard/email actions that bypass the chat API
//   - Fallback when llama-server template detection fails
//
function formatForModel(messages, systemPrompt, chatTemplate) {
  const template = chatTemplate || 'openai';

  switch (template) {
    case 'llama':
      return formatLlama(messages, systemPrompt);
    case 'chatml':
      return formatChatML(messages, systemPrompt);
    case 'phi':
      return formatPhi(messages, systemPrompt);
    case 'openai':
    default:
      return formatOpenAI(messages, systemPrompt);
  }
}

// ---------------------------------------------------------------------------
// Template formatters
// ---------------------------------------------------------------------------

/**
 * Llama 2/3 + Mistral instruct format
 * <s>[INST] <<SYS>>\n{system}\n<</SYS>>\n\n{user} [/INST] {assistant}</s>
 */
function formatLlama(messages, systemPrompt) {
  let prompt = '<s>';
  let isFirstUser = true;

  for (const msg of messages) {
    if (msg.role === 'system') continue; // handled via <<SYS>> block

    if (msg.role === 'user') {
      prompt += '[INST] ';
      if (isFirstUser && systemPrompt) {
        prompt += `<<SYS>>\n${systemPrompt}\n<</SYS>>\n\n`;
        isFirstUser = false;
      }
      prompt += `${msg.content} [/INST] `;
    } else if (msg.role === 'assistant') {
      prompt += `${msg.content}</s><s>`;
    }
  }

  return prompt;
}

/**
 * ChatML format (Qwen, Yi, OpenHermes, many fine-tunes)
 * <|im_start|>system\n{system}<|im_end|>\n
 * <|im_start|>user\n{user}<|im_end|>\n
 * <|im_start|>assistant\n
 */
function formatChatML(messages, systemPrompt) {
  let prompt = '';

  if (systemPrompt) {
    prompt += `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;
  }

  for (const msg of messages) {
    if (msg.role === 'system') continue;
    prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
  }

  // Prompt the model to start generating
  prompt += '<|im_start|>assistant\n';
  return prompt;
}

/**
 * Microsoft Phi format
 * <|system|>\n{system}<|end|>\n
 * <|user|>\n{user}<|end|>\n
 * <|assistant|>\n
 */
function formatPhi(messages, systemPrompt) {
  let prompt = '';

  if (systemPrompt) {
    prompt += `<|system|>\n${systemPrompt}<|end|>\n`;
  }

  for (const msg of messages) {
    if (msg.role === 'system') continue;
    prompt += `<|${msg.role}|>\n${msg.content}<|end|>\n`;
  }

  prompt += '<|assistant|>\n';
  return prompt;
}

/**
 * OpenAI messages format — used with /v1/chat/completions
 * Returns the messages array with system prompt prepended.
 * llama-server handles the actual template formatting.
 */
function formatOpenAI(messages, systemPrompt) {
  const formatted = [];

  if (systemPrompt) {
    formatted.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === 'system') continue;
    formatted.push({ role: msg.role, content: msg.content });
  }

  return formatted;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  getSystemPrompt,
  formatForModel,
  detectChatTemplate,
  PERSONAS,
  MODE_PROMPTS,
};
