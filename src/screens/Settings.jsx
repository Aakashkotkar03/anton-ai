// src/screens/Settings.jsx — 9-tab settings screen (PRD Feature 12)
// Design: UI/UX SCREEN 6A (Settings_General_Dark) + SCREEN 6B
//
// Two-column: left tab sidebar (220px) + right content area.
// Tabs: General, Models, Inference, Account, Hardware, Hotkeys, Clipboard AI, Voice, Browser Extension

import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../stores/useAppStore';
import useSettingsStore from '../stores/useSettingsStore';
import useHardwareStore from '../stores/useHardwareStore';
import useModelStore from '../stores/useModelStore';
import useAuthStore from '../stores/useAuthStore';
import { Button, Badge, Toggle, KbdBadge } from '../components/ui';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'general',   label: 'General',          icon: '⚙️' },
  { id: 'models',    label: 'Models',           icon: '🧠' },
  { id: 'inference', label: 'Inference',         icon: '⚡' },
  { id: 'account',   label: 'Account',          icon: '👤' },
  { id: 'hardware',  label: 'Hardware',         icon: '🖥️' },
  { id: 'hotkeys',   label: 'Hotkeys',          icon: '⌨️' },
  { id: 'clipboard', label: 'Clipboard AI',     icon: '📋' },
  { id: 'voice',     label: 'Voice',            icon: '🎤' },
  { id: 'extension', label: 'Browser Extension', icon: '🌐' },
];

// ---------------------------------------------------------------------------
// Settings (main component)
// ---------------------------------------------------------------------------
export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="flex h-full">
      {/* Left sidebar — tab list */}
      <div className="w-[220px] shrink-0 h-full overflow-y-auto py-4
        dark:bg-[#0F172A]/50 bg-slate-50
        border-r dark:border-[#1E293B] border-slate-200">
        <h2 className="px-5 mb-3 text-xs font-semibold uppercase tracking-wider
          dark:text-slate-500 text-slate-400">
          Settings
        </h2>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-left text-sm
                transition-colors duration-150
                ${isActive
                  ? 'dark:bg-[#1E293B] dark:text-slate-100 bg-white text-blue-600 border-l-[3px] border-blue-600 font-medium shadow-sm'
                  : 'dark:text-[#64748B] dark:hover:bg-[#1E293B]/50 dark:hover:text-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-700 border-l-[3px] border-transparent'
                }`}
            >
              <span className="text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right content area */}
      <div className="flex-1 h-full overflow-y-auto px-8 py-6">
        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'models' && <ModelsTab />}
        {activeTab === 'inference' && <InferenceTab />}
        {activeTab === 'account' && <AccountTab />}
        {activeTab === 'hardware' && <HardwareTab />}
        {activeTab === 'hotkeys' && <HotkeysTab />}
        {activeTab === 'clipboard' && <ClipboardTab />}
        {activeTab === 'voice' && <VoiceTab />}
        {activeTab === 'extension' && <ExtensionTab />}
      </div>
    </div>
  );
}

// ===========================================================================
// Shared layout helpers
// ===========================================================================
function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5 pb-3 border-b dark:border-[#1E293B] border-slate-100">
      <h3 className="text-base font-semibold dark:text-slate-100 text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs dark:text-[#64748B] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function GroupLabel({ label }) {
  return (
    <p className="text-[11px] uppercase tracking-wider dark:text-[#475569] text-slate-400 mb-3 mt-6 first:mt-0">
      {label}
    </p>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between py-3
      border-b dark:border-[#1E293B] border-slate-100 last:border-0">
      <div className="min-w-0 pr-4">
        <p className="text-sm dark:text-slate-200 text-slate-700">{label}</p>
        {description && <p className="text-xs dark:text-[#64748B] text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ===========================================================================
// TAB 1 — General
// ===========================================================================
function GeneralTab() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div>
      <SectionHeader title="General Settings" subtitle="Appearance, startup behaviour, and system preferences" />

      <GroupLabel label="Appearance" />
      <SettingRow label="Theme" description="How Anton AI looks">
        <SegmentControl
          options={[
            { id: 'dark', label: 'Dark' },
            { id: 'light', label: 'Light' },
            { id: 'system', label: 'System' },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </SettingRow>

      <GroupLabel label="Startup" />
      <SettingRow label="Launch at startup" description="Start in system tray when Windows starts">
        <Toggle on={false} onToggle={() => {}} label="Launch at startup" />
      </SettingRow>
      <SettingRow label="Show in taskbar" description="Show Anton AI in the Windows taskbar">
        <Toggle on={true} onToggle={() => {}} label="Show in taskbar" />
      </SettingRow>

      <GroupLabel label="Language" />
      <SettingRow label="Interface language">
        <select className="px-3 py-1.5 rounded-lg text-xs
          dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200
          bg-white border border-slate-300 text-slate-700
          focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option>English (US)</option>
        </select>
      </SettingRow>

      <GroupLabel label="Notifications" />
      <SettingRow label="Download complete" description="Notify when model downloads finish">
        <Toggle on={true} onToggle={() => {}} label="Download notifications" />
      </SettingRow>
      <SettingRow label="Model updates" description="Notify when model updates are available">
        <Toggle on={true} onToggle={() => {}} label="Update notifications" />
      </SettingRow>
      <SettingRow label="Context summarisation" description="Alert when older messages are summarised">
        <Toggle on={false} onToggle={() => {}} label="Summarisation alerts" />
      </SettingRow>
    </div>
  );
}

// ===========================================================================
// TAB 2 — Models
// ===========================================================================
function ModelsTab() {
  const { downloadedModels, activeModels } = useModelStore();
  const totalMB = downloadedModels.reduce((sum, m) => sum + (m.sizeMB || 0), 0);

  return (
    <div>
      <SectionHeader title="Models" subtitle="Default models, storage, and disk usage" />

      <GroupLabel label="Default Models" />
      <SettingRow label="Chat model" description="Used for general conversation">
        <ModelSelector models={downloadedModels.filter((m) => m.category === 'chat')} active={activeModels.chat} />
      </SettingRow>
      <SettingRow label="Code model" description="Used for coding tasks">
        <ModelSelector models={downloadedModels.filter((m) => m.category === 'code')} active={activeModels.code} />
      </SettingRow>

      <GroupLabel label="Storage" />
      <SettingRow label="Storage path" description="Where models are saved on disk">
        <span className="text-xs font-mono dark:text-slate-400 text-slate-500 max-w-[200px] truncate block">
          %APPDATA%\AntonAI\models\
        </span>
      </SettingRow>
      <SettingRow label="Total disk usage" description={`${downloadedModels.length} models downloaded`}>
        <Badge variant={totalMB > 20000 ? 'red' : totalMB > 10000 ? 'amber' : 'blue'}>
          {totalMB >= 1024 ? `${(totalMB / 1024).toFixed(1)} GB` : `${totalMB} MB`}
        </Badge>
      </SettingRow>

      <div className="mt-4">
        <Button variant="secondary" size="sm">Open Models Folder</Button>
      </div>
    </div>
  );
}

function ModelSelector({ models, active }) {
  return (
    <select className="px-3 py-1.5 rounded-lg text-xs
      dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200
      bg-white border border-slate-300 text-slate-700
      focus:outline-none focus:ring-1 focus:ring-blue-500">
      <option value="">None selected</option>
      {models.map((m) => (
        <option key={m.id} value={m.id} selected={m.id === active}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

// ===========================================================================
// TAB 3 — Inference
// ===========================================================================
function InferenceTab() {
  const temperature = useSettingsStore((s) => s.temperature);
  const setTemperature = useSettingsStore((s) => s.setTemperature);
  const maxTokens = useSettingsStore((s) => s.maxTokens);
  const setMaxTokens = useSettingsStore((s) => s.setMaxTokens);

  const tempLabel = temperature <= 0.3 ? 'Focused' : temperature <= 0.7 ? 'Balanced' : 'Creative';

  return (
    <div>
      <SectionHeader title="Inference" subtitle="Control how the AI generates responses" />

      <GroupLabel label="Generation" />

      {/* Temperature slider */}
      <div className="py-3 border-b dark:border-[#1E293B] border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm dark:text-slate-200 text-slate-700">Temperature</p>
            <p className="text-xs dark:text-[#64748B] text-slate-400">
              {tempLabel} — {temperature.toFixed(1)}
            </p>
          </div>
          <Badge variant={temperature <= 0.3 ? 'blue' : temperature <= 0.7 ? 'green' : 'amber'}>
            {tempLabel}
          </Badge>
        </div>
        <input
          type="range"
          min="0" max="1" step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer
            dark:bg-[#334155] bg-slate-200
            accent-blue-600"
        />
        <div className="flex justify-between text-[10px] dark:text-slate-600 text-slate-400 mt-1">
          <span>Focused (0.0)</span>
          <span>Creative (1.0)</span>
        </div>
      </div>

      {/* Max tokens slider */}
      <div className="py-3 border-b dark:border-[#1E293B] border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm dark:text-slate-200 text-slate-700">Max response tokens</p>
            <p className="text-xs dark:text-[#64748B] text-slate-400">
              Maximum length of AI responses
            </p>
          </div>
          <span className="text-xs font-mono dark:text-slate-300 text-slate-600">
            {maxTokens.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min="256" max="4096" step="256"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer
            dark:bg-[#334155] bg-slate-200
            accent-blue-600"
        />
        <div className="flex justify-between text-[10px] dark:text-slate-600 text-slate-400 mt-1">
          <span>256</span>
          <span>4,096</span>
        </div>
      </div>

      <GroupLabel label="Advanced" />
      <SettingRow label="GPU layers override" description="Set to 0 for CPU-only. Leave blank for automatic.">
        <input
          type="number"
          min="0" max="100"
          placeholder="Auto"
          className="w-20 px-2.5 py-1.5 rounded-lg text-xs text-center
            dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200
            bg-white border border-slate-300 text-slate-700
            focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </SettingRow>

      <p className="mt-4 text-[11px] dark:text-slate-600 text-slate-400">
        Changes take effect on the next model load. No restart needed.
      </p>
    </div>
  );
}

// ===========================================================================
// TAB 4 — Account
// ===========================================================================
function AccountTab() {
  const user = useAuthStore((s) => s.user);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = async () => {
    try {
      await window.antonAPI.signOut();
      // App.jsx will detect no auth and show Login
      window.location.reload();
    } catch (err) {
      console.error('[settings] Sign out failed:', err);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await window.antonAPI.signOut();
      // TODO: call Firebase deleteAccount Cloud Function
      window.location.reload();
    } catch (err) {
      console.error('[settings] Delete failed:', err);
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <SectionHeader title="Account" subtitle="Your profile and authentication" />

      {/* Profile */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-full
          dark:bg-slate-700 bg-slate-200 overflow-hidden text-lg font-bold
          dark:text-slate-300 text-slate-600">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            (user?.displayName || user?.email || 'U').charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <p className="text-sm font-medium dark:text-slate-100 text-slate-800">
            {user?.displayName || 'User'}
          </p>
          <p className="text-xs dark:text-[#64748B] text-slate-400">
            {user?.email || 'No email'}
          </p>
        </div>
      </div>

      <Button variant="secondary" size="sm" onClick={handleSignOut}>
        Sign Out
      </Button>

      {/* Danger zone */}
      <div className="mt-8 rounded-xl p-4
        dark:bg-red-900/10 dark:border dark:border-red-800/30
        bg-red-50 border border-red-200">
        <h4 className="text-sm font-semibold dark:text-red-400 text-red-600 mb-2">
          Danger Zone
        </h4>
        <p className="text-xs dark:text-red-400/70 text-red-600/80 mb-3">
          Delete your account permanently. Your local models and chat history will be preserved on this device, but your cloud profile will be removed.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder='Type "DELETE" to confirm'
            className="flex-1 px-3 py-1.5 rounded-lg text-xs
              dark:bg-[#0F172A] dark:border dark:border-[#334155] dark:text-slate-200
              bg-white border border-red-300 text-slate-800 placeholder-slate-400
              focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <Button
            variant="danger"
            size="sm"
            disabled={deleteInput !== 'DELETE' || isDeleting}
            loading={isDeleting}
            onClick={handleDeleteAccount}
          >
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 5 — Hardware
// ===========================================================================
function HardwareTab() {
  const specs = useHardwareStore((s) => s.specs);
  const tier = useHardwareStore((s) => s.tier) || 1;
  const imageTier = useHardwareStore((s) => s.imageTier) || 'IMG-Hidden';
  const [isScanning, setIsScanning] = useState(false);

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      await window.antonAPI.getHardware();
      // Store will update via the hardware handler
    } catch (err) {
      console.error('[settings] Rescan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div>
      <SectionHeader title="Hardware" subtitle="Detected specs and AI performance tier" />

      <div className="rounded-xl p-4 mb-4
        dark:bg-[#1E293B] bg-slate-50 border dark:border-[#334155] border-slate-200">
        <SpecRow label="Processor" value={specs?.cpu || 'Unknown'} />
        <SpecRow label="Memory" value={specs?.ramGB ? `${specs.ramGB} GB RAM` : 'Unknown'} />
        <SpecRow label="Graphics" value={specs?.gpu || 'No dedicated GPU'} />
        <SpecRow label="Free disk" value={specs?.freeDiskGB ? `${specs.freeDiskGB} GB` : 'Unknown'} />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Badge variant="blue">Tier {tier}</Badge>
        <Badge variant={imageTier === 'IMG-Full' ? 'green' : imageTier === 'IMG-Slow' ? 'amber' : 'grey'}>
          {imageTier === 'IMG-Full' ? 'GPU Ready' : imageTier === 'IMG-Slow' ? 'CPU Only (Slow)' : 'No Image Gen'}
        </Badge>
      </div>

      <Button variant="secondary" size="sm" onClick={handleRescan} loading={isScanning}>
        Re-scan Hardware
      </Button>

      <p className="mt-3 text-[11px] dark:text-slate-600 text-slate-400">
        Tier determines which models are available. GPU accelerates inference dramatically.
      </p>
    </div>
  );
}

function SpecRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2
      border-b dark:border-[#0F172A] border-slate-100 last:border-0">
      <span className="text-xs dark:text-[#64748B] text-slate-400">{label}</span>
      <span className="text-xs font-medium dark:text-slate-200 text-slate-700">{value}</span>
    </div>
  );
}

// ===========================================================================
// TAB 6 — Hotkeys
// ===========================================================================
const DEFAULT_HOTKEYS = [
  { id: 'panel',     action: 'Open / close chat panel', binding: 'Alt+Space' },
  { id: 'clipboard', action: 'Clipboard AI action wheel', binding: 'Ctrl+Shift+L' },
  { id: 'voice',     action: 'Voice recording toggle',   binding: 'Win+Alt+V' },
  { id: 'models',    action: 'Open Model Library',       binding: 'Ctrl+Shift+M' },
  { id: 'help',      action: 'Open Help',                binding: 'F1' },
];

function HotkeysTab() {
  const [hotkeys, setHotkeys] = useState(DEFAULT_HOTKEYS);
  const [rebindingId, setRebindingId] = useState(null);

  const handleReset = () => setHotkeys(DEFAULT_HOTKEYS);

  return (
    <div>
      <SectionHeader title="Hotkeys" subtitle="Global keyboard shortcuts — work from any application" />

      <div className="rounded-xl overflow-hidden
        dark:bg-[#1E293B] bg-slate-50 border dark:border-[#334155] border-slate-200">
        {hotkeys.map((hk) => (
          <div
            key={hk.id}
            className="flex items-center justify-between px-4 py-3
              border-b dark:border-[#0F172A] border-slate-100 last:border-0"
          >
            <p className="text-xs dark:text-slate-200 text-slate-700">{hk.action}</p>
            <button
              onClick={() => setRebindingId(rebindingId === hk.id ? null : hk.id)}
              className={`transition-colors ${
                rebindingId === hk.id
                  ? 'animate-pulse'
                  : ''
              }`}
            >
              <KbdBadge className={rebindingId === hk.id ? 'ring-2 ring-blue-500' : ''}>
                {rebindingId === hk.id ? 'Press keys...' : hk.binding}
              </KbdBadge>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Reset to Defaults
        </Button>
        <p className="text-[11px] dark:text-slate-600 text-slate-400">
          Click a shortcut to rebind it. Press Escape to cancel.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 7 — Clipboard AI
// ===========================================================================
function ClipboardTab() {
  const autopaste = useSettingsStore((s) => s.autopasteEnabled);
  const setAutopaste = useSettingsStore((s) => s.setAutopasteEnabled);
  const translateLang = useSettingsStore((s) => s.translateLanguage);
  const setTranslateLang = useSettingsStore((s) => s.setTranslateLanguage);

  const LANGUAGES = [
    'English', 'Spanish', 'French', 'German', 'Hindi', 'Marathi',
    'Japanese', 'Chinese', 'Korean', 'Portuguese', 'Italian', 'Russian', 'Arabic',
  ];

  return (
    <div>
      <SectionHeader title="Clipboard AI" subtitle="Configure the clipboard indicator and actions" />

      <SettingRow label="Show indicator" description="Blue dot appears after copying text">
        <Toggle on={true} onToggle={() => {}} label="Show indicator" />
      </SettingRow>
      <SettingRow label="Auto-paste result" description="Automatically paste the AI result after processing (Windows only)">
        <Toggle on={autopaste} onToggle={setAutopaste} label="Auto-paste" />
      </SettingRow>
      <SettingRow label="Translation language" description="Default target language for the Translate action">
        <select
          value={translateLang}
          onChange={(e) => setTranslateLang(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs
            dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200
            bg-white border border-slate-300 text-slate-700
            focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      </SettingRow>
    </div>
  );
}

// ===========================================================================
// TAB 8 — Voice
// ===========================================================================
function VoiceTab() {
  const whisperModel = useSettingsStore((s) => s.whisperModel);
  const setWhisperModel = useSettingsStore((s) => s.setWhisperModel);
  const [whisperModels, setWhisperModels] = useState([]);

  useEffect(() => {
    window.antonAPI.getWhisperModels()
      .then((models) => setWhisperModels(models || []))
      .catch(() => {});
  }, []);

  const WHISPER_OPTIONS = [
    { id: 'tiny',   name: 'Whisper Tiny (75 MB)',   desc: 'Bundled. Fast. English best.' },
    { id: 'small',  name: 'Whisper Small (244 MB)',  desc: 'Better accuracy. 20+ languages.' },
    { id: 'medium', name: 'Whisper Medium (769 MB)', desc: 'High accuracy. Best with GPU.' },
  ];

  return (
    <div>
      <SectionHeader title="Voice" subtitle="Microphone and Whisper transcription model" />

      <SettingRow label="Microphone" description="Select which microphone to use for voice input">
        <select className="px-3 py-1.5 rounded-lg text-xs
          dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200
          bg-white border border-slate-300 text-slate-700
          focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option>Default microphone</option>
        </select>
      </SettingRow>

      <GroupLabel label="Whisper Model" />
      <div className="space-y-2">
        {WHISPER_OPTIONS.map((opt) => {
          const isInstalled = whisperModels.some((m) => m.id === opt.id) || opt.id === 'tiny';
          const isActive = whisperModel === opt.id;

          return (
            <div
              key={opt.id}
              className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors
                ${isActive
                  ? 'dark:bg-blue-600/10 dark:border-blue-600/40 border-blue-300 bg-blue-50'
                  : 'dark:bg-[#1E293B] dark:border-[#334155] bg-slate-50 border-slate-200'
                }`}
            >
              <div>
                <p className="text-xs font-medium dark:text-slate-200 text-slate-700">{opt.name}</p>
                <p className="text-[11px] dark:text-[#64748B] text-slate-400 mt-0.5">{opt.desc}</p>
              </div>
              <div className="shrink-0 ml-3">
                {isInstalled ? (
                  <Button
                    variant={isActive ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setWhisperModel(opt.id)}
                  >
                    {isActive ? 'Active' : 'Use'}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm">
                    Download
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 9 — Browser Extension
// ===========================================================================
function ExtensionTab() {
  const chromeId = useSettingsStore((s) => s.chromeExtensionId);
  const edgeId = useSettingsStore((s) => s.edgeExtensionId);
  const setChromeId = useSettingsStore((s) => s.setChromeExtensionId);
  const setEdgeId = useSettingsStore((s) => s.setEdgeExtensionId);
  const [wsStatus, setWsStatus] = useState(null);

  useEffect(() => {
    window.antonAPI.getWsStatus()
      .then((s) => setWsStatus(s))
      .catch(() => {});

    const interval = setInterval(() => {
      window.antonAPI.getWsStatus()
        .then((s) => setWsStatus(s))
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const isConnected = wsStatus && wsStatus.connections > 0;

  const handleSaveIds = async () => {
    try {
      await window.antonAPI.updateExtensionIds({ chrome: chromeId, edge: edgeId });
    } catch (err) {
      console.error('[settings] Failed to update extension IDs:', err);
    }
  };

  return (
    <div>
      <SectionHeader title="Browser Extension" subtitle="Connect the Chrome or Edge extension to Anton AI" />

      {/* Status */}
      <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl
        dark:bg-[#1E293B] bg-slate-50 border dark:border-[#334155] border-slate-200">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-slate-400'}`} />
        <div>
          <p className="text-sm font-medium dark:text-slate-200 text-slate-700">
            {isConnected ? 'Connected' : 'Not connected'}
          </p>
          <p className="text-[11px] dark:text-[#64748B] text-slate-400">
            {isConnected
              ? `${wsStatus.connections} extension${wsStatus.connections > 1 ? 's' : ''} connected`
              : 'Install and open the extension to connect'}
          </p>
        </div>
      </div>

      {/* Install links */}
      <GroupLabel label="Install" />
      <div className="flex gap-2 mb-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.antonAPI.openExternal('https://chrome.google.com/webstore')}
        >
          Chrome Web Store
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.antonAPI.openExternal('https://microsoftedge.microsoft.com/addons')}
        >
          Edge Add-ons
        </Button>
      </div>

      {/* Extension IDs */}
      <GroupLabel label="Extension IDs" />
      <p className="text-[11px] dark:text-slate-600 text-slate-400 mb-3">
        If you reinstall the extension, the ID may change. Update it here.
      </p>
      <div className="space-y-2 mb-3">
        <div>
          <label className="text-[11px] dark:text-[#64748B] text-slate-400 mb-1 block">Chrome Extension ID</label>
          <input
            type="text"
            value={chromeId}
            onChange={(e) => setChromeId(e.target.value)}
            placeholder="Enter Chrome extension ID"
            className="w-full px-3 py-1.5 rounded-lg text-xs font-mono
              dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200
              bg-white border border-slate-300 text-slate-700
              focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-[11px] dark:text-[#64748B] text-slate-400 mb-1 block">Edge Extension ID</label>
          <input
            type="text"
            value={edgeId}
            onChange={(e) => setEdgeId(e.target.value)}
            placeholder="Enter Edge extension ID (optional)"
            className="w-full px-3 py-1.5 rounded-lg text-xs font-mono
              dark:bg-[#1E293B] dark:border dark:border-[#334155] dark:text-slate-200
              bg-white border border-slate-300 text-slate-700
              focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
      <Button variant="primary" size="sm" onClick={handleSaveIds}>
        Save Extension IDs
      </Button>

      {/* Technical info */}
      <GroupLabel label="Technical" />
      <SettingRow label="WebSocket port" description="Extension connects to this port on localhost">
        <span className="text-xs font-mono dark:text-slate-300 text-slate-600">58000</span>
      </SettingRow>
    </div>
  );
}

// ===========================================================================
// Shared components
// ===========================================================================

function SegmentControl({ options, value, onChange }) {
  return (
    <div className="flex rounded-lg overflow-hidden
      dark:bg-[#334155] bg-slate-200">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`px-4 py-1.5 text-xs font-medium transition-colors
            ${value === opt.id
              ? 'bg-blue-600 text-white'
              : 'dark:text-[#94A3B8] dark:hover:text-slate-200 text-slate-500 hover:text-slate-700'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
