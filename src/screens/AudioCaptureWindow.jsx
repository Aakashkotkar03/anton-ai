// src/screens/AudioCaptureWindow.jsx — Hidden audio capture window
// This runs inside an invisible 1×1 BrowserWindow.
// It uses the browser MediaRecorder API to capture microphone audio.
//
// Flow:
//   1. Main process sends 'audio:startRecording' → we call getUserMedia + start
//   2. Main process sends 'audio:stopRecording' → we stop + send buffer back
//   3. Buffer sent via window.antonAPI.sendRecordedAudio(buffer)
//
// No UI — this window is never visible.

import { useEffect, useRef } from 'react';

export default function AudioCaptureWindow() {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    // Listen for start recording command
    const cleanupStart = window.antonAPI.onStartRecording(async () => {
      try {
        await startCapture();
      } catch (err) {
        console.error('[audio-capture] Failed to start:', err);
        window.antonAPI.reportAudioError(err.message);
      }
    });

    // Listen for stop recording command
    const cleanupStop = window.antonAPI.onStopRecording(() => {
      stopCapture();
    });

    return () => {
      cleanupStart();
      cleanupStop();
      // Clean up any active stream on unmount
      releaseStream();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startCapture() {
    // Release any previous stream
    releaseStream();
    audioChunksRef.current = [];

    // Request microphone access — 16kHz mono (Whisper's preferred format)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    streamRef.current = stream;

    // Create MediaRecorder — use WAV-compatible format
    // Browsers typically support 'audio/webm;codecs=opus' or 'audio/ogg;codecs=opus'
    // We'll collect raw audio and let whisper.cpp handle the format
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      // Combine chunks into a single blob
      const blob = new Blob(audioChunksRef.current, { type: mimeType });

      if (blob.size < 100) {
        console.warn('[audio-capture] Recording too small, skipping.');
        window.antonAPI.reportAudioError('Recording too short or empty.');
        return;
      }

      // Convert blob to ArrayBuffer → Uint8Array for IPC transfer
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log(`[audio-capture] Sending ${uint8Array.length} bytes to main process.`);

      try {
        await window.antonAPI.sendRecordedAudio(uint8Array);
      } catch (err) {
        console.error('[audio-capture] Failed to send audio:', err);
      }

      audioChunksRef.current = [];
    };

    recorder.onerror = (event) => {
      console.error('[audio-capture] MediaRecorder error:', event.error);
      window.antonAPI.reportAudioError(
        event.error?.message || 'MediaRecorder error'
      );
    };

    // Start recording — collect data every 250ms
    recorder.start(250);
    mediaRecorderRef.current = recorder;
    console.log('[audio-capture] Recording started.');
  }

  function stopCapture() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      console.log('[audio-capture] Recording stopped.');
    }
    mediaRecorderRef.current = null;

    // Release the mic stream after a short delay (let onstop fire first)
    setTimeout(() => releaseStream(), 500);
  }

  function releaseStream() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }

  // No UI — this window is invisible
  return null;
}
