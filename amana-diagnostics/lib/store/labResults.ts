/**
 * Lab result formats: which specialised workup a test needs, and how each one
 * is written to and read back from `patient_tests.results`.
 *
 * This is the on-disk format of a medical result. Every stored result is read
 * back through the deserialisers here, and the report/slip renderers match on
 * the same prefixes, so a change to a parameter string rewrites history rather
 * than just the form. `lib/store/labResults.test.ts` pins the exact strings.
 *
 * Pure by design (AGENTS.md §5): no React, no store, no I/O.
 */

export interface ResultRow {
  parameter: string;
  result: string;
  unit: string;
  range: string;
  flag?: string;
}

// ── Option lists shown by the MCS form ───────────────────────────────────────

export const colourOptions = ['Yellow', 'Amber', 'Pale Yellow', 'Straw', 'Colourless', 'Turbid Yellow', 'Bloody', 'Brown', 'Green'];
export const appearanceOptions = ['Clear', 'Turbid', 'Slightly Turbid', 'Cloudy', 'Mucus-containing', 'Bloody'];
export const microscopyDefaults = ['Pus Cells', 'Epithelial Cells', 'RBCs', 'Yeast Cells', 'Trichomonas vaginalis', 'Bacteria', 'Casts', 'Crystals', 'Ova', 'Trophozoites'];
export const growthOptions = ['Growth', 'No Growth', 'Sterile', 'Scanty Growth', 'Moderate Growth', 'Heavy Growth'];
export const degreeOptions = ['Heavy', 'Moderate', 'Scanty', 'Nil'];
export const shapeOptions = ['Cocci', 'Bacilli', 'Coccobacilli', 'Yeast-like cells', 'Nil'];

export const GRAM_POSITIVE_ANTIBIOTICS = [
  { antibiotic: 'Rocephin', code: 'R' },
  { antibiotic: 'Ciprofloxacin', code: 'CPX' },
  { antibiotic: 'Azithromycin', code: 'AZ' },
  { antibiotic: 'Levofloxacin', code: 'LEV' },
  { antibiotic: 'Erythromycin', code: 'E' },
  { antibiotic: 'Pefloxacin', code: 'PEF' },
  { antibiotic: 'Gentamycin', code: 'CN' },
  { antibiotic: 'Ampiclox', code: 'APX' },
  { antibiotic: 'Zinnacef', code: 'Z' },
  { antibiotic: 'Amoxacillin', code: 'AM' }
];

export const GRAM_NEGATIVE_ANTIBIOTICS = [
  { antibiotic: 'Amoxicillin Clavulanate', code: 'AUG' },
  { antibiotic: 'Cefotaxime', code: 'CTX' },
  { antibiotic: 'Imipenem/Cilastatin', code: 'IMP' },
  { antibiotic: 'Nitrofurantoin', code: 'NF' },
  { antibiotic: 'Cefuroxime', code: 'CXM' },
  { antibiotic: 'Ceftriaxone Sulbactam', code: 'CRO' },
  { antibiotic: 'Ofloxacin', code: 'OFX' },
  { antibiotic: 'Gentamycin', code: 'GN' },
  { antibiotic: 'Nalidixic Acid', code: 'NA' },
  { antibiotic: 'Ampiclox', code: 'ACX' },
  { antibiotic: 'Cefexime', code: 'ZEM' },
  { antibiotic: 'Levofloxacin', code: 'LBC' }
];

// ── Which workup does a test need? ───────────────────────────────────────────
// Matching is deliberately loose: the catalogue is edited per organisation, so
// these read the test name as well as its id.

export function isMcsTest(testId: string, testName: string) {
  const id = testId.toLowerCase();
  const name = testName.toLowerCase();
  return id.endsWith('_mcs') || id.includes('mcs') || id === 'sfmcs' || name.includes('mcs') || name.includes('culture & sensitivity') || name.includes('culture and sensitivity');
}

export function isWidalTest(testId: string, testName: string) {
  const id = testId.toLowerCase();
  const name = testName.toLowerCase();
  return id === 'widal' || id.includes('widal') || name.includes('widal');
}

export function isMPsTest(testId: string, testName: string) {
  const id = testId.toLowerCase();
  const name = testName.toLowerCase();
  return (
    id === 'mps' ||
    id === 'mp' ||
    id.includes('mps') ||
    id.startsWith('mp_') ||
    id.includes('_mp') ||
    name.includes('mps') ||
    name.includes('mp ') ||
    name.includes('mp+') ||
    name.includes('mp +') ||
    name.includes('malaria parasite') ||
    name.includes('malaria film') ||
    name.includes('malaria')
  );
}

// ── Microscopy, culture & sensitivity ────────────────────────────────────────

export interface McsFormState {
  macroscopy: {
    colour: string;
    appearance: string;
  };
  microscopy: { parameter: string; value: string }[];
  culture: {
    growth: string;
    organism: string;
    degree: string;
    gramReaction: string;
    shape: string;
    incubationPeriod: string;
    incubationTemperature: string;
  };
  sensitivity: { antibiotic: string; code: string; result: 'S' | 'I' | 'R' | '' }[];
}

/** A blank MCS workup, as a technologist sees it on first opening the test. */
export const emptyMcsState = (): McsFormState => ({
  macroscopy: { colour: 'Yellow', appearance: 'Clear' },
  microscopy: [
    { parameter: 'Pus Cells', value: '' },
    { parameter: 'Epithelial Cells', value: '' },
    { parameter: 'RBCs', value: '' }
  ],
  culture: {
    growth: 'Growth',
    organism: '',
    degree: '',
    gramReaction: '',
    shape: '',
    incubationPeriod: '24 hours',
    incubationTemperature: '37°C'
  },
  sensitivity: []
});

/** No growth means there is nothing to identify and nothing to test against. */
export const isNoGrowth = (growth: string) =>
  ['no growth', 'sterile', 'no-growth'].includes(growth.trim().toLowerCase());

export const serializeMcsResults = (mcsState: McsFormState) => {
  const resultsList: ResultRow[] = [];

  resultsList.push({ parameter: 'Macroscopy: Colour', result: mcsState.macroscopy.colour, unit: '', range: '' });
  resultsList.push({ parameter: 'Macroscopy: Appearance', result: mcsState.macroscopy.appearance, unit: '', range: '' });

  mcsState.microscopy.forEach(m => {
    if (m.parameter.trim()) {
      resultsList.push({ parameter: `Microscopy: ${m.parameter}`, result: m.value, unit: '', range: '' });
    }
  });

  resultsList.push({ parameter: 'Culture: Growth', result: mcsState.culture.growth, unit: '', range: '' });
  if (!isNoGrowth(mcsState.culture.growth)) {
    resultsList.push({ parameter: 'Culture: Organism', result: mcsState.culture.organism, unit: '', range: '' });
    resultsList.push({ parameter: 'Culture: Degree', result: mcsState.culture.degree, unit: '', range: '' });
    resultsList.push({ parameter: 'Culture: Gram Reaction', result: mcsState.culture.gramReaction, unit: '', range: '' });
    resultsList.push({ parameter: 'Culture: Shape', result: mcsState.culture.shape, unit: '', range: '' });
    resultsList.push({ parameter: 'Culture: Incubation Period', result: mcsState.culture.incubationPeriod, unit: '', range: '' });
    resultsList.push({ parameter: 'Culture: Incubation Temperature', result: mcsState.culture.incubationTemperature, unit: '', range: '' });

    mcsState.sensitivity.forEach(s => {
      if (s.result) {
        resultsList.push({
          parameter: `Sensitivity: ${s.antibiotic} (${s.code})`,
          result: s.result,
          unit: '',
          range: ''
        });
      }
    });
  }

  return resultsList;
};

export const deserializeMcsResults = (results: any[]): McsFormState => {
  const mcsState: McsFormState = {
    macroscopy: { colour: '', appearance: '' },
    microscopy: [],
    culture: {
      growth: '',
      organism: '',
      degree: '',
      gramReaction: '',
      shape: '',
      incubationPeriod: '24 hours',
      incubationTemperature: '37°C'
    },
    sensitivity: []
  };

  results.forEach(r => {
    const param = r.parameter;
    const val = r.result;

    if (param.startsWith('Macroscopy: ')) {
      const field = param.replace('Macroscopy: ', '');
      if (field === 'Colour') mcsState.macroscopy.colour = val;
      if (field === 'Appearance') mcsState.macroscopy.appearance = val;
    } else if (param.startsWith('Microscopy: ')) {
      const pName = param.replace('Microscopy: ', '');
      mcsState.microscopy.push({ parameter: pName, value: val });
    } else if (param.startsWith('Culture: ')) {
      const field = param.replace('Culture: ', '');
      if (field === 'Growth') mcsState.culture.growth = val;
      if (field === 'Organism') mcsState.culture.organism = val;
      if (field === 'Degree') mcsState.culture.degree = val;
      if (field === 'Gram Reaction') mcsState.culture.gramReaction = val;
      if (field === 'Shape') mcsState.culture.shape = val;
      if (field === 'Incubation Period') mcsState.culture.incubationPeriod = val;
      if (field === 'Incubation Temperature') mcsState.culture.incubationTemperature = val;
    } else if (param.startsWith('Sensitivity: ')) {
      const match = param.match(/Sensitivity:\s+(.+)\s+\((.+)\)/);
      if (match) {
        const antibiotic = match[1];
        const code = match[2];
        mcsState.sensitivity.push({ antibiotic, code, result: val });
      }
    }
  });

  if (mcsState.microscopy.length === 0) {
    mcsState.microscopy = [
      { parameter: 'Pus Cells', value: '' },
      { parameter: 'Epithelial Cells', value: '' },
      { parameter: 'RBCs', value: '' }
    ];
  }

  return mcsState;
};

// ── Widal ────────────────────────────────────────────────────────────────────

export interface WidalFormState {
  typhiO: string;
  typhiH: string;
  paratyphiAO: string;
  paratyphiAH: string;
  paratyphiBO: string;
  paratyphiBH: string;
  paratyphiCO: string;
  paratyphiCH: string;
}

export const emptyWidalState = (): WidalFormState => ({
  typhiO: 'Negative', typhiH: 'Negative',
  paratyphiAO: 'Negative', paratyphiAH: 'Negative',
  paratyphiBO: 'Negative', paratyphiBH: 'Negative',
  paratyphiCO: 'Negative', paratyphiCH: 'Negative',
});

export const serializeWidalResults = (widalState: WidalFormState) => {
  return [
    { parameter: 'Widal: S. Typhi O', result: widalState.typhiO || 'Negative', unit: 'Titer', range: '<1:80' },
    { parameter: 'Widal: S. Typhi H', result: widalState.typhiH || 'Negative', unit: 'Titer', range: '<1:80' },
    { parameter: 'Widal: S. Paratyphi A O', result: widalState.paratyphiAO || 'Negative', unit: 'Titer', range: '<1:80' },
    { parameter: 'Widal: S. Paratyphi A H', result: widalState.paratyphiAH || 'Negative', unit: 'Titer', range: '<1:80' },
    { parameter: 'Widal: S. Paratyphi B O', result: widalState.paratyphiBO || 'Negative', unit: 'Titer', range: '<1:80' },
    { parameter: 'Widal: S. Paratyphi B H', result: widalState.paratyphiBH || 'Negative', unit: 'Titer', range: '<1:80' },
    { parameter: 'Widal: S. Paratyphi C O', result: widalState.paratyphiCO || 'Negative', unit: 'Titer', range: '<1:80' },
    { parameter: 'Widal: S. Paratyphi C H', result: widalState.paratyphiCH || 'Negative', unit: 'Titer', range: '<1:80' },
  ];
};

export const deserializeWidalResults = (results: any[]): WidalFormState => {
  const state = emptyWidalState();
  results.forEach(r => {
    const param = r.parameter;
    const val = r.result;
    if (param === 'Widal: S. Typhi O') state.typhiO = val;
    if (param === 'Widal: S. Typhi H') state.typhiH = val;
    if (param === 'Widal: S. Paratyphi A O') state.paratyphiAO = val;
    if (param === 'Widal: S. Paratyphi A H') state.paratyphiAH = val;
    if (param === 'Widal: S. Paratyphi B O') state.paratyphiBO = val;
    if (param === 'Widal: S. Paratyphi B H') state.paratyphiBH = val;
    if (param === 'Widal: S. Paratyphi C O') state.paratyphiCO = val;
    if (param === 'Widal: S. Paratyphi C H') state.paratyphiCH = val;
  });
  return state;
};

// ── Malaria parasites ────────────────────────────────────────────────────────

export interface MpsFormState {
  parasiteSeen: 'Seen' | 'Not Seen' | '';
  densityPlus: '+' | '++' | '+++' | '++++' | 'Nil' | '';
  densityCount: string;
  species: string;
  stage: string;
  comment: string;
}

export const emptyMpsState = (): MpsFormState => ({
  parasiteSeen: 'Not Seen',
  densityPlus: 'Nil',
  densityCount: 'Nil',
  species: 'Nil',
  stage: 'Nil',
  comment: 'Nil'
});

export const serializeMpsResults = (mpsState: MpsFormState) => {
  return [
    { parameter: 'MPs: Parasites', result: mpsState.parasiteSeen || 'Not Seen', unit: '', range: 'Not Seen' },
    { parameter: 'MPs: Density (Plus)', result: mpsState.densityPlus || 'Nil', unit: '', range: 'Nil' },
    { parameter: 'MPs: Density (Count)', result: mpsState.densityCount || 'Nil', unit: 'p/µL', range: 'Nil' },
    { parameter: 'MPs: Species', result: mpsState.species || 'Nil', unit: '', range: '' },
    { parameter: 'MPs: Stage', result: mpsState.stage || 'Nil', unit: '', range: '' },
    { parameter: 'MPs: Comment', result: mpsState.comment || 'Nil', unit: '', range: '' },
  ];
};

export const deserializeMpsResults = (results: any[]): MpsFormState => {
  const state = emptyMpsState();
  results.forEach(r => {
    const param = r.parameter;
    const val = r.result;
    if (param === 'MPs: Parasites') state.parasiteSeen = val as any;
    if (param === 'MPs: Density (Plus)') state.densityPlus = val as any;
    if (param === 'MPs: Density (Count)') state.densityCount = val;
    if (param === 'MPs: Species') state.species = val;
    if (param === 'MPs: Stage') state.stage = val;
    if (param === 'MPs: Comment') state.comment = val;
  });
  return state;
};

/**
 * The rows a Widal/MPs test carries that belong to neither matrix — extra
 * catalogue parameters the organisation attached to the same test.
 */
export const stripMatrixRows = <T extends { parameter: string }>(rows: T[]): T[] =>
  rows.filter(r => !r.parameter.startsWith('Widal:') && !r.parameter.startsWith('MPs:'));
