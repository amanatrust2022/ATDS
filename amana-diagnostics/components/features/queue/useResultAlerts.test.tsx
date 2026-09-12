import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const chime = vi.hoisted(() => vi.fn());
const desktop = vi.hoisted(() => vi.fn());
vi.mock('@/lib/notifications', () => ({
  playChime: chime,
  desktopNotify: desktop,
  requestNotificationPermission: vi.fn(),
}));

import { useResultAlerts } from './useResultAlerts';
import type { Patient } from '@/lib/store';

const patient = (tests: Array<{ id: string; status: 'pending' | 'completed'; department?: 'lab' | 'radiology'; testName?: string; completedAt?: string }>): Patient =>
  ({
    id: 1,
    firstName: 'Jane',
    surname: 'Doe',
    name: 'Jane Doe',
    tests: tests.map(t => ({
      id: t.id, testId: 'fbc', testName: t.testName ?? 'Full Blood Count',
      department: t.department ?? 'lab', status: t.status,
      completedAt: t.completedAt ?? (t.status === 'completed' ? new Date().toISOString() : undefined),
    })),
  }) as unknown as Patient;

function Harness({ patients, loading, announce }: { patients: Patient[]; loading: boolean; announce: (m: string) => void }) {
  useResultAlerts(patients, loading, announce);
  return null;
}

describe('Telling reception a result has arrived', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is silent about the backlog, then announces each test that completes', () => {
    const announce = vi.fn();
    const view = render(
      <Harness loading={false} announce={announce} patients={[patient([{ id: 't1', status: 'completed' }, { id: 't2', status: 'pending' }])]} />,
    );
    expect(announce).not.toHaveBeenCalled();
    expect(chime).not.toHaveBeenCalled();

    view.rerender(
      <Harness loading={false} announce={announce} patients={[patient([{ id: 't1', status: 'completed' }, { id: 't2', status: 'completed', department: 'radiology', testName: 'Pelvic Scan' }])]} />,
    );
    expect(chime).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Result ready from Radiology: Pelvic Scan for Jane Doe');
    expect(desktop).toHaveBeenCalledWith('Result ready', 'Jane Doe — Pelvic Scan (Radiology)');

    // The same list again is not news.
    view.rerender(
      <Harness loading={false} announce={announce} patients={[patient([{ id: 't1', status: 'completed' }, { id: 't2', status: 'completed', department: 'radiology', testName: 'Pelvic Scan' }])]} />,
    );
    expect(announce).toHaveBeenCalledTimes(1);
  });

  // Switching the queue from "today" to "30 days" pulls a month of finished
  // results into the list at once. None of them just arrived.
  it('does not announce old results that appear because the window widened', () => {
    const announce = vi.fn();
    const view = render(<Harness loading={false} announce={announce} patients={[patient([{ id: 't1', status: 'completed' }])]} />);

    const lastWeek = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    view.rerender(
      <Harness loading={false} announce={announce} patients={[
        patient([{ id: 't1', status: 'completed' }]),
        patient([{ id: 'old-1', status: 'completed', completedAt: lastWeek }, { id: 'old-2', status: 'completed', completedAt: lastWeek }]),
      ]} />,
    );
    expect(announce).not.toHaveBeenCalled();
    expect(chime).not.toHaveBeenCalled();
  });

  it('waits for the first real load before deciding what the backlog is', () => {
    const announce = vi.fn();
    const view = render(<Harness loading={true} announce={announce} patients={[]} />);
    view.rerender(<Harness loading={false} announce={announce} patients={[patient([{ id: 't1', status: 'completed' }])]} />);
    expect(announce).not.toHaveBeenCalled();
  });
});
