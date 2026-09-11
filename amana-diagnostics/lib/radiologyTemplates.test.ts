import { describe, it, expect } from 'vitest';

import { RADIOLOGY_TEMPLATES } from './radiology-templates';

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
