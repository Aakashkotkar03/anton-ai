// electron/handlers/hardware.js — CPU/RAM/GPU/Disk detection + tier classification
// Runs ONCE on app.ready. Result cached in module-level variable.
// systeminformation is never called twice.
//
// Tier classification matches PRD v1.0 Section: Hardware Tiers
//   Tier 1 — < 8 GB RAM, no GPU             → models ≤ 3B Q4
//   Tier 2 — 8–15 GB RAM, no GPU            → up to 7B Q4
//   Tier 3 — 16 GB RAM or GPU 4–7 GB VRAM   → up to 13B Q4
//   Tier 4 — 32 GB+ RAM or GPU ≥ 8 GB VRAM  → up to 34B Q4

const { app } = require('electron');
const si = require('systeminformation');
const { execFile } = require('child_process');
const path = require('path');

// ---------------------------------------------------------------------------
// Module-level cache — populated once, returned on every subsequent call
// ---------------------------------------------------------------------------
let cachedResult = null;

// ---------------------------------------------------------------------------
// detectHardware — main entry point
// ---------------------------------------------------------------------------
async function detectHardware() {
  // Return cache if already scanned
  if (cachedResult) {
    return cachedResult;
  }

  try {
    // Run all probes in parallel — ~1-2 seconds total
    const [cpu, mem, graphics, disks] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.graphics(),
      si.diskLayout(),
    ]);

    // --- CPU ---
    const avx2 = cpu.flags
      ? cpu.flags.toLowerCase().includes('avx2')
      : false;

    const cpuInfo = {
      brand: cpu.brand || 'Unknown CPU',
      cores: cpu.cores || 0,
      physicalCores: cpu.physicalCores || 0,
      avx2,
    };

    // --- RAM ---
    const ramInfo = {
      totalMB: Math.round((mem.total || 0) / (1024 * 1024)),
      availableMB: Math.round((mem.available || 0) / (1024 * 1024)),
    };

    // --- GPU ---
    const gpus = (graphics.controllers || [])
      .filter((g) => g.vram > 0)
      .sort((a, b) => (b.vram || 0) - (a.vram || 0));

    let mainGPU = gpus[0] || null;

    let gpuInfo = null;
    if (mainGPU) {
      let vramMB = mainGPU.vram || 0;

      // systeminformation sometimes reports 0 VRAM for NVIDIA GPUs.
      // Attempt nvidia-smi fallback on Windows to get the real value.
      if (vramMB === 0 && process.platform === 'win32') {
        vramMB = await tryNvidiaSmiVram();
      }

      gpuInfo = {
        vendor: mainGPU.vendor || 'Unknown',
        model: mainGPU.model || 'Unknown GPU',
        vramMB,
      };
    }

    // --- Disk free space ---
    const diskFreeGB = getDiskFreeGB(disks);

    // --- Build result ---
    const specs = {
      cpu: cpuInfo,
      ram: ramInfo,
      gpu: gpuInfo,
      diskFreeGB,
      arch: process.arch,
    };

    const tier = classifyTier(specs);
    const imageTier = classifyImageTier(specs);

    cachedResult = {
      ...specs,
      tier,
      imageTier,
    };

    console.log(
      `[hardware] Detected: ${cpuInfo.brand}, ` +
      `${ramInfo.totalMB} MB RAM, ` +
      `GPU: ${gpuInfo ? `${gpuInfo.model} (${gpuInfo.vramMB} MB)` : 'none'}, ` +
      `Disk free: ${diskFreeGB} GB, ` +
      `Tier ${tier}, Image: ${imageTier}`
    );

    return cachedResult;
  } catch (err) {
    console.error('[hardware] Detection failed:', err.message);

    // Return safe minimums so the app still works
    cachedResult = {
      cpu: { brand: 'Unknown', cores: 0, physicalCores: 0, avx2: false },
      ram: { totalMB: 0, availableMB: 0 },
      gpu: null,
      diskFreeGB: 0,
      arch: process.arch,
      tier: 1,
      imageTier: 'IMG-Hidden',
    };

    return cachedResult;
  }
}

// ---------------------------------------------------------------------------
// classifyTier — AI model tier based on hardware
// ---------------------------------------------------------------------------
function classifyTier(specs) {
  const ramGB = specs.ram.totalMB / 1024;
  const hasGPU = specs.gpu !== null;
  const vramMB = specs.gpu?.vramMB || 0;

  // AVX2 required for llama.cpp — without it, only the smallest models work
  if (!specs.cpu.avx2 || ramGB < 4) {
    return 1;
  }

  // < 8 GB RAM with no usable GPU
  if (ramGB < 8) {
    return 1;
  }

  // 8–15 GB RAM, no GPU → Tier 2
  if (ramGB < 16 && !hasGPU) {
    return 2;
  }

  // 32 GB+ RAM or GPU ≥ 8 GB VRAM → Tier 4
  if (vramMB >= 8000 || ramGB >= 32) {
    return 4;
  }

  // Everything else: 16 GB RAM, or GPU 4–7 GB → Tier 3
  return 3;
}

// ---------------------------------------------------------------------------
// classifyImageTier — Image generation capability
// ---------------------------------------------------------------------------
function classifyImageTier(specs) {
  const ramGB = specs.ram.totalMB / 1024;
  const hasGPU = specs.gpu !== null;
  const vramMB = specs.gpu?.vramMB || 0;

  // No GPU and less than 8 GB RAM → hide image gen completely
  if (!hasGPU && ramGB < 8) {
    return 'IMG-Hidden';
  }

  // GPU with 4 GB+ VRAM → full speed
  if (hasGPU && vramMB >= 4000) {
    return 'IMG-Full';
  }

  // Everything else (8 GB+ RAM no GPU, or GPU < 4 GB) → slow warning
  return 'IMG-Slow';
}

// ---------------------------------------------------------------------------
// tryNvidiaSmiVram — Windows fallback for NVIDIA VRAM detection
// ---------------------------------------------------------------------------
function tryNvidiaSmiVram() {
  return new Promise((resolve) => {
    // 🔒 Hardcoded path — no user input in execFile
    const nvidiaSmiPath = 'C:\\Windows\\System32\\nvidia-smi.exe';

    execFile(
      nvidiaSmiPath,
      ['--query-gpu=memory.total', '--format=csv,noheader,nounits'],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) {
          // nvidia-smi not available or failed — return 0, fall back to si data
          resolve(0);
          return;
        }

        // Parse first line: "8192" (in MiB)
        const firstLine = (stdout || '').trim().split('\n')[0];
        const vramMB = parseInt(firstLine, 10);
        resolve(Number.isFinite(vramMB) && vramMB > 0 ? vramMB : 0);
      }
    );
  });
}

// ---------------------------------------------------------------------------
// getDiskFreeGB — free space on the drive where user data lives
// ---------------------------------------------------------------------------
function getDiskFreeGB(disks) {
  try {
    // Get the drive letter of %APPDATA%\AntonAI
    const userDataPath = app.getPath('userData');

    if (process.platform === 'win32') {
      // Windows: extract drive letter e.g. "C" from "C:\Users\..."
      const driveLetter = userDataPath.charAt(0).toUpperCase();

      // si.diskLayout gives physical disks, but we need logical partition free space.
      // Use si.fsSize for mounted filesystem info instead.
      // Since we already have disks from the parallel call, do a quick sync check.
      // Fallback: return 0 and let the UI handle it.
      //
      // NOTE: fsSize is not in our Promise.all — we use a sync approximation.
      // The full free-space check happens below via a separate call.
    }

    // For accurate free space, call fsSize (fast, ~100ms)
    // We do this outside the Promise.all because it's a secondary concern
    return getDiskFreeFallback(userDataPath);
  } catch (_err) {
    return 0;
  }
}

/**
 * Synchronous-style fallback using si.fsSize()
 * Returns 0 on any failure — disk free is informational, not critical.
 */
async function getDiskFreeFallback(userDataPath) {
  try {
    const fsList = await si.fsSize();
    const driveLetter = userDataPath.charAt(0).toUpperCase();

    if (process.platform === 'win32') {
      // Match "C:" mount point
      const match = fsList.find(
        (fs) => fs.mount && fs.mount.charAt(0).toUpperCase() === driveLetter
      );
      if (match && match.available) {
        return Math.round(match.available / (1024 * 1024 * 1024));
      }
    } else {
      // macOS / Linux: find the root or most specific mount
      const sorted = fsList
        .filter((fs) => userDataPath.startsWith(fs.mount))
        .sort((a, b) => b.mount.length - a.mount.length);

      if (sorted[0] && sorted[0].available) {
        return Math.round(sorted[0].available / (1024 * 1024 * 1024));
      }
    }

    return 0;
  } catch (_err) {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { detectHardware, classifyTier, classifyImageTier };
