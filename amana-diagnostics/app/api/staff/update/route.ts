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
    const {
      action, staffId, role,
      // The screen's audit row for this change, so the log carries one row
      // whether the call came straight from the browser or through a hub's
      // outbox — the hub wrote the same id first, and the upsert ignores it.
      auditId, previousRole, reversesId, actorName,
    } = await request.json();

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

      // 1. Read what is there. The metadata update below used to replace
      // user_metadata with `{ role }` alone, dropping organization_id and
      // the name — so a role change quietly detached the person from the
      // clinic in the auth service.
      const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(staffId);
      if (userErr || !user) throw userErr || new Error('User not found');
      const { data: current } = await supabaseAdmin
        .from('profiles').select('role, full_name').eq('id', staffId).maybeSingle();

      // 2. Update Auth metadata
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(staffId, {
        user_metadata: { ...user.user_metadata, role }
      });
      if (authErr) throw authErr;

      // 3. Update Profiles
      const { error: profErr } = await supabaseAdmin.from('profiles').update({ role }).eq('id', staffId);
      if (profErr) throw profErr;

      await writeAudit(supabaseAdmin, {
        id: auditId,
        organization_id: caller.organizationId!,
        actor_id: caller.id,
        actor_name: actorName ?? caller.email,
        action: 'staff.role_changed',
        entity_type: 'profile',
        entity_id: staffId,
        entity_label: (current as any)?.full_name ?? null,
        before: { role: previousRole ?? (current as any)?.role ?? null },
        after: { role },
        reverses_id: reversesId ?? null,
      });

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
      const { data: removed } = await supabaseAdmin
        .from('profiles').select('role, full_name').eq('id', staffId).maybeSingle();
      const { error: profErr } = await supabaseAdmin
        .from('profiles')
        .update({ organization_id: null })
        .eq('id', staffId);
      if (profErr) throw profErr;

      await writeAudit(supabaseAdmin, {
        id: auditId,
        organization_id: caller.organizationId!,
        actor_id: caller.id,
        actor_name: actorName ?? caller.email,
        action: 'staff.removed',
        entity_type: 'profile',
        entity_id: staffId,
        entity_label: (removed as any)?.full_name ?? null,
        before: { role: (removed as any)?.role ?? null },
        after: {},
        reverses_id: null,
      });

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

/**
 * The log row for a staff change, written here because this is the only
 * place the change is certain to have happened. A hub that made the same
 * change first wrote a row with the same id, so the insert ignores a
 * duplicate rather than doubling it. A log that cannot be written must not
 * unwind the change — it is reported and the call still succeeds.
 */
async function writeAudit(
  // Untyped on purpose: there is no generated database type in this repo, and
  // the client's default generics reject any table name.
  supabaseAdmin: any,
  row: {
    id?: string;
    organization_id: string;
    actor_id: string;
    actor_name: string | null;
    action: 'staff.role_changed' | 'staff.removed';
    entity_type: 'profile';
    entity_id: string;
    entity_label: string | null;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    reverses_id: string | null;
  },
) {
  const { error } = await supabaseAdmin.from('audit_log').upsert(
    { ...row, id: row.id || crypto.randomUUID(), origin: 'cloud', created_at: new Date().toISOString() },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) console.error('API /api/staff/update: audit row not written:', error.message);
}
