import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { QueueList } from './QueueList';
import type { Patient, PatientTest } from '@/lib/store';

/**
 * Characterisation tests for the queue list itself — the container around the
 * patient cards. Written before the rebuild (decision #28).
 */

const test = (over: Partial<PatientTest> = {}): PatientTest => ({
  testId: 'fbc', testName: 'Full Blood Count', department: 'lab', status: 'in_progress', ...over,
});

const patient = (id: number, name: string): Patient => ({
  id,
  slipNumber: `ATD-000${id}`,
  registeredAt: new Date(2026, 6, 27, 12, 0, 0).toISOString(),
  name,
  firstName: name.split(' ')[0],
  surname: name.split(' ')[1] ?? '',
  age: '35yrs',
  sex: 'Male',
  phone: '08030000000',
  address: 'Kano',
  referredBy: 'Dr. Bello',
  tests: [test()],
});

const show = (patients: Patient[], mode: 'queue' | 'results' = 'queue') =>
  render(
    <QueueList patients={patients} mode={mode} onViewSlip={vi.fn()} onViewResult={vi.fn()} />,
  );

describe('Queue list', () => {
  /**
   * The waiting patients were a plain <div> of cards. A screen reader was
   * given no list and therefore no count — a receptionist working by ear had
   * to tab through the whole queue to find out how long it was.
   */
  it('presents the waiting patients as a counted list', () => {
    show([patient(1, 'John Doe'), patient(2, 'Jane Smith'), patient(3, 'Musa Bello')]);

    // Counted from the list's own children: each card carries a second list,
    // of the patient's test chips, whose items are listitems too.
    const list = screen.getByRole('list', { name: /patient/i });
    expect(list.children).toHaveLength(3);
  });

  /**
   * The empty state's 64px icon was live text to an accessibility tree — a
   * bare <svg> with nothing marking it decorative.
   */
  it('marks the empty-state icon as decoration', () => {
    const { container } = show([]);

    const svg = container.querySelector('svg');
    expect(svg?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  // Behaviour guards: both empty states still say what they said, and the
  // cards still appear. These held before.
  it('says the queue is empty rather than rendering nothing', () => {
    show([]);

    expect(screen.getByText('No patients in queue')).toBeInTheDocument();
    expect(screen.getByText(/register a patient to get started/i)).toBeInTheDocument();
  });

  it('says so when no result is ready', () => {
    show([], 'results');

    expect(screen.getByText('No results available yet')).toBeInTheDocument();
  });

  it('shows a card for each patient', () => {
    show([patient(1, 'John Doe'), patient(2, 'Jane Smith')]);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
});
