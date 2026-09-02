import { describe, it, expect } from 'vitest';
import {
  isMcsTest, isWidalTest, isMPsTest,
  serializeMcsResults, deserializeMcsResults,
  serializeWidalResults, deserializeWidalResults,
  serializeMpsResults, deserializeMpsResults,
  emptyMcsState, emptyWidalState, emptyMpsState, isNoGrowth, stripMatrixRows,
  type McsFormState, type WidalFormState, type MpsFormState,
} from './labResults';

/**
 * Characterisation tests for the on-disk format of a medical result.
 *
 * Written against `components/DepartmentPage.tsx` before these functions moved
 * here, and re-run unchanged afterwards. The exact parameter strings are
 * asserted, not just a round trip: the report and slip renderers match on the
 * same prefixes, so renaming one rewrites how stored results are read back.
 */

describe('Test-type detection', () => {
  it('recognises MCS by id suffix, embedded id, or name', () => {
    expect(isMcsTest('urine_mcs', 'Urine M/C/S')).toBe(true);
    expect(isMcsTest('sfmcs', 'Stool')).toBe(true);
    expect(isMcsTest('hvs', 'Culture & Sensitivity')).toBe(true);
    expect(isMcsTest('hvs', 'Culture and Sensitivity')).toBe(true);
    expect(isMcsTest('fbc', 'Full Blood Count')).toBe(false);
  });

  it('recognises Widal by id or name', () => {
    expect(isWidalTest('widal', 'Widal Test')).toBe(true);
    expect(isWidalTest('typhoid_widal', 'Typhoid Screen')).toBe(true);
    expect(isWidalTest('fbc', 'Full Blood Count')).toBe(false);
  });

  it('recognises MPs by id or by any mention of malaria', () => {
    expect(isMPsTest('mps', 'MPs')).toBe(true);
    expect(isMPsTest('mp', 'Blood Film')).toBe(true);
    expect(isMPsTest('x', 'Malaria Parasite')).toBe(true);
    expect(isMPsTest('x', 'Malaria Film')).toBe(true);
    expect(isMPsTest('fbc', 'Full Blood Count')).toBe(false);
  });

  it('treats a combined Widal + MPs test as both', () => {
    expect(isWidalTest('widal_mps', 'Widal + MPs')).toBe(true);
    expect(isMPsTest('widal_mps', 'Widal + MPs')).toBe(true);
  });
});

describe('MCS serialisation', () => {
  const state = (over: Partial<McsFormState> = {}): McsFormState => ({
    macroscopy: { colour: 'Amber', appearance: 'Turbid' },
    microscopy: [
      { parameter: 'Pus Cells', value: '5-10/hpf' },
      { parameter: 'RBCs', value: 'Nil' },
    ],
    culture: {
      growth: 'Growth', organism: 'Escherichia coli', degree: 'Heavy',
      gramReaction: 'Gram Negative', shape: 'Bacilli',
      incubationPeriod: '24 hours', incubationTemperature: '37°C',
    },
    sensitivity: [
      { antibiotic: 'Ofloxacin', code: 'OFX', result: 'S' },
      { antibiotic: 'Gentamycin', code: 'GN', result: '' },
    ],
    ...over,
  });

  it('writes macroscopy, microscopy and culture under prefixed parameter names', () => {
    const rows = serializeMcsResults(state());
    expect(rows.map(r => r.parameter)).toEqual([
      'Macroscopy: Colour',
      'Macroscopy: Appearance',
      'Microscopy: Pus Cells',
      'Microscopy: RBCs',
      'Culture: Growth',
      'Culture: Organism',
      'Culture: Degree',
      'Culture: Gram Reaction',
      'Culture: Shape',
      'Culture: Incubation Period',
      'Culture: Incubation Temperature',
      'Sensitivity: Ofloxacin (OFX)',
    ]);
  });

  it('omits an antibiotic that was never scored', () => {
    const rows = serializeMcsResults(state());
    expect(rows.find(r => r.parameter.includes('Gentamycin'))).toBeUndefined();
  });

  it('skips a microscopy row whose parameter is blank', () => {
    const rows = serializeMcsResults(state({
      microscopy: [{ parameter: '  ', value: 'orphaned' }, { parameter: 'Casts', value: 'Nil' }],
    }));
    expect(rows.filter(r => r.parameter.startsWith('Microscopy: ')).map(r => r.parameter))
      .toEqual(['Microscopy: Casts']);
  });

  it.each(['No Growth', 'Sterile', 'no growth'])(
    'drops organism, degree and the whole antibiogram when growth is %s',
    growth => {
      const rows = serializeMcsResults(state({ culture: { ...state().culture, growth } }));
      expect(rows.map(r => r.parameter)).toContain('Culture: Growth');
      expect(rows.some(r => r.parameter.startsWith('Culture: Organism'))).toBe(false);
      expect(rows.some(r => r.parameter.startsWith('Sensitivity: '))).toBe(false);
    },
  );

  it('round-trips a growth result back into form state', () => {
    const back = deserializeMcsResults(serializeMcsResults(state()));
    expect(back.macroscopy).toEqual({ colour: 'Amber', appearance: 'Turbid' });
    expect(back.microscopy).toEqual([
      { parameter: 'Pus Cells', value: '5-10/hpf' },
      { parameter: 'RBCs', value: 'Nil' },
    ]);
    expect(back.culture.organism).toBe('Escherichia coli');
    expect(back.culture.gramReaction).toBe('Gram Negative');
    expect(back.sensitivity).toEqual([{ antibiotic: 'Ofloxacin', code: 'OFX', result: 'S' }]);
  });

  it('seeds the three default microscopy rows when a stored result has none', () => {
    expect(deserializeMcsResults([]).microscopy).toEqual([
      { parameter: 'Pus Cells', value: '' },
      { parameter: 'Epithelial Cells', value: '' },
      { parameter: 'RBCs', value: '' },
    ]);
  });

  it('defaults incubation period and temperature when absent from the stored result', () => {
    const back = deserializeMcsResults([]);
    expect(back.culture.incubationPeriod).toBe('24 hours');
    expect(back.culture.incubationTemperature).toBe('37°C');
  });
});

describe('Widal serialisation', () => {
  const state: WidalFormState = {
    typhiO: '1:160', typhiH: '1:80',
    paratyphiAO: 'Negative', paratyphiAH: 'Negative',
    paratyphiBO: 'Negative', paratyphiBH: '1:40',
    paratyphiCO: 'Negative', paratyphiCH: 'Negative',
  };

  it('always writes all eight antigen rows, titre-typed with a <1:80 range', () => {
    const rows = serializeWidalResults(state);
    expect(rows).toHaveLength(8);
    expect(rows.every(r => r.unit === 'Titer' && r.range === '<1:80')).toBe(true);
    expect(rows[0]).toEqual({ parameter: 'Widal: S. Typhi O', result: '1:160', unit: 'Titer', range: '<1:80' });
  });

  it('substitutes Negative for an empty titre', () => {
    const rows = serializeWidalResults({ ...state, typhiO: '' });
    expect(rows[0].result).toBe('Negative');
  });

  it('round-trips, and defaults every antigen to Negative when nothing is stored', () => {
    expect(deserializeWidalResults(serializeWidalResults(state))).toEqual(state);
    expect(deserializeWidalResults([])).toEqual({
      typhiO: 'Negative', typhiH: 'Negative',
      paratyphiAO: 'Negative', paratyphiAH: 'Negative',
      paratyphiBO: 'Negative', paratyphiBH: 'Negative',
      paratyphiCO: 'Negative', paratyphiCH: 'Negative',
    });
  });
});

describe('MPs serialisation', () => {
  const state: MpsFormState = {
    parasiteSeen: 'Seen', densityPlus: '++', densityCount: '240',
    species: 'P. falciparum', stage: 'Trophozoite', comment: 'Normocytic RBCs',
  };

  it('writes the six MPs rows in a fixed order', () => {
    expect(serializeMpsResults(state).map(r => r.parameter)).toEqual([
      'MPs: Parasites',
      'MPs: Density (Plus)',
      'MPs: Density (Count)',
      'MPs: Species',
      'MPs: Stage',
      'MPs: Comment',
    ]);
  });

  it('fills blanks with Not Seen / Nil rather than leaving them empty', () => {
    const rows = serializeMpsResults({
      parasiteSeen: '', densityPlus: '', densityCount: '', species: '', stage: '', comment: '',
    });
    expect(rows.map(r => r.result)).toEqual(['Not Seen', 'Nil', 'Nil', 'Nil', 'Nil', 'Nil']);
  });

  it('round-trips', () => {
    expect(deserializeMpsResults(serializeMpsResults(state))).toEqual(state);
  });
});

describe('Blank workups', () => {
  it('opens an MCS test on Growth, so the antibiogram is offered', () => {
    const blank = emptyMcsState();
    expect(blank.culture.growth).toBe('Growth');
    expect(isNoGrowth(blank.culture.growth)).toBe(false);
    expect(blank.macroscopy).toEqual({ colour: 'Yellow', appearance: 'Clear' });
    expect(blank.microscopy.map(m => m.parameter)).toEqual(['Pus Cells', 'Epithelial Cells', 'RBCs']);
    expect(blank.sensitivity).toEqual([]);
  });

  it('opens Widal with every antigen Negative and MPs with nothing seen', () => {
    expect(Object.values(emptyWidalState()).every(v => v === 'Negative')).toBe(true);
    expect(emptyMpsState()).toEqual({
      parasiteSeen: 'Not Seen', densityPlus: 'Nil', densityCount: 'Nil',
      species: 'Nil', stage: 'Nil', comment: 'Nil',
    });
  });

  it('treats no growth, sterile and no-growth alike, whatever the casing', () => {
    ['No Growth', 'sterile', 'no-growth', '  NO GROWTH  '].forEach(g =>
      expect(isNoGrowth(g)).toBe(true));
    ['Growth', 'Scanty Growth', 'Heavy Growth', ''].forEach(g =>
      expect(isNoGrowth(g)).toBe(false));
  });
});

describe('stripMatrixRows', () => {
  it('keeps only the rows that belong to neither matrix', () => {
    expect(stripMatrixRows([
      { parameter: 'Widal: S. Typhi O' },
      { parameter: 'MPs: Parasites' },
      { parameter: 'PCV' },
    ])).toEqual([{ parameter: 'PCV' }]);
  });
});
