// src/screens/Maintenance.jsx — Maintenance mode screen
// Shown when appControl returns { status: 'maintenance' }.
// Auto-retries checkAppControl() every 60 seconds.

import { useState, useEffect, useRef } from 'react';

export default function Maintenance({ message, onStatusOk }) {
  const [countdown, setCountdown] = useState(60);
  const [isRetrying, setIsRetrying] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Tick countdown every second
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time's up — retry
          handleRetry();
          return 60; // reset for next cycle
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const result = await window.antonAPI.checkAppControl();
      if (result.status === 'ok') {
        // Maintenance is over — proceed to app
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        onStatusOk();
      }
      // If still maintenance or update_required, keep showing this screen
    } catch (_err) {
      // Network error — keep waiting
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center dark:bg-slate-900 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border p-12 text-center dark:border-slate-700 dark:bg-slate-800 border-slate-200 bg-white shadow-xl">
        {/* Icon */}
        <div className="mb-6 text-4xl">🔧</div>

        {/* Heading */}
        <h1 className="text-2xl font-bold dark:text-slate-100 text-slate-900">
          Under Maintenance
        </h1>

        {/* Message from Firestore */}
        <p className="mt-3 text-sm dark:text-slate-400 text-slate-500">
          {message || 'Anton AI is temporarily under maintenance. We\'ll be back shortly.'}
        </p>

        {/* Countdown */}
        <div className="mx-auto mt-8 flex h-20 w-20 items-center justify-center rounded-full dark:bg-slate-700 bg-slate-100">
          {isRetrying ? (
            <svg
              className="h-6 w-6 animate-spin dark:text-blue-400 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <span className="text-2xl font-mono font-bold dark:text-slate-200 text-slate-700">
              {countdown}
            </span>
          )}
        </div>

        <p className="mt-3 text-xs dark:text-slate-500 text-slate-400">
          {isRetrying ? 'Checking...' : `Retrying in ${countdown} seconds`}
        </p>

        {/* Manual retry button */}
        <button
          onClick={() => {
            setCountdown(60);
            handleRetry();
          }}
          disabled={isRetrying}
          className="mt-6 rounded-lg px-5 py-2 text-sm font-medium transition-colors dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          Retry now
        </button>
      </div>
    </div>
  );
}
