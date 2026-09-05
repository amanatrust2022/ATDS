import crypto from 'crypto';
import { getDb } from './localDb';
import { isLocalMode, getPortalSupabase } from './portalDb';

/**
 * One-time codes for the patient portal.
 *
 * The previous scheme was stateless: the code was HMAC'd into a token handed
 * back to the browser, and verification was a pure function of what the caller
 * sent. Nothing counted attempts, so the same token could be submitted with a
 * different six-digit code as many times as anyone liked — a million guesses
 * with no lockout, protecting a patient's diagnostic results. Nothing limited
 * how many codes could be requested for an address either.
 *
 * A challenge is now a row. It can be attempted a few times and used once.
 */

/** Wrong guesses allowed before a challenge is dead. */
export const MAX_ATTEMPTS = 5;
/** How long a code stays good. */
export const TTL_MS = 10 * 60 * 1000;
/** Codes that may be requested for one address inside the window below. */
export const MAX_CHALLENGES_PER_WINDOW = 5;
export const REQUEST_WINDOW_MS = 15 * 60 * 1000;

export interface Challenge {
  id: string;
  email: string;
  code_hash: string;
  expires_at: number;
  attempts: number;
  consumed: number;
}

/**
 * Six digits from a cryptographic source.
 *
 * `Math.random()` is not one: its output is predictable from previous values,
 * which for a credential is the whole ballgame.
 */
export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Salted so the stored value is not the code, and per-challenge so two are never equal. */
export function hashOtp(challengeId: string, email: string, code: string): string {
  return crypto.createHash('sha256').update(`${challengeId}|${email}|${code}`).digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ─── Storage ────────────────────────────────────────────────────────────────

function localDb() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS portal_otp_challenges (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

/** How many codes have been asked for at this address recently. */
export async function recentChallengeCount(email: string): Promise<number> {
  const since = Date.now() - REQUEST_WINDOW_MS;

  if (isLocalMode()) {
    const row = localDb()
      .prepare('SELECT COUNT(*) as count FROM portal_otp_challenges WHERE email = ? AND created_at > ?')
      .get(email, since) as { count: number };
    return row.count;
  }

  const supabase = getPortalSupabase();
  const { count } = await supabase
    .from('portal_otp_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gt('created_at', since);
  return count ?? 0;
}

export async function createChallenge(email: string, code: string): Promise<string> {
  const id = crypto.randomUUID();
  const row = {
    id,
    email,
    code_hash: hashOtp(id, email, code),
    expires_at: Date.now() + TTL_MS,
    attempts: 0,
    consumed: 0,
    created_at: Date.now(),
  };

  if (isLocalMode()) {
    localDb()
      .prepare(`INSERT INTO portal_otp_challenges (id, email, code_hash, expires_at, attempts, consumed, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(row.id, row.email, row.code_hash, row.expires_at, 0, 0, row.created_at);
    return id;
  }

  const supabase = getPortalSupabase();
  const { error } = await supabase.from('portal_otp_challenges').insert([row]);
  if (error) throw error;
  return id;
}

/**
 * Checks one guess against a challenge, spending an attempt whether or not it
 * was right.
 *
 * Returns the email the challenge was issued for, or null. The caller is told
 * nothing about *why* it failed: distinguishing "wrong code" from "too many
 * attempts" from "no such challenge" hands back information for free.
 */
export async function consumeChallenge(challengeId: string, submittedCode: string): Promise<string | null> {
  const now = Date.now();

  if (isLocalMode()) {
    const db = localDb();
    const row = db
      .prepare('SELECT * FROM portal_otp_challenges WHERE id = ?')
      .get(challengeId) as Challenge | undefined;

    if (!row || row.consumed || row.attempts >= MAX_ATTEMPTS || row.expires_at < now) return null;

    // Spent before the comparison, so a crash mid-check cannot give a free guess.
    db.prepare('UPDATE portal_otp_challenges SET attempts = attempts + 1 WHERE id = ?').run(challengeId);

    if (!timingSafeEqualHex(row.code_hash, hashOtp(row.id, row.email, submittedCode.trim()))) return null;

    db.prepare('UPDATE portal_otp_challenges SET consumed = 1 WHERE id = ?').run(challengeId);
    return row.email;
  }

  const supabase = getPortalSupabase();
  const { data: row } = await supabase
    .from('portal_otp_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();

  const challenge = row as Challenge | null;
  if (!challenge || challenge.consumed || challenge.attempts >= MAX_ATTEMPTS || challenge.expires_at < now) {
    return null;
  }

  await supabase
    .from('portal_otp_challenges')
    .update({ attempts: challenge.attempts + 1 })
    .eq('id', challengeId);

  if (!timingSafeEqualHex(challenge.code_hash, hashOtp(challenge.id, challenge.email, submittedCode.trim()))) {
    return null;
  }

  await supabase.from('portal_otp_challenges').update({ consumed: 1 }).eq('id', challengeId);
  return challenge.email;
}

/** Clears out spent and expired challenges. Called opportunistically on request. */
export async function pruneChallenges(): Promise<void> {
  const cutoff = Date.now() - REQUEST_WINDOW_MS;
  try {
    if (isLocalMode()) {
      localDb().prepare('DELETE FROM portal_otp_challenges WHERE expires_at < ? AND created_at < ?').run(Date.now(), cutoff);
      return;
    }
    const supabase = getPortalSupabase();
    await supabase.from('portal_otp_challenges').delete().lt('expires_at', Date.now()).lt('created_at', cutoff);
  } catch (e) {
    // Housekeeping only — never fail a sign-in because tidying up did not work.
    console.warn('[portal] could not prune spent OTP challenges:', e);
  }
}
