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
import { useId } from 'react';

import { cleanLetterhead } from '@/lib/sanitizeHtml';
import { buildDocCss } from '@/lib/letterheadStyles';

import styles from './letterheadPreview.module.css';

const MM = 96 / 25.4;              // px per mm at 96dpi
const PAGE_W = 210 * MM;           // A4 width  ≈ 793.7px
const PAGE_H = 297 * MM;           // A4 height ≈ 1122.5px
const MARGIN_X = 20;               // @page margin-left / margin-right (px)
const MARGIN_BOTTOM = 15 * MM;     // @page margin-bottom (15mm)
const PAD_TOP = 10;                // body padding-top on print
const SCALE = 0.72;                // shrink the sheet to fit the settings column

// Where a guide sits is geometry, so it stays here; what it looks like is
// chrome, so it lives in .guide.
const vGuide = (left: number): React.CSSProperties => ({
  left, top: 0, height: '100%', width: 0, borderLeftWidth: 1,
});

export default function LetterheadA4Preview({ html, footerHtml, bgHtml, bgTop = 170, bgBottom = 90 }: {
  html: string; footerHtml?: string; bgHtml?: string; bgTop?: number; bgBottom?: number;
}) {
  const clean = cleanLetterhead(html);
  const footerClean = footerHtml && footerHtml.trim() ? cleanLetterhead(footerHtml) : '';
  const bgClean = bgHtml && bgHtml.trim() ? cleanLetterhead(bgHtml) : '';
  const contentTop = bgClean ? bgTop : PAD_TOP;
  // A <figcaption> names its figure in the spec but not in every accessibility
  // tree, so the link is made explicitly.
  const captionId = useId();
  return (
    <figure className={styles.figure} aria-labelledby={captionId}>
      <div className={styles.desk}>
        {/* Reserve the scaled footprint so surrounding layout stays correct. */}
        <div style={{ width: PAGE_W * SCALE, height: PAGE_H * SCALE, flexShrink: 0 }}>
          <div
            className={styles.sheet}
            style={{
              width: PAGE_W, height: PAGE_H, transform: `scale(${SCALE})`, transformOrigin: 'top left',
            }}
          >
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

            {/* Full-page background/frame — in the same content-width space as the
                header and footer (the canvas centres itself via margin:0 auto), so
                it lines up with everything. Sits behind content at z-index 0. */}
            {bgClean && (
              <div className="a4-report" style={{ position: 'absolute', left: MARGIN_X, right: MARGIN_X, top: 0, zIndex: 0 }}>
                <div className="custom-letterhead" dangerouslySetInnerHTML={{ __html: bgClean }} />
              </div>
            )}

            {/* Margin guides. Draughtsman's marks over the paper, not part of the
                letterhead — so they are hidden from the reading order, which used
                to interleave "bottom margin · 15 mm" with the report text. */}
            <div aria-hidden="true">
              <div className={styles.guide} style={vGuide(MARGIN_X)} />
              <div className={styles.guide} style={vGuide(PAGE_W - MARGIN_X)} />
              <div
                className={styles.guide}
                style={{ left: 0, right: 0, top: PAGE_H - MARGIN_BOTTOM, height: 0, borderTopWidth: 1 }}
              />
              <div
                className={styles.guideLabel}
                style={{ right: MARGIN_X + 4, top: PAGE_H - MARGIN_BOTTOM + 4 }}
              >
                bottom margin · 15&nbsp;mm
              </div>

              {/* When a full-page background is used, show the clear area the report
                  prints inside, so the report never collides with the letterhead's
                  own header/footer. */}
              {bgClean && (
                <div
                  className={styles.clearArea}
                  style={{ left: MARGIN_X, right: MARGIN_X, top: bgTop, bottom: bgBottom, zIndex: 2 }}
                >
                  <div className={styles.clearAreaLabel}>report prints here</div>
                </div>
              )}
            </div>

            {/* Body content area: inset by the @page side margins. Starts below the
                letterhead header when a full-page background reserves space. */}
            <div className="a4-report" style={{ position: 'absolute', left: MARGIN_X, right: MARGIN_X, top: contentTop, zIndex: 1 }}>
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
              <div className={styles.continues}>
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

      {/* The sheet carries a made-up patient — Jane Doe, AMT-0001 — to show
          where a real one will land. Nothing used to say so, and on a settings
          page a screen reader announced it as though it were a record. */}
      <figcaption className={styles.caption} id={captionId}>
        A sample report on your letterhead. The patient details shown are made
        up; the dashed lines are the printer&apos;s margins and are not printed.
      </figcaption>
    </figure>
  );
}
