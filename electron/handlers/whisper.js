// electron/handlers/whisper.js — Whisper transcription engine (PRD Feature 5)
// Spawns whisper.cpp binary to transcribe audio locally.
//
// Architecture:
//   - Whisper Tiny (75 MB) bundled with the app — always available
//   - Additional models (Small, Medium) downloadable from catalogue
//   - Audio buffer written to temp WAV, whisper.cpp reads it, outputs .txt
//   - Both temp files cleaned up in finally block — even on error
//   - isTranscribing flag prevents concurrent transcriptions
//
// 🔒 Security:
//   - Binary path is hardcoded relative to app — no user input
//   - Model path validated to be under engines/ or userData/models/voice/
//   - spawn() with shell:false — no command injection
//   - Temp files use os.tmpdir() with unique names

const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ---------------------------------------------------------------------------
// WhisperEngine
// ---------------------------------------------------------------------------
class WhisperEngine {
  constructor() {
    this.binaryPath = null;   // resolved lazily on first use
    this.isTranscribing = false;
  }

  // -------------------------------------------------------------------------
  // selectBinary — find the whisper binary for this platform
  // -------------------------------------------------------------------------
  selectBinary() {
    const devBase = path.join(__dirname, '..', '..', 'engines', 'whisper', 'binaries');
    const prodBase = app.isPackaged
      ? path.join(process.resourcesPath, 'engines', 'whisper', 'binaries')
      : devBase;

    const exe = process.platform === 'win32' ? 'whisper.exe' : 'whisper';
    // CPU-only in v1.0 — GPU whisper builds in v1.1
    const candidate = path.join(prodBase, 'cpu', exe);

    if (!fs.existsSync(candidate)) {
      throw new Error(
        'BINARY_NOT_FOUND: whisper binary not found. ' +
        `Expected at: ${candidate}. ` +
        'Please re-install Anton AI or check engines/whisper/binaries/cpu/.'
      );
    }

    console.log(`[whisper] Selected binary: ${candidate}`);
    return candidate;
  }

  // -------------------------------------------------------------------------
  // resolveModel — find a whisper model .bin file
  // -------------------------------------------------------------------------
  resolveModel(modelId) {
    // Bundled models: engines/whisper/models/
    const bundledDir = app.isPackaged
      ? path.join(process.resourcesPath, 'engines', 'whisper', 'models')
      : path.join(__dirname, '..', '..', 'engines', 'whisper', 'models');

    // Downloaded models: %APPDATA%/AntonAI/models/voice/
    const userDir = path.join(app.getPath('userData'), 'models', 'voice');

    // Map common model IDs to filenames
    const modelFiles = {
      tiny: 'ggml-tiny.bin',
      small: 'ggml-small.bin',
      medium: 'ggml-medium.bin',
    };

    const filename = modelFiles[modelId] || modelFiles.tiny;

    // Check bundled first, then user dir
    const bundledPath = path.join(bundledDir, filename);
    if (fs.existsSync(bundledPath)) return bundledPath;

    const userPath = path.join(userDir, filename);
    if (fs.existsSync(userPath)) return userPath;

    throw new Error(
      `MODEL_NOT_FOUND: Whisper model '${modelId}' not found. ` +
      `Searched: ${bundledPath}, ${userPath}. ` +
      'Download it from the Model Library.'
    );
  }

  // -------------------------------------------------------------------------
  // transcribe — convert audio buffer to text
  // -------------------------------------------------------------------------
  // audioBuffer: Buffer or Uint8Array (16kHz mono WAV data)
  // options: { modelId?: string, language?: string }
  //
  async transcribe(audioBuffer, options = {}) {
    if (this.isTranscribing) {
      throw new Error('ALREADY_TRANSCRIBING: A transcription is already in progress.');
    }

    // 🔒 Validate input
    if (!audioBuffer || !(audioBuffer instanceof Buffer || audioBuffer instanceof Uint8Array)) {
      throw new Error('Invalid audio buffer');
    }
    if (audioBuffer.length < 100) {
      throw new Error('Audio buffer too small — recording may have failed.');
    }
    // 🔒 Cap at 60 MB (a 60-second 16kHz mono WAV is ~1.9 MB — this is very generous)
    if (audioBuffer.length > 60 * 1024 * 1024) {
      throw new Error('Audio buffer exceeds 60 MB limit.');
    }

    this.isTranscribing = true;

    // Resolve binary and model lazily
    if (!this.binaryPath) {
      this.binaryPath = this.selectBinary();
    }
    const modelId = options.modelId || 'tiny';
    const modelPath = this.resolveModel(modelId);

    // Temp file paths
    const tempWavPath = path.join(os.tmpdir(), `antonai_voice_${Date.now()}.wav`);
    const tempTxtPath = tempWavPath + '.txt';

    try {
      // Step 1 — Write audio buffer to temp WAV
      fs.writeFileSync(tempWavPath, Buffer.from(audioBuffer));
      console.log(`[whisper] Wrote ${audioBuffer.length} bytes to ${tempWavPath}`);

      // Step 2 — Build args
      const args = [
        '-m', modelPath,
        '-f', tempWavPath,
        '-otxt',             // output as plain text (creates .wav.txt)
        '--no-timestamps',   // clean output without [00:00:00.000 --> ...]
        '-l', options.language || 'auto',  // auto-detect language
      ];

      console.log(`[whisper] Spawning: ${this.binaryPath} ${args.join(' ')}`);

      // Step 3 — Spawn whisper process
      const transcript = await new Promise((resolve, reject) => {
        let stderrOutput = '';

        const proc = spawn(this.binaryPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,       // 🔒 no shell — prevents command injection
          cwd: path.dirname(this.binaryPath),
          timeout: 120000,    // 2-minute hard timeout
        });

        // Capture stderr for diagnostics (whisper.cpp logs progress here)
        proc.stderr.on('data', (chunk) => {
          stderrOutput += chunk.toString();
        });

        proc.on('error', (err) => {
          reject(new Error(`Whisper process failed to start: ${err.message}`));
        });

        proc.on('close', (code) => {
          if (code !== 0) {
            // Include last 300 chars of stderr for debugging
            const tail = stderrOutput.slice(-300).trim();
            reject(new Error(
              `Whisper exited with code ${code}.` +
              (tail ? ` stderr: ${tail}` : '')
            ));
            return;
          }

          // Step 4 — Read the output .txt file
          if (!fs.existsSync(tempTxtPath)) {
            reject(new Error(
              'Whisper completed but no output file was created. ' +
              'The audio may be silent or corrupted.'
            ));
            return;
          }

          const text = fs.readFileSync(tempTxtPath, 'utf8').trim();
          if (!text) {
            resolve(''); // empty transcript is valid (silence)
          } else {
            resolve(text);
          }
        });
      });

      console.log(`[whisper] Transcript: "${transcript.slice(0, 80)}${transcript.length > 80 ? '...' : ''}"`);
      return transcript;
    } finally {
      // 🔒 Always clean up temp files — even on error or timeout
      this.isTranscribing = false;
      cleanupFile(tempWavPath);
      cleanupFile(tempTxtPath);
    }
  }

  // -------------------------------------------------------------------------
  // getAvailableModels — list installed whisper models
  // -------------------------------------------------------------------------
  getAvailableModels() {
    const models = [];

    const dirs = [
      // Bundled
      app.isPackaged
        ? path.join(process.resourcesPath, 'engines', 'whisper', 'models')
        : path.join(__dirname, '..', '..', 'engines', 'whisper', 'models'),
      // User-downloaded
      path.join(app.getPath('userData'), 'models', 'voice'),
    ];

    const modelMeta = {
      'ggml-tiny.bin':   { id: 'tiny',   name: 'Whisper Tiny',   sizeMB: 75,  bundled: true  },
      'ggml-small.bin':  { id: 'small',  name: 'Whisper Small',  sizeMB: 244, bundled: false },
      'ggml-medium.bin': { id: 'medium', name: 'Whisper Medium', sizeMB: 769, bundled: false },
    };

    const seen = new Set();

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (!file.endsWith('.bin') || seen.has(file)) continue;
          seen.add(file);

          const meta = modelMeta[file];
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);

          models.push({
            id: meta?.id || file.replace('.bin', ''),
            name: meta?.name || file,
            path: filePath,
            sizeMB: meta?.sizeMB || Math.round(stat.size / (1024 * 1024)),
            bundled: meta?.bundled || false,
          });
        }
      } catch (_err) {
        // Directory read failed — skip
      }
    }

    return models;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely delete a file — never throws */
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[whisper] Failed to clean up ${filePath}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------
const whisperEngine = new WhisperEngine();

module.exports = { whisperEngine };
