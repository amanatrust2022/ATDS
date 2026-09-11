import { describe, it, expect } from 'vitest';
import {
  estimateGestationalAge,
  applyObstetricEstimate,
  dateByBiometry,
  CRL_DATING_LIMIT_MM,
  gestationalAgeByMeasurement,
  spreadInDays,
  SPREAD_WARNING_DAYS,
} from './obstetrics';
import { RADIOLOGY_TEMPLATES, convertTextToFormattedHtml } from '@/lib/radiology-templates';
import type { RadiologyFormState } from '@/lib/radiology-templates';

const TODAY = new Date(2026, 8, 2); // 2 September 2026

const state = (over: Partial<RadiologyFormState> = {}): RadiologyFormState => ({
  findings: '', impression: '', images: [], measurements: {}, ...over,
});

describe('estimateGestationalAge', () => {
  it('returns nothing when no usable measurement was entered', () => {
    expect(estimateGestationalAge({}, TODAY)).toBeNull();
    expect(estimateGestationalAge({ bpd: '', fl: '', crl: '' }, TODAY)).toBeNull();
    expect(estimateGestationalAge({ bpd: 'abc' }, TODAY)).toBeNull();
    expect(estimateGestationalAge({ bpd: '0' }, TODAY)).toBeNull();
  });

  it('estimates from BPD alone', () => {
    // 0.0012·35² + 0.22·35 + 7.5 = 16.67 weeks
    expect(estimateGestationalAge({ bpd: '35' }, TODAY)).toMatchObject({ weeks: 16, days: 4 });
  });

  it('estimates from FL alone', () => {
    // 0.0015·24² + 0.26·24 + 10.2 = 17.30 weeks
    expect(estimateGestationalAge({ fl: '24' }, TODAY)).toMatchObject({ weeks: 17, days: 2 });
  });

  it('estimates from CRL alone', () => {
    // -0.0006·50² + 0.15·50 + 5.8 = 11.80 weeks
    expect(estimateGestationalAge({ crl: '50' }, TODAY)).toMatchObject({ weeks: 11, days: 5 });
  });

  it('averages the second- and third-trimester measurements, ignoring blanks', () => {
    const both = estimateGestationalAge({ bpd: '35', fl: '24' }, TODAY);
    expect(both).toMatchObject({ weeks: 16, days: 6 }); // (16.67 + 17.30) / 2 = 16.98
    expect(estimateGestationalAge({ bpd: '35', fl: '', crl: '' }, TODAY))
      .toMatchObject({ weeks: 16, days: 4 });
  });

  it('dates delivery 40 weeks from conception, counted from today', () => {
    // 40 - 16.67 = 23.33 weeks left = 163 days
    const expected = new Date(TODAY);
    expected.setDate(expected.getDate() + 163);
    expect(estimateGestationalAge({ bpd: '35' }, TODAY)!.edd)
      .toBe(expected.toLocaleDateString('en-NG'));
  });
});

describe('dateByBiometry', () => {
  /**
   * The standard rule (ACOG Committee Opinion 700, ISUOG): up to a CRL of
   * 84 mm the crown-rump length dates the pregnancy on its own, being accurate
   * to about five days and better than anything else that early. Past 84 mm it
   * stops measuring age at all, and the pregnancy is dated on a composite of
   * the later biometry. The two are never blended — they describe different
   * halves of a pregnancy.
   */
  it('dates the first trimester by CRL alone, setting the rest aside', () => {
    const dating = dateByBiometry({ crl: '50', bpd: '20', fl: '10' }, TODAY)!;

    expect(dating.method).toBe('CRL');
    expect(dating.used.map(p => p.source)).toEqual(['CRL']);
    expect(dating.ignored.map(p => p.source)).toEqual(['BPD', 'FL']);
    // -0.0006·50² + 0.15·50 + 5.8 = 11.80 weeks, as CRL alone always gave.
    expect(dating).toMatchObject({ weeks: 11, days: 5 });
  });

  it('takes 84 mm as the last CRL that can date a pregnancy', () => {
    expect(dateByBiometry({ crl: String(CRL_DATING_LIMIT_MM), bpd: '85' }, TODAY)!.method)
      .toBe('CRL');
    expect(dateByBiometry({ crl: String(CRL_DATING_LIMIT_MM + 1), bpd: '85' }, TODAY)!.method)
      .toBe('composite');
  });

  /**
   * The case that made this worth changing: a CRL of 50 mm beside a BPD of 85.
   * Both are real measurements — of pregnancies about five months apart — so
   * one of the boxes is a typing slip, and which one is not something any rule
   * can know.
   *
   * The old code averaged them and reported 26 weeks, a gestation belonging to
   * neither reading, with nothing on the screen to show why. The rule now
   * applies as written — CRL is within range, so CRL dates it — and sets the
   * contradicting biometry aside where the screen can name it. The screen then
   * refuses to insert the estimate at all while the two are this far apart,
   * because picking one would be a guess printed as a finding.
   */
  it('dates by CRL within range and sets contradicting biometry aside', () => {
    const dating = dateByBiometry({ bpd: '85', fl: '65', crl: '50' }, TODAY)!;

    expect(dating.method).toBe('CRL');
    expect(dating.used.map(p => p.source)).toEqual(['CRL']);
    expect(dating.ignored.map(p => p.source)).toEqual(['BPD', 'FL']);

    // Never the blend of the two that the old mean produced.
    expect(dating.weeks).not.toBe(26);
    expect(spreadInDays(gestationalAgeByMeasurement({ bpd: '85', fl: '65', crl: '50' })))
      .toBeGreaterThan(SPREAD_WARNING_DAYS);
  });

  it('composites the later biometry once the CRL is past dating range', () => {
    const dating = dateByBiometry({ bpd: '85', fl: '65', crl: '90' }, TODAY)!;

    expect(dating.method).toBe('composite');
    expect(dating.used.map(p => p.source)).toEqual(['BPD', 'FL']);
    expect(dating.ignored.map(p => p.source)).toEqual(['CRL']);
    expect(dating.weeks).toBe(34);
  });

  it('uses an over-range CRL when it is all there is, and says so', () => {
    const dating = dateByBiometry({ crl: '100' }, TODAY)!;

    expect(dating.method).toBe('CRL (beyond dating range)');
    expect(dating.used.map(p => p.source)).toEqual(['CRL']);
    expect(dating.ignored).toEqual([]);
  });

  it('composites BPD and FL when there is no CRL at all', () => {
    const dating = dateByBiometry({ bpd: '35', fl: '24' }, TODAY)!;

    expect(dating.method).toBe('composite');
    expect(dating).toMatchObject({ weeks: 16, days: 6 });
    expect(dating.ignored).toEqual([]);
  });

  it('returns nothing when there is nothing usable', () => {
    expect(dateByBiometry({}, TODAY)).toBeNull();
    expect(dateByBiometry({ bpd: 'abc', crl: '0' }, TODAY)).toBeNull();
  });
});

describe('gestationalAgeByMeasurement', () => {
  it('gives each measurement its own answer and skips the blanks', () => {
    const parts = gestationalAgeByMeasurement({ bpd: '85', fl: '65', crl: '' });
    expect(parts.map(p => p.source)).toEqual(['BPD', 'FL']);
    expect(parts[0]!.weeks).toBeCloseTo(34.87, 1);
    expect(parts[1]!.weeks).toBeCloseTo(33.44, 1);
  });

  it('agrees with the average it is the working for', () => {
    const parts = gestationalAgeByMeasurement({ bpd: '85', fl: '65' });
    const mean = parts.reduce((t, p) => t + p.weeks, 0) / parts.length;
    expect(Math.floor(mean)).toBe(estimateGestationalAge({ bpd: '85', fl: '65' })!.weeks);
  });

  /**
   * The case the mean cannot see. CRL is first-trimester, BPD and FL are
   * second and third, and they do not overlap in a real pregnancy — so a CRL
   * left in the box beside a third-trimester BPD is a stale field, and the
   * average of the two belongs to no gestation at all.
   */
  /**
   * The spread is measured across everything that was typed, which is what
   * lets the screen catch a contradiction the dating rule has already resolved
   * by setting one measurement aside.
   */
  it('measures how far apart a contradictory set of boxes is', () => {
    const measurements = { bpd: '85', fl: '65', crl: '50' };

    expect(spreadInDays(gestationalAgeByMeasurement(measurements)))
      .toBeGreaterThan(SPREAD_WARNING_DAYS);

    // Biometry of one fetus scatters by days, not months.
    expect(spreadInDays(gestationalAgeByMeasurement({ bpd: '85', fl: '65' })))
      .toBeLessThan(SPREAD_WARNING_DAYS);
  });

  it('reports no spread for a single measurement', () => {
    expect(spreadInDays(gestationalAgeByMeasurement({ bpd: '85' }))).toBe(0);
    expect(spreadInDays(gestationalAgeByMeasurement({}))).toBe(0);
  });
});

describe('applyObstetricEstimate', () => {
  const estimate = { weeks: 16, days: 4, edd: '12/02/2027' };

  it('appends EGA and EDD to a report that has neither', () => {
    const next = applyObstetricEstimate(state({ findings: 'Uterus gravid.' }), estimate);
    expect(next.findings).toBe('Uterus gravid.\nEGA: 16 weeks 4 day(s)\nEDD: 12/02/2027');
  });

  it('records the estimate in the measurement fields', () => {
    const next = applyObstetricEstimate(state({ measurements: { bpd: '35' } }), estimate);
    expect(next.measurements).toEqual({ bpd: '35', ega: '16 weeks 4 day(s)', edd: '12/02/2027' });
  });

  it('replaces an existing EGA and EDD line in plain text, leaving the rest', () => {
    const next = applyObstetricEstimate(state({
      findings: 'BPD= 30.8mm\nEGA= x\nEGA: 15weeks 4day(s)\nEDD: 25/03/2023\nCUL-DE-SAC: clear.',
    }), estimate);
    expect(next.findings).toBe(
      'BPD= 30.8mm\nEGA= x\nEGA: 16 weeks 4 day(s)\nEDD: 12/02/2027\nCUL-DE-SAC: clear.');
  });

  it('prepends a conclusion when the impression has no heading', () => {
    const next = applyObstetricEstimate(state({ impression: 'Otherwise normal.' }), estimate);
    expect(next.impression).toBe(
      'IMPRESSION: Single live foetus at 16 weeks 4 day(s) GA.\nEDD: 12/02/2027\n\nOtherwise normal.');
  });

  it('replaces the existing IMPRESSION heading rather than adding another', () => {
    const next = applyObstetricEstimate(state({ impression: 'IMPRESSION: old text.' }), estimate);
    expect(next.impression).toBe('IMPRESSION: Single live foetus at 16 weeks 4 day(s) GA.');
  });

  it('updates BPD and FL only when they were measured', () => {
    const withBoth = applyObstetricEstimate(state({
      findings: 'BPD: 0mm\nFL: 0mm', measurements: { bpd: '35', fl: '24' },
    }), estimate);
    expect(withBoth.findings).toBe(
      'BPD: 35 mm\nFL: 24 mm\nEGA: 16 weeks 4 day(s)\nEDD: 12/02/2027');

    const withNeither = applyObstetricEstimate(state({ findings: 'BPD: 0mm\nFL: 0mm' }), estimate);
    expect(withNeither.findings).toContain('BPD: 0mm');
  });

  /**
   * Regression: the rich-text editor stores the report as HTML with no newlines
   * in it, so a "rest of the line" pattern anchored only on \n used to match to
   * the end of the document and delete everything after the biometry line.
   */
  it('keeps the rest of an HTML report when replacing the biometry line', () => {
    const findings = convertTextToFormattedHtml(
      RADIOLOGY_TEMPLATES['bpd_3_hc_ac_fl_efw_(cephalic)'].findings);
    expect(findings).not.toContain('\n'); // the condition that made this bite

    const next = applyObstetricEstimate(state({ findings }), estimate);

    expect(next.findings).toContain('Gestation age based on BPD, HC and FL is approximately (GA): 16 weeks 4 day(s)');
    expect(next.findings).toContain('FOETAL WEIGHT:');
    // The report grows by the estimate; it does not lose its tail.
    expect(next.findings.length).toBeGreaterThan(findings.length);

    // A separate quirk, characterised rather than fixed: convertTextToFormattedHtml
    // upper-cases the labels, so neither 'EDD:' nor 'Expected date of delivery'
    // matches and the delivery date is appended after the closing tag instead of
    // replacing the line already in the report.
    expect(next.findings).toContain('EXPECTED DATE OF DELIVERY BY USG DD):</u></b> 22/05/2026');
    expect(next.findings.endsWith('\nEDD: 12/02/2027')).toBe(true);
  });

  it('does not run past a tag when replacing inside HTML', () => {
    const next = applyObstetricEstimate(
      state({ findings: '<p>EGA: 15weeks</p><p>CUL-DE-SAC: clear.</p>' }), estimate);
    // The EGA line is replaced in place; the EDD is appended because this
    // fixture has no EDD line to replace.
    expect(next.findings).toBe(
      '<p>EGA: 16 weeks 4 day(s)</p><p>CUL-DE-SAC: clear.</p>\nEDD: 12/02/2027');
  });
});
