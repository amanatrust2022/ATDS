const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const projectDir = __dirname;
const distDir = path.join(projectDir, 'dist');
const serverDistDir = path.join(distDir, 'server');

console.log('=====================================================================');
console.log('               AMANA STANDALONE PACKAGING SCRIPT                     ');
console.log('=====================================================================');
console.log('');

// Helper: Delete directory recursively
function cleanDirectory(dir) {
  if (fs.existsSync(dir)) {
    console.log(`Cleaning old directory: ${dir}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Helper: Download a file following redirects
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    function get(requestUrl) {
      https.get(requestUrl, (response) => {
        // Handle redirect
        if (response.statusCode === 301 || response.statusCode === 302) {
          get(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error(`Server returned status code: ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close(() => resolve());
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
    }
    
    get(url);
  });
}

async function main() {
  try {
    // 1. Clean old dist directory
    cleanDirectory(distDir);
    fs.mkdirSync(distDir, { recursive: true });
    fs.mkdirSync(serverDistDir, { recursive: true });

    // 2. Build Next.js app in standalone mode
    console.log('[1] Running Next.js build...');
    execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });
    console.log('✅ Next.js build completed successfully.');
    console.log('');

    // Paths of standalone outputs
    const standaloneDir = path.join(projectDir, '.next', 'standalone');
    
    if (!fs.existsSync(standaloneDir)) {
      throw new Error(`Standalone directory not found at: ${standaloneDir}. Make sure output: 'standalone' is enabled in next.config.js.`);
    }

    // 3. Assemble standalone server files
    console.log('[2] Assembling server files...');
    
    // Copy standalone server and node_modules
    console.log('Copying standalone code and dependencies...');
    fs.cpSync(standaloneDir, serverDistDir, { recursive: true });

    // Standalone server requires public/ and .next/static/ directories to serve assets
    console.log('Copying public assets...');
    const publicSrc = path.join(projectDir, 'public');
    const publicDest = path.join(serverDistDir, 'public');
    if (fs.existsSync(publicSrc)) {
      fs.cpSync(publicSrc, publicDest, { recursive: true });
    }

    console.log('Copying static build chunks...');
    const staticSrc = path.join(projectDir, '.next', 'static');
    const staticDest = path.join(serverDistDir, '.next', 'static');
    if (fs.existsSync(staticSrc)) {
      fs.cpSync(staticSrc, staticDest, { recursive: true });
    }

    console.log('✅ Standalone server assembled in dist/server/');
    console.log('');

    // 4. Download/Fetch portable Node.js v22 binary for Windows (standalone runtime)
    console.log('[3] Fetching portable Node.js v22 binary for Windows...');
    const cachedNodePath = path.join(projectDir, 'node-portable.exe');
    const nodeDest = path.join(distDir, 'node.exe');
    
    if (fs.existsSync(cachedNodePath)) {
      console.log('✅ Found cached node-portable.exe in project root. Copying...');
      fs.copyFileSync(cachedNodePath, nodeDest);
    } else {
      const nodeUrl = 'https://nodejs.org/dist/v22.2.0/win-x64/node.exe';
      console.log(`Downloading node.exe from: ${nodeUrl}`);
      let success = false;
      let lastError;
      
      // Try up to 3 times to mitigate transient network ECONNRESET errors
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await downloadFile(nodeUrl, cachedNodePath);
          success = true;
          break;
        } catch (downloadErr) {
          lastError = downloadErr;
          console.warn(`⚠️ Attempt ${attempt} failed: ${downloadErr.message}. Retrying in 2 seconds...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      if (!success) {
        throw new Error(`Failed to download Node.exe after 3 attempts. Last error: ${lastError.message}`);
      }
      
      console.log('✅ Portable Node.js binary downloaded and cached in project root.');
      fs.copyFileSync(cachedNodePath, nodeDest);
    }
    console.log('');

    // 5. Generate version metadata file (version.json)
    console.log('[4] Generating version metadata file (version.json)...');
    const buildHash = `build-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const versionInfo = {
      version: '1.0.0',
      buildHash,
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(distDir, 'version.json'),
      JSON.stringify(versionInfo, null, 2),
      'utf8'
    );
    console.log(`✅ Generated version metadata (Hash: ${buildHash})`);
    console.log('');

    // 6. Compile the launcher executable using pkg
    console.log('[5] Compiling launcher binary using pkg...');
    
    // Run pkg to bundle launcher.js (target node18 is supported by default pkg versions)
    const targetBinary = 'amana-server.exe';
    const pkgCmd = `npx pkg launcher.js --target node18-win-x64 --output ${path.join(distDir, targetBinary)}`;
    console.log(`Executing: ${pkgCmd}`);
    execSync(pkgCmd, { cwd: projectDir, stdio: 'inherit' });
    console.log('✅ Compiled launcher binary successfully.');
    console.log('');

    // 7. Package standalone server folder into update-latest.zip
    console.log('[6] Packaging standalone update archive (update-latest.zip)...');
    const zipDest = path.join(distDir, 'update-latest.zip');
    
    if (process.platform === 'win32') {
      execSync(`powershell -Command "Compress-Archive -Path '${serverDistDir}' -DestinationPath '${zipDest}' -Force"`);
      console.log('✅ Packaged update-latest.zip successfully.');
    } else {
      console.log('Zip creation skipped: platform is not Windows. Please manually zip the server directory on other operating systems.');
    }

    console.log('');
    console.log('=====================================================================');
    console.log('🎉 STANDALONE EXECUTABLE PACKAGING SUCCESSFUL!');
    console.log('=====================================================================');
    console.log(`  The portable local hub folder is located at:\n  ${distDir}`);
    console.log('');
    console.log('  Contents of dist/:');
    fs.readdirSync(distDir).forEach(file => {
      console.log(`    - ${file}`);
    });
    console.log('=====================================================================');

  } catch (error) {
    console.error('\n❌ Packaging failed with error:');
    console.error(error.message);
    process.exit(1);
  }
}

main();
