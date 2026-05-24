// src/index.jsx — React entry point
// Detects hash routes to render special windows in their own BrowserWindows.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ChatPanelWindow from './screens/ChatPanelWindow';
import ClipboardIndicatorWindow from './screens/ClipboardIndicatorWindow';
import AudioCaptureWindow from './screens/AudioCaptureWindow';
import RecordingOverlayWindow from './screens/RecordingOverlayWindow';
import './styles/index.css';

// Route by hash — each overlay window gets its own React root
const hash = window.location.hash;

function Root() {
  if (hash === '#/panel') return <ChatPanelWindow />;
  if (hash === '#/clipboard-indicator') return <ClipboardIndicatorWindow />;
  if (hash === '#/audio-capture') return <AudioCaptureWindow />;
  if (hash === '#/recording-overlay') return <RecordingOverlayWindow />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
