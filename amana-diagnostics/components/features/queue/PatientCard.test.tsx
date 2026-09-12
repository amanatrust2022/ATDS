import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PatientCard } from './PatientCard';
import type { Patient, PatientTest } from '@/lib/store';

const test = (over: Partial<PatientTest> = {}): PatientTest => ({
  testId: 'fbc', testName: 'Full Blood Count', department: 'lab', status: 'in_progress', ...over,
});

const patient = (over: Partial<Patient> = {}): Patient => ({
  id: 1,
  slipNumber: 'ATD-0001',
  registeredAt: new Date(2026, 6, 27, 12, 0, 0).toISOString(),
  name: 'John Doe',
  firstName: 'John',
  surname: 'Doe',
  age: '35yrs',
  sex: 'Male',
  phone: '08030000000',
  address: 'Kano',
  referredBy: 'Dr. Bello',
  tests: [test()],
  ...over,
});

describe('Patient queue card', () => {
  /**
   * The rule-5 defect. A test's status was carried by the fill of its chip:
   * green for done, amber for in-progress, and — the worst of it — plain grey
   * for pending, with no icon or word at all. A colour-blind receptionist could
   * not tell a pending test from a done one, and a screen reader heard neither.
   */
  it('states each test status in words', () => {
    render(
      <PatientCard
        mode="queue"
        onViewSlip={vi.fn()}
        onViewResult={vi.fn()}
        patient={patient({
          tests: [
            test({ testId: 'fbc', testName: 'Full Blood Count', status: 'in_progress' }),
            test({ testId: 'esr', testName: 'ESR', status: 'pending' }),
          ],
        })}
      />,
    );

    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  /**
   * The department was a bare icon — a test tube or a radar dish — with no text
   * behind it, so a screen reader could not say whether a test was lab or
   * radiology work.
   */
  it('names the department of each test', () => {
    render(
      <PatientCard
        mode="queue"
        onViewSlip={vi.fn()}
        onViewResult={vi.fn()}
        patient={patient({
          tests: [
            test({ testId: 'fbc', testName: 'Full Blood Count', department: 'lab' }),
            test({ testId: 'usg', testName: 'Abdominal Ultrasound', department: 'radiology' }),
          ],
        })}
      />,
    );

    expect(screen.getByText(/^lab$/i)).toBeInTheDocument();
    expect(screen.getByText(/^radiology$/i)).toBeInTheDocument();
  });

  // A behaviour guard: the card names the patient, its slip, and offers the
  // slip button in the queue and the result button once results are ready.
  // These held on the old card too; kept so the rebuild does not lose them.
  it('shows the patient and both actions in results mode', () => {
    render(
      <PatientCard
        mode="results"
        onViewSlip={vi.fn()}
        onViewResult={vi.fn()}
        patient={patient()}
      />,
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('ATD-0001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /slip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view & print result/i })).toBeInTheDocument();
  });
});
