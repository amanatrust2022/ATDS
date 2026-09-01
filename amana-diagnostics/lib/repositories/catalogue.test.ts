import { describe, it, expect, beforeEach, vi } from 'vitest';

const createClientMock = vi.fn();
vi.mock('@/lib/supabase', () => ({ createClient: () => createClientMock() }));

import { getTestPricesRepository, localTestPricesRepository, cloudTestPricesRepository } from './testPrices';
import { getCustomTestsRepository, localCustomTestsRepository, cloudCustomTestsRepository } from './customTests';
import { getRadiologyTemplatesRepository, localRadiologyTemplatesRepository, cloudRadiologyTemplatesRepository } from './radiologyTemplates';
import type { Test } from '@/lib/store';

const supabaseStub = (result: { data?: any; error?: any } = { data: [], error: null }) => {
  const calls: Array<{ method: string; args: any[] }> = [];
  const builder: any = { then: (resolve: any) => resolve(result) };
  for (const method of ['from', 'select', 'eq', 'order', 'insert', 'update', 'upsert', 'delete', 'single']) {
    builder[method] = (...args: any[]) => { calls.push({ method, args }); return builder; };
  }
  return { client: { from: builder.from }, argsFor: (m: string) => calls.find(c => c.method === m)?.args };
};

const fetchMock = vi.fn();
const bodyOf = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);

const sampleTest: Test = {
  id: 'fbc', name: 'Full Blood Count', department: 'lab', category: 'Haematology', specimen: 'Blood',
  parameters: [{ name: 'WBC', unit: '10^9/L', range: '4-11' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as any;
});

describe('Test prices repository', () => {
  it('picks an implementation by runtime mode', () => {
    expect(getTestPricesRepository('local')).toBe(localTestPricesRepository);
    expect(getTestPricesRepository('cloud')).toBe(cloudTestPricesRepository);
  });

  it('reads the price list for the organisation locally', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ test_id: 'fbc', price: 5000 }] });

    await localTestPricesRepository.list('org-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/test-prices?organizationId=org-1');
  });

  it('posts the whole price list in one write locally', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await localTestPricesRepository.upsertMany([{ test_id: 'fbc', price: 5000 } as any], 'org-1');

    expect(bodyOf()).toEqual({ prices: [{ test_id: 'fbc', price: 5000 }], organizationId: 'org-1' });
  });

  it('upserts on the organisation and test pair so re-pricing overwrites', async () => {
    const stub = supabaseStub({ data: null, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudTestPricesRepository.upsertMany([{ test_id: 'fbc', test_name: 'FBC', price: 5000 } as any], 'org-1');

    const [rows, options] = stub.argsFor('upsert')!;
    expect(options).toEqual({ onConflict: 'organization_id,test_id' });
    expect(rows[0]).toMatchObject({ organization_id: 'org-1', test_id: 'fbc', price: 5000 });
  });

  it('accepts camelCase keys callers have historically passed', async () => {
    const stub = supabaseStub({ data: null, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudTestPricesRepository.upsertMany([{ testId: 'usg', testName: 'Ultrasound', price: 12000 } as any], 'org-1');

    expect(stub.argsFor('upsert')![0][0]).toMatchObject({ test_id: 'usg', test_name: 'Ultrasound' });
  });

  it('defaults a missing commission to zero percent rather than null', async () => {
    const stub = supabaseStub({ data: null, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudTestPricesRepository.upsertMany([{ test_id: 'fbc', test_name: 'FBC', price: 5000 } as any], 'org-1');

    expect(stub.argsFor('upsert')![0][0]).toMatchObject({ commission_type: 'percentage', commission_value: 0 });
  });
});

describe('Custom tests repository', () => {
  it('picks an implementation by runtime mode', () => {
    expect(getCustomTestsRepository('local')).toBe(localCustomTestsRepository);
    expect(getCustomTestsRepository('cloud')).toBe(cloudCustomTestsRepository);
  });

  // SQLite has no JSON or boolean column type; Postgres has both.
  it('encodes parameters as a JSON string and is_active as 1 for SQLite', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await localCustomTestsRepository.add(sampleTest, 'org-1');

    const { test } = bodyOf();
    expect(test.parameters).toBe(JSON.stringify(sampleTest.parameters));
    expect(test.is_active).toBe(1);
  });

  it('encodes an inactive test as 0 for SQLite', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await localCustomTestsRepository.add({ ...sampleTest, is_active: false }, 'org-1');

    expect(bodyOf().test.is_active).toBe(0);
  });

  it('sends parameters as jsonb and is_active as a boolean for Postgres', async () => {
    const stub = supabaseStub({ data: null, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudCustomTestsRepository.add(sampleTest, 'org-1');

    const [rows] = stub.argsFor('insert')!;
    expect(rows[0].parameters).toEqual(sampleTest.parameters);
    expect(rows[0].is_active).toBe(true);
    expect(rows[0].organization_id).toBe('org-1');
  });

  it('parses parameters that came back as a string', async () => {
    createClientMock.mockReturnValue(supabaseStub({
      data: [{ id: 'fbc', name: 'FBC', parameters: '[{"name":"WBC"}]', is_active: true }], error: null,
    }).client);

    const [test] = await cloudCustomTestsRepository.list('org-1');

    expect(test.parameters).toEqual([{ name: 'WBC' }]);
  });

  it('leaves parameters alone when they arrive already parsed', async () => {
    createClientMock.mockReturnValue(supabaseStub({
      data: [{ id: 'fbc', name: 'FBC', parameters: [{ name: 'WBC' }], is_active: true }], error: null,
    }).client);

    const [test] = await cloudCustomTestsRepository.list('org-1');

    expect(test.parameters).toEqual([{ name: 'WBC' }]);
  });

  it('returns an empty catalogue rather than throwing when the hub is unreachable', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await expect(localCustomTestsRepository.list('org-1')).resolves.toEqual([]);
  });

  it('sends only the fields being changed on update', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await localCustomTestsRepository.update('fbc', { name: 'Renamed' }, 'org-1');

    const { updates } = bodyOf();
    expect(updates.name).toBe('Renamed');
    expect(updates).not.toHaveProperty('category');
    expect(updates).not.toHaveProperty('parameters');
  });

  // A built-in test has no row until it is first customised, so update must upsert.
  it('upserts rather than updates so a first-time override creates the row', async () => {
    const stub = supabaseStub({ data: null, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudCustomTestsRepository.update('fbc', { name: 'Renamed' }, 'org-1');

    expect(stub.argsFor('upsert')![0]).toMatchObject({ id: 'fbc', organization_id: 'org-1', name: 'Renamed' });
    expect(stub.argsFor('update')).toBeUndefined();
  });

  it('scopes a delete to the organisation as well as the id', async () => {
    const stub = supabaseStub({ data: null, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudCustomTestsRepository.remove('mine', 'org-1');

    expect(stub.argsFor('from')).toEqual(['custom_tests']);
    expect(stub.argsFor('eq')).toEqual(['organization_id', 'org-1']);
  });
});

describe('Radiology templates repository', () => {
  it('picks an implementation by runtime mode', () => {
    expect(getRadiologyTemplatesRepository('local')).toBe(localRadiologyTemplatesRepository);
    expect(getRadiologyTemplatesRepository('cloud')).toBe(cloudRadiologyTemplatesRepository);
  });

  it('records who authored a new template', async () => {
    const stub = supabaseStub({ data: { id: 'tpl-1' }, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudRadiologyTemplatesRepository.add({ key: 'cxr', name: 'Chest X-Ray' } as any, 'user-7');

    expect(stub.argsFor('insert')![0][0]).toMatchObject({ key: 'cxr', created_by: 'user-7' });
  });

  it('passes the author through on the local write too', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tpl-1' }) });

    await localRadiologyTemplatesRepository.add({ key: 'cxr', name: 'Chest X-Ray' } as any, 'user-7');

    expect(bodyOf()).toMatchObject({ action: 'add', userId: 'user-7' });
  });

  // Ownership and timestamps must not be rewritten by an edit.
  it('writes only the authored fields on update', async () => {
    const stub = supabaseStub({ data: null, error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudRadiologyTemplatesRepository.update('tpl-1', {
      name: 'Renamed', findings: 'F', impression: 'I', created_by: 'someone-else',
    } as any);

    expect(Object.keys(stub.argsFor('update')![0]).sort()).toEqual(['findings', 'impression', 'key', 'name']);
  });

  it('lists templates for the organisation in name order', async () => {
    const stub = supabaseStub({ data: [{ id: 'tpl-1' }], error: null });
    createClientMock.mockReturnValue(stub.client);

    await cloudRadiologyTemplatesRepository.list('org-1');

    expect(stub.argsFor('order')).toEqual(['name', { ascending: true }]);
  });

  it('surfaces the hub error when a template will not save', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Template key already exists' }) });

    await expect(localRadiologyTemplatesRepository.add({} as any))
      .rejects.toThrow('Template key already exists');
  });
});
