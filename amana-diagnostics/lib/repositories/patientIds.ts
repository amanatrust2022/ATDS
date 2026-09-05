import { isMissingFunction, RpcError } from './rpcErrors';
import { generatePatientId } from './patientMappers';

/**
 * Where a cloud patient or profile id comes from.
 *
 * Ids used to be drawn at random from 90 million values. By the ordinary
 * birthday maths that becomes more likely than not to repeat at around 11,000
 * records, and it gets worse with every registration — a collision reaching a
 * receptionist as an unreadable primary-key error mid-registration.
 *
 * They now come from a counter in the database (`allocate_numeric_id`, in
 * supabase_id_and_slip_integrity.sql), which hands out each number once.
 *
 * The on-premise hub already did this; see lib/idGenerator.ts.
 */

export type IdEntity = 'patients' | 'patient_profiles';

/** Set once per session so the warning below is not printed on every registration. */
let warnedMissingAllocator = false;

/**
 * Reserves one id.
 *
 * Falls back to the old random id if the function is not deployed yet, so an
 * app release cannot outrun the migration — the same guard the wallet functions
 * use. The fallback carries the old collision risk and says so out loud.
 */
export async function allocatePatientId(supabase: any, organizationId: string, entity: IdEntity): Promise<number> {
  const { data, error } = await supabase.rpc('allocate_numeric_id', {
    p_organization_id: organizationId,
    p_entity: entity,
    p_count: 1,
  });

  if (!error && data != null) return Number(data);

  if (error && !isMissingFunction(error as RpcError)) {
    throw new Error((error as RpcError).message || `Could not allocate an id for ${entity}`);
  }

  if (!warnedMissingAllocator) {
    warnedMissingAllocator = true;
    console.warn(
      '[patients] allocate_numeric_id is not deployed; falling back to random ids, which can ' +
      'collide. Apply supabase_id_and_slip_integrity.sql to fix this.',
    );
  }
  return generatePatientId();
}

/** Exposed for tests: forgets that the warning has already been printed. */
export function resetAllocatorWarning() {
  warnedMissingAllocator = false;
}

/**
 * True when the database refused a write because that slip number is already
 * taken — Postgres reports 23505 for a unique violation, SQLite says so in
 * the message.
 */
export function isDuplicateSlipNumber(error: RpcError): boolean {
  const message = error.message || '';
  if (error.code === '23505') return /slip_number/i.test(message) || message === '';
  return /UNIQUE constraint failed:.*slip_number|patients_org_slip_number_key/i.test(message);
}

/** How many times registration will take the next slip number and try again. */
export const SLIP_RETRY_LIMIT = 5;

/**
 * Runs `attempt` with a slip number, taking a fresh one and retrying if the
 * database says that number has just been taken by another desk.
 *
 * Two front desks counting today's registrations at the same moment both
 * arrive at the same next number. Rather than trying to stop that happening,
 * the database refuses the second one and this quietly moves it along.
 *
 * `attempt` must leave nothing behind when it throws, or a retry will duplicate
 * whatever it did before failing.
 */
export async function withSlipNumberRetry<T>(
  slipNumber: string,
  nextSlipNumber: () => Promise<string>,
  attempt: (slip: string) => Promise<T>,
): Promise<T> {
  let slip = slipNumber;

  for (let tries = 1; ; tries++) {
    try {
      return await attempt(slip);
    } catch (err: any) {
      if (!isDuplicateSlipNumber(err) || tries >= SLIP_RETRY_LIMIT) throw err;
      console.warn(`[patients] Slip ${slip} was taken by another desk; taking the next one.`);
      slip = await nextSlipNumber();
    }
  }
}
