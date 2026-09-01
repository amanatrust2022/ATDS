import { describe, it, expect, beforeEach, vi } from 'vitest';

const createClientMock = vi.fn();
vi.mock('@/lib/supabase', () => ({ createClient: () => createClientMock() }));

import {
  getReferralsRepository, localReferralsRepository, cloudReferralsRepository,
} from './referrals';

/**
 * Minimal stand-in for the Supabase query builder: every method records its call
 * and returns `this`, and awaiting the chain yields the configured result.
 */
const supabaseStub = (result: { data?: any; error?: any } = { data: [], error: null }) => {
  const calls: Array<{ method: string; args: any[] }> = [];
  const builder: any = {
    then: (resolve: any) => resolve(result),
  };
  for (const method of ['from', 'select', 'eq', 'order', 'insert', 'update', 'delete', 'single']) {
    builder[method] = (...args: any[]) => { calls.push({ method, args }); return builder; };
  }
  return { client: { from: builder.from }, calls, argsFor: (m: string) => calls.find(c => c.method === m)?.args };
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as any;
});

describe('getReferralsRepository', () => {
  it('serves the local repository on an on-premise hub', () => {
    expect(getReferralsRepository('local')).toBe(localReferralsRepository);
  });

  it('serves the cloud repository otherwise', () => {
    expect(getReferralsRepository('cloud')).toBe(cloudReferralsRepository);
  });
});

describe('Local repository', () => {
  it('reads facilities for the organisation', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'fac-1' }] });

    const result = await localReferralsRepository.listFacilities('org-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/referrals?type=facilities&organizationId=org-1');
    expect(result).toEqual([{ id: 'fac-1' }]);
  });

  it('reads doctors for the organisation', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'doc-1' }] });

    await localReferralsRepository.listDoctors('org-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/referrals?type=doctors&organizationId=org-1');
  });

  it('posts a new facility in the envelope the API route expects', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'fac-9' }) });

    const facility = { organization_id: 'org-1', name: 'City General' } as any;
    const created = await localReferralsRepository.addFacility(facility, 'org-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/referrals');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      target: 'facility', action: 'add', facility, organizationId: 'org-1',
    });
    expect(created).toEqual({ id: 'fac-9' });
  });

  it('posts a doctor update with the target and action', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await localReferralsRepository.updateDoctor('doc-1', { name: 'Bello' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      target: 'doctor', action: 'update', id: 'doc-1', updates: { name: 'Bello' },
    });
  });

  it('posts a delete for the given id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await localReferralsRepository.deleteFacility('fac-1');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      target: 'facility', action: 'delete', id: 'fac-1',
    });
  });

  it('surfaces the error the hub reported', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Slip number already used' }) });

    await expect(localReferralsRepository.addDoctor({} as any, 'org-1'))
      .rejects.toThrow('Slip number already used');
  });

  it('falls back to a readable message when the hub gives no reason', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await expect(localReferralsRepository.addFacility({} as any, 'org-1'))
      .rejects.toThrow('Failed to add referring facility locally');
  });
});

describe('Cloud repository', () => {
  it('reads facilities scoped to the organisation, by name', async () => {
    const stub = supabaseStub({ data: [{ id: 'fac-1' }], error: null });
    createClientMock.mockReturnValue(stub.client);

    const result = await cloudReferralsRepository.listFacilities('org-1');

    expect(stub.argsFor('from')).toEqual(['referring_facilities']);
    expect(stub.argsFor('eq')).toEqual(['organization_id', 'org-1']);
    expect(stub.argsFor('order')).toEqual(['name', { ascending: true }]);
    expect(result).toEqual([{ id: 'fac-1' }]);
  });

  it('returns an empty list rather than throwing when a read fails', async () => {
    createClientMock.mockReturnValue(supabaseStub({ data: null, error: { message: 'network' } }).client);

    await expect(cloudReferralsRepository.listFacilities('org-1')).resolves.toEqual([]);
  });

  it('flattens the joined facility name onto each doctor', async () => {
    const stub = supabaseStub({
      data: [{ id: 'doc-1', name: 'Bello', referring_facilities: { name: 'City General' } }],
      error: null,
    });
    createClientMock.mockReturnValue(stub.client);

    const [doctor] = await cloudReferralsRepository.listDoctors('org-1');

    expect(stub.argsFor('select')).toEqual(['*, referring_facilities(name)']);
    expect(doctor.facility_name).toBe('City General');
  });

  it('leaves facility_name undefined for an unaffiliated doctor', async () => {
    createClientMock.mockReturnValue(supabaseStub({ data: [{ id: 'doc-2', name: 'Adamu' }], error: null }).client);

    const [doctor] = await cloudReferralsRepository.listDoctors('org-1');

    expect(doctor.facility_name).toBeUndefined();
  });

  it('stamps the organisation onto a new facility', async () => {
    const stub = supabaseStub({ data: { id: 'fac-9' }, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudReferralsRepository.addFacility({ name: 'City General' } as any, 'org-1');

    expect(stub.argsFor('insert')).toEqual([[{ name: 'City General', organization_id: 'org-1' }]]);
  });

  // facility_name is a joined column; writing it back would fail on Postgres.
  it('drops the joined facility_name before inserting a doctor', async () => {
    const stub = supabaseStub({ data: { id: 'doc-9' }, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudReferralsRepository.addDoctor({ name: 'Bello', facility_name: 'City General' } as any, 'org-1');

    expect(stub.argsFor('insert')).toEqual([[{ name: 'Bello', organization_id: 'org-1' }]]);
  });

  it('drops the joined facility_name before updating a doctor', async () => {
    const stub = supabaseStub({ data: null, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudReferralsRepository.updateDoctor('doc-1', { name: 'Bello', facility_name: 'City General' } as any);

    expect(stub.argsFor('update')).toEqual([{ name: 'Bello' }]);
    expect(stub.argsFor('eq')).toEqual(['id', 'doc-1']);
  });

  it('raises a failed write instead of swallowing it', async () => {
    createClientMock.mockReturnValue(supabaseStub({ data: null, error: { message: 'duplicate key' } }).client);

    await expect(cloudReferralsRepository.addFacility({ name: 'X' } as any, 'org-1')).rejects.toBeTruthy();
  });

  it('deletes by id', async () => {
    const stub = supabaseStub({ data: null, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudReferralsRepository.deleteDoctor('doc-1');

    expect(stub.argsFor('from')).toEqual(['referring_doctors']);
    expect(stub.argsFor('eq')).toEqual(['id', 'doc-1']);
  });
});
