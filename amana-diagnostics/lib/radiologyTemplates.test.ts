import { describe, it, expect } from 'vitest';

import {
  RADIOLOGY_TEMPLATES,
  splitTemplateContent,
  stripImpressionHeading,
} from './radiology-templates';

/**
 * The canned radiology reports a radiographer picks from.
 *
 * These were transcribed from printed reports, and three of them had the
 * clinic's letterhead line pasted in at the top of the findings —
 * "AND CLINICAL SERVICES LIMITED" sitting where the first organ should be. It
 * would have printed inside the clinical findings of every report written from
 * those three templates.
 *
 * The point of this file is that the next paste cannot bring it back.
 */
describe('Canned radiology templates', () => {
  const entries = Object.entries(RADIOLOGY_TEMPLATES);

  it('has templates to check', () => {
    expect(entries.length).toBeGreaterThan(100);
  });

  it('carries no letterhead text in the findings', () => {
    // The letterhead is drawn by the print template around the report. Any of
    // it inside the findings is transcription residue.
    const letterhead =
      /clinical services|diagnostic centre|tudun wada|nasarawa lga|\bltd\b|\blimited\b|tel[:.]?\s*0\d{6,}/i;

    for (const [key, t] of entries) {
      expect(
        letterhead.test(t.findings),
        `${key}: findings contain letterhead text — "${t.findings.slice(0, 60)}"`,
      ).toBe(false);
      expect(
        letterhead.test(t.impression),
        `${key}: impression contains letterhead text`,
      ).toBe(false);
    }
  });

  it('opens every report with something', () => {
    for (const [key, t] of entries) {
      const first = t.findings.split('\n')[0]!.trim();
      expect(first.length, `${key}: findings start with a blank line`).toBeGreaterThan(0);
    }
  });

  /**
   * Sections read "URINARY BLADDER:", never ":URINARY BLADDER:". 183 of them
   * carried a colon in front of the heading — the same transcription residue as
   * the letterhead, just spread wider.
   */
  it('opens no line with a stray colon', () => {
    for (const [key, t] of entries) {
      for (const text of [t.findings, t.impression]) {
        for (const line of text.split('\n')) {
          expect(line.trimStart().startsWith(':'), `${key}: line opens with a colon — "${line.slice(0, 40)}"`).toBe(false);
        }
      }
    }
  });

  it('gives every template a name', () => {
    for (const [key, t] of entries) {
      expect(t.name?.trim(), `${key} has no name`).toBeTruthy();
    }
  });

  /**
   * A template with no impression hands the radiographer findings and no
   * conclusion. One of these is missing one. Writing it is a clinical
   * judgement, not a refactor, so it is recorded here rather than invented —
   * and the list must not grow in the meantime.
   */
  it('has only the one template still missing its impression', () => {
    const missing = entries.filter(([, t]) => !t.impression?.trim()).map(([k]) => k);
    expect(missing).toEqual(['enteritis']);
  });
});

/**
 * The impression prints inside a section headed "IMPRESSION / CONCLUSION:",
 * and almost every template's own text began with the same word — which is how
 * the impression was identified in the first place. The result was the word
 * printed twice, one line under the other, on every scan report issued.
 */
describe('taking the heading off an impression', () => {
  it('removes the word the section is already called', () => {
    expect(stripImpressionHeading('IMPRESSION: Normal pelvic scan.')).toBe('Normal pelvic scan.');
    expect(stripImpressionHeading('CONCLUSION - Fetal demise.')).toBe('Fetal demise.');
    expect(stripImpressionHeading('IMPRESSION:The USS features are suggestive of X.'))
      .toBe('The USS features are suggestive of X.');
  });

  it('handles the spellings templates actually use', () => {
    expect(stripImpressionHeading('CLINICAL IMPRESSION: A')).toBe('A');
    expect(stripImpressionHeading('IMPRESSIONS: A')).toBe('A');
    expect(stripImpressionHeading('Conclusions: A')).toBe('A');
    expect(stripImpressionHeading('SUMMARY: A')).toBe('A');
    expect(stripImpressionHeading('IMPRESSION\nA')).toBe('A');
  });

  it('reaches the word through the formatting an imported template wraps it in', () => {
    expect(stripImpressionHeading('<p><b><u>IMPRESSION:</u></b> Normal study.</p>'))
      .toBe('<p> Normal study.</p>');
    // ...and does not leave an empty paragraph where a standalone heading was.
    expect(stripImpressionHeading('<p><b><u>IMPRESSION:</u></b></p><p>Normal study.</p>'))
      .toBe('<p>Normal study.</p>');
  });

  it('leaves the radiologist’s own words alone', () => {
    expect(stripImpressionHeading('No conclusion can be drawn without contrast.'))
      .toBe('No conclusion can be drawn without contrast.');
    expect(stripImpressionHeading('Findings are in keeping with the clinical impression given.'))
      .toBe('Findings are in keeping with the clinical impression given.');
    expect(stripImpressionHeading('')).toBe('');
    expect(stripImpressionHeading(null)).toBe('');
  });

  it('is applied to every built-in template', () => {
    const leftOver = Object.entries(RADIOLOGY_TEMPLATES).filter(
      ([, t]) => /^\s*(?:CLINICAL\s+)?(?:IMPRESSIONS?|CONCLUSIONS?|SUMMARY)\b/i
        .test(stripImpressionHeading(t.impression)),
    );
    expect(leftOver.map(([key]) => key)).toEqual([]);
  });
});

describe('splitting an imported report into findings and impression', () => {
  it('finds the impression by its keyword and then drops the keyword', () => {
    const { findings, impression } = splitTemplateContent(
      'ORGANS:\nLiver is normal.\n\nIMPRESSION: Normal abdominal scan.',
    );

    expect(findings).toContain('Liver is normal.');
    expect(impression).toBe('Normal abdominal scan.');
  });

  it('does the same for an HTML import', () => {
    const { impression } = splitTemplateContent(
      '<p>Liver is normal.</p><p><b>CONCLUSION:</b> Normal abdominal scan.</p>',
    );

    expect(impression).not.toMatch(/CONCLUSION/i);
    expect(impression).toContain('Normal abdominal scan.');
  });

  it('leaves everything as findings when there is no impression keyword', () => {
    const { findings, impression } = splitTemplateContent('Liver is normal.');
    expect(findings).toBe('Liver is normal.');
    expect(impression).toBe('');
  });
});
