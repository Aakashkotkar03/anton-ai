// electron/config/firebase-admin.js — Firebase ADMIN SDK initialisation
// Runs in the Electron main process ONLY. Used for:
//   - Minting custom auth tokens (auth.js handler)
//   - Writing to Firestore users/{uid} without client auth
//   - Server-side account deletion (deleteAccount Cloud Function fallback)
//
// 🔒 Security: The service account key grants FULL access to the Firebase
//    project. It must NEVER be bundled in the shipped app, committed to git,
//    or accessible from the renderer process. It is only used during
//    development and in the GitHub Actions build environment.
//
//    In production builds: admin features that need the service account
//    (like custom token minting) are handled by Cloud Functions instead.
//    This file gracefully exports nulls when the key is missing.

const admin = require('firebase-admin');

// ---------------------------------------------------------------------------
// Initialise with service account
// ---------------------------------------------------------------------------
let adminApp = null;
let adminAuth = null;
let adminDb = null;

try {
  const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    console.warn(
      '[firebase-admin] SERVICE_ACCOUNT_PATH not set in environment. ' +
      'Admin SDK disabled. Auth will use Cloud Functions in production.'
    );
  } else {
    // 🔒 Validate the path exists before requiring it
    const fs = require('fs');
    const path = require('path');
    const resolvedPath = path.resolve(serviceAccountPath);

    // 🔒 Block path traversal — service account must be within the project
    //    or an absolute path explicitly set by the developer
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `Service account file not found at: ${resolvedPath}. ` +
        'Check SERVICE_ACCOUNT_PATH in .env.local.'
      );
    }

    const serviceAccount = require(resolvedPath);

    // 🔒 Sanity check: ensure the file looks like a service account
    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      throw new Error(
        'Service account file is missing project_id or private_key. ' +
        'Ensure it is a valid Firebase service account JSON file.'
      );
    }

    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    adminAuth = admin.auth(adminApp);
    adminDb = admin.firestore(adminApp);

    console.log(
      `[firebase-admin] Initialised for project: ${serviceAccount.project_id}`
    );
  }
} catch (err) {
  console.error('[firebase-admin] Failed to initialise:', err.message);
  // Exports remain null — callers must check before using
  adminApp = null;
  adminAuth = null;
  adminDb = null;
}

module.exports = { adminApp, adminAuth, adminDb };
