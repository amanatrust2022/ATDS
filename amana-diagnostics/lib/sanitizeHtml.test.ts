import { describe, it, expect } from 'vitest';
import { sanitizeLetterheadHtml, cleanLetterhead } from './sanitizeHtml';

/**
 * The letterhead is authored in the app and then injected, as HTML, into the
 * settings preview, every printed and emailed report, the page the patient is
 * shown, and a headless browser printing from a file:// URL. What used to guard
 * it only stripped trailing empty tags.
 */
describe('Sanitising the letterhead', () => {
  it('drops a script tag and everything in it', () => {
    const out = sanitizeLetterheadHtml('<p>Amana</p><script>fetch("/steal")</script>');

    expect(out).toBe('<p>Amana</p>');
    expect(out).not.toContain('fetch');
  });

  it('drops an event handler while keeping the element', () => {
    const out = sanitizeLetterheadHtml('<img src="https://x.supabase.co/logo.png" onerror="alert(1)" />');

    expect(out).toContain('src="https://x.supabase.co/logo.png"');
    expect(out).not.toContain('onerror');
  });

  it('refuses a javascript: image source', () => {
    expect(sanitizeLetterheadHtml('<img src="javascript:alert(1)">')).not.toContain('javascript:');
  });

  it('refuses an http image source but keeps an inline one', () => {
    expect(sanitizeLetterheadHtml('<img src="http://evil.test/x.png">')).not.toContain('evil.test');
    expect(sanitizeLetterheadHtml('<img src="data:image/png;base64,iVBORw0KGgo=">')).toContain('data:image/png');
  });

  it('strips a style declaration that would fetch something', () => {
    const out = sanitizeLetterheadHtml('<div style="color:#000;background:url(http://evil.test/x)">Hi</div>');

    expect(out).toContain('color:#000');
    expect(out).not.toContain('evil.test');
  });

  it('removes an iframe entirely', () => {
    expect(sanitizeLetterheadHtml('<iframe src="https://evil.test"></iframe>')).toBe('');
  });

  it('unwraps a tag nobody needs rather than trusting it', () => {
    expect(sanitizeLetterheadHtml('<marquee>AMANA</marquee>')).toBe('AMANA');
  });

  it('hides markup inside an HTML comment from doing anything', () => {
    expect(sanitizeLetterheadHtml('<!--<script>alert(1)</script>-->Amana')).toBe('Amana');
  });

  it('keeps the formatting a real letterhead uses', () => {
    const letterhead =
      '<p style="text-align:center"><strong>AMANA TRUST DIAGNOSTICS</strong></p>' +
      '<p><span style="font-size:9pt">No 15, Tudun Wada, Kano</span></p><hr>';

    const out = sanitizeLetterheadHtml(letterhead);

    expect(out).toContain('<strong>AMANA TRUST DIAGNOSTICS</strong>');
    expect(out).toContain('text-align:center');
    expect(out).toContain('font-size:9pt');
    expect(out).toContain('<hr');
  });

  it('keeps a table, which letterheads use for logo-beside-address layouts', () => {
    const out = sanitizeLetterheadHtml('<table><tr><td colspan="2">Amana</td></tr></table>');

    expect(out).toContain('<table>');
    expect(out).toContain('colspan="2"');
  });

  it('leaves an ampersand in a clinic name alone', () => {
    expect(sanitizeLetterheadHtml('<p>Amana Trust & Clinical Services</p>')).toContain('Trust & Clinical');
  });

  it('takes nothing from an empty or missing letterhead', () => {
    expect(sanitizeLetterheadHtml('')).toBe('');
    expect(sanitizeLetterheadHtml(null)).toBe('');
    expect(sanitizeLetterheadHtml(undefined)).toBe('');
  });
});

describe('Tidying and sanitising together', () => {
  it('still trims the trailing blank paragraphs the editor leaves', () => {
    expect(cleanLetterhead('<p>Amana</p><p><br></p><p>&nbsp;</p>')).toBe('<p>Amana</p>');
  });

  it('sanitises after tidying, so tidying cannot re-admit anything', () => {
    const out = cleanLetterhead('<p>Amana</p><script>alert(1)</script><p><br></p>');

    expect(out).not.toContain('script');
    expect(out).toContain('<p>Amana</p>');
  });

  it('keeps a trailing rule, which is a real letterhead element', () => {
    expect(cleanLetterhead('<p>Amana</p><hr>')).toContain('<hr');
  });
});
