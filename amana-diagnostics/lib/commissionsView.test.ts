import { describe, it, expect } from 'vitest';

import {
  filterEntries,
  totalsFor,
  groupByReferrer,
  csvCell,
  buildCommissionCsv,
  buildCommissionStatementHtml,
  escapeHtml,
} from './commissionsView';
import type { CommissionEntry } from './store';

/**
 * The commissions report decides what a clinic pays its referring doctors, and
 * it leaves the building twice: as a CSV an accountant opens, and as a printed
 * statement a doctor is handed. Both were built by pasting names into strings.
 */

const entry = (over: Partial<CommissionEntry> = {}): CommissionEntry => ({
  patientId: 'p1',
  patientName: 'Ada Okoye',
  slipNumber: '00412',
  registeredAt: '2026-09-01T09:00:00.000Z',
  referrerName: 'Dr Bala',
  referrerType: 'doctor',
  commissionType: 'percentage',
  commissionValue: 10,
  tests: [{ testId: 't1', testName: 'FBC', price: 10000 }],
  totalAmount: 10000,
  commissionAmount: 1000,
  commissionStatus: 'pending',
  ...over,
});

describe('filtering', () => {
  const entries = [
    entry(),
    entry({
      patientId: 'p2',
      patientName: 'Bala Yusuf',
      slipNumber: '00500',
      referrerType: 'facility',
      referrerName: 'Kano Clinic',
      commissionStatus: 'paid',
    }),
  ];

  it('narrows by referrer type and by settlement status', () => {
    expect(filterEntries(entries, { type: 'doctor', status: 'all', search: '' })).toHaveLength(1);
    expect(filterEntries(entries, { type: 'all', status: 'paid', search: '' })).toHaveLength(1);
  });

  it('searches the patient, the referrer and the slip number', () => {
    const f = { type: 'all' as const, status: 'all' as const };
    expect(filterEntries(entries, { ...f, search: 'ada' })).toHaveLength(1);
    expect(filterEntries(entries, { ...f, search: 'kano' })).toHaveLength(1);
    expect(filterEntries(entries, { ...f, search: '00412' })).toHaveLength(1);
    expect(filterEntries(entries, { ...f, search: '  ' })).toHaveLength(2);
  });
});

describe('totals', () => {
  it('splits settled from outstanding', () => {
    const t = totalsFor([
      entry({ commissionAmount: 1000, commissionStatus: 'pending' }),
      entry({ patientId: 'p2', commissionAmount: 500, commissionStatus: 'paid' }),
    ]);
    expect(t.commission).toBe(1500);
    expect(t.outstanding).toBe(1000);
    expect(t.paid).toBe(500);
  });

  it('counts a referrer once however many patients they sent', () => {
    const t = totalsFor([entry(), entry({ patientId: 'p2' }), entry({ patientId: 'p3', referrerName: 'Dr Chi' })]);
    expect(t.referrers).toBe(2);
  });

  it('is all zeroes for an empty report rather than NaN', () => {
    expect(totalsFor([])).toMatchObject({ billed: 0, commission: 0, referrers: 0 });
  });
});

describe('grouping by referrer', () => {
  it('adds each referrer up once', () => {
    const groups = groupByReferrer([
      entry({ commissionAmount: 1000, totalAmount: 10000 }),
      entry({ patientId: 'p2', commissionAmount: 500, totalAmount: 5000, commissionStatus: 'paid' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      name: 'Dr Bala',
      totalBilled: 15000,
      commissionAmount: 1500,
      paid: 500,
      outstanding: 1000,
    });
    expect(groups[0]!.patients).toHaveLength(2);
  });
});

/* ── The two exports ──────────────────────────────────────────────────── */

describe('CSV cells', () => {
  it('doubles a quote instead of ending the field early', () => {
    // O"Brien used to shift every column after it on that row.
    expect(csvCell('O"Brien')).toBe('"O""Brien"');
  });

  it('defuses a cell a spreadsheet would run as a formula', () => {
    // Reachable: patient names and settlement notes are typed by staff.
    for (const dangerous of ['=1+1', '+SUM(A1)', '-2', '@import', '=cmd|calc']) {
      expect(csvCell(dangerous).startsWith(`"'`), dangerous).toBe(true);
    }
  });

  it('leaves an ordinary value alone', () => {
    expect(csvCell('Ada Okoye')).toBe('"Ada Okoye"');
    expect(csvCell(1200.5)).toBe('"1200.5"');
    expect(csvCell(null)).toBe('""');
  });

  it('does not mistake a negative figure written as text for a formula, it quotes it safely', () => {
    // It is still prefixed — correct, because a leading '-' is a formula start.
    // The value survives; only the spreadsheet's interpretation changes.
    expect(csvCell('-500')).toBe(`"'-500"`);
  });
});

describe('the CSV', () => {
  it('has a header row and one row per entry', () => {
    const csv = buildCommissionCsv([entry(), entry({ patientId: 'p2' })]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('"Slip No"');
  });

  it('carries a malicious name through without letting it break the file', () => {
    const csv = buildCommissionCsv([entry({ patientName: '=HYPERLINK("http://x","click")' })]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""click"")"`);
  });
});

describe('the printed statement', () => {
  it('is headed with the clinic that generated it', () => {
    const html = buildCommissionStatementHtml({ clinicName: 'Riverside Diagnostics', entries: [entry()] });
    expect(html).toContain('RIVERSIDE DIAGNOSTICS');
  });

  it('narrows to one referrer when asked, and totals only their entries', () => {
    const html = buildCommissionStatementHtml({
      clinicName: 'Riverside',
      entries: [entry(), entry({ patientId: 'p2', referrerName: 'Dr Chi', commissionAmount: 9999 })],
      referrerName: 'Dr Bala',
    });
    expect(html).toContain('DR BALA');
    expect(html).not.toContain('9,999');
  });

  it('escapes a name rather than letting it close a tag', () => {
    const html = buildCommissionStatementHtml({
      clinicName: 'Riverside',
      entries: [entry({ patientName: '<script>alert(1)</script>' })],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes the five characters that matter', () => {
    expect(escapeHtml(`<&">'`)).toBe('&lt;&amp;&quot;&gt;&#39;');
  });
});
