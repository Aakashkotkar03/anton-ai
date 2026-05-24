// src/data/featuresData.js — Feature definitions + dynamic status calculation
// 21 features from PRD v1.0 (Features 1-13) + v1.1 planned features.
// Status is computed dynamically from hardware tier + installed state.

// ---------------------------------------------------------------------------
// Feature definitions
// ---------------------------------------------------------------------------
const FEATURES = [
  // --- v1.0 Core Features ---
  {
    id: 'chat',
    name: 'AI Chat Assistant',
    icon: '💬',
    description: 'Floating AI panel accessible from any app with Alt+Space. Ask questions, paste code, drop files.',
    category: 'core',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: 'Alt+Space',
    version: '1.0',
  },
  {
    id: 'context-display',
    name: 'Context Window Display',
    icon: '📊',
    description: 'Shows real-time context usage with hardware-aware explanations and upgrade suggestions.',
    category: 'core',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.0',
  },
  {
    id: 'documents',
    name: 'Document Intelligence',
    icon: '📄',
    description: 'Drop PDF, Word, or text files for AI summaries, Q&A, and data extraction.',
    category: 'productivity',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.0',
  },
  {
    id: 'clipboard',
    name: 'Clipboard AI',
    icon: '📋',
    description: '7 AI actions on any copied text — improve, shorten, translate, and more.',
    category: 'productivity',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: 'Ctrl+Shift+L',
    version: '1.0',
  },
  {
    id: 'voice',
    name: 'Voice Input & Dictation',
    icon: '🎤',
    description: 'Hold Win+Alt+V to record, release to transcribe with Whisper running locally.',
    category: 'productivity',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: 'Win+Alt+V',
    version: '1.0',
  },
  {
    id: 'email',
    name: 'Email Assistant',
    icon: '📧',
    description: 'AI reply drafts, fix grammar, expand bullets, summarise threads — in Gmail and Outlook.',
    category: 'productivity',
    requiredTier: 2,
    requiredImageTier: null,
    setupSteps: ['Install the Anton AI browser extension from the Chrome Web Store'],
    hotkey: null,
    version: '1.0',
  },
  {
    id: 'browser-extension',
    name: 'Browser Extension',
    icon: '🌐',
    description: 'AI text enhancer on any website, page summariser sidebar, and email integration.',
    category: 'integration',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: ['Install from Chrome Web Store or Edge Add-ons', 'Open Anton AI desktop app to connect'],
    hotkey: null,
    version: '1.0',
  },
  {
    id: 'windows-integration',
    name: 'Windows System Integration',
    icon: '🖥️',
    description: 'System tray, global hotkeys, right-click context menu, File Explorer integration.',
    category: 'integration',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.0',
  },
  {
    id: 'model-library',
    name: 'AI Model Library',
    icon: '🧠',
    description: 'Discover, download, and manage 11+ AI models with hardware-aware recommendations.',
    category: 'core',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: 'Ctrl+Shift+M',
    version: '1.0',
  },
  {
    id: 'custom-import',
    name: 'Custom Model Import',
    icon: '📦',
    description: 'Import any GGUF model from HuggingFace or local files.',
    category: 'core',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.0',
  },
  {
    id: 'features-tab',
    name: 'Features & Status',
    icon: '⭐',
    description: 'See every feature with its current status on your machine.',
    category: 'core',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.0',
  },
  {
    id: 'help',
    name: 'Help & Feature Guide',
    icon: '❓',
    description: 'Searchable help, interactive walkthrough, and context token education.',
    category: 'core',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: 'F1',
    version: '1.0',
  },
  {
    id: 'onboarding',
    name: 'Onboarding & Setup',
    icon: '🚀',
    description: '5-step first-launch flow with hardware scan and guided model download.',
    category: 'core',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.0',
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: '⚙️',
    description: '9 configuration tabs — theme, models, inference, hotkeys, voice, and more.',
    category: 'core',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.0',
  },
  {
    id: 'force-update',
    name: 'Force Update System',
    icon: '🔄',
    description: 'Ensures all users update when critical new versions launch. Models and data preserved.',
    category: 'core',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.0',
  },

  // --- v1.1 Planned Features ---
  {
    id: 'vscode',
    name: 'VS Code Extension',
    icon: '✏️',
    description: 'Inline completions and code review inside Visual Studio Code.',
    category: 'coding',
    requiredTier: 2,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.1',
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes & Transcription',
    icon: '🎙️',
    description: 'Record meetings and get AI-generated notes, summaries, and action items.',
    category: 'productivity',
    requiredTier: 2,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.1',
  },
  {
    id: 'firefox',
    name: 'Firefox Extension',
    icon: '🦊',
    description: 'Same AI capabilities as the Chrome extension, now for Firefox.',
    category: 'integration',
    requiredTier: 1,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.1',
  },
  {
    id: 'image-gen',
    name: 'Image Generation',
    icon: '🎨',
    description: 'Generate images locally with Stable Diffusion. No cloud, no API costs.',
    category: 'creative',
    requiredTier: 2,
    requiredImageTier: 'IMG-Full',
    setupSteps: null,
    hotkey: null,
    version: '1.1',
  },
  {
    id: 'agent-mode',
    name: 'Agent Mode',
    icon: '🤖',
    description: 'Multi-step local task automation — let AI chain actions together.',
    category: 'advanced',
    requiredTier: 3,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.1',
  },
  {
    id: 'rag-mode',
    name: 'RAG Mode',
    icon: '🗃️',
    description: 'Persistent local vector memory using ChromaDB. Chat with your knowledge base.',
    category: 'advanced',
    requiredTier: 3,
    requiredImageTier: null,
    setupSteps: null,
    hotkey: null,
    version: '1.1',
  },
];

// ---------------------------------------------------------------------------
// Dynamic status calculation
// ---------------------------------------------------------------------------
// Returns the features array with a computed `status` field per feature.
//
// hardwareTier: 1-4 (from hardware.js classifyTier)
// imageTier: 'IMG-Hidden' | 'IMG-Slow' | 'IMG-Full' (from hardware.js classifyImageTier)
// installedFeatures: Set of feature IDs that have completed their setup steps
//   e.g. new Set(['browser-extension', 'email'])
//
export function getFeatureStatuses(hardwareTier = 1, imageTier = 'IMG-Hidden', installedFeatures = new Set()) {
  return FEATURES.map((feature) => {
    let status;

    // v1.1 features are always coming_soon regardless of hardware
    if (feature.version !== '1.0') {
      status = 'coming_soon';
    }
    // Hardware lock: tier too low
    else if (feature.requiredTier > hardwareTier) {
      status = 'locked';
    }
    // Image tier lock: specific image generation requirement
    else if (feature.requiredImageTier === 'IMG-Full' && imageTier !== 'IMG-Full') {
      status = 'locked';
    }
    // Setup needed: has setup steps and user hasn't completed them
    else if (feature.setupSteps && !installedFeatures.has(feature.id)) {
      status = 'setup';
    }
    // Available: all requirements met
    else {
      status = 'available';
    }

    return { ...feature, status };
  });
}

// ---------------------------------------------------------------------------
// Summary stats helper
// ---------------------------------------------------------------------------
export function getFeatureSummary(features) {
  const counts = { available: 0, setup: 0, locked: 0, coming_soon: 0 };
  for (const f of features) {
    counts[f.status] = (counts[f.status] || 0) + 1;
  }
  return counts;
}

// Export raw features for reference
export { FEATURES };

export default getFeatureStatuses;
