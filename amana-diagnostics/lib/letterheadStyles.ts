/**
 * Shared document styling for the rich-text / letterhead editor.
 *
 * This is the single source of truth used in three places:
 *   1. The editor content area (components/RichTextEditor.tsx) — on-screen rendering.
 *   2. The saved HTML the editor emits — styles are inlined onto each element so the
 *      output is fully self-contained and renders identically anywhere.
 *   3. The print/preview templates (lib/templates.ts, admin/settings) — as a fallback
 *      stylesheet so *legacy* letterheads (saved before inlining) still render correctly.
 *
 * Because the same numbers drive all three, what you see in the editor is exactly what
 * prints — the whole point of the rebuild.
 *
 * Keep this file free of DOM/browser APIs so it is safe to import on the server.
 */

export const DOC_BASE = {
  fontFamily: "'Times New Roman', Times, serif",
  fontSize: '11pt',
  lineHeight: '1.5',
  color: '#000000',
};

/**
 * Base style applied to every block-level element the editor produces.
 * Heading sizes use `em` so they scale off the inherited 11pt base, which is
 * identical in the editor and in the print document.
 */
export const BLOCK_RULES: { selector: string; style: string }[] = [
  { selector: 'p', style: 'margin:0 0 8px 0' },
  { selector: 'h1', style: 'font-size:2em;font-weight:700;margin:0.5em 0 0.3em 0;line-height:1.2' },
  { selector: 'h2', style: 'font-size:1.5em;font-weight:700;margin:0.5em 0 0.3em 0;line-height:1.2' },
  { selector: 'h3', style: 'font-size:1.25em;font-weight:700;margin:0.5em 0 0.3em 0;line-height:1.2' },
  { selector: 'ul', style: 'margin:0 0 8px 0;padding-left:1.5em;list-style-type:disc' },
  { selector: 'ol', style: 'margin:0 0 8px 0;padding-left:1.5em;list-style-type:decimal' },
  { selector: 'li', style: 'margin:0 0 4px 0' },
  { selector: 'blockquote', style: 'margin:0 0 8px 0;padding-left:12px;border-left:3px solid #cbd5e1;color:#475569' },
  { selector: 'hr', style: 'border:none;border-top:1px solid #000000;margin:12px 0' },
  { selector: 'table', style: 'border-collapse:collapse;width:100%;margin:8px 0;table-layout:fixed' },
  { selector: 'td', style: 'border:1px solid #000000;padding:6px 8px;vertical-align:top' },
  { selector: 'th', style: 'border:1px solid #000000;padding:6px 8px;vertical-align:top;font-weight:700;background:#f2f2f2;text-align:left' },
  { selector: 'img', style: 'max-width:100%;height:auto' },
];

/**
 * Build a CSS string that reproduces the document styles, scoped under `scope`
 * (e.g. `.rte-content` in the editor, `.custom-letterhead` in the print template).
 */
export function buildDocCss(scope: string): string {
  const base =
    `${scope}{font-family:${DOC_BASE.fontFamily};font-size:${DOC_BASE.fontSize};` +
    `line-height:${DOC_BASE.lineHeight};color:${DOC_BASE.color};}`;
  const rules = BLOCK_RULES.map((r) => {
    const sel = r.selector
      .split(',')
      .map((s) => `${scope} ${s.trim()}`)
      .join(',');
    return `${sel}{${r.style};}`;
  }).join('');
  return base + rules;
}
