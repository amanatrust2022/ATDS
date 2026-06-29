const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');

// Determine paths relative to the executable location (or process.cwd() in dev)
const isCompiled = process.pkg !== undefined;
const baseDir = isCompiled ? path.dirname(process.execPath) : process.cwd();

// Find Next.js standalone server path (can be in root of server/ or nested in amana-diagnostics/)
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

// 1. Detect active local IPv4 address
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
  return '127.0.0.1';
}

const localIp = getLocalIpAddress();
console.log(`[1] Detected Server PC IP Address: ${localIp}`);

// 2. Parse Supabase URL from .env.local
function getSupabaseUrl() {
  // Check both in root of server/ and nested amana-diagnostics/
  const paths = [
    path.join(baseDir, 'server', '.env.local'),
    path.join(baseDir, 'server', 'amana-diagnostics', '.env.local')
  ];
  for (const envPath of paths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
      if (match && match[1]) {
        return match[1].trim().replace(/['"]/g, '');
      }
    }
  }
  return null;
}

// 3. Helper to Download File
function downloadFile(url, dest, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let timer;

    function get(requestUrl) {
      const req = https.get(requestUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          get(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          clearTimeout(timer);
          file.close();
          fs.unlink(dest, () => {});
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
        fs.unlink(dest, () => {});
        reject(err);
      });

      // Set timeout
      timer = setTimeout(() => {
        req.destroy();
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error('Connection timed out'));
      }, timeoutMs);
    }

    get(url);
  });
}

// 4. Fetch JSON helper (with timeout)
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

// 5. Check and Apply Update
async function runAutoUpdate() {
  console.log('[2] Checking for cloud updates...');
  
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    console.log('ℹ️ Supabase URL not found in config. Skipping update check.');
    return;
  }

  const localVersionPath = path.join(baseDir, 'version.json');
  let localVersion = { version: '1.0.0', buildHash: 'initial' };

  if (fs.existsSync(localVersionPath)) {
    try {
      localVersion = JSON.parse(fs.readFileSync(localVersionPath, 'utf8'));
    } catch (e) {}
  }

  try {
    // Check latest version info in Supabase Updates bucket
    const cloudVersionUrl = `${supabaseUrl}/storage/v1/object/public/updates/version.json`;
    const cloudVersion = await fetchJson(cloudVersionUrl, 6000); // 6s timeout

    const localServerDir = path.join(baseDir, 'server');
    const isFirstRun = !fs.existsSync(localServerDir);

    if (isFirstRun) {
      console.log('🆕 First run detected — downloading server files from cloud...');
    } else if (cloudVersion && cloudVersion.buildHash && cloudVersion.buildHash !== localVersion.buildHash) {
      console.log(`🔄 New update available: v${cloudVersion.version} (Hash: ${cloudVersion.buildHash})`);
    } else {
      console.log('✅ Local Hub is up-to-date.');
      return;
    }

    if (isFirstRun || (cloudVersion && cloudVersion.buildHash !== localVersion.buildHash)) {
      console.log('💾 Downloading server package, please wait (this may take a minute)...');


      const zipUrl = `${supabaseUrl}/storage/v1/object/public/updates/update-latest.zip`;
      const zipPath = path.join(baseDir, 'update.zip');
      const tempExtractDir = path.join(baseDir, 'server_temp');

      // Download update zip
      await downloadFile(zipUrl, zipPath, 45000); // 45s timeout for 10-15MB bundle
      console.log('✅ Update downloaded. Extracting files...');

      // Clean temp extraction directory
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempExtractDir, { recursive: true });

      // Run PowerShell Expand-Archive (native on Windows)
      if (process.platform === 'win32') {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtractDir}' -Force"`);
      } else {
        // Unix fallback
        execSync(`unzip -o "${zipPath}" -d "${tempExtractDir}"`);
      }

      console.log('Applying update (atomic swap)...');

      const localServerDir = path.join(baseDir, 'server');
      const backupServerDir = path.join(baseDir, 'server_old');
      const extractedServerDir = path.join(tempExtractDir, 'server');

      if (!fs.existsSync(extractedServerDir)) {
        throw new Error('Invalid update package structure: missing "server" folder.');
      }

      // Perform atomic backup and replace
      if (fs.existsSync(backupServerDir)) {
        fs.rmSync(backupServerDir, { recursive: true, force: true });
      }

      // Rename current to old
      if (fs.existsSync(localServerDir)) {
        fs.renameSync(localServerDir, backupServerDir);
      }

      try {
        // Move new folder to 'server'
        fs.renameSync(extractedServerDir, localServerDir);

        // Update local version file
        fs.writeFileSync(localVersionPath, JSON.stringify(cloudVersion, null, 2), 'utf8');

        // Cleanup
        fs.rmSync(backupServerDir, { recursive: true, force: true });
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);

        console.log('🎉 Update applied successfully! Local Hub is now on the latest version.');
        resolveServerPath(); // Re-resolve server path in case it changed
      } catch (swapError) {
        // Rollback
        console.error('Swap failed, rolling back to previous version:', swapError.message);
        if (fs.existsSync(backupServerDir)) {
          if (fs.existsSync(localServerDir)) {
            fs.rmSync(localServerDir, { recursive: true, force: true });
          }
          fs.renameSync(backupServerDir, localServerDir);
        }
        throw swapError;
    }
  } catch (err) {
    console.log(`ℹ️ Update check skipped or failed: ${err.message}. Starting current version.`);
  }
  console.log('');
}

// Download portable node.exe on first run if not present
async function downloadNodeIfMissing() {
  const nodeDest = path.join(baseDir, 'node.exe');
  if (fs.existsSync(nodeDest)) return; // Already present

  console.log('[2b] node.exe not found. Downloading portable Node.js v22 for Windows...');
  const nodeUrl = 'https://nodejs.org/dist/v22.2.0/win-x64/node.exe';
  const tmpDest = nodeDest + '.tmp';

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await downloadFile(nodeUrl, tmpDest, 120000); // 2 min timeout for 75MB
      fs.renameSync(tmpDest, nodeDest);
      console.log('✅ node.exe downloaded successfully.');
      return;
    } catch (e) {
      lastErr = e;
      if (fs.existsSync(tmpDest)) fs.unlinkSync(tmpDest);
      console.warn(`⚠️  Attempt ${attempt} failed: ${e.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.warn(`⚠️  Could not download node.exe (${lastErr.message}). Will try system Node.js if available.`);
}

async function startServer() {
  await runAutoUpdate();
  await downloadNodeIfMissing();

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
    console.error('Please run the build and distribution pack scripts first.');
    process.exit(1);
  }

  // 2. Set environment variables dynamically
  const env = {
    ...process.env,
    PORT: '3000',
    HOSTNAME: '0.0.0.0',
    NEXT_PUBLIC_LOCAL_SERVER_MODE: 'true',
    IS_LOCAL_HUB: 'true',
    NODE_ENV: 'production'
  };

  // 3. Spawn the Next.js server process
  const bundledNodePath = process.platform === 'win32'
    ? path.join(baseDir, 'node.exe')
    : path.join(baseDir, 'node');

  const nodeExecutable = fs.existsSync(bundledNodePath) ? bundledNodePath : 'node';
  console.log(`Using Node engine: ${nodeExecutable}`);

  const serverProcess = spawn(nodeExecutable, [serverPath], {
    cwd: baseDir,
    env,
    stdio: 'inherit' // Pipes server logs directly to this console window
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start Next.js standalone server:', err);
    process.exit(1);
  });

  // 4. Automatically open browser to localhost:3000 after 2 seconds
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

  // Graceful cleanup on termination
  function cleanup() {
    console.log('\n[Shutting down Amana Local Hub server...]');
    if (serverProcess) {
      serverProcess.kill('SIGINT');
    }
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
}

startServer();
