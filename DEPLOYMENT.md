# DEPLOYMENT.md — Upload to GitHub & Get Windows Build
# Follow these steps in order. Each step takes 1-5 minutes.

## OVERVIEW
Your code is on your Mac. GitHub Actions builds the Windows .exe for you.
You push code → GitHub compiles on Windows → you download the .exe.

---

## STEP 1 — Initialize Git Repo (Mac Terminal, 2 minutes)

Open Terminal. Navigate to your project:

```bash
cd /Users/aakashkotkar/Projects/anton-ai
```

Initialize git and make your first commit:

```bash
git init
git add .
git commit -m "feat: Anton AI v1.0 — full app"
```

VERIFY: Before committing, check that SECRET files are NOT staged:

```bash
git status
```

These should NOT appear in the staged files list:
- .env.local ← contains Firebase keys
- SECRETS.md ← contains all passwords
- serviceAccountKey*.json ← Firebase Admin SDK
- node_modules/ ← dependencies (reinstalled by CI)

If any of these appear: STOP. Run `git reset HEAD <file>` to unstage them.
The .gitignore should block all of them automatically.


---

## STEP 2 — Create GitHub Repository (github.com, 2 minutes)

1. Go to https://github.com/new
2. Repository name: `anton-ai`
3. Description: `Anton AI — Local AI Desktop Assistant`
4. Set to **Private** (your code is proprietary)
5. Do NOT initialize with README, .gitignore, or license (you already have these)
6. Click "Create repository"

GitHub shows you the push commands. Use the HTTPS ones:

```bash
git remote add origin https://github.com/aakashkotkar/anton-ai.git
git branch -M main
git push -u origin main
```

It will ask for your GitHub credentials. Use a Personal Access Token (PAT):
- Go to: https://github.com/settings/tokens → Generate new token (classic)
- Scopes: select `repo` (full control of private repos)
- Copy the token. Use it as your password when git asks.


---

## STEP 3 — Add GitHub Secrets (github.com, 5 minutes)

The GitHub Actions workflow needs your Firebase keys to build the app.
These are stored as encrypted Secrets — GitHub never shows them in logs.

### Option A: Environment Secrets (recommended, more secure)

1. Go to your repo: https://github.com/aakashkotkar/anton-ai
2. Settings → Environments → New environment
3. Name: `production` → Configure environment
4. Click "Add secret" for each one below:

### Option B: Repo Secrets (simpler)

If using this option, first edit the workflow file and REMOVE this line:
```
    environment: production
```
Then: Settings → Secrets and variables → Actions → New repository secret

### Secrets to Add (same for Option A or B):

Copy each value from your `.env.local` file (which is on your Mac, NOT in git).

| Secret Name | Where to Find the Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | .env.local → VITE_FIREBASE_API_KEY line |
| `VITE_FIREBASE_AUTH_DOMAIN` | .env.local → VITE_FIREBASE_AUTH_DOMAIN line |
| `VITE_FIREBASE_PROJECT_ID` | .env.local → VITE_FIREBASE_PROJECT_ID line |
| `VITE_FIREBASE_STORAGE_BUCKET` | .env.local → VITE_FIREBASE_STORAGE_BUCKET line |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | .env.local → VITE_FIREBASE_MESSAGING_SENDER_ID line |
| `VITE_FIREBASE_APP_ID` | .env.local → VITE_FIREBASE_APP_ID line |
| `VITE_SENTRY_DSN` | .env.local → SENTRY_DSN line |

### NOT needed for the first build (add later):
| Secret Name | Purpose | When to Add |
|---|---|---|
| `CSC_LINK` | Code signing certificate (.pfx base64) | Before publishing to MS Store |
| `CSC_KEY_PASSWORD` | Certificate password | Before publishing to MS Store |

Without code signing: the .exe builds fine but shows a Windows SmartScreen
warning ("Unknown publisher") when users first run it. That's OK for testing.


---

## STEP 4 — Push and Trigger the Build (Terminal, 1 minute)

The workflow is set to trigger on pushes to `main` and `release` branches.
Your first push to `main` in Step 2 should already trigger it.

If not, make a small change and push:

```bash
git add .
git commit -m "ci: trigger first Windows build"
git push origin main
```


---

## STEP 5 — Watch the Build (github.com, 10-20 minutes)

1. Go to: https://github.com/aakashkotkar/anton-ai/actions
2. You should see a workflow run in progress (yellow dot)
3. Click it to watch the logs in real time

### What happens during the build:
```
Step 1: Checkout code                    (~10 seconds)
Step 2: Setup Node.js 20                 (~30 seconds)
Step 3: npm ci (install dependencies)    (~2-5 minutes)
Step 4: npm run build (Vite build)       (~30 seconds)
Step 5: Build Shell Extension DLL        (~1-2 minutes, may fail — OK)
Step 6: electron-builder --win           (~5-10 minutes)
Step 7: Upload .exe artifact             (~2 minutes)
```

### If the build FAILS:
- Click the failed step to see the error log
- Common issues:
  - "Secret not found" → check Step 3 (secrets not added or wrong environment)
  - "npm ci failed" → package-lock.json might need updating
  - "Shell Extension DLL failed" → that's OK, it has continue-on-error
  - "electron-builder failed" → usually a native module issue, share the log with me

### If the build SUCCEEDS:
- Green checkmark appears
- Artifacts are uploaded (see Step 6)


---

## STEP 6 — Download the Windows .exe (github.com, 1 minute)

1. Go to the completed workflow run
2. Scroll to the bottom → "Artifacts" section
3. Click `anton-ai-windows-nsis` to download the .zip
4. Unzip it → you get `Anton AI Setup 1.0.0.exe`


---

## STEP 7 — Test on Windows (Windows PC, 5 minutes)

1. Transfer the .exe to a Windows computer (USB, cloud drive, email)
2. Double-click `Anton AI Setup 1.0.0.exe`
3. Windows SmartScreen warning appears (because unsigned):
   → Click "More info" → "Run anyway"
4. Install to default location
5. Anton AI starts → you should see the Login screen

### First test checklist:
- [ ] App opens without crashing
- [ ] Login screen appears (may not work without Firebase — that's OK)
- [ ] If you skip auth: check if the onboarding flow works
- [ ] Theme: does dark mode look correct?
- [ ] Left rail navigation: clicking icons switches screens
- [ ] Model Library screen loads (no models to download yet — that's OK)
- [ ] Settings screen: all 9 tabs visible and switchable

### What WON'T work yet:
- AI inference (no llama-server.exe binary in engines/ yet)
- Voice input (no whisper.exe binary yet)
- Google Sign-In (needs OAuth redirect setup on Windows)
- Browser extension (needs to be installed separately)
- Right-click context menu (DLL may not have compiled)


---

## STEP 8 — After First Successful Build (next steps)

### Add the inference engines (required for AI to work):
1. Download pre-built llama.cpp from: https://github.com/ggerganov/llama.cpp/releases
2. Get `llama-server.exe` (CPU build) → place in `engines/llama/binaries/cpu/`
3. Download whisper.cpp from: https://github.com/ggerganov/whisper.cpp/releases
4. Get `main.exe` → rename to `whisper.exe` → place in `engines/whisper/binaries/cpu/`
5. Download ggml-tiny.bin from HuggingFace → place in `engines/whisper/models/`
6. Rebuild and retest

### Remove `main` from workflow trigger:
After your first successful build, edit `.github/workflows/build-windows.yml`
and remove the `- main` line so only pushes to `release` trigger builds.

### Get a code signing certificate (before MS Store submission):
1. Buy a code signing cert from DigiCert, Sectigo, or similar (~$200-400/year)
2. Export as .pfx file
3. Base64 encode: `base64 -i certificate.pfx | tr -d '\n' > cert_base64.txt`
4. Add as GitHub Secret: `CSC_LINK` = contents of cert_base64.txt
5. Add: `CSC_KEY_PASSWORD` = your certificate password
6. Rebuild — the .exe is now signed, no SmartScreen warning


---

## TROUBLESHOOTING

### "npm ci" fails with lockfile error:
```bash
# On your Mac, regenerate the lockfile:
rm package-lock.json
npm install
git add package-lock.json
git commit -m "fix: regenerate package-lock.json"
git push
```

### Native modules fail to compile:
electron-builder needs to rebuild native modules (better-sqlite3, keytar)
for Windows. If this fails, the error log will show the specific module.
Common fix: ensure `electron` version matches what electron-builder expects.

### "Cannot find module" errors:
Check that all imports in your code reference files that exist.
Run `npm run build` locally on Mac first to catch any missing files.

### Build takes too long (> 30 minutes):
GitHub Actions has a 6-hour timeout. Windows builds typically take 10-20 min.
If stuck, cancel and re-run. May be a GitHub infrastructure issue.

---

## QUICK REFERENCE — Commands

```bash
# First time setup:
cd /Users/aakashkotkar/Projects/anton-ai
git init
git add .
git commit -m "feat: Anton AI v1.0"
git remote add origin https://github.com/aakashkotkar/anton-ai.git
git branch -M main
git push -u origin main

# Future pushes:
git add .
git commit -m "fix: description of change"
git push

# Push to release (production build):
git checkout -b release
git push -u origin release

# Or merge main into release:
git checkout release
git merge main
git push
```
