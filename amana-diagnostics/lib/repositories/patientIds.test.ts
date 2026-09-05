import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  allocatePatientId, resetAllocatorWarning, isDuplicateSlipNumber,
  withSlipNumberRetry, SLIP_RETRY_LIMIT,
} from './patientIds';

beforeEach(() => {
  vi.clearAllMocks();
  resetAllocatorWarning();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const supabaseReturning = (result: any) => ({ rpc: vi.fn().mockResolvedValue(result) });

describe('Allocating patient ids (D-04)', () => {
  it('takes the number the database hands out', async () => {
    const supabase = supabaseReturning({ data: 10000042, error: null });

    await expect(allocatePatientId(supabase, 'org-1', 'patients')).resolves.toBe(10000042);
    expect(supabase.rpc).toHaveBeenCalledWith('allocate_numeric_id', {
      p_organization_id: 'org-1',
      p_entity: 'patients',
      p_count: 1,
    });
  });

  it('allocates profiles from their own counter, not the patients one', async () => {
    const supabase = supabaseReturning({ data: 10000007, error: null });

    await allocatePatientId(supabase, 'org-1', 'patient_profiles');

    expect(supabase.rpc.mock.calls[0][1].p_entity).toBe('patient_profiles');
  });

  it('hands out a different number each time, unlike the random ids it replaces', async () => {
    let next = 10000001;
    const supabase = { rpc: vi.fn().mockImplementation(async () => ({ data: next++, error: null })) };

    const ids = [
      await allocatePatientId(supabase, 'org-1', 'patients'),
      await allocatePatientId(supabase, 'org-1', 'patients'),
      await allocatePatientId(supabase, 'org-1', 'patients'),
    ];

    expect(new Set(ids).size).toBe(3);
  });

  // The same guard the wallet functions use: a release must not break
  // registration on a database where the migration has not been applied.
  it('falls back to the old random id when the function is not deployed', async () => {
    const supabase = supabaseReturning({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });

    const id = await allocatePatientId(supabase, 'org-1', 'patients');

    expect(id).toBeGreaterThanOrEqual(10000000);
    expect(id).toBeLessThan(100000000);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('allocate_numeric_id is not deployed'));
  });

  it('warns once per session rather than on every registration', async () => {
    const supabase = supabaseReturning({ data: null, error: { code: '42883', message: 'undefined function' } });

    await allocatePatientId(supabase, 'org-1', 'patients');
    await allocatePatientId(supabase, 'org-1', 'patients');

    expect((console.warn as any).mock.calls.filter((c: any[]) => /not deployed/.test(c[0])).length).toBe(1);
  });

  it('surfaces a real allocation failure instead of quietly inventing an id', async () => {
    const supabase = supabaseReturning({ data: null, error: { code: '23514', message: 'ID_SPACE_EXHAUSTED' } });

    await expect(allocatePatientId(supabase, 'org-1', 'patients')).rejects.toThrow('ID_SPACE_EXHAUSTED');
  });
});

describe('Recognising a slip number that has just been taken (D-06)', () => {
  it('recognises the Postgres unique violation', () => {
    expect(isDuplicateSlipNumber({ code: '23505', message: 'duplicate key value violates unique constraint "patients_org_slip_number_key"' })).toBe(true);
  });

  it('recognises the SQLite unique violation', () => {
    expect(isDuplicateSlipNumber({ message: 'UNIQUE constraint failed: patients.organization_id, patients.slip_number' })).toBe(true);
  });

  it('does not mistake a different unique violation for a slip clash', () => {
    expect(isDuplicateSlipNumber({ code: '23505', message: 'duplicate key value violates unique constraint "patients_pkey"' })).toBe(false);
  });

  it('does not mistake an ordinary failure for a slip clash', () => {
    expect(isDuplicateSlipNumber({ message: 'network timeout' })).toBe(false);
  });
});

describe('Retrying with the next slip number (D-06)', () => {
  const duplicate = () => Object.assign(new Error('UNIQUE constraint failed: patients.slip_number'), {});

  it('takes the next number and succeeds when another desk got there first', async () => {
    const attempt = vi.fn()
      .mockRejectedValueOnce(duplicate())
      .mockResolvedValueOnce('registered');
    const nextSlip = vi.fn().mockResolvedValue('ATD/20260904/0008');

    await expect(
      withSlipNumberRetry('ATD/20260904/0007', nextSlip, attempt),
    ).resolves.toBe('registered');

    expect(attempt.mock.calls.map(c => c[0])).toEqual(['ATD/20260904/0007', 'ATD/20260904/0008']);
  });

  it('does not retry a failure that has nothing to do with the slip number', async () => {
    const attempt = vi.fn().mockRejectedValue(new Error('Insufficient wallet balance'));
    const nextSlip = vi.fn();

    await expect(withSlipNumberRetry('ATD/20260904/0007', nextSlip, attempt)).rejects.toThrow('Insufficient wallet balance');
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(nextSlip).not.toHaveBeenCalled();
  });

  it('gives up rather than looping forever', async () => {
    const attempt = vi.fn().mockRejectedValue(duplicate());
    const nextSlip = vi.fn().mockResolvedValue('ATD/20260904/0008');

    await expect(withSlipNumberRetry('ATD/20260904/0007', nextSlip, attempt)).rejects.toThrow(/UNIQUE constraint/);
    expect(attempt).toHaveBeenCalledTimes(SLIP_RETRY_LIMIT);
  });

  it('does not go near the database when the first attempt works', async () => {
    const attempt = vi.fn().mockResolvedValue('registered');
    const nextSlip = vi.fn();

    await withSlipNumberRetry('ATD/20260904/0007', nextSlip, attempt);

    expect(nextSlip).not.toHaveBeenCalled();
  });
});
