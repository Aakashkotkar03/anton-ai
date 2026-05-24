// electron/config/features.js — Feature flags for Anton AI
// All flags are false in v1.0 — free, no payments.
// v2.0 will enable payments via Razorpay (India).
//
// Usage:
//   const features = require('./config/features');
//   if (features.PAYMENTS_ENABLED) { ... }

module.exports = {
  // v1.0 — everything free
  PAYMENTS_ENABLED: false,
  SUBSCRIPTION_REQUIRED: false,

  // v1.1 features — toggled on when ready
  AGENT_MODE: false,          // multi-step local tasks
  RAG_MODE: false,            // persistent local vector memory (ChromaDB)
  IMAGE_GENERATION: false,    // stable-diffusion.cpp
  VSCODE_EXTENSION: false,    // inline completions
  FIREFOX_EXTENSION: false,   // Firefox browser extension
  MEETING_NOTES: false,       // audio transcription for meetings

  // Debug / dev flags
  DEV_TOOLS_IN_PRODUCTION: false,
  VERBOSE_LOGGING: false,
};
