// electron/handlers/auth.js — Google OAuth sign-in, JWT check, sign-out
// Runs in the Electron main process ONLY.
//
// Flow: Google OAuth in system browser → localhost callback →
//       exchange code → Firebase custom token → store in keytar
//
// 🔒 Security notes:
//   - OAuth callback runs on 127.0.0.1 only — not exposed to network
//   - Express server shuts down immediately after receiving the code
//   - 5-minute timeout prevents dangling server if user abandons login
//   - Client secret lives in .env.local — never in renderer or shipped code
//   - Custom token is stored in Windows Credential Manager via keytar

const { shell, app } = require('electron');
const express = require('express');
const https = require('https');
const portfinder = require('portfinder');
const keytar = require('keytar');
const { adminAuth, adminDb } = require('../config/firebase-admin');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const KEYTAR_SERVICE = 'antonai';
const KEYTAR_ACCOUNT = 'jwt';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// ---------------------------------------------------------------------------
// signInWithGoogle
// ---------------------------------------------------------------------------
async function signInWithGoogle() {
  // 🔒 Validate required env vars before starting the flow
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local'
    );
  }

  // 🔒 Admin SDK is required for custom token minting
  if (!adminAuth || !adminDb) {
    throw new Error(
      'Firebase Admin SDK not initialised. Check SERVICE_ACCOUNT_PATH in .env.local'
    );
  }

  // Step 1 — Find an available port
  const port = await portfinder.getPortPromise({
    port: 8080,
    stopPort: 8180,
  });

  const redirectUri = `http://localhost:${port}/callback`;

  // Step 2 — Start Express server + create auth promise
  const { code, cleanup } = await waitForOAuthCallback(port, redirectUri);

  try {
    // Step 3 — Exchange code for Google tokens
    const googleTokens = await exchangeCodeForTokens(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    // Step 4 — Get user profile from Google
    const profile = await fetchGoogleUserInfo(googleTokens.access_token);

    // 🔒 Validate profile has required fields
    if (!profile.sub || !profile.email) {
      throw new Error('Google profile missing required fields (sub, email)');
    }

    // Step 5 — Create Firebase custom token
    const uid = `google_${profile.sub}`;
    const customToken = await adminAuth.createCustomToken(uid);

    // Step 6 — Decode the custom token to get its expiry
    const tokenPayload = decodeJwtPayload(customToken);

    // Step 7 — Store session in keytar
    // We store a JSON object because the custom token JWT does not
    // contain email/displayName — we need those for checkAuth.
    const sessionData = {
      token: customToken,
      uid,
      email: profile.email,
      displayName: profile.name || profile.email.split('@')[0],
      photoURL: profile.picture || null,
      exp: tokenPayload.exp,
    };

    await keytar.setPassword(
      KEYTAR_SERVICE,
      KEYTAR_ACCOUNT,
      JSON.stringify(sessionData)
    );

    // Step 8 — Create or update Firestore user document
    const { FieldValue } = require('firebase-admin/firestore');
    const userRef = adminDb.collection('users').doc(uid);

    await userRef.set(
      {
        email: sessionData.email,
        displayName: sessionData.displayName,
        photoURL: sessionData.photoURL,
        lastSeen: FieldValue.serverTimestamp(),
        appVersion: app.getVersion(),
        platform: process.platform,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true } // create if missing, update if exists
    );

    console.log(`[auth] Signed in: ${sessionData.email} (${uid})`);

    return {
      uid: sessionData.uid,
      email: sessionData.email,
      displayName: sessionData.displayName,
    };
  } finally {
    // Always clean up the Express server
    cleanup();
  }
}

// ---------------------------------------------------------------------------
// waitForOAuthCallback — Express server + timeout promise
// ---------------------------------------------------------------------------
function waitForOAuthCallback(port, redirectUri) {
  return new Promise((resolve, reject) => {
    const expressApp = express();
    let server = null;
    let timeoutHandle = null;

    // Cleanup function — stops server + clears timeout
    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (server) {
        server.close();
        server = null;
      }
    };

    // 🔒 5-minute timeout — reject if user abandons the login
    timeoutHandle = setTimeout(() => {
      cleanup();
      reject(new Error('LOGIN_TIMEOUT — sign-in was not completed within 5 minutes'));
    }, LOGIN_TIMEOUT_MS);

    // OAuth callback route
    expressApp.get('/callback', (req, res) => {
      const code = req.query.code;
      const error = req.query.error;

      if (error) {
        res.status(400).send(buildCallbackHTML(
          'Sign-in cancelled',
          'You can close this tab and try again in Anton AI.'
        ));
        cleanup();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      // 🔒 Validate code exists and is a reasonable length
      if (!code || typeof code !== 'string' || code.length > 2048) {
        res.status(400).send(buildCallbackHTML(
          'Invalid response',
          'The sign-in response was invalid. Please try again.'
        ));
        cleanup();
        reject(new Error('Invalid or missing authorization code'));
        return;
      }

      // Success — show confirmation page and resolve
      res.send(buildCallbackHTML(
        'Signed in to Anton AI',
        'You can close this tab and return to Anton AI.'
      ));

      resolve({ code, cleanup });
    });

    // 🔒 Bind to 127.0.0.1 ONLY — not 0.0.0.0
    server = expressApp.listen(port, '127.0.0.1', () => {
      // Server is ready — open Google OAuth URL in system browser
      const authUrl = buildGoogleAuthUrl(
        process.env.GOOGLE_CLIENT_ID,
        redirectUri
      );
      shell.openExternal(authUrl);
    });

    server.on('error', (err) => {
      cleanup();
      reject(new Error(`OAuth callback server failed to start: ${err.message}`));
    });
  });
}

// ---------------------------------------------------------------------------
// buildGoogleAuthUrl
// ---------------------------------------------------------------------------
function buildGoogleAuthUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// exchangeCodeForTokens — POST to Google token endpoint
// ---------------------------------------------------------------------------
function exchangeCodeForTokens(code, clientId, clientSecret, redirectUri) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString();

    const url = new URL(GOOGLE_TOKEN_URL);

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.error) {
              reject(new Error(`Google token error: ${data.error} — ${data.error_description || ''}`));
              return;
            }
            if (!data.access_token) {
              reject(new Error('Google token response missing access_token'));
              return;
            }
            resolve(data);
          } catch (err) {
            reject(new Error(`Failed to parse Google token response: ${err.message}`));
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`Google token request failed: ${err.message}`));
    });

    // 🔒 30-second timeout on the HTTP request
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Google token request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// fetchGoogleUserInfo — GET user profile using access_token
// ---------------------------------------------------------------------------
function fetchGoogleUserInfo(accessToken) {
  return new Promise((resolve, reject) => {
    const url = new URL(GOOGLE_USERINFO_URL);

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!data.sub) {
              reject(new Error('Google userinfo response missing sub field'));
              return;
            }
            resolve(data);
          } catch (err) {
            reject(new Error(`Failed to parse Google userinfo: ${err.message}`));
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`Google userinfo request failed: ${err.message}`));
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Google userinfo request timed out'));
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// checkAuth — read JWT from keytar, validate expiry
// ---------------------------------------------------------------------------
async function checkAuth() {
  try {
    const raw = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);

    // No stored session
    if (!raw) {
      return null;
    }

    // Parse the stored session JSON
    let sessionData;
    try {
      sessionData = JSON.parse(raw);
    } catch (_err) {
      // Corrupted data — clear it and return null
      console.warn('[auth] Stored session data is corrupted — clearing.');
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
      return null;
    }

    // Validate required fields exist
    if (!sessionData.uid || !sessionData.email || !sessionData.exp) {
      console.warn('[auth] Stored session missing required fields — clearing.');
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
      return null;
    }

    // Check token expiry
    const nowSecs = Math.floor(Date.now() / 1000);
    if (sessionData.exp <= nowSecs) {
      console.log('[auth] Stored token has expired — user must sign in again.');
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
      return null;
    }

    return {
      uid: sessionData.uid,
      email: sessionData.email,
      displayName: sessionData.displayName,
    };
  } catch (err) {
    console.error('[auth] checkAuth error:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// signOut — delete stored JWT
// ---------------------------------------------------------------------------
async function signOut() {
  try {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    console.log('[auth] Signed out — credential removed from keytar.');
    return { success: true };
  } catch (err) {
    console.error('[auth] signOut error:', err.message);
    // Return success anyway — if the credential didn't exist that's fine
    return { success: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode a JWT payload without verifying the signature.
 * Used only for reading exp/claims from tokens we created ourselves.
 * 🔒 Do NOT use this to trust tokens from external sources.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Token is not a valid JWT (expected 3 parts)');
    }
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch (err) {
    console.error('[auth] Failed to decode JWT:', err.message);
    return {};
  }
}

/**
 * Build a minimal HTML page shown in the browser after OAuth callback.
 */
function buildCallbackHTML(title, message) {
  // 🔒 No external resources — fully self-contained HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; margin: 0;
      background: #0F172A; color: #F1F5F9;
    }
    .card {
      text-align: center; padding: 48px;
      background: #1E293B; border-radius: 16px;
      border: 1px solid #334155;
      max-width: 400px;
    }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { font-size: 14px; color: #94A3B8; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML entities to prevent XSS in the callback page.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { signInWithGoogle, checkAuth, signOut };
