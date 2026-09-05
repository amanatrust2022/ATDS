import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireAdmin, assertSameOrganization, organizationOfUser, authErrorResponse } from '@/lib/apiAuth';

/**
 * Changing a colleague's role, or removing them from the clinic.
 *
 * This route holds the service-role key, so it bypasses row-level security
 * entirely. It previously had no authentication at all: anyone who knew the URL
 * could promote themselves to administrator, or remove any member of any
 * clinic, without a session. Every action here is now gated on an administrator
 * of the same workspace as the person being acted on.
 */
export async function POST(request: Request) {
  try {
    const caller = await requireAdmin(request);
    const { action, staffId, role } = await request.json();

    if (!staffId || !action) {
      return NextResponse.json({ error: 'Missing staffId or action' }, { status: 400 });
    }

    // Being an administrator somewhere is not permission to act everywhere.
    assertSameOrganization(caller, await organizationOfUser(staffId));

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!key) {
      return NextResponse.json({ error: 'Server misconfiguration: Service Role Key missing' }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    if (action === 'update_role') {
      if (!role) return NextResponse.json({ error: 'Missing role' }, { status: 400 });
      if (!ASSIGNABLE_ROLES.includes(role)) {
        return NextResponse.json({ error: `Unknown role: ${role}` }, { status: 400 });
      }
      // Without this an administrator can demote themselves and leave the
      // clinic with nobody able to manage staff.
      if (staffId === caller.id && role !== 'admin') {
        return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
      }

      // 1. Update Auth metadata
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(staffId, {
        user_metadata: { role }
      });
      if (authErr) throw authErr;

      // 2. Update Profiles
      const { error: profErr } = await supabaseAdmin.from('profiles').update({ role }).eq('id', staffId);
      if (profErr) throw profErr;

      return NextResponse.json({ success: true });
    }

    if (action === 'remove_staff') {
      if (staffId === caller.id) {
        return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
      }

      // 1. Get current metadata to preserve other fields
      const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(staffId);
      if (userErr || !user) throw userErr || new Error('User not found');

      // 2. Update Auth metadata
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(staffId, {
        user_metadata: { ...user.user_metadata, organization_id: null }
      });
      if (authErr) throw authErr;

      // 3. Update Profiles
      const { error: profErr } = await supabaseAdmin
        .from('profiles')
        .update({ organization_id: null })
        .eq('id', staffId);
      if (profErr) throw profErr;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    const denied = authErrorResponse(error);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    console.error('API /api/staff/update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** The roles the app understands. Anything else is a typo or an attempt. */
const ASSIGNABLE_ROLES = ['admin', 'reception', 'lab', 'lab_tech', 'radiology'];
