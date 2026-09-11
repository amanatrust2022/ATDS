import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Patient, PatientTest } from '@/lib/store';
import DepartmentQueue from './DepartmentQueue';
import { departmentTheme } from './theme';

/**
 * Characterisation tests for the bench queue.
 *
 * This is the screen a scientist works down: who is waiting, what for, and how
 * long they have been there. Waiting time is the whole point of a queue, and
 * it was a line of small grey text that never changed after the first render.
 *
 * Written before the rebuild. See decision #28.
 */

const NOW = new Date('2026-09-11T12:00:00Z');

const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

const aTest = (over: Partial<PatientTest> = {}): PatientTest =>
  ({
    testId: 'fbc',
    testName: 'Full Blood Count',
    department: 'lab',
    status: 'pending',
    price: 0,
    ...over,
  }) as PatientTest;

const patient = (over: Partial<Patient> = {}): Patient =>
  ({
    id: 1,
    slipNumber: 'A-001',
    registeredAt: minsAgo(5),
    name: '',
    firstName: 'Amina',
    surname: 'Bello',
    age: '31',
    sex: 'Female',
    phone: '',
    address: '',
    referredBy: '',
    tests: [aTest()],
    ...over,
  }) as Patient;

const renderQueue = (over: Partial<React.ComponentProps<typeof DepartmentQueue>> = {}) =>
  render(
    <DepartmentQueue
      department="lab"
      pending={[patient()]}
      completedToday={[]}
      pendingCount={1}
      loading={false}
      onOpenTest={vi.fn()}
      theme={departmentTheme('lab')}
      {...over}
    />,
  );

beforeEach(() => vi.useFakeTimers({ now: NOW, shouldAdvanceTime: false }));
afterEach(() => vi.useRealTimers());

describe('The bench queue', () => {
  it('lists who is waiting and what for', () => {
    renderQueue();

    expect(screen.getByText(/Amina Bello/)).toBeInTheDocument();
    expect(screen.getByText('Full Blood Count')).toBeInTheDocument();
  });

  it('says the queue is empty rather than showing nothing', () => {
    renderQueue({ pending: [], pendingCount: 0 });
    expect(screen.getByText(/no pending requests/i)).toBeInTheDocument();
  });

  /**
   * The waiting time is computed once, during render, from Date.now(). Nothing
   * re-renders a queue that is only waiting for new patients, so someone who
   * arrived twenty minutes ago goes on reading "5 min ago" for as long as the
   * tab is open — and the one number the bench uses to decide who to pick up
   * next is the first one to stop being true.
   */
  it('keeps the waiting time current as time passes', async () => {
    renderQueue({ pending: [patient({ registeredAt: minsAgo(5) })] });
    expect(screen.getByText(/5 min/)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect(screen.getByText(/15 min/)).toBeInTheDocument();
  });

  /**
   * A queue in no particular order is not a queue. Nothing sorted these, so
   * someone waiting three hours sat wherever the store happened to put them —
   * quite possibly below a patient who walked in a minute ago.
   */
  it('puts the longest wait at the top', () => {
    renderQueue({
      pending: [
        patient({ id: 1, slipNumber: 'A-001', firstName: 'Recent', registeredAt: minsAgo(2) }),
        patient({ id: 2, slipNumber: 'A-002', firstName: 'Waiting', registeredAt: minsAgo(180) }),
        patient({ id: 3, slipNumber: 'A-003', firstName: 'Middle', registeredAt: minsAgo(40) }),
      ],
      pendingCount: 3,
    });

    const names = screen.getAllByTestId('queue-patient').map((el) => el.textContent);
    expect(names[0]).toMatch(/Waiting/);
    expect(names[1]).toMatch(/Middle/);
    expect(names[2]).toMatch(/Recent/);
  });

  it('marks a patient who has been waiting too long', () => {
    renderQueue({ pending: [patient({ registeredAt: minsAgo(150) })] });

    const card = screen.getByTestId('queue-patient');
    expect(within(card).getByText(/waiting over/i)).toBeInTheDocument();
  });

  it('does not mark a patient who has just arrived', () => {
    renderQueue({ pending: [patient({ registeredAt: minsAgo(3) })] });
    expect(screen.queryByText(/waiting over/i)).not.toBeInTheDocument();
  });

  it('opens a test from a real button', () => {
    const onOpenTest = vi.fn();
    renderQueue({ onOpenTest });

    screen.getByRole('button', { name: /full blood count/i }).click();
    expect(onOpenTest).toHaveBeenCalledTimes(1);
  });

  it('says which tests are already being worked on', () => {
    renderQueue({ pending: [patient({ tests: [aTest({ status: 'in_progress' })] })] });
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it('lists what was finished today', () => {
    renderQueue({
      completedToday: [
        patient({ id: 9, firstName: 'Done', tests: [aTest({ status: 'completed' })] }),
      ],
    });
    expect(screen.getByText(/completed today/i)).toBeInTheDocument();
    expect(screen.getByText(/Done Bello/)).toBeInTheDocument();
  });
});
