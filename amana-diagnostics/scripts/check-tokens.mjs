/**
 * A ratchet on the things that got the interface into its current state.
 *
 * The app reached 2,100 inline style objects, 192 hand-typed hex colours and
 * 80 font sizes one reasonable-looking edit at a time. Nothing was wrong with
 * any single one of them; the problem was that nothing counted.
 *
 * This counts. Each metric has a ceiling recorded in scripts/ui-budget.json.
 * Going below the ceiling is free. Going above it fails the build.
 *
 *   node scripts/check-tokens.mjs            check against the budget
 *   node scripts/check-tokens.mjs --update   lower the budget to today's count
 *
 * --update only ever lowers. If a number has genuinely to rise, edit
 * ui-budget.json by hand in the same commit, so the increase is reviewable
 * rather than automatic.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const budgetPath = join(root, 'scripts/ui-budget.json');

const SCAN_DIRS = ['app', 'components'];

/**
 * components/ui is the design system itself, and it is the one place these
 * patterns are supposed to live: the single <table> that every screen's table
 * is now made of, the one inline style object inside Button. Counting it here
 * would penalise moving work INTO the library, which is the whole direction of
 * travel.
 */
const SYSTEM_DIR = 'components/ui';
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.open-next', '.wrangler']);

/* --- Collect files ------------------------------------------------------ */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(root, d))).filter(
  (f) => !relative(root, f).split(sep).join('/').startsWith(SYSTEM_DIR),
);

/* --- Metrics ------------------------------------------------------------
 * Each returns { count, worst } where worst lists the heaviest offenders so
 * a failure names somewhere to start rather than just a number. */

const METRICS = {
  /** Styling that cannot be themed, reused, or changed in one place. */
  inlineStyleObjects: {
    label: 'inline style={{...}} objects',
    pattern: /style=\{\{/g,
  },
  /** A colour typed by hand is a colour no theme can reach. */
  rawHexColors: {
    label: 'hard-coded hex colours',
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
  },
  /** Same problem, different notation. */
  rawRgbaColors: {
    label: 'hard-coded rgb()/rgba() colours',
    pattern: /\brgba?\(\s*\d/g,
  },
  /** The pre-token names. Frozen: nothing new may use them. */
  legacyTokens: {
    label: 'legacy --gray-*/--teal-* token uses',
    pattern: /var\(--(?:gray|teal)-\d+\)/g,
  },
  /** Hover simulated in JS instead of CSS. Never fires for keyboard users. */
  jsHoverHandlers: {
    label: 'onMouseOver/onMouseOut hover handlers',
    pattern: /onMouse(?:Over|Out|Enter|Leave)=/g,
  },
  /** Removing the focus ring is how the app became keyboard-hostile. */
  outlineNone: {
    label: "inline outline:'none'",
    pattern: /outline:\s*['"]none['"]/g,
  },
  /** !important outside print is the cascade giving up. */
  importantRules: {
    label: '!important in component styles',
    pattern: /!important/g,
  },
  /** Every one of these is a modal without a focus trap. */
  handRolledOverlays: {
    label: "hand-rolled position:'fixed' overlays",
    pattern: /position:\s*['"]fixed['"]/g,
  },
  /** Each is a table with no sticky header, sort, or empty state. */
  rawTables: {
    label: 'raw <table> elements',
    pattern: /<table[\s>]/g,
  },
  /** Unmanaged stacking. Use the --z-* tokens. */
  rawZIndex: {
    label: 'hard-coded numeric zIndex',
    pattern: /zIndex:\s*\d+/g,
  },
};

const results = {};

for (const [key, metric] of Object.entries(METRICS)) {
  let total = 0;
  const perFile = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const n = (src.match(metric.pattern) || []).length;
    if (n > 0) {
      total += n;
      perFile.push([relative(root, file).split(sep).join('/'), n]);
    }
  }
  perFile.sort((a, b) => b[1] - a[1]);
  results[key] = { count: total, worst: perFile.slice(0, 3) };
}

/* --- Compare to budget -------------------------------------------------- */

const update = process.argv.includes('--update');

let budget = {};
try {
  budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
} catch {
  console.log('No budget file yet — writing one from the current counts.\n');
  budget = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.count]));
  writeFileSync(budgetPath, JSON.stringify(budget, null, 2) + '\n');
}

let failed = 0;
let improved = 0;
const rows = [];

for (const [key, metric] of Object.entries(METRICS)) {
  const now = results[key].count;
  const cap = budget[key] ?? now;
  const status = now > cap ? 'OVER' : now < cap ? 'down' : 'ok';
  if (status === 'OVER') failed++;
  if (status === 'down') improved++;
  rows.push({ key, label: metric.label, now, cap, status, worst: results[key].worst });
}

const w = Math.max(...rows.map((r) => r.label.length));
console.log('  count   budget   metric');
console.log('  ' + '-'.repeat(w + 20));
for (const r of rows) {
  const mark = r.status === 'OVER' ? '!!' : r.status === 'down' ? ' v' : '  ';
  console.log(
    `${mark} ${String(r.now).padStart(5)}   ${String(r.cap).padStart(6)}   ${r.label}`,
  );
}

if (failed) {
  console.error('\nOver budget:\n');
  for (const r of rows.filter((x) => x.status === 'OVER')) {
    console.error(`  ${r.label}: ${r.now} (budget ${r.cap})`);
    for (const [f, n] of r.worst) console.error(`      ${n.toString().padStart(4)}  ${f}`);
  }
  console.error(
    '\nUse the design system instead: styles/tokens.css for values,\n' +
      'components/ui/ for primitives. If the system lacks what you need,\n' +
      'add it there rather than inline.\n',
  );
  process.exit(1);
}

if (update) {
  const next = {};
  for (const r of rows) next[r.key] = Math.min(r.now, r.cap);
  writeFileSync(budgetPath, JSON.stringify(next, null, 2) + '\n');
  console.log('\nBudget lowered to current counts.');
} else if (improved) {
  console.log(
    `\n${improved} metric(s) below budget. Run with --update to lock the gains in.`,
  );
} else {
  console.log('\nAll metrics within budget.');
}
