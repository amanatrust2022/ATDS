import { describe, it, expect, beforeEach, vi } from 'vitest';

const createClientMock = vi.fn();
vi.mock('@/lib/supabase', () => ({ createClient: () => createClientMock() }));

import { cloudPatientsRepository, localPatientsRepository, patientQueryParams, debounce } from './patients';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as any;
});

/**
 * Records the filters a query was built with, so a test can assert that the
 * bound reached the database rather than the browser.
 */
function recordingSupabase() {
  const calls: { select?: string; eq: [string, any][]; neq: [string, any][]; gte: [string, any][]; lte: [string, any][]; not: any[]; or: string[]; limit?: number } = {
    eq: [], neq: [], gte: [], lte: [], not: [], or: [],
  };
  const builder: any = {
    select: (cols: string) => { calls.select = cols; return builder; },
    eq: (col: string, val: any) => { calls.eq.push([col, val]); return builder; },
    neq: (col: string, val: any) => { calls.neq.push([col, val]); return builder; },
    gte: (col: string, val: any) => { calls.gte.push([col, val]); return builder; },
    lte: (col: string, val: any) => { calls.lte.push([col, val]); return builder; },
    not: (...a: any[]) => { calls.not.push(a); return builder; },
    or: (clause: string) => { calls.or.push(clause); return builder; },
    limit: (n: number) => { calls.limit = n; return builder; },
    order: () => builder,
    then: (res: any) => res({ data: [], error: null }),
  };
  createClientMock.mockReturnValue({ from: () => builder });
  return calls;
}

describe('Bounding what the queue loads (cloud)', () => {
  it('asks the database for the date window instead of filtering in the browser', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { since: '2026-09-04T00:00:00.000Z' });

    expect(calls.gte).toContainEqual(['registered_at', '2026-09-04T00:00:00.000Z']);
  });

  it('makes the department a condition on the patient, not just on the tests returned', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { department: 'radiology' });

    // Without !inner every patient comes back, most carrying an empty test list.
    expect(calls.select).toContain('patient_tests!inner');
    expect(calls.eq).toContainEqual(['tests.department', 'radiology']);
  });

  it('leaves the join open when no department is asked for, so reception sees every test', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { since: '2026-09-04T00:00:00.000Z' });

    expect(calls.select).not.toContain('!inner');
  });

  it('returns wallet members of any age, because an account is not a date window', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { withBillingAccount: true });

    expect(calls.not).toContainEqual(['billing_account_id', 'is', null]);
    expect(calls.gte).toEqual([]);
  });

  it('searches name and phone, and caps what comes back', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { search: 'amina', limit: 25 });

    expect(calls.or[0]).toContain('first_name.ilike.%amina%');
    expect(calls.or[0]).toContain('surname.ilike.%amina%');
    expect(calls.or[0]).toContain('phone.ilike.%amina%');
    expect(calls.limit).toBe(25);
  });

  it('strips characters that would be read as extra filter clauses', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { search: 'a,b)(c' });

    expect(calls.or[0]).not.toMatch(/[()]/);
    expect(calls.or[0].match(/,/g)?.length).toBe(2); // only the two separating the three clauses
  });

  it('still returns everything when nothing is asked for', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1');

    expect(calls.gte).toEqual([]);
    expect(calls.not).toEqual([]);
    expect(calls.limit).toBeUndefined();
  });
});

/**
 * The commission report is run for a chosen period, so that period is what it
 * should load. It used to fetch every patient the centre had ever registered
 * and then narrow the list in the browser.
 */
describe('Bounding the commission report to its period', () => {
  it('bounds both ends of the period in the database', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', {
      since: '2026-08-01T00:00:00.000Z',
      until: '2026-08-31T22:59:59.000Z',
    });

    expect(calls.gte).toContainEqual(['registered_at', '2026-08-01T00:00:00.000Z']);
    expect(calls.lte).toContainEqual(['registered_at', '2026-08-31T22:59:59.000Z']);
  });

  it('leaves the period open at the end when no end was given', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { since: '2026-08-01T00:00:00.000Z' });

    expect(calls.lte).toEqual([]);
  });

  it('carries both ends through to the hub', () => {
    const qs = patientQueryParams('org-1', { since: '2026-08-01T00:00:00.000Z', until: '2026-08-31T22:59:59.000Z' });

    expect(qs).toContain('since=2026-08-01T00%3A00%3A00.000Z');
    expect(qs).toContain('until=2026-08-31T22%3A59%3A59.000Z');
  });
});

/**
 * A department screen asks two questions instead of one, because the two lists
 * on it are bounded by different things. Asking only by department meant "every
 * patient who has ever had a test at this bench" — the whole archive, fetched
 * to show a morning's work.
 */
describe('Bounding a department screen', () => {
  it('asks for outstanding work with no date bound at all', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { department: 'lab', unfinished: true });

    expect(calls.select).toContain('patient_tests!inner');
    expect(calls.neq).toContainEqual(['tests.status', 'completed']);
    // A specimen left waiting since last month is still waiting; a date window
    // would take it off the queue, which is the one thing a queue must not do.
    expect(calls.gte).toEqual([]);
    expect(calls.lte).toEqual([]);
  });

  it('bounds finished work by when it was finished, not by when the patient arrived', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', {
      department: 'lab',
      completedSince: '2026-09-07T00:00:00.000Z',
    });

    expect(calls.eq).toContainEqual(['tests.status', 'completed']);
    expect(calls.gte).toContainEqual(['tests.completed_at', '2026-09-07T00:00:00.000Z']);
    // Not registered_at: a result can be entered days after the visit.
    expect(calls.gte).not.toContainEqual(['registered_at', '2026-09-07T00:00:00.000Z']);
  });

  it('carries both through to the hub', () => {
    const params = new URLSearchParams(patientQueryParams('org-1', {
      department: 'lab',
      unfinished: true,
      completedSince: '2026-09-07T00:00:00.000Z',
    }));

    expect(params.get('unfinished')).toBe('1');
    expect(params.get('completedSince')).toBe('2026-09-07T00:00:00.000Z');
  });
});

describe('Bounding what the queue loads (hub)', () => {
  it('carries every bound through to the hub as query parameters', () => {
    const params = new URLSearchParams(
      patientQueryParams('org-1', { since: '2026-09-04T00:00:00.000Z', department: 'lab', withBillingAccount: true, search: 'ali', limit: 25 }),
    );

    expect(params.get('organizationId')).toBe('org-1');
    expect(params.get('since')).toBe('2026-09-04T00:00:00.000Z');
    expect(params.get('department')).toBe('lab');
    expect(params.get('withBillingAccount')).toBe('1');
    expect(params.get('search')).toBe('ali');
    expect(params.get('limit')).toBe('25');
  });

  it('sends no bounds when none were asked for', () => {
    expect(patientQueryParams('org-1')).toBe('organizationId=org-1');
  });

  it('escapes a search term rather than breaking the URL', () => {
    const params = new URLSearchParams(patientQueryParams('org-1', { search: 'a&b=c' }));
    expect(params.get('search')).toBe('a&b=c');
  });

  it('passes the bounds on when the hub is asked for a list', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await localPatientsRepository.list('org-1', { department: 'radiology' });

    expect(fetchMock.mock.calls[0][0]).toContain('department=radiology');
  });
});

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());

  // Registering one patient with five tests produces roughly seven realtime
  // events across three tables. They used to be seven full reloads, on every
  // open screen in the building.
  it('collapses a burst of changes into a single call', () => {
    const fn = vi.fn();
    const run = debounce(fn, 400);

    for (let i = 0; i < 7; i++) run();
    vi.advanceTimersByTime(400);

    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('still fires again for a change that arrives later', () => {
    const fn = vi.fn();
    const run = debounce(fn, 400);

    run();
    vi.advanceTimersByTime(400);
    run();
    vi.advanceTimersByTime(400);

    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not fire after it has been cancelled on unmount', () => {
    const fn = vi.fn();
    const run = debounce(fn, 400);

    run();
    run.cancel();
    vi.advanceTimersByTime(1000);

    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
