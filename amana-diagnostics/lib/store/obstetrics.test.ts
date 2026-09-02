import { describe, it, expect } from 'vitest';
import { estimateGestationalAge, applyObstetricEstimate } from './obstetrics';
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

  it('averages whichever measurements are present, ignoring the blanks', () => {
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
