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
  });
});
