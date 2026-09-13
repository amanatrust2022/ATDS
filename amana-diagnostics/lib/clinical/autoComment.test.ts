import { describe, it, expect } from 'vitest';

import { buildAutoComment, mayReplace } from './autoComment';

/**
 * The comment the flags write.
 *
 * The two things it must never do are assert normality it has not checked, and
 * overwrite what a technologist wrote. Everything else is wording.
 */

const row = (
  parameter: string,
  result: string,
  range = '',
  unit = '',
  flag = '',
) => ({ parameter, result, range, unit, flag });

describe('building the comment', () => {
  it('says nothing at all until a result has been entered', () => {
    expect(buildAutoComment([row('Haemoglobin', '', '12-16', 'g/dL')])).toBe('');
    expect(buildAutoComment([])).toBe('');
  });

  it('names a low result with its value and its reference range', () => {
    const comment = buildAutoComment([row('Haemoglobin', '9.1', '12-16', 'g/dL')]);

    expect(comment).toContain('Haemoglobin 9.1 g/dL (reference 12-16) is low.');
  });

  it('says everything is in range when everything is', () => {
    const comment = buildAutoComment([
      row('Sodium', '140', '135-145', 'mmol/L'),
      row('Chloride', '100', '98-107', 'mmol/L'),
    ]);

    expect(comment).toBe('All parameters are within their reference ranges.');
  });

  it('leads with a critical value and says it has to be phoned through', () => {
    const comment = buildAutoComment([
      row('Potassium', '7.1', '3.5-5.2', 'mmol/L'),
      row('Sodium', '140', '135-145', 'mmol/L'),
    ]);

    expect(comment.startsWith('CRITICAL:')).toBe(true);
    expect(comment).toContain('Potassium 7.1 mmol/L (reference 3.5-5.2) is critically high.');
    expect(comment).toContain('informed without delay');
    expect(comment).toContain('The remaining 1 parameter is within its reference range.');
  });

  /**
   * The defect this exists to stop: a parameter whose range cannot be read must
   * not be quietly counted among the ones found to be normal.
   */
  it('names what it could not assess rather than calling it normal', () => {
    const comment = buildAutoComment([
      row('Blood group', 'O+', ''),
      row('Sodium', '140', '135-145', 'mmol/L'),
    ]);

    expect(comment).toContain('Not assessed against a reference range: Blood group');
    expect(comment).not.toContain('All parameters are within');
  });

  it('takes a hand-set flag over the range', () => {
    const comment = buildAutoComment([row('ESR', '30', 'age dependent', 'mm/hr', 'H')]);

    expect(comment).toContain('ESR 30 mm/hr (reference age dependent) is high.');
  });

  it('accepts an explicit normal on a parameter with no readable range', () => {
    const comment = buildAutoComment([row('Urinalysis: Protein', 'Nil', '', '', 'N')]);

    expect(comment).toBe('All parameters are within their reference ranges.');
  });

  it('counts the rest once the list would run long', () => {
    const many = Array.from({ length: 11 }, (_, i) =>
      row(`Analyte ${i + 1}`, '1', '5-10', 'mmol/L'),
    );

    const comment = buildAutoComment(many, { maxNamed: 3 });
    expect(comment).toContain('A further 8 parameters are outside the reference range.');
  });

  it('resolves a sexed range against the patient', () => {
    const female = buildAutoComment([row('Ferritin', '150', 'F: 35-135 / M: 40-160', 'ng/mL')], { sex: 'female' });
    const male = buildAutoComment([row('Ferritin', '150', 'F: 35-135 / M: 40-160', 'ng/mL')], { sex: 'male' });

    expect(female).toContain('is high');
    expect(male).toBe('All parameters are within their reference ranges.');
  });

  it('offers no diagnosis, only what the range says', () => {
    const comment = buildAutoComment([row('Haemoglobin', '6.0', '12-16', 'g/dL')]);

    expect(comment.toLowerCase()).not.toContain('anaem');
    expect(comment.toLowerCase()).not.toContain('transfus');
  });
});

describe('whose words are in the box', () => {
  it('may fill an empty box', () => {
    expect(mayReplace('', 'anything')).toBe(true);
    expect(mayReplace(undefined, null)).toBe(true);
  });

  it('may replace its own previous draft', () => {
    expect(mayReplace('Haemoglobin is low.', 'Haemoglobin is low.')).toBe(true);
  });

  it('never replaces what a person wrote', () => {
    expect(mayReplace('Sample haemolysed; repeat requested.', 'Haemoglobin is low.')).toBe(false);
    expect(mayReplace('Haemoglobin is low. Repeat in 2 weeks.', 'Haemoglobin is low.')).toBe(false);
  });
});
