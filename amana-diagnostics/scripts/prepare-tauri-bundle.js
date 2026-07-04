#!/usr/bin/env node
/**
 * scripts/prepare-tauri-bundle.js
 *
 * Run by `npm run build:tauri` (between `next build` and `cargo tauri build`).
 * Copies the Next.js standalone output into src-tauri/nextjs/ so Tauri can
 * bundle it as a resource.
 *
 * Directory layout produced:
 *   src-tauri/nextjs/
 *     server.js            ← Next.js standalone entry
 *     node_modules/        ← standalone runtime deps only
 *     .next/
 *       server/            ← server-side build output
 *       static/            ← copied from .next/static/
 *     public/              ← copied from public/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const STANDALONE  = path.join(ROOT, '.next', 'standalone');
const NEXT_STATIC = path.join(ROOT, '.next', 'static');
const PUBLIC      = path.join(ROOT, 'public');
const DEST        = path.join(ROOT, 'src-tauri', 'nextjs');

// ── Helpers ──────────────────────────────────────────────────────────────────

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ skipped (not found): ${path.relative(ROOT, src)}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });

  // Use xcopy on Windows, cp -r on Unix
  if (process.platform === 'win32') {
    execSync(`xcopy "${src}" "${dest}" /E /I /Y /Q`, { stdio: 'inherit' });
  } else {
    execSync(`cp -r "${src}/." "${dest}"`, { stdio: 'inherit' });
  }
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ file not found: ${path.relative(ROOT, src)}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('\n📦  Preparing Next.js bundle for Tauri...\n');

// Verify standalone output exists
if (!fs.existsSync(STANDALONE)) {
  console.error(`❌  .next/standalone not found at ${STANDALONE}`);
  console.error('   Run `npm run build` first (next.config.js must have output: "standalone").');
  process.exit(1);
}

// Clean previous bundle
if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true });
  console.log('  🗑  Cleared previous bundle.');
}
fs.mkdirSync(DEST, { recursive: true });

// 1. server.js
copyFile(path.join(STANDALONE, 'server.js'), path.join(DEST, 'server.js'));
console.log('  ✓  server.js');

// 2. node_modules (standalone subset)
const standaloneMods = path.join(STANDALONE, 'node_modules');
if (fs.existsSync(standaloneMods)) {
  copyRecursive(standaloneMods, path.join(DEST, 'node_modules'));
  console.log('  ✓  node_modules');
} else {
  console.warn('  ⚠  No standalone node_modules — Next.js may have inlined them.');
}

// 3. .next server output (from standalone)
const standaloneNext = path.join(STANDALONE, '.next');
if (fs.existsSync(standaloneNext)) {
  copyRecursive(standaloneNext, path.join(DEST, '.next'));
  console.log('  ✓  .next/server');
}

// 4. Static assets — MUST be copied separately (not included in standalone)
const staticDest = path.join(DEST, '.next', 'static');
if (fs.existsSync(NEXT_STATIC)) {
  copyRecursive(NEXT_STATIC, staticDest);
  console.log('  ✓  .next/static');
} else {
  console.warn('  ⚠  .next/static not found — UI assets may be missing.');
}

// 5. Public folder
if (fs.existsSync(PUBLIC)) {
  copyRecursive(PUBLIC, path.join(DEST, 'public'));
  console.log('  ✓  public');
}

// ── Summary ──────────────────────────────────────────────────────────────────
function du(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      try { total += fs.statSync(path.join(entry.parentPath || entry.path, entry.name)).size; }
      catch { /* ignore */ }
    }
  }
  return total;
}

const bundleMB = (du(DEST) / 1024 / 1024).toFixed(1);
console.log(`\n✅  Bundle ready at src-tauri/nextjs/  (${bundleMB} MB)\n`);
