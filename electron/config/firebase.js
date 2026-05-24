// electron/config/firebase.js — Firebase CLIENT SDK initialisation
// Runs in the Electron main process. Uses VITE_FIREBASE_* env vars
// loaded from .env.local at the project root.
//
// 🔒 Security: These are Firebase *client* keys — they are safe to embed
//    in the shipped app. They only identify the project; access is controlled
//    by Firestore Security Rules and Firebase Auth on the server side.
//    The Admin SDK (firebase-admin.js) is the one with privileged access.

const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
const { getFirestore } = require('firebase/firestore');
const { getAnalytics, isSupported } = require('firebase/analytics');

// ---------------------------------------------------------------------------
// Firebase configuration from environment variables
// ---------------------------------------------------------------------------
// 🔒 Values come from .env.local (never committed to git).
//    In production builds, these are injected via electron-builder env
//    or baked in at build time by GitHub Actions secrets.
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// ---------------------------------------------------------------------------
// Validate — fail fast if config is missing
// ---------------------------------------------------------------------------
const requiredKeys = ['apiKey', 'projectId', 'authDomain', 'appId'];
const missing = requiredKeys.filter((key) => !firebaseConfig[key]);

if (missing.length > 0) {
  console.error(
    `[firebase] Missing required config keys: ${missing.join(', ')}. ` +
    'Check your .env.local file has VITE_FIREBASE_* variables set.'
  );
}

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------
let app = null;
let auth = null;
let db = null;
let analytics = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Analytics requires a browser environment — in Electron main process
  // it may not be supported. Check before initialising.
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      } else {
        console.warn('[firebase] Analytics not supported in this environment.');
      }
    })
    .catch(() => {
      // Silently skip — analytics is non-critical
    });
} catch (err) {
  console.error('[firebase] Failed to initialise Firebase client SDK:', err.message);
}

module.exports = { app, auth, db, analytics };
