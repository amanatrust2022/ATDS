import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Is this workspace ID available, and if it is taken, is it actually in use?
 *
 * Sign-up creates the organisation first to reserve the slug, then the account.
 * If the second step fails there is a rollback — but it runs in the browser's
 * catch block, so closing the tab or losing the connection in between leaves an
 * organisation nobody belongs to, holding a workspace ID that the clinic can
 * never claim. They pick a different one, or they call somebody.
 *
 * A workspace with no members is not a clinic; it is the wreckage of an
 * abandoned sign-up. This reports it as adoptable, and sign-up reuses it instead
 * of refusing. A real clinic always has at least its administrator, so an
 * organisation in use can never be adopted this way.
 *
 * Unauthenticated by necessity — nobody has an account at this point in
 * sign-up. It discloses only whether a workspace ID is free, which the sign-up
 * form has to tell people anyway.
 */
export async function POST(request: Request) {
  try {
    const { slug } = await request.json();

    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]{1,64}$/.test(slug)) {
      return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const admin = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: org, error } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    if (!org) return NextResponse.json({ available: true, adoptable: false });

    const { count, error: countErr } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', (org as any).id);

    if (countErr) throw countErr;

    const abandoned = (count ?? 0) === 0;

    return NextResponse.json({
      available: false,
      // Only ever true for an organisation nobody is a member of.
      adoptable: abandoned,
      organizationId: abandoned ? (org as any).id : undefined,
    });
  } catch (error: any) {
    console.error('API /api/signup/claim-slug error:', error);
    return NextResponse.json({ error: error.message || 'Could not check workspace ID' }, { status: 500 });
  }
}
