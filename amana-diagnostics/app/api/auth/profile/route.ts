import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireUser, authErrorResponse } from '@/lib/apiAuth';

/**
 * The fallback that writes a profile row when the browser's own write is
 * blocked by row-level security. Used during sign-up.
 *
 * It previously took a `userId` and a whole profile object from the request
 * body and upserted it with the service-role key, unauthenticated. That let
 * anyone write any profile row with any `role` and any `organization_id` —
 * administrator of any clinic, for the cost of one HTTP request.
 *
 * Three rules now hold:
 *
 *   1. the row written is always the caller's own (`auth.uid()`), never a
 *      `userId` from the body;
 *   2. an existing profile's `role` and `organization_id` are never changed
 *      here — those move only through an invitation or the staff screen;
 *   3. a *new* profile may claim admin of a workspace only when that workspace
 *      has no members yet, which is the sign-up case and nothing else.
 */
export async function POST(request: Request) {
  try {
    const caller = await requireUser(request);
    const body = await request.json();
    const submitted = body?.profile;

    if (!submitted) {
      return NextResponse.json({ error: 'Missing profile' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Details the account holder owns and may always correct about themselves.
    const ownDetails = {
      id: caller.id,
      email: caller.email,
      full_name: submitted.full_name ?? submitted.fullName ?? null,
      title: submitted.title ?? null,
      signature_url: submitted.signature_url ?? null,
    };

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id, role, organization_id')
      .eq('id', caller.id)
      .maybeSingle();

    if (existing) {
      // Rule 2: standing in the clinic is not self-service.
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(ownDetails)
        .eq('id', caller.id)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[auth/profile] supabase update failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: data || { id: caller.id } });
    }

    // Rule 3: a first profile may only take admin of an empty workspace — the
    // one the caller has just created for themselves during sign-up.
    const requestedOrg: string | null = submitted.organization_id ?? null;
    let role = 'reception';
    let organizationId: string | null = null;

    if (requestedOrg) {
      const { count, error: countErr } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', requestedOrg);

      if (countErr) {
        console.error('[auth/profile] could not check workspace membership:', countErr);
        return NextResponse.json({ error: 'Could not verify workspace' }, { status: 500 });
      }

      if ((count ?? 0) === 0) {
        organizationId = requestedOrg;
        role = 'admin';
      } else {
        // Someone is already in that workspace, so this is not a sign-up.
        // Joining an existing clinic happens through an invitation.
        console.warn(`[auth/profile] refused to attach ${caller.id} to populated workspace ${requestedOrg}`);
        return NextResponse.json(
          { error: 'This workspace already exists. Ask an administrator to invite you.' },
          { status: 403 },
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({ ...ownDetails, role, organization_id: organizationId })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[auth/profile] supabase insert failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || { id: caller.id } });
  } catch (error: any) {
    const denied = authErrorResponse(error);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    console.error('[auth/profile] route failed:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
