/**
 * Copies the pdf.js worker out of node_modules into /public so it is served
 * locally (and works offline). Run from `postinstall`, so the vendored copy
 * always matches the installed pdfjs-dist version — bump the dep and the worker
 * refreshes on the next `npm install`.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const dest = path.join(__dirname, '..', 'public', 'pdf.worker.min.mjs');

try {
  if (!fs.existsSync(src)) {
    // pdfjs-dist not installed (e.g. --omit=dev in some contexts) — nothing to do.
    console.warn('[copy-pdf-worker] pdfjs-dist worker not found, skipping.');
    process.exit(0);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('[copy-pdf-worker] public/pdf.worker.min.mjs updated.');
} catch (err) {
  // Never fail the install over this.
  console.warn('[copy-pdf-worker] could not copy worker:', err.message);
  process.exit(0);
}
