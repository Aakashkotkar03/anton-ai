// src/data/helpContent.js — Structured help content for HelpScreen
// Categories: getting_started, features, education, troubleshooting
// Each entry is searchable by title, shortDescription, and steps text.

const HELP_CONTENT = [
  // =========================================================================
  // GETTING STARTED
  // =========================================================================
  {
    id: 'quick-start',
    title: 'Quick Start',
    icon: '⚡',
    category: 'getting_started',
    shortDescription: 'Your first AI conversation in 3 steps.',
    steps: [
      'Open Anton AI — it starts in your system tray. Click the tray icon or press Alt+Space.',
      'Download a model — go to the Model Library and click Download on a recommended model. Llama 3.2 3B is a great start.',
      'Start chatting — type a question in the chat input and press Ctrl+Enter. Your AI runs entirely on your PC.',
    ],
    setupRequired: false,
    hotkey: null,
    learnMoreUrl: null,
  },
  {
    id: 'walkthrough',
    title: 'Take the Tour',
    icon: '🗺️',
    category: 'getting_started',
    shortDescription: 'Interactive walkthrough of all key features.',
    steps: [
      'Click "Take the Tour" to start a guided walkthrough.',
      'Each step highlights a part of the UI and explains what it does.',
      'You can skip at any time. The tour only runs once unless you restart it from Help.',
    ],
    setupRequired: false,
    hotkey: null,
    learnMoreUrl: null,
  },

  // =========================================================================
  // FEATURES
  // =========================================================================
  {
    id: 'help-chat',
    title: 'AI Chat Assistant',
    icon: '💬',
    category: 'features',
    shortDescription: 'Ask questions, paste code, drop files — all processed locally.',
    steps: [
      'Press Alt+Space to open the floating chat panel from any app.',
      'Choose a persona: General, Coder, Writer, or Analyst.',
      'Type your message and press Ctrl+Enter to send.',
      'Responses stream in real-time from your local AI model.',
      'Use the Insert at Cursor button to paste the response into your active app.',
    ],
    setupRequired: false,
    hotkey: 'Alt+Space',
    learnMoreUrl: 'https://antonai.dev/chat',
  },
  {
    id: 'help-documents',
    title: 'Document Intelligence',
    icon: '📄',
    category: 'features',
    shortDescription: 'Drop a PDF or Word file for instant AI analysis.',
    steps: [
      'Open the Documents screen from the left rail.',
      'Drag and drop a PDF, DOCX, TXT, MD, or CSV file onto the window.',
      'Anton AI automatically generates a structured summary.',
      'Ask specific questions about the document using the Q&A panel on the right.',
      'For large documents, Anton AI searches the most relevant sections automatically.',
    ],
    setupRequired: false,
    hotkey: null,
    learnMoreUrl: 'https://antonai.dev/documents',
  },
  {
    id: 'help-clipboard',
    title: 'Clipboard AI',
    icon: '📋',
    category: 'features',
    shortDescription: 'Copy text, then use 7 AI actions to transform it.',
    steps: [
      'Copy any text with Ctrl+C — a small blue dot appears at the bottom-right.',
      'Press Ctrl+Shift+L to open the action wheel (or click the dot).',
      'Choose an action: Improve, Shorten, Formal, Casual, Translate, Explain, or Continue.',
      'The result replaces your clipboard. Press Ctrl+V to paste.',
      'Click Undo in the toast to restore the original text.',
    ],
    setupRequired: false,
    hotkey: 'Ctrl+Shift+L',
    learnMoreUrl: 'https://antonai.dev/clipboard',
  },
  {
    id: 'help-voice',
    title: 'Voice Input & Dictation',
    icon: '🎤',
    category: 'features',
    shortDescription: 'Hold a hotkey to record, release to transcribe.',
    steps: [
      'Press Win+Alt+V to start recording (a recording indicator appears).',
      'Speak naturally — Whisper runs locally on your PC.',
      'Press Win+Alt+V again (or release after 60 seconds) to stop.',
      'The transcribed text is pasted at your cursor position.',
      'Download Whisper Small from the Model Library for better multilingual accuracy.',
    ],
    setupRequired: false,
    hotkey: 'Win+Alt+V',
    learnMoreUrl: 'https://antonai.dev/voice',
  },
  {
    id: 'help-email',
    title: 'Email Assistant',
    icon: '📧',
    category: 'features',
    shortDescription: 'AI-powered email in Gmail and Outlook — zero data leaves your PC.',
    steps: [
      'Install the Anton AI browser extension from the Chrome Web Store.',
      'Open Gmail or Outlook Web — you\'ll see the Anton AI button in compose windows.',
      'Click the button for 6 actions: Reply Drafts, Fix Email, Expand Bullets, Summarise, Subject Lines, Translate.',
      'Reply Drafts generates 3 options (Professional, Friendly, Brief). Click to use.',
      'All processing happens locally — zero email content reaches any server.',
    ],
    setupRequired: true,
    hotkey: null,
    learnMoreUrl: 'https://antonai.dev/email',
  },
  {
    id: 'help-browser',
    title: 'Browser Extension',
    icon: '🌐',
    category: 'features',
    shortDescription: 'AI text enhancer on any website + page summariser.',
    steps: [
      'Install from the Chrome Web Store (also works on Edge).',
      'Make sure Anton AI desktop app is running — the extension icon turns green when connected.',
      'Focus any text input on any website — a small blue "A" icon appears.',
      'Hover the icon for 5 quick actions: Fix, Shorten, Formal, Casual, Translate.',
      'Click the toolbar icon for page summarisation.',
    ],
    setupRequired: true,
    hotkey: null,
    learnMoreUrl: 'https://antonai.dev/extension',
  },
  {
    id: 'help-models',
    title: 'Model Library',
    icon: '🧠',
    category: 'features',
    shortDescription: 'Download and manage AI models — all hardware-gated for your PC.',
    steps: [
      'Open the Model Library from the left rail (or press Ctrl+Shift+M).',
      'Models are filtered by your hardware — only compatible models show as downloadable.',
      'Click Download — progress shows speed and ETA.',
      'Switch between models in the chat header or Settings.',
      'Import custom models from HuggingFace or local GGUF files.',
    ],
    setupRequired: false,
    hotkey: 'Ctrl+Shift+M',
    learnMoreUrl: 'https://antonai.dev/models',
  },

  // =========================================================================
  // EDUCATION
  // =========================================================================
  {
    id: 'token-education',
    title: 'Understanding AI Memory (Context Windows)',
    icon: '🧠',
    category: 'education',
    shortDescription: 'Why your AI memory is smaller than ChatGPT — and why that\'s OK.',
    steps: [
      'Context windows define how much text the AI can "see" at once — think of it as working memory.',
      'ChatGPT uses cloud servers with terabytes of RAM. Your PC has 8-32 GB. This limits the context window.',
      'Anton AI automatically calculates the maximum safe context for your hardware and shows it in the context bar.',
      'When conversations get long, Anton AI summarises older messages to free up space (you can scroll back to read originals).',
      'For large documents, Anton AI searches the most relevant sections instead of loading the entire file.',
      'Upgrading RAM is the simplest way to increase your context window. 16 GB RAM unlocks ~25,000 tokens.',
    ],
    setupRequired: false,
    hotkey: null,
    learnMoreUrl: 'https://antonai.dev/tokens',
  },

  // =========================================================================
  // TROUBLESHOOTING
  // =========================================================================
  {
    id: 'ts-model-wont-load',
    title: 'Model won\'t load',
    icon: '⚠️',
    category: 'troubleshooting',
    shortDescription: 'The model fails to start or crashes immediately.',
    steps: [
      'Check your RAM — the model may need more memory than available. Close other apps to free RAM.',
      'Try a smaller model. If a 7B model fails, download the 3B version instead.',
      'Verify the model file is not corrupted — delete it from the Model Library and re-download.',
      'Check Settings > Hardware for your detected specs and tier rating.',
      'If using a GPU, ensure your drivers are up to date (NVIDIA: GeForce Experience, AMD: Adrenalin).',
    ],
    setupRequired: false,
    hotkey: null,
    learnMoreUrl: null,
  },
  {
    id: 'ts-extension-disconnected',
    title: 'Browser extension not connecting',
    icon: '🔌',
    category: 'troubleshooting',
    shortDescription: 'The extension icon stays grey / shows "Not connected".',
    steps: [
      'Make sure the Anton AI desktop app is running (check your system tray).',
      'The extension connects via localhost port 58000. Firewalls should not block localhost, but check if one is.',
      'Try closing and reopening the browser tab.',
      'If the extension was recently reinstalled, the extension ID may have changed. Update it in Settings > Browser Extension.',
      'Check chrome://extensions to verify the extension is enabled.',
    ],
    setupRequired: false,
    hotkey: null,
    learnMoreUrl: null,
  },
  {
    id: 'ts-slow-responses',
    title: 'AI responses are very slow',
    icon: '🐌',
    category: 'troubleshooting',
    shortDescription: 'Responses take a long time or appear word by word.',
    steps: [
      'Check Settings > Hardware for your tier. Tier 1 (< 8 GB RAM) produces ~1-3 tokens/second — this is normal.',
      'Close memory-intensive apps (browser with many tabs, Photoshop, games) to free RAM for the AI.',
      'Try a smaller model — 3B models are 3-5x faster than 7B models on the same hardware.',
      'If you have a dedicated GPU (NVIDIA or AMD), ensure it is detected in Settings > Hardware. GPU offloading dramatically speeds up inference.',
      'Reduce the context window size in Settings > Inference for faster responses.',
    ],
    setupRequired: false,
    hotkey: null,
    learnMoreUrl: null,
  },
  {
    id: 'ts-voice-not-working',
    title: 'Voice input not working',
    icon: '🎤',
    category: 'troubleshooting',
    shortDescription: 'Win+Alt+V doesn\'t record or transcription fails.',
    steps: [
      'Check that your microphone is selected in Settings > Voice.',
      'Windows may be blocking microphone access. Go to Windows Settings > Privacy > Microphone and allow Anton AI.',
      'Try a test recording in another app (e.g. Voice Recorder) to verify your mic works.',
      'If transcription fails, the Whisper model may be missing. Check Settings > Voice and download Whisper Tiny if needed.',
      'The hotkey Win+Alt+V may conflict with another app. Check Settings > Hotkeys to rebind.',
    ],
    setupRequired: false,
    hotkey: null,
    learnMoreUrl: null,
  },
  {
    id: 'ts-download-stuck',
    title: 'Model download stuck or failed',
    icon: '⬇️',
    category: 'troubleshooting',
    shortDescription: 'Download progress stops or shows an error.',
    steps: [
      'Check your internet connection. Model downloads require a stable connection.',
      'Pause and resume the download — Anton AI supports resume so you won\'t lose progress.',
      'Check available disk space. Models range from 2-5 GB each.',
      'If the download repeatedly fails, try cancelling and restarting it.',
      'Downloads use HuggingFace servers. If they are slow, try again later.',
    ],
    setupRequired: false,
    hotkey: null,
    learnMoreUrl: null,
  },
];

// ---------------------------------------------------------------------------
// Search helper — filters content by query string
// ---------------------------------------------------------------------------
export function searchHelp(query) {
  if (!query || query.trim().length === 0) return HELP_CONTENT;

  const q = query.toLowerCase().trim();
  return HELP_CONTENT.filter((entry) => {
    const searchable = [
      entry.title,
      entry.shortDescription,
      ...(entry.steps || []),
      entry.hotkey || '',
    ].join(' ').toLowerCase();

    return searchable.includes(q);
  });
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------
export function getByCategory(category) {
  return HELP_CONTENT.filter((e) => e.category === category);
}

export { HELP_CONTENT };
export default HELP_CONTENT;
