/**
 * =============================================================================
 * AMANA DIAGNOSTICS — Upload Update Files to Supabase Storage
 * =============================================================================
 *
 * WHAT THIS DOES:
 *   Uploads three files from the local `dist/` folder to the Supabase Storage
 *   `updates` bucket so all deployed Local Hubs can auto-update themselves.
 *
 * FILES UPLOADED:
 *   dist/version.json          → Tiny metadata file (buildHash, version, createdAt).
 *                                Each Local Hub checks this on startup to decide
 *                                whether to download an update.
 *   dist/update-latest.zip     → The Next.js standalone server/ folder (~36MB).
 *                                Downloaded by existing Local Hubs when their
 *                                buildHash doesn't match the cloud version.
 *   dist/amana-hub-portable.zip → Initial download ZIP (~14MB: amana-server.exe
 *                                 + version.json only). New clinics download this
 *                                 from the website. On first launch, the launcher
 *                                 downloads update-latest.zip automatically.
 *
 * HOW TO RUN MANUALLY (from your dev machine):
 *   1. Run `npm run dist:package` first to build the dist/ files.
 *   2. Set env vars and run:
 *        $env:NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
 *        $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *        node upload-updates.js
 *
 * WHY NATIVE HTTPS (not @supabase/supabase-js):
 *   The Supabase JS client loads files into memory as a Buffer before uploading,
 *   which causes out-of-memory errors or hangs for files >30MB. This script uses
 *   Node's native `fs.createReadStream()` to stream files directly to the
 *   Supabase Storage REST API without ever loading the full file into RAM.
 *
 * PUBLIC URL FORMAT (after upload):
 *   {SUPABASE_URL}/storage/v1/object/public/updates/{filename}
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const https = require('https');


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

// Upload a file using native HTTPS streams (handles large files without OOM)
function uploadToSupabase(filePath, destName, contentType) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File does not exist: ${filePath}`));
    }

    const fileSize = fs.statSync(filePath).size;
    const url = new URL(`${supabaseUrl}/storage/v1/object/updates/${destName}`);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': contentType,
        'Content-Length': fileSize,
        'x-upsert': 'true',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✅ Uploaded ${destName} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
          resolve();
        } else {
          reject(new Error(`Upload ${destName} failed: HTTP ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', reject);

    // Stream file directly without loading into memory
    const readStream = fs.createReadStream(filePath);
    readStream.on('error', reject);
    readStream.pipe(req);
  });
}

async function main() {
  try {
    const distDir = path.join(__dirname, 'dist');

    console.log('Uploading version.json...');
    await uploadToSupabase(
      path.join(distDir, 'version.json'),
      'version.json',
      'application/json'
    );

    console.log('Uploading update-latest.zip...');
    await uploadToSupabase(
      path.join(distDir, 'update-latest.zip'),
      'update-latest.zip',
      'application/zip'
    );

    console.log('Uploading amana-hub-portable.zip...');
    await uploadToSupabase(
      path.join(distDir, 'amana-hub-portable.zip'),
      'amana-hub-portable.zip',
      'application/zip'
    );

    console.log('');
    console.log('🎉 All files deployed to Supabase Storage!');
    console.log(`Download URL: ${supabaseUrl}/storage/v1/object/public/updates/amana-hub-portable.zip`);
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main();
