import { describe, it, expect, beforeEach, vi } from 'vitest';

const createClientMock = vi.fn();
vi.mock('@/lib/supabase', () => ({ createClient: () => createClientMock() }));

import { cloudPatientsRepository, localPatientsRepository, patientQueryParams } from './patients';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as any;
});

function recordingSupabase() {
  const calls: { eq: [string, any][]; gte: [string, any][] } = { eq: [], gte: [] };
  const builder: any = {
    select: () => builder,
    eq: (col: string, val: any) => { calls.eq.push([col, val]); return builder; },
    gte: (col: string, val: any) => { calls.gte.push([col, val]); return builder; },
    not: () => builder,
    or: () => builder,
    limit: () => builder,
    order: () => builder,
    then: (res: any) => res({ data: [], error: null }),
  };
  createClientMock.mockReturnValue({ from: () => builder });
  return calls;
}

/**
 * A returning patient's visit history is older than any date window the queue
 * is showing. Registration reads it to carry forward their age and, more
 * importantly, the wallet their family's visits are charged to — filtering the
 * on-screen queue for it would have silently defaulted them to cash.
 */
describe('Looking up one patient\'s whole visit history', () => {
  it('asks for every visit belonging to that permanent record', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { patientProfileId: 42 });

    expect(calls.eq).toContainEqual(['patient_profile_id', 42]);
  });

  it('applies no date bound, so a visit from months ago still counts', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { patientProfileId: 42 });

    expect(calls.gte).toEqual([]);
  });

  it('stays inside the organisation', async () => {
    const calls = recordingSupabase();

    await cloudPatientsRepository.list('org-1', { patientProfileId: 42 });

    expect(calls.eq).toContainEqual(['organization_id', 'org-1']);
  });

  it('carries the filter through to the hub', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await localPatientsRepository.list('org-1', { patientProfileId: 42 });

    expect(fetchMock.mock.calls[0][0]).toContain('patientProfileId=42');
  });

  it('sends nothing when no profile was asked for', () => {
    expect(patientQueryParams('org-1')).not.toContain('patientProfileId');
  });
});
