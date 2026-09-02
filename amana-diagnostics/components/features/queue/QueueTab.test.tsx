import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueueTab } from './QueueTab';
import { ResultsTab } from './ResultsTab';
import { Patient, PatientTest } from '@/lib/store';
import { useQueueStore } from '@/lib/store/useQueueStore';

const NOW = new Date(2026, 6, 27, 12, 0, 0); // 27 July 2026, midday

const test = (over: Partial<PatientTest> = {}): PatientTest => ({
  testId: 'fbc', testName: 'Full Blood Count', department: 'lab', status: 'in_progress', ...over,
});

const patient = (over: Partial<Patient> = {}): Patient => ({
  id: 1,
  slipNumber: 'ATD-0001',
  registeredAt: NOW.toISOString(),
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

const john = patient();
const jane = patient({
  id: 2, slipNumber: 'ATD-0002', name: 'Jane Smith', firstName: 'Jane', surname: 'Smith', sex: 'Female',
  tests: [test({ testId: 'usg', testName: 'Abdominal Ultrasound', department: 'radiology' })],
});

const renderQueue = (patients: Patient[] = [john, jane]) =>
  render(<QueueTab patients={patients} onViewSlip={vi.fn()} onViewResult={vi.fn()} />);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  useQueueStore.setState({ searchQuery: '', deptFilter: 'all', dateFilter: 'today' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Feature: Patient Queue Management', () => {
  it('lists the patients waiting on a result', () => {
    renderQueue();

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  // Regression: the queue once listed only patients with a test at in_progress, so a
  // patient who had just been registered — every test still pending — was counted by
  // the tab badge but never appeared in the queue underneath it.
  it('shows a freshly registered patient whose tests are all still pending', () => {
    const justRegistered = patient({
      id: 7, name: 'Newly Registered', slipNumber: 'ATD-0007',
      tests: [test({ status: 'pending' })],
    });
    renderQueue([justRegistered]);

    expect(screen.getByText('Newly Registered')).toBeInTheDocument();
  });

  it('keeps a partly finished patient in the queue while work is outstanding', () => {
    const partial = patient({
      id: 8, name: 'Half Done',
      tests: [test({ status: 'completed' }), test({ testId: 'esr', testName: 'ESR', status: 'pending' })],
    });
    renderQueue([partial]);

    expect(screen.getByText('Half Done')).toBeInTheDocument();
  });

  it('narrows the queue to the patient the receptionist searched for', () => {
    renderQueue();

    fireEvent.change(screen.getByPlaceholderText('Search by name or slip number...'), {
      target: { value: 'John' },
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  /**
   * `patients` has no `name` column, so every real row arrives without one and
   * the display name is built from the parts. Searching used to read `p.name`
   * directly, which meant no patient could be found by name at all.
   */
  it('finds and shows a patient whose row carries no name, only the parts', () => {
    renderQueue([
      patient({ name: '', firstName: 'John', middleName: 'Adeola', surname: 'Doe' }),
      patient({ id: 2, slipNumber: 'ATD-0002', name: '', firstName: 'Jane', surname: 'Smith' }),
    ]);

    expect(screen.getByText('John Adeola Doe')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search by name or slip number...'), {
      target: { value: 'adeola' },
    });

    expect(screen.getByText('John Adeola Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('finds a patient by slip number as well as by name', () => {
    renderQueue();

    fireEvent.change(screen.getByPlaceholderText('Search by name or slip number...'), {
      target: { value: 'ATD-0002' },
    });

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('filters the queue down to one department', () => {
    renderQueue();

    fireEvent.click(screen.getByRole('button', { name: /Radiology/i }));

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('hides a patient registered before the selected date window', () => {
    const lastWeek = patient({
      id: 3, name: 'Old Visit', slipNumber: 'ATD-0003',
      registeredAt: new Date(2026, 6, 20, 9, 0, 0).toISOString(), // 7 days earlier
    });
    renderQueue([john, lastWeek]);

    // Default filter is Today
    expect(screen.queryByText('Old Visit')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Last 30 Days' }));

    expect(screen.getByText('Old Visit')).toBeInTheDocument();
  });

  it('tells the user the queue is empty rather than rendering nothing', () => {
    renderQueue([]);

    expect(screen.getByText('No patients in queue')).toBeInTheDocument();
  });

  it('leaves completed patients out of the queue', () => {
    const done = patient({ id: 4, name: 'Finished Patient', tests: [test({ status: 'completed' })] });
    renderQueue([done]);

    expect(screen.queryByText('Finished Patient')).not.toBeInTheDocument();
    expect(screen.getByText('No patients in queue')).toBeInTheDocument();
  });

  it('hands the selected patient back when the slip is opened', () => {
    const onViewSlip = vi.fn();
    render(<QueueTab patients={[john]} onViewSlip={onViewSlip} onViewResult={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Slip/i }));

    expect(onViewSlip).toHaveBeenCalledWith(john);
  });
});

describe('Feature: Ready Results', () => {
  const completed = patient({
    id: 5, name: 'Ready Patient', tests: [test({ status: 'completed' })],
  });

  it('shows only patients whose tests are all complete', () => {
    render(<ResultsTab patients={[completed, john]} onViewSlip={vi.fn()} onViewResult={vi.fn()} />);

    expect(screen.getByText('Ready Patient')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  // A partly finished patient has a result worth printing, so reception sees them
  // here as well as in the queue. The card shows "1/2 completed".
  it('shows a patient whose tests are only partly complete', () => {
    const partial = patient({
      id: 6, name: 'Half Done',
      tests: [test({ status: 'completed' }), test({ testId: 'esr', testName: 'ESR', status: 'pending' })],
    });
    render(<ResultsTab patients={[partial]} onViewSlip={vi.fn()} onViewResult={vi.fn()} />);

    expect(screen.getByText('Half Done')).toBeInTheDocument();
  });

  it('withholds a patient with nothing completed yet', () => {
    render(<ResultsTab patients={[john]} onViewSlip={vi.fn()} onViewResult={vi.fn()} />);

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('No results available yet')).toBeInTheDocument();
  });

  it('opens the result for printing', () => {
    const onViewResult = vi.fn();
    render(<ResultsTab patients={[completed]} onViewSlip={vi.fn()} onViewResult={onViewResult} />);

    fireEvent.click(screen.getByRole('button', { name: /View & Print Result/i }));

    expect(onViewResult).toHaveBeenCalledWith(completed);
  });

  it('does not offer the department filter on the results tab', () => {
    render(<ResultsTab patients={[completed]} onViewSlip={vi.fn()} onViewResult={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Radiology/i })).not.toBeInTheDocument();
  });
});
