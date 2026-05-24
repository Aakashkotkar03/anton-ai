// src/screens/Login.jsx — Welcome + Google Sign-In screen
// Shown when checkAuth() returns null.

import { useState } from 'react';

export default function Login({ onSignInSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await window.antonAPI.signIn();
      if (user && user.uid) {
        onSignInSuccess(user);
      } else {
        setError('Sign-in did not return a valid user. Please try again.');
      }
    } catch (err) {
      const message = err?.message || 'Sign-in failed. Please try again.';
      // Show user-friendly message for common errors
      if (message.includes('LOGIN_TIMEOUT')) {
        setError('Sign-in timed out. Please try again.');
      } else if (message.includes('cancelled')) {
        setError('Sign-in was cancelled.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const openLink = (url) => {
    window.antonAPI.openExternal(url);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 dark:bg-slate-900 bg-white">
      {/* Background — subtle gradient in dark mode */}
      <div className="fixed inset-0 dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 bg-gradient-to-b from-slate-50 to-white" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border p-12 dark:border-slate-700 dark:bg-slate-800 border-slate-200 bg-white shadow-xl">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600">
            <span className="text-2xl font-bold text-white">A</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight dark:text-slate-100 text-slate-900">
            Anton AI
          </h1>
          <p className="mt-1 text-sm dark:text-slate-500 text-slate-400">
            by Local Intelligence
          </p>
        </div>

        {/* Tagline */}
        <p className="mb-8 text-center text-base dark:text-slate-300 text-slate-600">
          Your private AI. Runs on your PC.
        </p>

        {/* Sign-in button */}
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <GoogleIcon />
              Sign in with Google
            </>
          )}
        </button>

        {/* Error message */}
        {error && (
          <p className="mt-3 rounded-lg px-3 py-2 text-center text-sm dark:bg-red-900/20 dark:text-red-400 bg-red-50 text-red-600">
            {error}
          </p>
        )}

        {/* Sub-text */}
        <p className="mt-4 text-center text-xs dark:text-slate-500 text-slate-400">
          Free · No credit card · No subscription
        </p>

        {/* Feature highlights */}
        <div className="mt-8 space-y-2.5">
          <FeatureRow icon="🔒" text="Your AI runs on your PC. Zero data leaves your device." />
          <FeatureRow icon="⚡" text="Local models, instant responses. No API costs." />
          <FeatureRow icon="📡" text="Works offline. Yours forever." />
        </div>

        {/* Footer links */}
        <div className="mt-8 flex items-center justify-center gap-3 text-xs dark:text-slate-500 text-slate-400">
          <button
            onClick={() => openLink('https://antonai.dev/privacy')}
            className="hover:underline dark:hover:text-slate-300 hover:text-slate-600"
          >
            Privacy Policy
          </button>
          <span>·</span>
          <button
            onClick={() => openLink('https://antonai.dev/terms')}
            className="hover:underline dark:hover:text-slate-300 hover:text-slate-600"
          >
            Terms of Service
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeatureRow({ icon, text }) {
  return (
    <div className="flex items-start gap-2.5 text-sm dark:text-slate-400 text-slate-500">
      <span className="mt-0.5 text-blue-500">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
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
  );
}
