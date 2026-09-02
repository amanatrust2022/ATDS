import { describe, it, expect } from 'vitest';
import { patientDisplayName } from './patientName';

/**
 * `patients.name` is a real column, but for a long time only `update()` wrote
 * it — registration did not. Every patient therefore showed a blank name in the
 * queue until someone edited them. Registration writes it now, but rows created
 * before that fix still have it empty, so the fallback has to stay.
 */
describe('patientDisplayName', () => {
  it('uses the stored name when there is one', () => {
    expect(patientDisplayName({
      name: 'Aisha B. Musa', firstName: 'Aisha', middleName: 'Bello', surname: 'Musa',
    })).toBe('Aisha B. Musa');
  });

  it('falls back to the parts for a row saved before the name was written', () => {
    expect(patientDisplayName({
      name: '', firstName: 'Aisha', middleName: 'Bello', surname: 'Musa',
    })).toBe('Aisha Bello Musa');
  });

  it('skips a missing middle name rather than leaving a double space', () => {
    expect(patientDisplayName({ name: '', firstName: 'Aisha', surname: 'Musa' } as any))
      .toBe('Aisha Musa');
  });

  it('returns an empty string rather than "undefined" when nothing is known', () => {
    expect(patientDisplayName({} as any)).toBe('');
  });
});
