import { NextResponse } from 'next/server';
import { getDb, queueSync } from '@/lib/localDb';
import { isHubServer } from '@/lib/runtimeMode';
import { COMMAND_PREFIX } from '@/lib/sync/tables';

/**
 * A staff change made on a hub.
 *
 * Changing a colleague's role or removing them touches the auth service as
 * well as the profiles table, so only the cloud's `/api/staff/update` can
 * do it fully. A hub used to call that route straight from the screen when
 * it happened to have a session, and otherwise did nothing but rewrite its
 * own copy of the profile — the change never left the building, and the
 * screen said "skipped".
 *
 * Now the hub does what the hub can do (its own copy, so the directory is
 * right at once) and queues the rest as a command row in the sync outbox.
 * The engine POSTs it to the cloud under the next administrator's session,
 * online or not, now or later. The badge shows it waiting until then.
 */

const ASSIGNABLE_ROLES = ['reception', 'lab', 'lab_tech', 'radiology', 'admin'];

export async function POST(request: Request) {
  if (!isHubServer()) {
    return NextResponse.json({ error: 'Not available in cloud mode' }, { status: 404 });
  }
  try {
    const { action, staffId, role } = await request.json();
    if (!staffId || !action) {
      return NextResponse.json({ error: 'Missing staffId or action' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM profiles WHERE id = ?').get(staffId);
    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found on this hub' }, { status: 404 });
    }

    if (action === 'update_role') {
      if (!role || !ASSIGNABLE_ROLES.includes(role)) {
        return NextResponse.json({ error: `Unknown role: ${role}` }, { status: 400 });
      }
      db.prepare('UPDATE profiles SET role = ? WHERE id = ?').run(role, staffId);
      queueSync(db, `${COMMAND_PREFIX}api/staff/update`, 'INSERT', `${staffId}:role`, { action, staffId, role });
      return NextResponse.json({ success: true, queued: true });
    }

    if (action === 'remove_staff') {
      db.prepare('UPDATE profiles SET organization_id = NULL WHERE id = ?').run(staffId);
      queueSync(db, `${COMMAND_PREFIX}api/staff/update`, 'INSERT', `${staffId}:remove`, { action, staffId });
      return NextResponse.json({ success: true, queued: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API POST /api/staff/hub error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
