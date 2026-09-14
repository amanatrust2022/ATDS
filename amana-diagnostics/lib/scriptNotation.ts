/**
 * Subscripts and superscripts in plain text.
 *
 * Most of what a laboratory writes is plain text in a plain field: a unit,
 * a reference range, a comment. "x10^9/L", "mm3", "CO2" and "Ca2+" are all
 * typed flat because there is nowhere to type them any other way, and the
 * printed report showed them flat. This module recognises the ways people
 * already write them and renders them properly — on paper, in the PDF and
 * on screen — without asking anyone to learn a markup language.
 *
 * What is recognised:
 *
 *   x10^9/L   10^-3   mm^3          `^` then digits, a sign, or {anything}
 *   H_2O      C_{6}H_{12}O_6         `_` then digits or {anything}
 *   mm3  cm2  m2  µm3                a length unit with a power
 *   H2O  CO2  HCO3  PaCO2  SpO2 …    the chemical formulas a clinic writes
 *   Ca2+  Mg2+  Na+  K+  Cl-  Fe3+   an ion's charge
 *
 * Nothing else is touched. A slip number, a phone number, "L4/L5", a date,
 * an email address — none of them match, because every rule needs either
 * the explicit `^`/`_` or a word from the list.
 *
 * One parser, three renderers: HTML (reports, email), pdfmake runs (the
 * PDF), and a React-free segment list for anything else.
 */

/** One run of text at one level. */
export interface ScriptSegment {
  text: string;
  level: 'normal' | 'sup' | 'sub';
}

/**
 * Formulas written flat, as they are on every request form. Digits inside
 * become subscripts; a trailing charge becomes a superscript.
 */
const FORMULAS = [
  'H2O', 'CO2', 'O2', 'N2', 'H2', 'CH4', 'H2S', 'NH3', 'NH4', 'NO2', 'NO3',
  'HCO3', 'H2CO3', 'PO4', 'HPO4', 'H2PO4', 'SO4', 'SO2', 'CaCO3', 'NaCl', 'KCl',
  'C6H12O6', 'C2H5OH', 'H2O2', 'MgSO4', 'CaCl2', 'FeSO4', 'ZnSO4',
  'PCO2', 'PaCO2', 'PO2', 'PaO2', 'SpO2', 'SaO2', 'SvO2', 'FiO2', 'EtCO2',
  'HbA2', 'T3', 'T4', 'FT3', 'FT4', 'rT3', 'B12', 'D3', 'D2', 'K2', 'B6', 'PGE2', 'PGF2',
  // Deliberately absent: HbA1c, CD4, C3 — written flat by convention.
];

/** The element symbols an ion's charge may follow. */
const IONS = ['Ca', 'Mg', 'Na', 'K', 'Cl', 'Fe', 'Cu', 'Zn', 'H', 'OH', 'Li', 'NH4', 'HCO3', 'PO4', 'SO4', 'NO3', 'Mn', 'Al', 'Pb', 'Hg', 'Ba', 'Sr', 'I', 'F', 'Br'];

/** Digits inside a formula are subscripts; the letters around them are not. */
const formulaSegments = (formula: string): ScriptSegment[] => {
  const out: ScriptSegment[] = [];
  for (const part of formula.match(/[A-Za-z]+|\d+/g) ?? []) {
    out.push({ text: part, level: /^\d/.test(part) ? 'sub' : 'normal' });
  }
  return out;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest first, so "H2CO3" is not read as "H2" + "CO3".
const formulaAlternation = [...FORMULAS].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
const ionAlternation = [...IONS].sort((a, b) => b.length - a.length).map(escapeRe).join('|');

/**
 * The rules, tried at each position in order. Each returns the segments it
 * produced and how many characters it consumed, or null.
 */
const RULES: Array<RegExp> = [
  // ^{...}  ^9  ^-3  ^+
  /^\^(?:\{([^}]*)\}|([0-9+\-]+))/,
  // _{...}  _2
  /^_(?:\{([^}]*)\}|([0-9]+))/,
  // mm3 cm2 m2 µm3 um3 — a length unit followed by a power of 2 or 3
  new RegExp('^(mm|cm|µm|um|km|m)([23])(?![0-9A-Za-z])'),
  // a formula, with an optional charge: CO2, HCO3-, Ca2+
  new RegExp(`^(${formulaAlternation})(2\\+|3\\+|2-|3-|\\+|-)?(?![A-Za-z0-9])`),
  // an ion with a charge: Na+, Cl-, Fe3+
  new RegExp(`^(${ionAlternation})(2\\+|3\\+|2-|3-|\\+|-)(?![A-Za-z0-9])`),
];

/** True where a formula or ion may start: not in the middle of a word. */
const atWordStart = (text: string, i: number) => i === 0 || !/[A-Za-z0-9]/.test(text[i - 1]);

/**
 * Splits text into runs with their level. The plain text of the input is
 * preserved exactly except for the `^`, `_` and braces that spelt the
 * notation, which are consumed.
 */
export function parseScripts(text: string): ScriptSegment[] {
  const out: ScriptSegment[] = [];
  const push = (t: string, level: ScriptSegment['level']) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.level === level) last.text += t;
    else out.push({ text: t, level });
  };

  let i = 0;
  let plain = '';
  while (i < text.length) {
    const rest = text.slice(i);
    let consumed = 0;

    // ^ and _
    let m = RULES[0].exec(rest);
    if (m) {
      push(plain, 'normal'); plain = '';
      push(m[1] ?? m[2] ?? '', 'sup');
      consumed = m[0].length;
    } else if ((m = RULES[1].exec(rest))) {
      push(plain, 'normal'); plain = '';
      push(m[1] ?? m[2] ?? '', 'sub');
      consumed = m[0].length;
    } else if (atWordStart(text, i)) {
      if ((m = RULES[2].exec(rest))) {
        push(plain, 'normal'); plain = '';
        push(m[1], 'normal');
        push(m[2], 'sup');
        consumed = m[0].length;
      } else if ((m = RULES[3].exec(rest))) {
        push(plain, 'normal'); plain = '';
        formulaSegments(m[1]).forEach((s) => push(s.text, s.level));
        if (m[2]) push(m[2], 'sup');
        consumed = m[0].length;
      } else if ((m = RULES[4].exec(rest))) {
        push(plain, 'normal'); plain = '';
        formulaSegments(m[1]).forEach((s) => push(s.text, s.level));
        push(m[2], 'sup');
        consumed = m[0].length;
      }
    }

    if (consumed > 0) {
      i += consumed;
    } else {
      plain += text[i];
      i += 1;
    }
  }
  push(plain, 'normal');
  return out;
}

/** True if the text contains anything the rules would change. */
export function hasScripts(text: string): boolean {
  return parseScripts(text).some((s) => s.level !== 'normal');
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * HTML with `<sup>`/`<sub>`, everything escaped. A drop-in for the report
 * templates' `esc()` wherever a value may carry a unit or a formula.
 */
export function scriptsToHtml(text: string | null | undefined): string {
  if (!text) return '';
  return parseScripts(String(text))
    .map((s) => (s.level === 'normal' ? escapeHtml(s.text) : `<${s.level}>${escapeHtml(s.text)}</${s.level}>`))
    .join('');
}

/**
 * pdfmake text runs. pdfmake renders `{ text, sup: true }` and `{ text,
 * sub: true }` natively. Returns the plain string when there is nothing to
 * mark, so the call sites that pass a string through keep working.
 */
export function scriptsToPdfRuns(text: string | null | undefined): string | Array<Record<string, unknown>> {
  if (!text) return '';
  const segments = parseScripts(String(text));
  if (!segments.some((s) => s.level !== 'normal')) return String(text);
  return segments.map((s) => (s.level === 'normal' ? { text: s.text } : { text: s.text, [s.level]: true }));
}

/**
 * The inverse for the rich-text editor: what a `<sup>`/`<sub>` run would be
 * typed as, so a report copied back into a plain field keeps its meaning.
 */
export function scriptsToNotation(segments: ScriptSegment[]): string {
  return segments
    .map((s) => (s.level === 'normal' ? s.text : `${s.level === 'sup' ? '^' : '_'}{${s.text}}`))
    .join('');
}

/**
 * The same recognition inside HTML that is already HTML — the text nodes of
 * a radiology report typed in the rich-text editor, say. Only text between
 * tags is touched; tags, attributes, styles and anything already inside a
 * `<sup>`/`<sub>` are left exactly as they are. The text is not escaped
 * again: it is HTML text already.
 */
export function markScriptsInHtml(html: string): string {
  if (!html) return '';
  const parts = html.split(/(<\/?[a-zA-Z][^>]*>)/);
  let skipDepth = 0;
  return parts
    .map((part) => {
      if (part.startsWith('<')) {
        const name = /^<\/?([a-zA-Z0-9]+)/.exec(part)?.[1]?.toLowerCase();
        if (name && ['style', 'script', 'sup', 'sub'].includes(name) && !part.endsWith('/>')) {
          skipDepth += part.startsWith('</') ? -1 : 1;
          if (skipDepth < 0) skipDepth = 0;
        }
        return part;
      }
      if (skipDepth > 0 || !part.trim()) return part;
      // HTML text may hold entities; a `&` here is one, not a character to
      // escape. Segments are joined back without re-escaping.
      return parseScripts(part)
        .map((s) => (s.level === 'normal' ? s.text : `<${s.level}>${s.text}</${s.level}>`))
        .join('');
    })
    .join('');
}
