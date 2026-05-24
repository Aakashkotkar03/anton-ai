// src/App.jsx — Root component
// Startup sequence: checkAuth → checkAppControl → getHardware → render screen
//
// Screen flow:
//   null auth     → Login
//   update_required → ForceUpdate (non-dismissable)
//   maintenance   → Maintenance (auto-retry 60s)
//   first launch  → Onboarding (placeholder)
//   else          → AppShell (placeholder)

import { useState, useEffect } from 'react';
import useAppStore from './stores/useAppStore';
import Login from './screens/Login';
import ForceUpdate from './screens/ForceUpdate';
import Maintenance from './screens/Maintenance';
import AppShell from './screens/AppShell';
import Onboarding from './screens/Onboarding';

// ---------------------------------------------------------------------------
// Startup states
// ---------------------------------------------------------------------------
const SCREEN = {
  LOADING: 'loading',
  LOGIN: 'login',
  FORCE_UPDATE: 'force_update',
  MAINTENANCE: 'maintenance',
  ONBOARDING: 'onboarding',
  APP: 'app',
};

export default function App() {
  const [screen, setScreen] = useState(SCREEN.LOADING);
  const [user, setUser] = useState(null);
  const [appControl, setAppControl] = useState(null);
  const [hardwareLoaded, setHardwareLoaded] = useState(false);

  const setTheme = useAppStore((s) => s.setTheme);

  // -------------------------------------------------------------------------
  // Apply initial theme on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Default to dark — matches PRD default
    setTheme('dark');

    // Listen for OS theme changes from main process
    const cleanup = window.antonAPI.onThemeChange((osTheme) => {
      setTheme(osTheme);
    });

    return cleanup;
  }, [setTheme]);

  // -------------------------------------------------------------------------
  // Startup sequence — runs once on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    runStartupSequence();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runStartupSequence() {
    try {
      // Step 1 — Check auth
      const authResult = await window.antonAPI.checkAuth();

      if (!authResult) {
        setScreen(SCREEN.LOGIN);
        return;
      }

      setUser(authResult);

      // Step 2 — Check app control (force update / maintenance)
      await runAppControlCheck();

      // Step 3 — Get hardware specs
      await loadHardware();

      // Step 4 — Check if onboarding is completed
      try {
        const onboarding = await window.antonAPI.checkOnboarding();
        if (!onboarding?.completed) {
          setScreen(SCREEN.ONBOARDING);
          return;
        }
      } catch (_err) {
        // If onboarding check fails, skip to app
      }

      // Step 5 — Determine final screen
      setScreen(SCREEN.APP);
    } catch (err) {
      console.error('[App] Startup error:', err);
      // On any unexpected error, show login as safe fallback
      setScreen(SCREEN.LOGIN);
    }
  }

  async function runAppControlCheck() {
    try {
      const ctrl = await window.antonAPI.checkAppControl();
      setAppControl(ctrl);

      if (ctrl.status === 'update_required') {
        setScreen(SCREEN.FORCE_UPDATE);
        // Throw to stop the startup sequence — ForceUpdate is a dead end
        throw new Error('__FORCE_UPDATE__');
      }

      if (ctrl.status === 'maintenance') {
        setScreen(SCREEN.MAINTENANCE);
        throw new Error('__MAINTENANCE__');
      }
    } catch (err) {
      // Re-throw our control flow errors
      if (
        err.message === '__FORCE_UPDATE__' ||
        err.message === '__MAINTENANCE__'
      ) {
        throw err;
      }
      // Any other error → let user in (never block offline)
      console.warn('[App] appControl check failed — allowing launch.');
    }
  }

  async function loadHardware() {
    try {
      await window.antonAPI.getHardware();
      // TODO: store result in useHardwareStore when that store is built
      setHardwareLoaded(true);
    } catch (err) {
      console.warn('[App] Hardware detection failed:', err.message);
      setHardwareLoaded(true); // proceed anyway
    }
  }

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------
  const handleSignInSuccess = async (signedInUser) => {
    setUser(signedInUser);

    // Continue startup from step 2
    try {
      await runAppControlCheck();
      await loadHardware();

      // Check onboarding after sign-in too
      try {
        const onboarding = await window.antonAPI.checkOnboarding();
        if (!onboarding?.completed) {
          setScreen(SCREEN.ONBOARDING);
          return;
        }
      } catch (_err) {
        // skip
      }

      setScreen(SCREEN.APP);
    } catch (err) {
      // ForceUpdate / Maintenance already set the screen via throw
      if (
        err.message !== '__FORCE_UPDATE__' &&
        err.message !== '__MAINTENANCE__'
      ) {
        console.error('[App] Post-login startup error:', err);
        setScreen(SCREEN.APP); // best effort — show the app
      }
    }
  };

  const handleMaintenanceOk = async () => {
    // Maintenance is over — continue startup
    try {
      await loadHardware();
      setScreen(SCREEN.APP);
    } catch (_err) {
      setScreen(SCREEN.APP);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  switch (screen) {
    case SCREEN.LOADING:
      return <LoadingScreen />;

    case SCREEN.LOGIN:
      return <Login onSignInSuccess={handleSignInSuccess} />;

    case SCREEN.FORCE_UPDATE:
      return (
        <ForceUpdate
          message={appControl?.message}
          updateUrl={appControl?.url}
          currentVersion={appControl?.current}
          requiredVersion={appControl?.required}
        />
      );

    case SCREEN.MAINTENANCE:
      return (
        <Maintenance
          message={appControl?.message}
          onStatusOk={handleMaintenanceOk}
        />
      );

    case SCREEN.ONBOARDING:
      return <Onboarding onComplete={() => setScreen(SCREEN.APP)} />;

    case SCREEN.APP:
      return <AppShell />;

    default:
      return <LoadingScreen />;
  }
}

// ---------------------------------------------------------------------------
// Temporary screens — replaced in later phases
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center dark:bg-slate-900 bg-white">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600">
          <span className="text-lg font-bold text-white">A</span>
        </div>
        <p className="text-sm dark:text-slate-400 text-slate-500">Loading...</p>
      </div>
    </div>
  );
}

function PlaceholderScreen({ label }) {
  return (
    <div className="flex min-h-screen items-center justify-center dark:bg-slate-900 bg-white">
      <div className="rounded-2xl border p-8 text-center dark:border-slate-700 dark:bg-slate-800 border-slate-200 bg-white">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600">
          <span className="text-lg font-bold text-white">A</span>
        </div>
        <h2 className="text-xl font-bold dark:text-slate-100 text-slate-900">
          {label}
        </h2>
        <p className="mt-2 text-sm dark:text-slate-400 text-slate-500">
          This screen will be built in a later phase.
        </p>
      </div>
    </div>
  );
}
