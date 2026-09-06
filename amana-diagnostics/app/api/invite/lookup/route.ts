import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * What is behind this invitation link?
 *
 * The invite page used to read the `invitations` table straight from the
 * browser. That worked because the table carried an anon-readable policy —
 * which also meant anybody at all could list every pending invitation in the
 * system, tokens included, and accept one. That policy is gone
 * (supabase_tighten_rls.sql), so this route is how the page learns what it
 * needs.
 *
 * Unauthenticated by necessity: the person clicking the link has no account
 * yet. Holding the token is the whole of the authorisation, exactly as it was
 * before — the difference is that now the token has to be known in advance
 * rather than being listable.
 *
 * It answers with the four things the page shows and nothing else. In
 * particular it does not echo the token back, and it never returns a row for a
 * different invitation: an unknown, expired or already-accepted token is a flat
 * 404, with no hint as to which of the three it was.
 */
export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const admin = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from('invitations')
      .select('id, email, role, organization_id, organizations(name)')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
    }

    const row = data as any;
    const organization = Array.isArray(row.organizations)
      ? row.organizations[0]
      : row.organizations;

    return NextResponse.json({
      id: row.id,
      email: row.email,
      role: row.role,
      organizationName: organization?.name ?? null,
    });
  } catch (error: any) {
    console.error('API /api/invite/lookup error:', error);
    return NextResponse.json({ error: 'Could not read invitation' }, { status: 500 });
  }
}
