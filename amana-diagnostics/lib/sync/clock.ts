/**
 * The hub's idea of what time it is, corrected to the cloud's.
 *
 * Every row carries an `updated_at`, and when the hub and the cloud both
 * change the same row, the newer stamp wins. The cloud stamps its rows with
 * its own clock. The hub stamped its rows with the clinic PC's clock — which
 * on a machine that has never seen a time server can be minutes out, and a
 * hub that runs ahead wins every conflict it should lose.
 *
 * The cloud tells the hub the time on every response, in the `Date` header.
 * The sync engine reads it, keeps the difference, and every hub write stamps
 * itself with `hubNowIso()` instead of `new Date()`. One second of
 * resolution — the header carries no more — is a great deal better than
 * "whatever the BIOS thinks".
 *
 * On `globalThis` for the same reason the change bus is: Next.js can load a
 * module more than once per process, and the offset must be one number.
 */

interface Clock {
  offsetMs: number;
  learnedAt: number | null;
}

const g = globalThis as typeof globalThis & { __redianClock?: Clock };
const clock: Clock = g.__redianClock ?? (g.__redianClock = { offsetMs: 0, learnedAt: null });

/** Ignore a jump this large: a header from a broken proxy, not the cloud. */
const MAX_PLAUSIBLE_OFFSET_MS = 24 * 60 * 60 * 1000;

/**
 * Records the difference between the cloud's clock and this machine's from
 * a response header. Returns the offset in effect afterwards.
 */
export function learnCloudClock(dateHeader: string | null | undefined, localNow: number = Date.now()): number {
  if (!dateHeader) return clock.offsetMs;
  const cloud = Date.parse(dateHeader);
  if (Number.isNaN(cloud)) return clock.offsetMs;
  const offset = cloud - localNow;
  if (Math.abs(offset) > MAX_PLAUSIBLE_OFFSET_MS) return clock.offsetMs;
  clock.offsetMs = offset;
  clock.learnedAt = localNow;
  return clock.offsetMs;
}

/** Restores an offset saved from a previous run, before the cloud has answered this one. */
export function restoreClockOffset(offsetMs: number): void {
  if (Number.isFinite(offsetMs) && Math.abs(offsetMs) <= MAX_PLAUSIBLE_OFFSET_MS) clock.offsetMs = offsetMs;
}

export function clockOffsetMs(): number {
  return clock.offsetMs;
}

/** Now, in the cloud's clock. */
export function hubNow(): Date {
  return new Date(Date.now() + clock.offsetMs);
}

/** Now, in the cloud's clock, as the ISO string every `updated_at` holds. */
export function hubNowIso(): string {
  return hubNow().toISOString();
}
