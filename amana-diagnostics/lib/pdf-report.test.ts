import { describe, expect, it } from 'vitest';

import { buildReportPdfDefinition } from './pdf-report';
import type { Patient, PatientTest } from './store';

describe('PDF report signatory', () => {
  it('prints both the signatory name and title', () => {
    const completed = {
      id: 'test-1',
      testId: 'fbc',
      testName: 'Full Blood Count',
      department: 'lab',
      status: 'completed',
      completedBy: 'Dr. Aisha Bello',
      completedByTitle: 'Medical Director',
      completedBySignatureUrl: 'data:image/png;base64,c2ln',
      results: [],
    } satisfies PatientTest;
    const patient = {
      id: 1,
      slipNumber: 'ATD/20260916/0001',
      registeredAt: '2026-09-16T09:00:00.000Z',
      name: 'Test Patient',
      firstName: 'Test',
      surname: 'Patient',
      age: '30yrs',
      sex: 'Female',
      phone: '08000000000',
      address: 'Kano',
      referredBy: '',
      tests: [completed],
    } satisfies Patient;

    const definition = buildReportPdfDefinition(patient, [completed]);
    const serialized = JSON.stringify(definition);
    expect(serialized).toContain('Dr. Aisha Bello');
    expect(serialized).toContain('Medical Director');
    expect(serialized).toContain('data:image/png;base64,c2ln');
  });

  it('names a package once and renders radiology images without a section title', () => {
    const tests = [
      {
        id: 'mps', testId: 'mps', testName: 'MPS', department: 'lab', status: 'completed',
        packageName: 'Antenatal', results: [],
      },
      {
        id: 'fbc', testId: 'fbc', testName: 'Full Blood Count', department: 'lab', status: 'completed',
        packageName: 'Antenatal', results: [],
      },
      {
        id: 'scan', testId: 'us_abd', testName: 'Abdominal Ultrasound', department: 'radiology', status: 'completed',
        results: [
          { parameter: 'Radiology: Findings', result: 'Normal.', unit: '', range: '' },
          { parameter: 'Radiology: Images', result: '["https://images.test/scan.png"]', unit: '', range: '' },
        ],
      },
    ] as PatientTest[];
    const reportPatient = {
      id: 1, slipNumber: 'ATD/1', registeredAt: '2026-09-16T09:00:00.000Z',
      name: 'Test Patient', firstName: 'Test', surname: 'Patient', age: '30yrs', sex: 'Female',
      phone: '', address: '', referredBy: '', tests,
    } satisfies Patient;

    const serialized = JSON.stringify(buildReportPdfDefinition(reportPatient, tests));
    expect(serialized).toContain('MPS, Full Blood Count (Antenatal); Abdominal Ultrasound');
    expect(serialized.match(/Antenatal/g)).toHaveLength(1);
    expect(serialized).not.toContain('from Antenatal');
    expect(serialized).not.toContain('Originating package');
    expect(serialized).not.toContain('ATTACHED IMAGERY');
    expect(serialized).toContain('https://images.test/scan.png');
  });
});
