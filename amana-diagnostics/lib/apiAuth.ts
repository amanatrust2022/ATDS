import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Who is calling a server route.
 *
 * Several routes here hold the service-role key, which bypasses every
 * row-level security rule in the database. They were written as internal
 * helpers and then deployed to the public internet with no check of any kind,
 * so anyone who knew the URL could set any user's role or read across clinics.
 *
 * A route holding that key must establish three things before it acts, and this
 * module is the one place that does it:
 *
 *   1. the caller has a valid session (`requireUser`),
 *   2. the caller holds the role the action needs (`requireAdmin`),
 *   3. the thing being acted on belongs to the caller's clinic
 *      (`assertSameOrganization`).
 *
 * The third is the one that is easy to forget and the one that lets a real
 * administrator of one clinic act on another.
 */

export interface Caller {
  id: string;
  email: string | null;
  role: string | null;
  organizationId: string | null;
}

/** Thrown by the guards below; carries the status the route should return. */
export class AuthError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new AuthError(500, 'Server misconfiguration: Supabase service credentials missing');
  }
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) throw new AuthError(401, 'Authentication required');
  const token = header.slice(7).trim();
  if (!token) throw new AuthError(401, 'Authentication required');
  return token;
}

/**
 * Resolves the caller from their bearer token.
 *
 * The role and organisation come from the `profiles` table, never from the
 * token's `user_metadata` — that field is writable by the user themselves
 * through the ordinary client SDK, so a role read from it is a role the user
 * chose for themselves.
 */
export async function requireUser(request: Request): Promise<Caller> {
  const token = bearerToken(request);
  const admin = serviceClient();

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new AuthError(401, 'Invalid or expired session');

  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization_id')
    .eq('id', data.user.id)
    .maybeSingle();

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: (profile as any)?.role ?? null,
    organizationId: (profile as any)?.organization_id ?? null,
  };
}

/** As `requireUser`, and the caller must be an administrator of some clinic. */
export async function requireAdmin(request: Request): Promise<Caller> {
  const caller = await requireUser(request);
  if (caller.role !== 'admin') throw new AuthError(403, 'Administrator access required');
  if (!caller.organizationId) throw new AuthError(403, 'Your account is not attached to a workspace');
  return caller;
}

/**
 * Refuses an action aimed at another clinic's data.
 *
 * Being an administrator is not enough on its own: without this, an
 * administrator of one clinic can act on the staff and records of every other.
 */
export function assertSameOrganization(caller: Caller, targetOrganizationId: string | null | undefined): void {
  if (!targetOrganizationId || targetOrganizationId !== caller.organizationId) {
    // Deliberately the same message either way, so this cannot be used to
    // discover which ids exist in other clinics.
    throw new AuthError(404, 'Not found in this workspace');
  }
}

/** Looks up which clinic a user belongs to, for `assertSameOrganization`. */
export async function organizationOfUser(userId: string): Promise<string | null> {
  const admin = serviceClient();
  const { data } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
  return (data as any)?.organization_id ?? null;
}

/** Turns an AuthError into the response it describes; rethrows anything else. */
export function authErrorResponse(err: unknown): { error: string; status: number } | null {
  if (err instanceof AuthError) return { error: err.message, status: err.status };
  return null;
}
