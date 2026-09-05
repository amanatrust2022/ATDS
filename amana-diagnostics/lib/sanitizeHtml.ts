/**
 * Reduces authored HTML to the formatting a letterhead legitimately needs.
 *
 * The letterhead is stored as raw HTML and injected into the settings preview,
 * into every printed and emailed report, into the page the *patient* is shown,
 * and into headless Chrome — which `send-result` runs with `--no-sandbox`
 * against a `file://` URL, where a script can read local files.
 *
 * The function that used to guard this only trimmed trailing empty tags. It was
 * a tidier, not a sanitiser, and it left `<script>`, `onerror=` and
 * `javascript:` untouched.
 *
 * This is an allow-list: anything not named here is dropped. That is the only
 * approach that stays correct as browsers gain features — a block-list is a
 * list of the attacks somebody already thought of.
 *
 * It runs on the server as well as the browser, so it cannot use the DOM.
 */

/** Elements a letterhead may contain. Everything else is unwrapped or dropped. */
const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'br', 'hr',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'small', 'font',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'img',
]);

/** Elements whose *content* goes too, not just the tag. */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta',
  'svg', 'math', 'template', 'noscript', 'form', 'input', 'button',
]);

/** Attributes that carry only presentation, never behaviour. */
const ALLOWED_ATTRS = new Set([
  'style', 'class', 'align', 'valign', 'width', 'height',
  'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing',
  'src', 'alt', 'face', 'color', 'size', 'dir',
]);

/** `style` declarations that can fetch or execute. */
const DANGEROUS_CSS = /(expression\s*\(|url\s*\(\s*['"]?\s*(?!data:image\/)|@import|behavior\s*:|-moz-binding)/i;

function sanitizeStyle(value: string): string {
  return value
    .split(';')
    .filter(decl => decl.trim() && !DANGEROUS_CSS.test(decl))
    .join(';')
    .trim();
}

/**
 * An `src` may only be an inline image or an https URL. `javascript:`,
 * `data:text/html` and protocol-relative URLs are all refused.
 */
function safeSrc(value: string): string | null {
  const v = value.trim();
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(v)) return v;
  if (/^https:\/\/[^\s"'<>]+$/i.test(v)) return v;
  return null;
}

function sanitizeAttributes(raw: string): string {
  const out: string[] = [];
  // name="value" | name='value' | name=value | name
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g;

  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(raw)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';

    // Every `on*` handler, and anything the allow-list does not name.
    if (name.startsWith('on') || !ALLOWED_ATTRS.has(name)) continue;

    if (name === 'style') {
      const cleaned = sanitizeStyle(value);
      if (cleaned) out.push(`style="${escapeAttr(cleaned)}"`);
      continue;
    }

    if (name === 'src') {
      const src = safeSrc(value);
      if (src) out.push(`src="${escapeAttr(src)}"`);
      continue;
    }

    out.push(value ? `${name}="${escapeAttr(value)}"` : name);
  }

  return out.length ? ' ' + out.join(' ') : '';
}

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Void elements, which must not be given a closing tag. */
const VOID_TAGS = new Set(['br', 'hr', 'img']);

export function sanitizeLetterheadHtml(input: string | null | undefined): string {
  if (!input) return '';

  let html = String(input);

  // Comments can hide markup from the tag scanner below.
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // Elements whose content is dropped along with them.
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    // ...and any unclosed remainder.
    html = html.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
  }

  // Rewrite every remaining tag through the allow-list. Text between tags is
  // left as it is: it is already inert, and escaping it would visibly mangle
  // ampersands in clinic names.
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_match, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return '';

    const isClosing = /^<\//.test(_match);
    if (isClosing) return VOID_TAGS.has(name) ? '' : `</${name}>`;

    const attrs = sanitizeAttributes(rawAttrs);
    return VOID_TAGS.has(name) ? `<${name}${attrs} />` : `<${name}${attrs}>`;
  });

  // Anything that still looks like a tag was malformed on purpose.
  html = html.replace(/<(?![/a-zA-Z])/g, '&lt;');

  return html.trim();
}

/**
 * Trims the trailing blank paragraphs the editor leaves behind, then
 * sanitises. Cosmetic tidying and safety are separate jobs; this is the order
 * they belong in, and sanitising last means the tidier can never re-admit
 * something.
 */
export function cleanLetterhead(html: string | null | undefined): string {
  let clean = (html || '').trim();
  let prev = '';

  while (clean !== prev) {
    prev = clean;
    clean = clean.replace(/(?:<br\s*\/?>\s*)+(?=(?:\s|<\/\w+>)*$)/gi, '').trim();
    clean = clean.replace(
      /<(\w+)\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>|<(?:\/?(?:span|strong|em|b|i|u|font))\b[^>]*>)*<\/\1>(?=(?:\s|<\/\w+>)*$)/gi,
      (match) => {
        if (match.includes('<img') || match.includes('<hr') || match.includes('data-shape')) return match;
        const textOnly = match.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').replace(/\s/g, '');
        return textOnly === '' ? '' : match;
      },
    ).trim();
  }

  return sanitizeLetterheadHtml(clean);
}
