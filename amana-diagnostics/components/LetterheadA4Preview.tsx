'use client';
/**
 * A page-accurate print preview of the letterhead.
 *
 * It reproduces the exact geometry the printed report uses (see
 * lib/templates.ts → getResultTemplate): a real A4 sheet, the @page margins
 * (20px left/right, 15mm bottom, and 0 top on the FIRST page), the body's 10px
 * top padding, and the same report classes — so what sits here is where it lands
 * on paper. The letterhead is sanitised through the same cleanLetterhead used at
 * print time, then a sample report title + patient block follow it for context.
 */
import { cleanLetterhead } from '@/lib/sanitizeHtml';
import { buildDocCss } from '@/lib/letterheadStyles';

const MM = 96 / 25.4;              // px per mm at 96dpi
const PAGE_W = 210 * MM;           // A4 width  ≈ 793.7px
const PAGE_H = 297 * MM;           // A4 height ≈ 1122.5px
const MARGIN_X = 20;               // @page margin-left / margin-right (px)
const MARGIN_BOTTOM = 15 * MM;     // @page margin-bottom (15mm)
const PAD_TOP = 10;                // body padding-top on print
const SCALE = 0.72;                // shrink the sheet to fit the settings column

const vGuide = (left: number): React.CSSProperties => ({
  position: 'absolute', left, top: 0, height: '100%', width: 0,
  borderLeft: '1px dashed #cbd5e1', pointerEvents: 'none',
});

const CANVAS_W = 740; // must match LetterheadDesigner's CANVAS_W

export default function LetterheadA4Preview({ html, footerHtml, bgHtml }: { html: string; footerHtml?: string; bgHtml?: string }) {
  const clean = cleanLetterhead(html);
  const footerClean = footerHtml && footerHtml.trim() ? cleanLetterhead(footerHtml) : '';
  const bgClean = bgHtml && bgHtml.trim() ? cleanLetterhead(bgHtml) : '';
  return (
    <div style={{ background: '#e9edf2', padding: 20, overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
      {/* Reserve the scaled footprint so surrounding layout stays correct. */}
      <div style={{ width: PAGE_W * SCALE, height: PAGE_H * SCALE, flexShrink: 0 }}>
        <div style={{
          width: PAGE_W, height: PAGE_H, transform: `scale(${SCALE})`, transformOrigin: 'top left',
          background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.25)', position: 'relative', boxSizing: 'border-box',
        }}>
          <style>{`
            ${buildDocCss('.a4-report .custom-letterhead')}
            .a4-report { font-family: 'Times New Roman', Times, serif; color: #000; font-size: 11pt; }
            .a4-report .custom-letterhead p { margin: 0 0 4px 0; }
            .a4-report .custom-letterhead div { margin: 0; }
            .a4-report .custom-letterhead *:last-child { margin-bottom: 0 !important; padding-bottom: 0 !important; }
            .a4-report .report-title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 2.5px 0 10px; color: #0563c1; text-decoration: underline; }
            .a4-report .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; font-size: 12pt; border: 1px solid #0563c1; padding: 12px; }
            .a4-report .pi-label { font-weight: bold; margin-right: 8px; }
          `}</style>

          {/* Full-page background/frame — scaled to cover the whole sheet, behind content. */}
          {bgClean && (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
              <div style={{ width: CANVAS_W, transformOrigin: 'top left', transform: `scale(${PAGE_W / CANVAS_W})` }}
                dangerouslySetInnerHTML={{ __html: bgClean }} />
            </div>
          )}

          {/* Margin guides (dashed) */}
          <div style={vGuide(MARGIN_X)} />
          <div style={vGuide(PAGE_W - MARGIN_X)} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: PAGE_H - MARGIN_BOTTOM, height: 0, borderTop: '1px dashed #cbd5e1', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', right: MARGIN_X + 4, top: PAGE_H - MARGIN_BOTTOM + 4, fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>bottom margin · 15&nbsp;mm</div>

          {/* Body content area: inset by the @page side margins, 10px top padding,
              first-page top margin 0. This is exactly where the report renders. */}
          <div className="a4-report" style={{ position: 'absolute', left: MARGIN_X, right: MARGIN_X, top: PAD_TOP, zIndex: 1 }}>
            <div className="header" style={{ textAlign: 'left' }}>
              <div className="custom-letterhead" dangerouslySetInnerHTML={{ __html: clean }} />
            </div>
            <div className="report-title">Laboratory Result Report</div>
            <div className="patient-info">
              <div><span className="pi-label">Patient Name;</span> Jane Doe</div>
              <div><span className="pi-label">Patient ID;</span> AMT-0001</div>
              <div><span className="pi-label">Age;</span> 34</div>
              <div><span className="pi-label">Sex;</span> Female</div>
              <div><span className="pi-label">Investigation(s);</span> Full Blood Count</div>
              <div><span className="pi-label">Specimen(s);</span> Whole Blood (EDTA)</div>
            </div>
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '9pt', marginTop: 18, fontFamily: 'system-ui, sans-serif' }}>
              — results, signature and the rest of the report continue below —
            </div>
          </div>

          {/* Footer — repeats at the bottom of every printed page. */}
          {footerClean && (
            <div className="a4-report" style={{ position: 'absolute', left: MARGIN_X, right: MARGIN_X, bottom: 6, zIndex: 1 }}>
              <div className="custom-letterhead" dangerouslySetInnerHTML={{ __html: footerClean }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
