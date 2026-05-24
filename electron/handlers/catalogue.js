// electron/handlers/catalogue.js — Model catalogue fetcher + hardware filter
// Fetches the catalogue from a remote URL, falls back to local cache,
// then to the bundled fallback JSON. Never fails — always returns models.
//
// Fetch order:
//   1. Remote URL (VITE_CATALOGUE_URL) with 5s timeout
//   2. Local cache (%APPDATA%/AntonAI/catalogue.json)
//   3. Bundled fallback (catalogue/catalogue.json in app resources)

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ---------------------------------------------------------------------------
// fetchCatalogue — main entry point
// ---------------------------------------------------------------------------
async function fetchCatalogue() {
  let models = null;

  // Step 1 — Try remote
  const remoteUrl = process.env.VITE_CATALOGUE_URL;
  if (remoteUrl) {
    models = await fetchRemoteCatalogue(remoteUrl);
    if (models) {
      // Write to cache for offline use
      writeCacheFile(models);
    }
  }

  // Step 2 — Try local cache
  if (!models) {
    models = readCacheFile();
  }

  // Step 3 — Bundled fallback
  if (!models) {
    models = readBundledFallback();
  }

  // Step 4 — Emergency: empty array (should never happen)
  if (!models) {
    console.error('[catalogue] All sources failed — returning empty catalogue.');
    return { models: [], source: 'empty' };
  }

  return models;
}

// ---------------------------------------------------------------------------
// filterForHardware — mark each model with compatible:true/false
// ---------------------------------------------------------------------------
function filterForHardware(catalogueResult, tier, imageTier) {
  if (!catalogueResult || !catalogueResult.models) {
    return { models: [], source: 'empty' };
  }

  const filtered = catalogueResult.models.map((model) => {
    let compatible = true;

    // Tier check — model needs minimum tier
    if (model.minTier && model.minTier > tier) {
      compatible = false;
    }

    // Image models: hidden if user has IMG-Hidden tier
    if (model.category === 'image') {
      if (imageTier === 'IMG-Hidden') {
        compatible = false;
      }
      // Also check minImageTier if specified
      if (model.minImageTier && imageTier === 'IMG-Hidden') {
        compatible = false;
      }
    }

    // Coming soon models are never compatible (can't download)
    if (model.comingSoon) {
      compatible = false;
    }

    return {
      ...model,
      compatible,
    };
  });

  return {
    models: filtered,
    source: catalogueResult.source,
  };
}

// ---------------------------------------------------------------------------
// fetchRemoteCatalogue — HTTPS GET with 5s timeout
// ---------------------------------------------------------------------------
function fetchRemoteCatalogue(url) {
  return new Promise((resolve) => {
    try {
      // 🔒 Validate URL is https
      if (!url.startsWith('https://')) {
        console.warn('[catalogue] Remote URL is not HTTPS — skipping.');
        resolve(null);
        return;
      }

      const parsedUrl = new URL(url);

      const req = https.get(
        {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          headers: { 'Accept': 'application/json' },
        },
        (res) => {
          if (res.statusCode !== 200) {
            console.warn(`[catalogue] Remote returned ${res.statusCode} — using fallback.`);
            res.resume(); // consume response to free memory
            resolve(null);
            return;
          }

          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
            // 🔒 Cap at 5 MB to prevent memory abuse
            if (body.length > 5 * 1024 * 1024) {
              req.destroy();
              resolve(null);
            }
          });

          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (!data.models || !Array.isArray(data.models)) {
                console.warn('[catalogue] Remote JSON missing models array.');
                resolve(null);
                return;
              }
              console.log(`[catalogue] Loaded ${data.models.length} models from remote.`);
              resolve({ models: data.models, source: 'remote' });
            } catch (err) {
              console.warn('[catalogue] Failed to parse remote JSON:', err.message);
              resolve(null);
            }
          });
        }
      );

      // 5-second timeout
      req.setTimeout(5000, () => {
        req.destroy();
        console.warn('[catalogue] Remote fetch timed out (5s) — using fallback.');
        resolve(null);
      });

      req.on('error', (err) => {
        console.warn('[catalogue] Remote fetch error:', err.message);
        resolve(null);
      });
    } catch (err) {
      console.warn('[catalogue] Remote URL error:', err.message);
      resolve(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Cache file — %APPDATA%/AntonAI/catalogue.json
// ---------------------------------------------------------------------------
function getCachePath() {
  return path.join(app.getPath('userData'), 'catalogue.json');
}

function writeCacheFile(catalogueResult) {
  try {
    const cachePath = getCachePath();
    const data = JSON.stringify({
      models: catalogueResult.models,
      cachedAt: new Date().toISOString(),
    });
    fs.writeFileSync(cachePath, data, 'utf8');
    console.log('[catalogue] Cache written:', cachePath);
  } catch (err) {
    console.warn('[catalogue] Failed to write cache:', err.message);
  }
}

function readCacheFile() {
  try {
    const cachePath = getCachePath();
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    const raw = fs.readFileSync(cachePath, 'utf8');
    const data = JSON.parse(raw);
    if (!data.models || !Array.isArray(data.models)) {
      return null;
    }
    console.log(`[catalogue] Loaded ${data.models.length} models from cache.`);
    return { models: data.models, source: 'cache' };
  } catch (err) {
    console.warn('[catalogue] Failed to read cache:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Bundled fallback — catalogue/catalogue.json in app resources
// ---------------------------------------------------------------------------
function readBundledFallback() {
  try {
    // In dev: relative to project root
    // In prod: inside extraResources (configured in electron-builder.yml)
    const devPath = path.join(__dirname, '..', '..', 'catalogue', 'catalogue.json');
    const prodPath = path.join(process.resourcesPath, 'catalogue', 'catalogue.json');

    const fallbackPath = app.isPackaged ? prodPath : devPath;

    if (!fs.existsSync(fallbackPath)) {
      console.error('[catalogue] Bundled fallback not found at:', fallbackPath);
      return null;
    }

    const raw = fs.readFileSync(fallbackPath, 'utf8');
    const data = JSON.parse(raw);
    if (!data.models || !Array.isArray(data.models)) {
      return null;
    }
    console.log(`[catalogue] Loaded ${data.models.length} models from bundled fallback.`);
    return { models: data.models, source: 'bundled' };
  } catch (err) {
    console.error('[catalogue] Failed to read bundled fallback:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { fetchCatalogue, filterForHardware };
