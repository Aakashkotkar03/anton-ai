// electron/handlers/appControl.js — Firestore force-update & maintenance check
// Runs on every app launch, after auth, before showing the main UI.
//
// The single most important rule:
//   ➜ NEVER block an offline user.
//   ➜ If Firestore is unreachable, return { status: 'ok' } and let them in.
//
// Firestore document: config/appControl
// Fields:
//   forceUpdateRequired  (bool)   — when true, all users must update
//   minimumVersion       (string) — semver; versions below this must update
//   updateMessage        (string) — shown on the ForceUpdate screen
//   updateUrl            (string) — link to Microsoft Store listing
//   maintenanceMode      (bool)   — when true, show maintenance screen
//   maintenanceMessage   (string) — shown on the Maintenance screen

const { app } = require('electron');
const semver = require('semver');

// ---------------------------------------------------------------------------
// checkAppControl
// ---------------------------------------------------------------------------
// @param {Firestore} db — Firestore client instance from firebase.js
// @returns {{ status: 'ok' | 'update_required' | 'maintenance', ... }}
//
async function checkAppControl(db) {
  // If Firestore client was not initialised (missing config), let user in
  if (!db) {
    console.warn('[appControl] Firestore not available — skipping check.');
    return { status: 'ok' };
  }

  const currentVersion = app.getVersion(); // reads from package.json "version"

  try {
    const docRef = db.collection('config').doc('appControl');
    const snapshot = await docRef.get();

    // Document does not exist yet (fresh Firebase project) — let user in
    if (!snapshot.exists) {
      console.log('[appControl] No appControl document found — allowing launch.');
      return { status: 'ok' };
    }

    const ctrl = snapshot.data();

    // --- Force update check ---
    const minimumVersion = ctrl.minimumVersion || '0.0.0';
    const versionTooOld = semver.valid(minimumVersion)
      ? semver.lt(currentVersion, minimumVersion)
      : false; // malformed semver in Firestore → don't block

    if (ctrl.forceUpdateRequired === true || versionTooOld) {
      console.log(
        `[appControl] Update required. Current: ${currentVersion}, ` +
        `minimum: ${minimumVersion}, forced: ${ctrl.forceUpdateRequired}`
      );
      return {
        status: 'update_required',
        message: ctrl.updateMessage || 'A new version of Anton AI is available.',
        url: ctrl.updateUrl || '',
        current: currentVersion,
        required: minimumVersion,
      };
    }

    // --- Maintenance mode check ---
    if (ctrl.maintenanceMode === true) {
      console.log('[appControl] Maintenance mode is active.');
      return {
        status: 'maintenance',
        message: ctrl.maintenanceMessage || 'Anton AI is temporarily under maintenance.',
      };
    }

    // All clear
    return { status: 'ok' };
  } catch (err) {
    // 🔒 NEVER block offline users — any error means let them in
    console.warn('[appControl] Check failed (offline?) — allowing launch:', err.message);
    return { status: 'ok' };
  }
}

module.exports = { checkAppControl };
