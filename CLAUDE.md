# CLAUDE.md — Anton AI Project Memory
# Last verified: 2026-05-21

## PROJECT
Name: Anton AI  │  Company: Local Intelligence
Stack: Electron 30 + React 18 + Vite 5 + Tailwind 3 + Firebase 10 + llama.cpp + whisper.cpp
Dev machine: Mac Mini M4  │  Target: Windows x64
Repo: github.com/aakashkotkar/anton-ai

## CURRENT STATUS
Phase 0–6 + UI Sessions 1–10: ✅ ALL COMPLETE
All ~90 files verified on disk. Zero placeholders remain.

## COMPLETED PHASES
- Phase 0 (Config): ✅ — package.json, vite, tailwind, eslint, prettier, gitignore, electron-builder, GitHub Actions
- Phase 1 (Foundation): ✅ — main.js, preload.js, db.js, firebase config, auth, appControl, hardware
- Phase 2 (Model + Chat): ✅ — catalogue, downloader, llama, promptEngine, contextManager, ChatScreen + components
- Phase 3 (Panel + Clipboard + Voice): ✅ — chatPanel, clipboard handler/indicator, whisper, audio capture, recording overlay
- Phase 4 (Documents): ✅ — documentParser, DocumentScreen, DocumentViewer, DocumentChat, ChunkWarning
- Phase 5 (Browser Extension): ✅ — websocketServer, llama.singleShot, extension (manifest, service_worker, gmail, outlook, universal, popup)
- Phase 6 (Shell Extension): ✅ — shell_extension.cpp/.def, CMakeLists.txt, namedPipeServer.js, NSIS registration
- UI Session 1 (Stores + Data): ✅ — useAuthStore, useConversationStore, useDownloadStore, featuresData, helpContent
- UI Session 2 (Primitives): ✅ — Button, Badge, Toggle, Skeleton, Toast, KbdBadge
- UI Session 3 (AppShell): ✅ — three-panel layout, left rail, keyboard shortcuts
- UI Session 4 (PersonaSwitcher): ✅ — wired into ChatScreen header
- UI Session 5 (Model Components): ✅ — ModelCard, ModelDetailPanel, CustomImportPanel, ModelUpdateModal, SpaceManager
- UI Session 6 (ModelLibrary): ✅ — catalogue grid, downloads, filter/search/sort, 4 overlays
- UI Session 7 (Onboarding): ✅ — 5-step flow, hardware scan, model download, SQLite persistence
- UI Session 8 (Settings): ✅ — 9 tabs all built (General, Models, Inference, Account, Hardware, Hotkeys, Clipboard, Voice, Extension)
- UI Session 9 (FeaturesTab): ✅ — summary card, 4-state FeatureCard, 2-column grid
- UI Session 10 (HelpScreen): ✅ — search, FeatureHelpCard, TokenEducationCard, WalkthroughOverlay

## FILE INVENTORY (~90 files)
### Root (9): package.json, vite.config.js, tailwind.config.js, postcss.config.js, electron-builder.yml, .eslintrc.js, .prettierrc, .gitignore, index.html
### GitHub Actions (1): .github/workflows/build-windows.yml
### Electron Main (3): main.js, preload.js, db.js
### Electron Config (3): firebase.js, firebase-admin.js, features.js
### Electron Handlers (13): auth, appControl, hardware, catalogue, downloader, llama, promptEngine, contextManager, clipboard, whisper, documentParser, websocketServer, namedPipeServer
### Catalogue (1): catalogue.json
### React Entry (3): index.jsx, App.jsx, styles/index.css
### Stores (9): useAppStore, useAuthStore, useClipboardStore, useConversationStore, useDocumentStore, useDownloadStore, useHardwareStore, useModelStore, useSettingsStore
### Data (2): featuresData.js, helpContent.js
### Screens (15): AppShell, AudioCaptureWindow, ChatPanelWindow, ChatScreen, ClipboardIndicatorWindow, DocumentScreen, FeaturesTab, ForceUpdate, HelpScreen, Login, Maintenance, ModelLibrary, Onboarding, RecordingOverlayWindow, Settings
### Components (21): chat/(6), clipboard/(2), documents/(3), features/(1), help/(3), models/(5), ui/(1)
### Extension (6): manifest.json, service_worker.js, gmail.js, outlook.js, universal.js, popup.html
### Native C++ (3): shell_extension.cpp, shell_extension.def, CMakeLists.txt
### Build (1): nsis-shell-extension.nsh

## WHAT REMAINS (Phase 10–12)
- Phase 10: Security hardening — pin GH Action SHA tags, CSP audit, refactor clipboard singleShotLLM to use llama.singleShot
- Phase 11: Testing — Jest unit tests, Playwright E2E tests
- Phase 12: Launch prep — NSIS installer testing, MS Store submission, website, docs

## MINOR WIRING TASKS
- Add data-walkthrough attributes to ChatInput, PersonaSwitcher, ContextBar, model pill
- Wire completeWalkthrough IPC in preload.js + main.js
- Add canvas-confetti to package.json (npm install canvas-confetti)
- Real mic enumeration in Settings > Voice tab
- Persist all Settings toggles to SQLite (some are local state only)
- Extension icon PNGs (16/48/128 + grey variants) needed before Chrome Web Store

## KNOWN ISSUES
- Shell Extension DLL only compiles on Windows (dev is Mac)
- DLL registration needs admin rights (regsvr32)
- .env.local must be created manually with Firebase keys
- Extension ID hhkmgifjhchlkcjiamfijndoaiklempb is dev/unpacked — changes after Chrome Web Store publish
