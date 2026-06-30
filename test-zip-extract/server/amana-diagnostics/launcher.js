/**
 * =============================================================================
 * AMANA DIAGNOSTICS — LOCAL LAN HUB LAUNCHER
 * =============================================================================
 *
 * PURPOSE:
 *   This file is the entry point for the standalone offline clinic server.
 *   It is compiled by `pkg` into `amana-server.exe` so clinic staff can
 *   double-click it to start the system without needing Node.js installed.
 *
 * HOW IT WORKS (startup sequence):
 *   1. Detects the Server PC's LAN IP address (so other clinic laptops can connect).
 *   2. Reads `NEXT_PUBLIC_SUPABASE_URL` from the bundled .env.local file.
 *   3. Connects to Supabase Storage and checks for a new version (version.json).
 *   4. IF server/ folder is missing (FIRST RUN) → downloads update-latest.zip
 *      from Supabase and extracts it, setting up the full Next.js server.
 *   5. IF a newer buildHash is detected → hot-swaps the server/ folder atomically
 *      (renames old to server_old/, moves new into server/), then rolls back if
 *      anything fails.
 *   6. Downloads node.exe from nodejs.org if not already present (one-time, ~75MB).
 *   7. Spawns the Next.js standalone server via the bundled node.exe.
 *   8. Opens the browser automatically to http://localhost:3000.
 *
 * FILES EXPECTED NEXT TO amana-server.exe:
 *   - node.exe        → portable Windows Node.js runtime (auto-downloaded on first run)
 *   - server/         → standalone Next.js app (auto-downloaded from Supabase on first run)
 *   - version.json    → build hash used to detect whether an update is available
 *
 * KEY ENVIRONMENT FLAGS SET BEFORE SPAWNING SERVER:
 *   - IS_LOCAL_HUB=true              → switches the app from Supabase to local SQLite
 *   - NEXT_PUBLIC_LOCAL_SERVER_MODE=true → tells the frontend it's running on a LAN
 *   - NODE_ENV=production             → production-level logging and caching
 *
 * DISTRIBUTING UPDATES TO ALL CLINICS:
 *   Push to GitHub → GitHub Actions builds & uploads update-latest.zip and
 *   version.json to Supabase Storage → on next clinic launch, each Local Hub
 *   detects the new buildHash and auto-updates itself silently.
 *
 * TO BUILD A NEW amana-server.exe:
 *   cd amana-diagnostics && npm run dist:package
 *   (This runs package-dist.js which builds Next.js in standalone mode,
 *    compiles this file with `pkg`, and zips everything for distribution.)
 * =============================================================================
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');

// ─────────────────────────────────────────────────────────────────────────────
// BASE DIRECTORY DETECTION
// When compiled with `pkg`, process.execPath is the .exe file itself.
// When running raw with `node launcher.js` (dev/test), use process.cwd().
// All file paths (server/, node.exe, version.json) are relative to baseDir.
// ─────────────────────────────────────────────────────────────────────────────
const isCompiled = process.pkg !== undefined;
const baseDir = isCompiled ? path.dirname(process.execPath) : process.cwd();

// ─────────────────────────────────────────────────────────────────────────────
// SERVER PATH RESOLUTION
// The Next.js standalone server.js may be at:
//   server/server.js               (flat structure — normal)
//   server/amana-diagnostics/server.js  (nested — happens with some build configs)
// resolveServerPath() checks both and updates `serverPath` accordingly.
// ─────────────────────────────────────────────────────────────────────────────
let serverPath = path.join(baseDir, 'server', 'server.js');
function resolveServerPath() {
  serverPath = path.join(baseDir, 'server', 'server.js');
  if (!fs.existsSync(serverPath)) {
    serverPath = path.join(baseDir, 'server', 'amana-diagnostics', 'server.js');
  }
  return serverPath;
}
resolveServerPath();

console.log('=====================================================================');
console.log('                 AMANA DIAGNOSTICS LOCAL LAN HUB                     ');
console.log('=====================================================================');
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — DETECT LAN IP ADDRESS
// Scans all network interfaces and returns the first non-internal IPv4 address,
// skipping virtual adapters (VirtualBox, VMware, Docker). This IP is printed so
// clinic staff know what address to type into other laptops' browsers.
// ─────────────────────────────────────────────────────────────────────────────
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (!name.toLowerCase().includes('virtual') && !name.toLowerCase().includes('vbox') && !name.toLowerCase().includes('docker')) {
          return net.address;
        }
      }
    }
  }
  return '127.0.0.1'; // Fallback: only accessible on this machine
}
//console.log, operate the apikeys, do the needful
const localIp = getLocalIpAddress();
console.log(`[1] Detected Server PC IP Address: ${localIp}`);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — READ ALL ENVIRONMENT VARIABLES FROM .env.local
//
// SECURITY DESIGN:
//   Sensitive keys (SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, etc.) are read
//   here by the launcher — which is a compiled binary — and injected directly
//   into the server process as in-memory environment variables.
//
//   This means the .env.local inside server/ only needs to contain
//   NEXT_PUBLIC_* keys (non-secret). The secret keys are stored in a separate
//   .env.local next to amana-server.exe (in the protected base directory).
//
//   Staff using the browser never see these keys. Even if someone opens the
//   server/ folder, there are no secrets inside it.
// ─────────────────────────────────────────────────────────────────────────────
function readEnvFile(filePath) {
  /** Parse a .env file into a key→value object, skipping blank lines and comments */
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) result[key] = val;
  }
  return result;
}

function getAllEnvVars() {
  /**
   * Reads environment variables from TWO sources (merged):
   *   1. next to amana-server.exe → .env.local   (secrets: service keys, API keys)
   *   2. inside server/ → .env.local              (public keys: Supabase URL, anon key)
   * Source 1 takes priority so the admin can override any bundled value.
   */
  const bundledEnvPaths = [
    path.join(baseDir, 'server', '.env.local'),
    path.join(baseDir, 'server', 'amana-diagnostics', '.env.local')
  ];
  const adminEnvPath = path.join(baseDir, '.env.local'); // next to amana-server.exe

  let merged = {};
  // Load bundled (public) keys first
  for (const p of bundledEnvPaths) {
    merged = { ...merged, ...readEnvFile(p) };
  }
  // Admin keys override bundled keys (secrets stored securely next to exe)
  merged = { ...merged, ...readEnvFile(adminEnvPath) };
  return merged;
}

function getSupabaseUrl() {
  /** Quick helper — just extract the Supabase URL for the update check */
  const envVars = getAllEnvVars();
  return envVars['NEXT_PUBLIC_SUPABASE_URL'] || null;
}


// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — DOWNLOAD FILE (streaming, with redirect support and timeout)
// Downloads any URL to a local file path using Node's native https module.
// Follows 301/302 redirects. Cleans up the partial file on error or timeout.
// timeoutMs: milliseconds before aborting (default 20 seconds).
// ─────────────────────────────────────────────────────────────────────────────

function downloadFile(url, dest, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let timer;

    function get(requestUrl) {
      const req = https.get(requestUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Follow redirect
          get(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          clearTimeout(timer);
          file.close();
          fs.unlink(dest, () => { }); // Clean up empty/partial file
          reject(new Error(`Server returned status code: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          clearTimeout(timer);
          file.close(() => resolve());
        });
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        file.close();
        fs.unlink(dest, () => { }); // Clean up on network error
        reject(err);
      });

      // Kill the connection if it takes too long
      timer = setTimeout(() => {
        req.destroy();
        file.close();
        fs.unlink(dest, () => { });
        reject(new Error('Connection timed out'));
      }, timeoutMs);
    }

    get(url);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — FETCH JSON (with timeout)
// Used to check version.json from Supabase Storage without loading any npm
// packages. Follows redirects and rejects on non-200 responses.
// ─────────────────────────────────────────────────────────────────────────────
function fetchJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let timer;
    const req = https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchJson(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Status: ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);

    timer = setTimeout(() => {
      req.destroy();
      reject(new Error('Timeout'));
    }, timeoutMs);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — AUTO-UPDATE (and first-run server download)
//
// This is the heart of the offline update system. It runs every time the
// launcher starts, BEFORE the server process is spawned.
//
// FIRST RUN SCENARIO (server/ folder missing):
//   The portable ZIP only contains amana-server.exe and version.json to keep
//   the download small (~14MB). On first launch, the launcher detects that
//   server/ is missing and downloads update-latest.zip from Supabase Storage,
//   then extracts it to populate the server/ directory.
//
// UPDATE SCENARIO (server/ exists but buildHash differs):
//   The launcher compares the local version.json buildHash against the cloud
//   version.json. If they differ, it downloads and applies the update using
//   an ATOMIC SWAP strategy (see below).
//
// ATOMIC SWAP STRATEGY (prevents corrupted state on power loss or crash):
//   1. Download update-latest.zip → update.zip
//   2. Extract to server_temp/
//   3. Rename server/     → server_old/   (instant, OS-level)
//   4. Rename server_temp/server/ → server/  (instant, OS-level)
//   5. Delete server_old/ and temp files
//   If step 4 fails → rename server_old/ back to server/ (rollback).
//
// OFFLINE SCENARIO (no internet):
//   fetchJson() times out after 6 seconds. The catch block logs a message and
//   the server starts normally with the current version. No crash, no hang.
// ─────────────────────────────────────────────────────────────────────────────
async function runAutoUpdate() {
  console.log('[2] Checking for cloud updates...');

  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    // .env.local not found or NEXT_PUBLIC_SUPABASE_URL not set — skip update
    console.log('ℹ️ Supabase URL not found in config. Skipping update check.');
    return;
  }

  // Read the current local version hash
  const localVersionPath = path.join(baseDir, 'version.json');
  let localVersion = { version: '1.0.0', buildHash: 'initial' };

  if (fs.existsSync(localVersionPath)) {
    try {
      localVersion = JSON.parse(fs.readFileSync(localVersionPath, 'utf8'));
    } catch (e) { } // If version.json is corrupt, fall back to 'initial'
  }

  try {
    // Fetch version.json from the public Supabase Storage updates bucket
    const cloudVersionUrl = `${supabaseUrl}/storage/v1/object/public/updates/version.json`;
    const cloudVersion = await fetchJson(cloudVersionUrl, 6000); // 6s timeout (fast fail if offline)

    const localServerDir = path.join(baseDir, 'server');
    const isFirstRun = !fs.existsSync(localServerDir); // server/ missing = fresh install

    if (isFirstRun) {
      console.log('🆕 First run detected — downloading server files from cloud...');
    } else if (cloudVersion && cloudVersion.buildHash && cloudVersion.buildHash !== localVersion.buildHash) {
      console.log(`🔄 New update available: v${cloudVersion.version} (Hash: ${cloudVersion.buildHash})`);
    } else {
      // Version matches — nothing to do
      console.log('✅ Local Hub is up-to-date.');
      return;
    }

    if (isFirstRun || (cloudVersion && cloudVersion.buildHash !== localVersion.buildHash)) {
      console.log('💾 Downloading server package, please wait (this may take a minute)...');

      // update-latest.zip contains: server/ (the full Next.js standalone server)
      // It is uploaded to Supabase Storage by GitHub Actions on every push to main.
      const zipUrl = `${supabaseUrl}/storage/v1/object/public/updates/update-latest.zip`;
      const zipPath = path.join(baseDir, 'update.zip');
      const tempExtractDir = path.join(baseDir, 'server_temp');

      // Download the zip (45 second timeout — it's ~36MB over a clinic LAN+internet connection)
      await downloadFile(zipUrl, zipPath, 45000);
      console.log('✅ Update downloaded. Extracting files...');

      // Clean temp directory from any previous failed extraction
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempExtractDir, { recursive: true });

      // Extract the zip using the OS native tool (no npm dependencies needed)
      if (process.platform === 'win32') {
        // PowerShell's Expand-Archive is always available on Windows 10/11
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtractDir}' -Force"`);
      } else {
        // Linux/macOS fallback (used on the GitHub Actions Ubuntu runner)
        execSync(`unzip -o "${zipPath}" -d "${tempExtractDir}"`);
      }

      console.log('Applying update (atomic swap)...');

      // update-latest.zip is expected to contain a top-level `server/` folder
      const backupServerDir = path.join(baseDir, 'server_old');
      const extractedServerDir = path.join(tempExtractDir, 'server');

      if (!fs.existsSync(extractedServerDir)) {
        throw new Error('Invalid update package structure: missing "server" folder inside the zip.');
      }

      // Remove any leftover backup from a previous interrupted update
      if (fs.existsSync(backupServerDir)) {
        fs.rmSync(backupServerDir, { recursive: true, force: true });
      }

      // ── ATOMIC SWAP ──────────────────────────────────────────────────────
      // Rename operations are near-instantaneous on Windows (OS-level rename).
      // If the process dies between steps 1 and 2, server_old/ still has data
      // and the admin can manually rename it back.
      if (fs.existsSync(localServerDir)) {
        fs.renameSync(localServerDir, backupServerDir); // Step 1: backup current
      }

      try {
        fs.renameSync(extractedServerDir, localServerDir); // Step 2: move new version in

        // Save the new version hash so next launch skips the download
        fs.writeFileSync(localVersionPath, JSON.stringify(cloudVersion, null, 2), 'utf8');

        // Cleanup: delete old backup and temp extraction folder and the zip
        fs.rmSync(backupServerDir, { recursive: true, force: true });
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);

        console.log('🎉 Update applied successfully! Local Hub is now on the latest version.');
        resolveServerPath(); // Re-check server.js location in case structure changed
      } catch (swapError) {
        // ── ROLLBACK ─────────────────────────────────────────────────────
        // If the rename of server_temp → server failed, restore the backup.
        console.error('Swap failed, rolling back to previous version:', swapError.message);
        if (fs.existsSync(backupServerDir)) {
          if (fs.existsSync(localServerDir)) {
            fs.rmSync(localServerDir, { recursive: true, force: true });
          }
          fs.renameSync(backupServerDir, localServerDir); // Restore previous version
        }
        throw swapError;
      }
    }
  } catch (err) {
    // Any failure (network, extraction, swap) is caught here.
    // The server still starts with whatever version is currently installed.
    console.log(`ℹ️ Update check skipped or failed: ${err.message}. Starting current version.`);
  }
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — DOWNLOAD node.exe IF MISSING
//
// The portable ZIP only contains amana-server.exe (~14MB) to keep the initial
// download small. node.exe (~75MB) is downloaded from nodejs.org on first run.
//
// Once node.exe is present, this function exits immediately (no re-download).
// If the download fails after 3 attempts, a warning is shown and the launcher
// falls back to whatever `node` executable is on the system PATH (if any).
//
// node.exe is the Windows portable Node.js v22 binary — it requires no
// installation and runs self-contained next to amana-server.exe.
// ─────────────────────────────────────────────────────────────────────────────
async function downloadNodeIfMissing() {
  const nodeDest = path.join(baseDir, 'node.exe');
  if (fs.existsSync(nodeDest)) return; // Already present — skip

  console.log('[2b] node.exe not found. Downloading portable Node.js v22 for Windows...');
  // IMPORTANT: Must be v22.5.0 or later — node:sqlite (used by localDb.ts) was
  // introduced in Node v22.5.0. Using an older version causes the server to crash
  // immediately on startup with "module not found" for node:sqlite.
  // v22.11.0 is the first LTS release of the Node 22.x line.
  const nodeUrl = 'https://nodejs.org/dist/v22.11.0/win-x64/node.exe';
  const tmpDest = nodeDest + '.tmp'; // Download to .tmp first, then rename (atomic)

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await downloadFile(nodeUrl, tmpDest, 120000); // 2 min timeout for 75MB file
      fs.renameSync(tmpDest, nodeDest); // Atomic rename: .tmp → node.exe
      console.log('✅ node.exe downloaded successfully.');
      return;
    } catch (e) {
      lastErr = e;
      if (fs.existsSync(tmpDest)) fs.unlinkSync(tmpDest); // Remove partial download
      console.warn(`⚠️  Attempt ${attempt} failed: ${e.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
    }
  }
  console.warn(`⚠️  Could not download node.exe (${lastErr.message}). Will try system Node.js if available.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — START THE NEXT.JS SERVER
//
// After all updates and downloads are complete, spawns the Next.js standalone
// server process using node.exe (or system node as fallback).
//
// Environment flags passed to the server:
//   PORT=3000                          → listen on port 3000 on all interfaces
//   HOSTNAME=0.0.0.0                   → accept connections from other LAN devices
//   IS_LOCAL_HUB=true                  → use local SQLite DB instead of Supabase
//   NEXT_PUBLIC_LOCAL_SERVER_MODE=true → frontend shows LAN sync UI, not cloud UI
//   NODE_ENV=production                → enables production-level caching
//
// stdio: 'inherit' means server logs (console.log, errors, etc.) are printed
// directly in this same console window the clinic staff sees.
//
// A browser is opened automatically after 2 seconds pointing to localhost:3000.
// On SIGINT (Ctrl+C) or SIGTERM, the server process is killed cleanly.
// ─────────────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    // Check if running from temp directory (unextracted ZIP preview on Windows)
    const baseDirLower = baseDir.toLowerCase();
    const isTempFolder = baseDirLower.includes('\\temp') || baseDirLower.includes('/temp') || baseDirLower.includes('temp1_');

    if (isTempFolder) {
      console.error('=====================================================================');
      console.error('  ⚠️  CRITICAL: RUNNING FROM ZIP FILE DETECTED');
      console.error('=====================================================================');
      console.error('  It looks like you are running Amana Diagnostics directly from');
      console.error('  inside the ZIP file without extracting it first.');
      console.error('');
      console.error('  This will cause the server to fail and crash on startup.');
      console.error('');
      console.error('  TO FIX THIS:');
      console.error('    1. Close this window.');
      console.error('    2. Right-click the downloaded "amana-hub-portable.zip" file.');
      console.error('    3. Select "Extract All..." and choose a destination folder.');
      console.error('    4. Open the extracted folder and run "amana-server.exe" from there.');
      console.error('=====================================================================');
      console.error('');
      console.error('This window will stay open. Press Ctrl+C to close.');
      setInterval(() => {}, 1000);
      return;
    }

    await runAutoUpdate();         // Step 3: Check for / apply updates
    await downloadNodeIfMissing(); // Step 4: Ensure node.exe is present


    console.log('=====================================================================');
    console.log('                  CLINIC STAFF CONNECTION INSTRUCTIONS               ');
  console.log('=====================================================================');
  console.log('');
  console.log('  1. Connect all clinic laptops (Reception, Lab, Radiology) to the same Wi-Fi router.');
  console.log('  2. Open the browser on each laptop and type the following address:');
  console.log('');
  console.log(`         --->   http://${localIp}:3000   <---`);
  console.log('');
  console.log('  3. To access this Server PC itself locally, you can open:');
  console.log('');
  console.log('         --->   http://localhost:3000   <---');
  console.log('');
  console.log('  * CRITICAL: Do NOT close this window. Closing it will shut down the');
  console.log('    server database and disconnect all other laptops in the clinic.');
  console.log('=====================================================================');
  console.log('');

  console.log('[3] Starting database server in Local LAN mode...');
  console.log('');

  if (!fs.existsSync(serverPath)) {
    console.error(`Error: Next.js standalone server not found at: ${serverPath}`);
    console.error('This usually means the server/ download failed. Check internet connection and restart.');
    console.error('');
    console.error('This window will stay open. Press Ctrl+C to close.');
    setInterval(() => {}, 1000);
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECURITY: Inject all env vars from .env.local at runtime
  // Secrets are NEVER read from disk by the browser or by staff — they live
  // only in this process's memory and are passed to the server as env vars.
  // The server/ folder itself can have a stripped-down .env.local with only
  // public (NEXT_PUBLIC_*) keys inside.
  // ─────────────────────────────────────────────────────────────────────────
  const parsedEnvVars = getAllEnvVars();

  const env = {
    ...process.env,
    ...parsedEnvVars,             // Inject ALL keys from .env.local files
    PORT: '3000',
    HOSTNAME: '0.0.0.0',                    // Accept connections from all LAN devices
    NEXT_PUBLIC_LOCAL_SERVER_MODE: 'true',  // Tell frontend it's running in LAN mode
    IS_LOCAL_HUB: 'true',                   // Tell backend to use SQLite (not Supabase)
    NODE_ENV: 'production'                  // Production mode
  };


  // Use bundled node.exe if available, fall back to system node (for testing)
  const bundledNodePath = process.platform === 'win32'
    ? path.join(baseDir, 'node.exe')
    : path.join(baseDir, 'node');

  const nodeExecutable = fs.existsSync(bundledNodePath) ? bundledNodePath : 'node';
  console.log(`Using Node engine: ${nodeExecutable}`);

  // Spawn the Next.js server — it keeps running until this window is closed
  const serverProcess = spawn(nodeExecutable, [serverPath], {
    cwd: baseDir,
    env,
    stdio: 'inherit' // Forward server output to this console window
  });

  serverProcess.on('error', (err) => {
    console.error('');
    console.error('=====================================================================');
    console.error('  ERROR: Failed to start the server process.');
    console.error(`  Detail: ${err.message}`);
    console.error('  Common causes:');
    console.error('    - node.exe is missing or corrupted (delete it and restart to re-download)');
    console.error('    - server/ folder is missing (delete version.json and restart to re-download)');
    console.error('=====================================================================');
    console.error('');
    console.error('This window will stay open. Press Ctrl+C to close.');
    // Keep the window open indefinitely so staff can read the error
    setInterval(() => {}, 1000);
  });

  // If the server process exits unexpectedly (crash), show a clear message
  // and keep the terminal open so clinic staff can see what went wrong.
  serverProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error('');
      console.error('=====================================================================');
      console.error(`  ⚠️  SERVER CRASHED (exit code: ${code})`);
      console.error('  The Amana Local Hub server stopped unexpectedly.');
      console.error('');
      console.error('  WHAT TO TRY:');
      console.error('    1. Read the error messages above for the specific cause.');
      console.error('    2. If you see "node:sqlite" errors → delete node.exe and restart');
      console.error('       (launcher will re-download the correct Node version).');
      console.error('    3. If you see "Cannot find module" → delete server/ folder and');
      console.error('       restart (launcher will re-download the server files).');
      console.error('    4. Contact your system administrator if the error persists.');
      console.error('=====================================================================');
      console.error('');
      console.error('This window will stay open. Press Ctrl+C to close.');
      // Keep event loop alive indefinitely so the window stays open for staff to read the error
      setInterval(() => {}, 1000);
    }
  });

  // Auto-open browser after 2 seconds (gives server time to bind to port 3000)
  setTimeout(() => {
    console.log('[4] Launching default web browser...');
    const url = 'http://localhost:3000';
    let command = '';

    if (process.platform === 'win32') {
      command = `start "" "${url}"`;
    } else if (process.platform === 'darwin') {
      command = `open "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    const browserLauncher = spawn(command, { shell: true });
    browserLauncher.on('error', (err) => {
      console.error('Failed to automatically open browser:', err);
    });
  }, 2000);

  // Graceful shutdown: kill the server when this window is closed or Ctrl+C is pressed
  function cleanup() {
    console.log('\n[Shutting down Amana Local Hub server...]');
    if (serverProcess) {
      serverProcess.kill('SIGINT');
    }
    process.exit(0);
  }

    process.on('SIGINT', cleanup);  // Ctrl+C
    process.on('SIGTERM', cleanup); // OS kill signal
    process.on('exit', cleanup);    // Window closed
  } catch (error) {
    console.error('');
    console.error('=====================================================================');
    console.error('  ⚠️  LAUNCHER SETUP ERROR');
    console.error('=====================================================================');
    console.error(`  An error occurred during launcher initialization:`);
    console.error(`  Detail: ${error.message}`);
    console.error('');
    console.error('  WHAT TO TRY:');
    console.error('    1. Check your internet connection.');
    console.error('    2. If the problem persists, delete version.json or node.exe and restart.');
    console.error('=====================================================================');
    console.error('');
    console.error('This window will stay open. Press Ctrl+C to close.');
    setInterval(() => {}, 1000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
startServer();
