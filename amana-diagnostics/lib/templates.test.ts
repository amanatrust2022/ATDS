import { describe, it, expect } from 'vitest';

import { getResultTemplate, esc } from './templates';
import { combineLetterhead, letterheadHeight } from './letterheadStyles';
import type { Patient, PatientTest } from './store';

/**
 * The printed report.
 *
 * Everything here is a defect that reached paper: a comment containing "<"
 * that deleted the rest of the report, a running footer printed over the last
 * lines of the body, a signature stranded on the right-hand margin, and
 * investigation headings tucked into the corner of their own section bar.
 */

const test = (over: Partial<PatientTest> = {}): PatientTest => ({
  id: 't1',
  testId: 'fbc',
  testName: 'Full Blood Count',
  department: 'lab',
  status: 'completed',
  results: [{ parameter: 'Haemoglobin', result: '9.1', unit: 'g/dL', range: '12 - 16', flag: 'L' }],
  completedBy: 'Amina Bello',
  completedAt: '2026-09-10T09:00:00.000Z',
  ...over,
}) as unknown as PatientTest;

const patient = (over: Partial<Patient> = {}): Patient => ({
  id: 1,
  slipNumber: 'AMT-0001',
  registeredAt: '2026-09-10T08:00:00.000Z',
  firstName: 'Jane',
  surname: 'Doe',
  age: 34,
  sex: 'Female',
  tests: [],
  ...over,
}) as unknown as Patient;

const canvas = (height: number, body = '<div style="position:absolute;left:0;top:0">Clinic</div>') =>
  `<div data-letterhead-canvas="1" style="position:relative;width:740px;height:${height}px;margin:0 auto">${body}</div>`;

describe('text a person typed, on the way into a report', () => {
  it('does not let a "<" in a comment swallow the rest of the page', () => {
    const html = getResultTemplate(
      patient(),
      [test({ notes: 'Repeat sample: Hb < 7.0 g/dL and falling' })],
    );

    expect(html).toContain('Hb &lt; 7.0 g/dL and falling');
    // The report carried on: everything after the comment is still there.
    expect(html).toContain('END OF REPORT');
    expect(html).toContain('Amina Bello');
  });

  it('prints a reference range written with an inequality', () => {
    const html = getResultTemplate(
      patient(),
      [test({ results: [{ parameter: 'LDL', result: '3.4', unit: 'mmol/L', range: '< 3.0', flag: 'H' }] as any }),
      ],
    );

    expect(html).toContain('&lt; 3.0');
  });

  it('escapes the ampersand in a clinic or patient name rather than printing &amp;', () => {
    expect(esc('Smith & Sons')).toBe('Smith &amp; Sons');
    expect(esc(undefined)).toBe('');
  });
});

describe('where the signature sits', () => {
  it('closes the report at the lower right', () => {
    const html = getResultTemplate(patient(), [test()]);

    expect(html).toContain('.sig-section { margin-top: 28px; display: flex; justify-content: flex-end;');
    expect(html).toContain('.sig-box { text-align: right;');
    // ...and after the end-of-report marker, not before it.
    expect(html.indexOf('END OF REPORT')).toBeLessThan(html.indexOf('<div class="sig-section">'));
  });

  it('puts no rule over the name', () => {
    const html = getResultTemplate(patient(), [test()]);
    expect(html).not.toMatch(/\.sig-line \{[^}]*border-top/);
  });

  it('prints the title of whoever released the result, when there is one', () => {
    const html = getResultTemplate(patient(), [test({ completedByTitle: 'MLS, AMLSCN' })]);
    expect(html).toContain('MLS, AMLSCN');
  });
});

describe('the heading of each investigation', () => {
  it('is centred over its own section', () => {
    const html = getResultTemplate(patient(), [test()]);
    expect(html).toMatch(/\.test-header \{[^}]*text-align: center/);
  });

  it('is centred on a radiology section too', () => {
    const html = getResultTemplate(
      patient(),
      [test({
        testId: 'us_abd',
        testName: 'Abdominal Ultrasound',
        department: 'radiology',
        results: [{ parameter: 'Radiology: Findings', result: 'Liver normal.', unit: '', range: '', flag: '' }] as any,
      })],
    );

    expect(html).toMatch(/font-size: 12pt;[^"]*text-align: center/);
  });
});

describe('the running footer', () => {
  const org = (footer: string) => ({
    name: 'Riverside Diagnostics',
    letterhead_html: combineLetterhead(canvas(200), footer),
  });

  it('has room reserved for it in the flow, not in the page margin', () => {
    const html = getResultTemplate(patient(), [test()], org(canvas(90)) as any);

    // 90px of footer + the 12px gap, kept clear on every page by the repeating
    // spacer row — not by a page margin the fixed footer sits above.
    expect(html).toContain('<tfoot><tr><td><div style="height:102px"></div></td></tr></tfoot>');
    expect(html).toContain('margin-bottom: 20mm;');
  });

  it('measures the footer it was actually given', () => {
    const html = getResultTemplate(patient(), [test()], org(canvas(150)) as any);
    expect(html).toContain('height:162px');
  });

  it('reserves nothing when there is no footer', () => {
    const html = getResultTemplate(patient(), [test()], {
      name: 'Riverside Diagnostics',
      letterhead_html: canvas(200),
    } as any);

    expect(html).not.toContain('<tfoot>');
    expect(html).toContain('class="report-body"');
  });

  it('refuses to hand half the page to a mis-measured footer', () => {
    expect(letterheadHeight(canvas(4000), 120)).toBe(340);
    expect(letterheadHeight('<div>a legacy footer with no canvas</div>', 120)).toBe(120);
    expect(letterheadHeight('', 120)).toBe(0);
  });
});

describe('a full-page background', () => {
  const withBg = {
    name: 'Riverside Diagnostics',
    letterhead_html: combineLetterhead(canvas(200), '', canvas(1040), 170, 90),
  };

  it('gives every page the same top margin, so the frame lands in the same place', () => {
    const html = getResultTemplate(patient(), [test()], withBg as any);
    expect(html).toContain('margin-top: 0;');
    expect(html).not.toContain('margin-top: 20mm;');
  });

  it('keeps the clear area at the top and bottom of every page', () => {
    const html = getResultTemplate(patient(), [test()], withBg as any);
    expect(html).toContain('<thead><tr><td><div style="height:170px"></div></td></tr></thead>');
    expect(html).toContain('<tfoot><tr><td><div style="height:90px"></div></td></tr></tfoot>');
  });

  it('takes the larger of the background clearance and the footer strip', () => {
    const html = getResultTemplate(
      patient(),
      [test()],
      { name: 'X', letterhead_html: combineLetterhead(canvas(200), canvas(140), canvas(1040), 170, 90) } as any,
    );

    // 140 + 12 beats the background's 90.
    expect(html).toContain('<tfoot><tr><td><div style="height:152px"></div></td></tr></tfoot>');
  });
});
