import { describe, expect, it } from 'vitest';
import { flattenTestParameters } from './catalogue';

describe('flattenTestParameters', () => {
  it('qualifies sub-parameters for consistent result entry and reports', () => {
    expect(flattenTestParameters([{
      name: 'White cell differential', unit: '', range: '',
      children: [
        { name: 'Neutrophils', unit: '%', range: '40-75' },
        { name: 'Lymphocytes', unit: '%', range: '20-45' },
      ],
    }])).toEqual([
      { name: 'White cell differential — Neutrophils', unit: '%', range: '40-75', children: undefined },
      { name: 'White cell differential — Lymphocytes', unit: '%', range: '20-45', children: undefined },
    ]);
  });
});
