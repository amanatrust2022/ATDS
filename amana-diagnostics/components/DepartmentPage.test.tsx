import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Patient, PatientTest, Test } from '@/lib/store';

/**
 * Characterisation tests for the Lab/Radiology department screen.
 *
 * Written against `components/DepartmentPage.tsx` BEFORE it is split into
 * feature components (Phase 3), and they describe what the technologist sees
 * and what reaches the database. They must keep passing across the split, with
 * nothing changed but import paths.
 *
 * Three earlier extractions in this repo copied state instead of moving it and
 * shipped dead buttons behind a green build. These tests exist so that fails
 * loudly this time.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────
// Everything the page reaches for outside its own render. `@/lib/radiology-templates`
// is deliberately left real: it is pure, and its serialisation is part of what
// we are characterising.

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));

vi.mock('@/components/Header', () => ({
  default: ({ title, subtitle, notifications }: any) => (
    <div data-testid="header">
      <span>{title}</span><span>{subtitle}</span>
      <span data-testid="header-notifications">{notifications}</span>
    </div>
  ),
}));

vi.mock('@/components/TemplateManager', () => ({
  default: ({ isOpen }: any) => (isOpen ? <div data-testid="template-manager" /> : null),
}));

vi.mock('@/components/TestManager', () => ({
  default: ({ restrictDepartment }: any) => (
    <div data-testid="test-manager">{restrictDepartment}</div>
  ),
}));

vi.mock('@/components/RichTextEditor', () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <textarea value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
  ),
}));

const fetchPatients = vi.fn();
const updateTestResult = vi.fn();
const subscribeToPatients = vi.fn();
const fetchCustomTemplates = vi.fn();
const fetchCustomTests = vi.fn();
const setCustomCatalogueCache = vi.fn();
const getTestById = vi.fn();

vi.mock('@/lib/store', () => ({
  fetchPatients: (...a: any[]) => fetchPatients(...a),
  updateTestResult: (...a: any[]) => updateTestResult(...a),
  subscribeToPatients: (...a: any[]) => subscribeToPatients(...a),
  fetchCustomTemplates: (...a: any[]) => fetchCustomTemplates(...a),
  fetchCustomTests: (...a: any[]) => fetchCustomTests(...a),
  setCustomCatalogueCache: (...a: any[]) => setCustomCatalogueCache(...a),
  getTestById: (...a: any[]) => getTestById(...a),
}));

import DepartmentPage, {
  isMcsTest, isWidalTest, isMPsTest,
  serializeMcsResults, deserializeMcsResults,
  serializeWidalResults, deserializeWidalResults,
  serializeMpsResults, deserializeMpsResults,
  type McsFormState, type WidalFormState, type MpsFormState,
} from './DepartmentPage';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const patientTest = (over: Partial<PatientTest> = {}): PatientTest => ({
  id: 'pt-1', testId: 'fbc', testName: 'Full Blood Count',
  department: 'lab', status: 'pending', specimen: 'Whole Blood', ...over,
});

const patient = (over: Partial<Patient> = {}): Patient => ({
  id: 1,
  slipNumber: 'ATD-0001',
  registeredAt: new Date().toISOString(),
  name: 'John Doe',
  firstName: 'John',
  surname: 'Doe',
  age: '35yrs',
  sex: 'Male',
  phone: '08030000000',
  address: 'Kano',
  referredBy: 'Dr. Bello',
  tests: [patientTest()],
  ...over,
});

const testDef = (over: Partial<Test> = {}): Test => ({
  id: 'fbc', name: 'Full Blood Count', department: 'lab',
  category: 'Haematology', specimen: 'Whole Blood',
  parameters: [
    { name: 'Haemoglobin', unit: 'g/dL', range: '12-16' },
    { name: 'WBC', unit: '10^9/L', range: '4-11' },
  ],
  ...over,
});

const renderPage = async (department: 'lab' | 'radiology' = 'lab') => {
  const view = render(<DepartmentPage department={department} />);
  // The queue starts on "Loading queue..." until the first fetch resolves.
  await waitFor(() => expect(screen.queryByText('Loading queue...')).toBeNull());
  return view;
};

beforeEach(() => {
  vi.clearAllMocks();
  authState = {
    profile: { id: 'user-1', full_name: 'MLS Aisha Bello', title: 'MLS', signature_url: 'sig.png' },
    organization: { id: 'org-1', name: 'Amana Diagnostics' },
    signOut: vi.fn(),
  };
  fetchPatients.mockResolvedValue([patient()]);
  fetchCustomTests.mockResolvedValue([]);
  fetchCustomTemplates.mockResolvedValue([]);
  updateTestResult.mockResolvedValue(undefined);
  subscribeToPatients.mockReturnValue(() => {});
  getTestById.mockImplementation((id: string) => (id === 'fbc' ? testDef() : undefined));
});

// ═══════════════════════════════════════════════════════════════════════════
// Pure result serialisation.
//
// This is the on-disk format of a medical result. A change here silently
// rewrites how every stored result is read back, so these assert the exact
// parameter strings, not just a round trip.
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// The screen itself.
// ═══════════════════════════════════════════════════════════════════════════

describe('Department queue', () => {
  it('lists only patients with an unfinished test in this department', async () => {
    fetchPatients.mockResolvedValue([
      patient(),
      patient({
        id: 2, slipNumber: 'ATD-0002', name: 'Jane Smith',
        tests: [patientTest({ id: 'pt-2', testId: 'usg', testName: 'Abdominal Ultrasound', department: 'radiology' })],
      }),
    ]);
    await renderPage('lab');

    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.queryByText('Jane Smith')).toBeNull();
  });

  it('hides a test that is already completed', async () => {
    fetchPatients.mockResolvedValue([
      patient({ tests: [patientTest({ status: 'completed', completedAt: new Date().toISOString() })] }),
    ]);
    await renderPage('lab');

    expect(screen.getByText('No pending requests')).toBeDefined();
    expect(screen.getByText('New patient tests will appear here automatically.')).toBeDefined();
  });

  it('counts only pending tests in the badge, while the list also shows in-progress ones', async () => {
    fetchPatients.mockResolvedValue([
      patient(),
      patient({
        id: 2, slipNumber: 'ATD-0002', name: 'Jane Smith',
        tests: [patientTest({ id: 'pt-2', status: 'in_progress' })],
      }),
    ]);
    await renderPage('lab');

    expect(screen.getByText('1 pending')).toBeDefined();
    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText('Jane Smith')).toBeDefined();
  });

  it('labels a pending test Enter Results and an in-progress one Continue', async () => {
    fetchPatients.mockResolvedValue([
      patient(),
      patient({
        id: 2, slipNumber: 'ATD-0002', name: 'Jane Smith',
        tests: [patientTest({ id: 'pt-2', status: 'in_progress' })],
      }),
    ]);
    await renderPage('lab');

    expect(screen.getByText('Enter Results →')).toBeDefined();
    expect(screen.getByText('Continue')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
  });

  it('titles the page for the department and offers template management only to radiology', async () => {
    const lab = await renderPage('lab');
    expect(screen.getByText('Laboratory')).toBeDefined();
    expect(screen.getByText('Pending Lab Requests')).toBeDefined();
    expect(screen.queryByText(/Manage Templates/)).toBeNull();
    expect(screen.getByText(/Manage Tests/)).toBeDefined();
    lab.unmount();

    fetchPatients.mockResolvedValue([]);
    await renderPage('radiology');
    expect(screen.getByText('Radiology')).toBeDefined();
    expect(screen.getByText('Pending Radiology Requests')).toBeDefined();
    expect(screen.getByText(/Manage Templates/)).toBeDefined();
  });

  it('lists tests finished today, for this department, under Completed Today', async () => {
    fetchPatients.mockResolvedValue([
      patient({
        tests: [
          patientTest({ id: 'pt-1', status: 'completed', completedAt: new Date().toISOString() }),
          patientTest({ id: 'pt-2', testId: 'lft', testName: 'Liver Function Test' }),
        ],
      }),
    ]);
    await renderPage('lab');

    expect(screen.getByText('Completed Today (1)')).toBeDefined();
  });

  it('does not count a test completed on an earlier day as done today', async () => {
    const lastWeek = new Date(Date.now() - 7 * 86400_000).toISOString();
    fetchPatients.mockResolvedValue([
      patient({
        tests: [
          patientTest({ id: 'pt-1', status: 'completed', completedAt: lastWeek }),
          patientTest({ id: 'pt-2', testId: 'lft', testName: 'Liver Function Test' }),
        ],
      }),
    ]);
    await renderPage('lab');

    expect(screen.queryByText(/Completed Today/)).toBeNull();
  });
});

describe('Opening a test for result entry', () => {
  it('shows the patient, slip and specimen in the entry panel header', async () => {
    await renderPage('lab');
    fireEvent.click(screen.getByText('Enter Results →'));

    const panel = (await screen.findByText('Entering Results: Full Blood Count')).parentElement!;
    expect(within(panel).getByText(/John Doe/)).toBeDefined();
    expect(within(panel).getByText(/ATD-0001/)).toBeDefined();
    expect(within(panel).getByText('Whole Blood')).toBeDefined();
  });

  it('claims a pending test by marking it in progress', async () => {
    await renderPage('lab');
    fireEvent.click(screen.getByText('Enter Results →'));

    await waitFor(() =>
      expect(updateTestResult).toHaveBeenCalledWith('pt-1', { status: 'in_progress' }));
  });

  it('does not re-claim a test that is already in progress', async () => {
    fetchPatients.mockResolvedValue([patient({ tests: [patientTest({ status: 'in_progress' })] })]);
    await renderPage('lab');
    fireEvent.click(screen.getByText('Continue'));

    await screen.findByText('Entering Results: Full Blood Count');
    expect(updateTestResult).not.toHaveBeenCalled();
  });

  it('builds one empty row per catalogue parameter', async () => {
    await renderPage('lab');
    fireEvent.click(screen.getByText('Enter Results →'));

    await screen.findByText('Entering Results: Full Blood Count');
    expect(screen.getByText('Haemoglobin')).toBeDefined();
    expect(screen.getByText('WBC')).toBeDefined();
    expect(screen.getAllByPlaceholderText('Enter result')).toHaveLength(2);
  });

  it('reopens a partly-entered test with its saved values', async () => {
    fetchPatients.mockResolvedValue([patient({
      tests: [patientTest({
        status: 'in_progress',
        results: [{ parameter: 'Haemoglobin', result: '9.4', unit: 'g/dL', range: '12-16', flag: 'L' }],
      })],
    })]);
    await renderPage('lab');
    fireEvent.click(screen.getByText('Continue'));

    await screen.findByText('Entering Results: Full Blood Count');
    const inputs = screen.getAllByPlaceholderText('Enter result') as HTMLInputElement[];
    expect(inputs).toHaveLength(1);
    expect(inputs[0].value).toBe('9.4');
  });

  it('pre-fills the professional name from the signed-in profile', async () => {
    await renderPage('lab');
    fireEvent.click(screen.getByText('Enter Results →'));

    await screen.findByText('Entering Results: Full Blood Count');
    expect((screen.getByPlaceholderText('e.g. MLS ABDULLAHI SHEHU') as HTMLInputElement).value)
      .toBe('MLS Aisha Bello');
  });

  it('closes the panel on Cancel without saving', async () => {
    await renderPage('lab');
    fireEvent.click(screen.getByText('Enter Results →'));
    await screen.findByText('Entering Results: Full Blood Count');

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Entering Results: Full Blood Count')).toBeNull();
  });
});

describe('Submitting a result', () => {
  const openFbc = async () => {
    await renderPage('lab');
    fireEvent.click(screen.getByText('Enter Results →'));
    await screen.findByText('Entering Results: Full Blood Count');
    updateTestResult.mockClear();
  };

  it('refuses to save without a professional name', async () => {
    authState.profile = { id: 'user-1' }; // no full_name to pre-fill
    await openFbc();

    fireEvent.click(screen.getByText(/Submit & Send to Reception/));

    expect(await screen.findByText('Please enter your name or staff ID')).toBeDefined();
    expect(updateTestResult).not.toHaveBeenCalled();
  });

  it('sends the results, the signature and the notes, then closes the panel', async () => {
    await openFbc();

    fireEvent.change(screen.getAllByPlaceholderText('Enter result')[0], { target: { value: '9.4' } });
    fireEvent.change(screen.getByPlaceholderText('Additional clinical comments or interpretation...'),
      { target: { value: 'Repeat in 2 weeks' } });
    fireEvent.click(screen.getByText(/Submit & Send to Reception/));

    await waitFor(() => expect(updateTestResult).toHaveBeenCalledTimes(1));
    const [id, payload] = updateTestResult.mock.calls[0];
    expect(id).toBe('pt-1');
    expect(payload.status).toBe('completed');
    expect(payload.completedBy).toBe('MLS Aisha Bello');
    expect(payload.completedBySignatureUrl).toBe('sig.png');
    expect(payload.completedByTitle).toBe('MLS');
    expect(payload.notes).toBe('Repeat in 2 weeks');
    expect(payload.results).toEqual([
      { parameter: 'Haemoglobin', result: '9.4', unit: 'g/dL', range: '12-16', flag: '' },
      { parameter: 'WBC', result: '', unit: '10^9/L', range: '4-11', flag: '' },
    ]);

    expect(await screen.findByText('"Full Blood Count" result sent to reception ✓')).toBeDefined();
    expect(screen.queryByText('Entering Results: Full Blood Count')).toBeNull();
  });

  it('keeps the panel open and reports the reason when the save fails', async () => {
    await openFbc();
    updateTestResult.mockRejectedValueOnce(new Error('network down'));

    fireEvent.click(screen.getByText(/Submit & Send to Reception/));

    expect(await screen.findByText('Failed to save result: network down')).toBeDefined();
    expect(screen.getByText('Entering Results: Full Blood Count')).toBeDefined();
  });
});

describe('Specialised entry forms', () => {
  const openOnly = async (test: PatientTest) => {
    fetchPatients.mockResolvedValue([patient({ tests: [test] })]);
    await renderPage(test.department);
    fireEvent.click(screen.getByText('Enter Results →'));
    await screen.findByText(`Entering Results: ${test.testName}`);
  };

  it('opens the MCS workup for a culture test', async () => {
    await openOnly(patientTest({ testId: 'urine_mcs', testName: 'Urine M/C/S' }));

    expect(screen.getByText('Macroscopy')).toBeDefined();
    expect(screen.getByText('Microscopy')).toBeDefined();
    expect(screen.getByText('Culture Findings')).toBeDefined();
    expect(screen.getByText('Antibiotic Sensitivity Testing (AST)')).toBeDefined();
  });

  it('loads the gram-negative antibiotic panel when gram reaction is set', async () => {
    await openOnly(patientTest({ testId: 'urine_mcs', testName: 'Urine M/C/S' }));

    expect(screen.getByText(/Please select Gram Reaction/)).toBeDefined();
    fireEvent.change(screen.getByDisplayValue('-- Select Reaction --'), { target: { value: 'Gram Negative' } });

    // Each row reads "<antibiotic> (<code>)", and the code differs between panels.
    expect(await screen.findByText('Nitrofurantoin (NF)')).toBeDefined();
    expect(screen.getByText('Ampiclox (ACX)')).toBeDefined();  // gram-negative code
    expect(screen.queryByText('Ampiclox (APX)')).toBeNull();   // gram-positive code
    expect(screen.queryByText(/Erythromycin/)).toBeNull();     // gram-positive only
  });

  it('opens the Widal titre matrix for a Widal test', async () => {
    await openOnly(patientTest({ testId: 'widal', testName: 'Widal Test' }));

    expect(screen.getByText('Salmonella Antigen Titers (Widal Reaction Matrix)')).toBeDefined();
    expect(screen.getByText('S. Typhi')).toBeDefined();
    expect(screen.getByText('S. Paratyphi C')).toBeDefined();
    expect(screen.queryByText('Malaria Parasite (MPs) Microscopy Form')).toBeNull();
  });

  it('opens the MPs form for a malaria test', async () => {
    await openOnly(patientTest({ testId: 'mps', testName: 'Malaria Parasite' }));

    expect(screen.getByText('Malaria Parasite (MPs) Microscopy Form')).toBeDefined();
    expect(screen.queryByText('Salmonella Antigen Titers (Widal Reaction Matrix)')).toBeNull();
  });

  it('stacks both forms for a combined Widal + MPs test', async () => {
    await openOnly(patientTest({ testId: 'widal_mps', testName: 'Widal + MPs' }));

    expect(screen.getByText('Malaria Parasite (MPs) Microscopy Form')).toBeDefined();
    expect(screen.getByText('Salmonella Antigen Titers (Widal Reaction Matrix)')).toBeDefined();
  });

  it('saves a Widal result as the eight antigen rows', async () => {
    await openOnly(patientTest({ testId: 'widal', testName: 'Widal Test' }));
    updateTestResult.mockClear();

    const [typhiO] = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(typhiO, { target: { value: '1:160' } });
    fireEvent.click(screen.getByText(/Submit & Send to Reception/));

    await waitFor(() => expect(updateTestResult).toHaveBeenCalledTimes(1));
    const { results } = updateTestResult.mock.calls[0][1];
    expect(results).toHaveLength(8);
    expect(results[0]).toEqual({ parameter: 'Widal: S. Typhi O', result: '1:160', unit: 'Titer', range: '<1:80' });
  });

  it('gives a radiology test the free-text editor and the template search', async () => {
    getTestById.mockReturnValue(undefined);
    await openOnly(patientTest({
      testId: 'usg', testName: 'Abdominal Ultrasound', department: 'radiology', specimen: '',
    }));

    expect(screen.getByPlaceholderText('Type to search e.g. Appendicitis, Pelvic, Normal...')).toBeDefined();
    expect(screen.getByPlaceholderText('Describe the findings for each organ in detail...')).toBeDefined();
    expect(screen.getByPlaceholderText('Write clinical impression, summary, or suggestions here...')).toBeDefined();
  });

  it('gives a lab test with no catalogue parameters the same free-text editor', async () => {
    getTestById.mockReturnValue(testDef({ id: 'hist', parameters: [] }));
    await openOnly(patientTest({ testId: 'hist', testName: 'Histology Report' }));

    expect(screen.getByPlaceholderText('Describe the findings for each organ in detail...')).toBeDefined();
  });

  it('saves free text as the Findings and Impression rows', async () => {
    getTestById.mockReturnValue(undefined);
    await openOnly(patientTest({
      testId: 'usg', testName: 'Abdominal Ultrasound', department: 'radiology', specimen: '',
    }));
    updateTestResult.mockClear();

    fireEvent.change(screen.getByPlaceholderText('Describe the findings for each organ in detail...'),
      { target: { value: 'Liver normal in size.' } });
    fireEvent.change(screen.getByPlaceholderText('Write clinical impression, summary, or suggestions here...'),
      { target: { value: 'Normal abdominal scan.' } });
    fireEvent.click(screen.getByText(/Submit & Send to Reception/));

    await waitFor(() => expect(updateTestResult).toHaveBeenCalledTimes(1));
    expect(updateTestResult.mock.calls[0][1].results).toEqual([
      { parameter: 'Radiology: Findings', result: 'Liver normal in size.', unit: '', range: '' },
      { parameter: 'Radiology: Impression', result: 'Normal abdominal scan.', unit: '', range: '' },
    ]);
  });
});

describe('Data loading', () => {
  it('pre-caches the custom test catalogue before reading the queue', async () => {
    await renderPage('lab');

    expect(fetchCustomTests).toHaveBeenCalledWith('org-1');
    expect(setCustomCatalogueCache).toHaveBeenCalled();
    expect(fetchPatients).toHaveBeenCalledWith('org-1');
  });

  it('subscribes to patient changes and unsubscribes on unmount', async () => {
    const unsub = vi.fn();
    subscribeToPatients.mockReturnValue(unsub);

    const view = await renderPage('lab');
    expect(subscribeToPatients).toHaveBeenCalledWith('org-1', expect.any(Function));

    view.unmount();
    expect(unsub).toHaveBeenCalled();
  });

  it('loads custom radiology templates only for the radiology department', async () => {
    const lab = await renderPage('lab');
    expect(fetchCustomTemplates).not.toHaveBeenCalled();
    lab.unmount();

    await renderPage('radiology');
    expect(fetchCustomTemplates).toHaveBeenCalledWith('org-1');
  });

  it('still renders the queue when the custom-test pre-cache fails', async () => {
    fetchCustomTests.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await renderPage('lab');
    expect(screen.getByText('John Doe')).toBeDefined();
  });

  it('renders nothing until an organization is known', () => {
    authState.organization = null;
    const { container } = render(<DepartmentPage department="lab" />);
    expect(container.firstChild).toBeNull();
  });
});
