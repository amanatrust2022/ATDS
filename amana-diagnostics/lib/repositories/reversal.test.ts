import { describe, it, expect, beforeEach, vi } from 'vitest';

const createClientMock = vi.fn();
vi.mock('@/lib/supabase', () => ({ createClient: () => createClientMock() }));
vi.mock('@/lib/runtimeMode', () => ({ RUNTIME_MODE: 'cloud', isLocalMode: () => false }));

import { cloudBillingRepository } from './billing';

/**
 * Reversing a charge that should not have been made.
 *
 * There was no way to do this at all. A receptionist who charged the wrong
 * wallet — easy on a family account — could only add a compensating deposit
 * with an explanatory note, which left the wrong charge standing on the
 * patient's statement looking like a real one.
 *
 * The rule the tests below hold to: the original entry is never edited or
 * removed. A statement records what happened, and "this was reversed, and why"
 * is the truth; a charge that quietly vanishes is not.
 */

type Row = Record<string, any> | null;

/** Answers the original-transaction read, the already-reversed count, and the rpc. */
const supabaseWith = (original: Row, reversalCount = 0, rpcError: any = null) => {
  const rpcCalls: Array<{ fn: string; args: any }> = [];
  const writes: Array<{ table: string; method: string }> = [];

  const client: any = {
    rpc(fn: string, args: any) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: null, error: rpcError });
    },
    from(table: string) {
      const builder: any = {
        // A `head: true` count query resolves with a count; a row read resolves with data.
        then: (resolve: any) => resolve({ data: original, error: null, count: reversalCount }),
      };
      for (const m of ['select', 'eq', 'maybeSingle', 'insert', 'update', 'delete']) {
        builder[m] = (...a: any[]) => { writes.push({ table, method: m }); return builder; };
      }
      return builder;
    },
  };
  return { client, rpcCalls, writes };
};

const charge = (over: Record<string, any> = {}) => ({
  id: 'tx-1',
  organization_id: 'org-1',
  billing_account_id: 'acc-1',
  patient_id: 42,
  type: 'charge',
  amount: -2500,
  description: 'PHARMACY Bill - Ref: R-1',
  payment_method: 'wallet',
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('Reversing a wallet charge', () => {
  it('gives back exactly what the charge took', async () => {
    const sb = supabaseWith(charge());
    createClientMock.mockReturnValue(sb.client);

    await cloudBillingRepository.reverseTransaction('tx-1', 'Charged the wrong family member', 'Reception', 'org-1');

    expect(sb.rpcCalls[0].fn).toBe('deposit_to_wallet');
    expect(sb.rpcCalls[0].args.p_account).toMatchObject({ id: 'acc-1', amount: 2500 });
  });

  it('writes a reversal entry that names what it undoes', async () => {
    const sb = supabaseWith(charge());
    createClientMock.mockReturnValue(sb.client);

    await cloudBillingRepository.reverseTransaction('tx-1', 'Charged the wrong family member', 'Reception', 'org-1');

    expect(sb.rpcCalls[0].args.p_ledger).toMatchObject({
      type: 'reversal',
      amount: 2500,
      reference_id: 'tx-1',
      billing_account_id: 'acc-1',
      created_by: 'Reception',
    });
  });

  it('carries the reason onto the statement', async () => {
    const sb = supabaseWith(charge());
    createClientMock.mockReturnValue(sb.client);

    await cloudBillingRepository.reverseTransaction('tx-1', 'Charged the wrong family member', 'Reception', 'org-1');

    expect(sb.rpcCalls[0].args.p_ledger.description).toContain('Charged the wrong family member');
    expect(sb.rpcCalls[0].args.p_ledger.description).toContain('PHARMACY Bill - Ref: R-1');
  });

  // The original stays. Everything below is about refusing to make that untrue.

  it('never updates or deletes the entry being reversed', async () => {
    const sb = supabaseWith(charge());
    createClientMock.mockReturnValue(sb.client);

    await cloudBillingRepository.reverseTransaction('tx-1', 'wrong wallet', 'Reception', 'org-1');

    expect(sb.writes.some(w => w.method === 'update' || w.method === 'delete')).toBe(false);
  });

  it('refuses a second reversal of the same charge', async () => {
    const sb = supabaseWith(charge(), 1);
    createClientMock.mockReturnValue(sb.client);

    await expect(cloudBillingRepository.reverseTransaction('tx-1', 'again', 'Reception', 'org-1'))
      .rejects.toThrow('already been reversed');

    expect(sb.rpcCalls).toHaveLength(0);
  });

  it('refuses to reverse a reversal', async () => {
    const sb = supabaseWith(charge({ type: 'reversal', amount: 2500 }));
    createClientMock.mockReturnValue(sb.client);

    await expect(cloudBillingRepository.reverseTransaction('tx-1', 'undo the undo', 'Reception', 'org-1'))
      .rejects.toThrow('itself a reversal');
  });

  /**
   * Undoing a deposit has to take money out, and the function this goes through
   * only ever puts money in. Refused before anything is written, because
   * discovering it afterwards would mean the money had already been handed over.
   */
  it('refuses to reverse a deposit, and writes nothing', async () => {
    const sb = supabaseWith(charge({ type: 'deposit', amount: 5000 }));
    createClientMock.mockReturnValue(sb.client);

    await expect(cloudBillingRepository.reverseTransaction('tx-1', 'mistake', 'Reception', 'org-1'))
      .rejects.toThrow(/deposit is not supported/);

    expect(sb.rpcCalls).toHaveLength(0);
  });

  it('refuses an entry that is not there', async () => {
    const sb = supabaseWith(null);
    createClientMock.mockReturnValue(sb.client);

    await expect(cloudBillingRepository.reverseTransaction('ghost', 'x', 'Reception', 'org-1'))
      .rejects.toThrow('could not be found');
  });

  it('says what to do when the database function is missing', async () => {
    const sb = supabaseWith(charge(), 0, { code: 'PGRST202', message: 'Could not find the function' });
    createClientMock.mockReturnValue(sb.client);

    await expect(cloudBillingRepository.reverseTransaction('tx-1', 'x', 'Reception', 'org-1'))
      .rejects.toThrow(/supabase_deposit_atomicity\.sql/);
  });
});
