/**
 * Verifies every foreground/background pair in the design system against
 * WCAG 2.1 AA, in both themes.
 *
 * The palette this replaced had --gray-500 as its secondary text colour in 111
 * places at 3.67:1, below the 4.5:1 AA requires. Nobody noticed because
 * nothing checked. This runs in CI so a palette edit cannot quietly
 * reintroduce a failing pair.
 *
 *   node scripts/check-contrast.mjs
 *
 * Exit code 1 on any failure.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'styles/tokens.css'), 'utf8');

/* --- Parse the three blocks we care about. ------------------------------- */

/** Pull `--name: value;` pairs out of one brace-delimited block. */
function parseBlock(source) {
  const out = {};
  for (const m of source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim().replace(/\s*\/\*[\s\S]*?\*\//g, '').trim();
  }
  return out;
}

/** The bare :root block — everything, light theme. */
function blockAfter(marker, from = 0) {
  const i = css.indexOf(marker, from);
  if (i === -1) return '';
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, j);
    }
  }
  return '';
}

const light = { ...parseBlock(blockAfter(':root {')), ...parseBlock(blockAfter('LEGACY BRIDGE')) };
const dark = { ...light, ...parseBlock(blockAfter(":root[data-theme='dark']")) };

/* --- Resolve var() chains down to a literal colour. ---------------------- */

function resolve(name, table, seen = new Set()) {
  let v = table[name];
  if (v === undefined) return null;
  let guard = 0;
  while (typeof v === 'string' && v.startsWith('var(')) {
    const ref = v.slice(4, v.indexOf(')')).trim();
    if (seen.has(ref) || guard++ > 20) {
      throw new Error(`Cyclic or unresolvable token: ${name} -> ${ref}`);
    }
    seen.add(ref);
    v = table[ref];
    if (v === undefined) return null;
  }
  return v;
}

/* --- Contrast maths (WCAG 2.x relative luminance). ----------------------- */

function parseColor(c) {
  if (!c) return null;
  c = c.trim();
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    if (h.length !== 6) return null;
    return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((x) => parseFloat(x));
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }
  return null;
}

const lum = ([r, g, b]) => {
  const v = [r, g, b]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};

const ratio = (fg, bg) => {
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

/* --- The pairs the product actually renders. -----------------------------
 * `min` is 4.5 for body text, 3 for large text and for UI boundaries that
 * carry meaning. A boundary that is purely decorative is not listed. */

const PAIRS = [
  ['text-primary', 'surface-page', 4.5, 'body text on the page'],
  ['text-primary', 'surface-raised', 4.5, 'body text on a card'],
  ['text-primary', 'surface-sunken', 4.5, 'body text on a table header'],
  ['text-secondary', 'surface-page', 4.5, 'secondary text on the page'],
  ['text-secondary', 'surface-raised', 4.5, 'secondary text on a card'],
  ['text-muted', 'surface-page', 4.5, 'muted text on the page'],
  ['text-muted', 'surface-raised', 4.5, 'muted text on a card'],
  ['text-muted', 'surface-sunken', 4.5, 'muted text on a sunken surface'],
  ['text-link', 'surface-raised', 4.5, 'links'],
  ['text-link', 'surface-page', 4.5, 'links on the page'],

  ['accent-solid-text', 'accent-solid', 4.5, 'primary button label'],
  ['accent-solid-text', 'accent-solid-hover', 4.5, 'primary button label, hover'],
  ['accent-text', 'surface-raised', 4.5, 'accent text on a card'],
  ['accent-subtle-text', 'accent-subtle', 4.5, 'accent chip'],
  ['accent-subtle-text', 'surface-selected', 4.5, 'text in a selected row'],

  ['critical-solid-text', 'critical-solid', 4.5, 'destructive button label'],
  ['critical-text', 'critical-subtle', 4.5, 'critical chip'],
  ['critical-text', 'surface-raised', 4.5, 'critical text on a card'],
  ['warning-solid-text', 'warning-solid', 4.5, 'warning button label'],
  ['warning-text', 'warning-subtle', 4.5, 'warning chip'],
  ['warning-text', 'surface-raised', 4.5, 'warning text on a card'],
  ['success-solid-text', 'success-solid', 4.5, 'success button label'],
  ['success-text', 'success-subtle', 4.5, 'success chip'],
  ['success-text', 'surface-raised', 4.5, 'success text on a card'],
  ['info-solid-text', 'info-solid', 4.5, 'info button label'],
  ['info-text', 'info-subtle', 4.5, 'info chip'],

  ['border-strong', 'surface-raised', 3, 'meaningful boundary on a card'],
  ['border-strong', 'surface-page', 3, 'meaningful boundary on the page'],
  ['focus-color', 'surface-page', 3, 'focus ring on the page'],
  ['focus-color', 'surface-raised', 3, 'focus ring on a card'],
];

/* --- Run --------------------------------------------------------------- */

let failures = 0;
let checked = 0;

for (const [themeName, table] of [['light', light], ['dark', dark]]) {
  const rows = [];
  for (const [fgName, bgName, min, label] of PAIRS) {
    const fg = parseColor(resolve(`--${fgName}`, table));
    const bg = parseColor(resolve(`--${bgName}`, table));

    if (!fg || !bg) {
      console.error(`  MISSING  ${themeName}: --${fgName} on --${bgName} (${label})`);
      failures++;
      continue;
    }
    checked++;
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failures++;
    rows.push({ ok, r, min, fgName, bgName, label });
  }

  const bad = rows.filter((x) => !x.ok);
  console.log(
    `\n${themeName.toUpperCase()}  ${rows.length - bad.length}/${rows.length} pairs pass`,
  );
  for (const x of bad) {
    console.error(
      `  FAIL  ${x.r.toFixed(2)}:1  (needs ${x.min}:1)  --${x.fgName} on --${x.bgName}  — ${x.label}`,
    );
  }
}

console.log(`\n${checked} pairs checked across both themes.`);

if (failures > 0) {
  console.error(`\n${failures} contrast failure(s). Fix styles/tokens.css.`);
  process.exit(1);
}
console.log('All pairs meet WCAG 2.1 AA.\n');
