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
    const {
      action, staffId, role,
      // The screen's audit row for this change. The hub writes it now and the
      // command carries the same id, so the cloud's route finds it already
      // there and does not write a second.
      auditId, previousRole, reversesId, actorId, actorName, entityLabel, roleLabel,
      performanceCommissionType, performanceCommissionValue,
    } = await request.json();
    if (!staffId || !action) {
      return NextResponse.json({ error: 'Missing staffId or action' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id, organization_id, role, full_name, performance_commission_type, performance_commission_value FROM profiles WHERE id = ?').get(staffId) as any;
    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found on this hub' }, { status: 404 });
    }

    const audit = (
      auditAction: 'staff.role_changed' | 'staff.removed' | 'staff.performance_commission_changed',
      before: Record<string, unknown>,
      after: Record<string, unknown>,
    ) => {
      const row = {
        id: auditId || crypto.randomUUID(),
        organization_id: existing.organization_id,
        actor_id: actorId ?? null,
        actor_name: actorName ?? null,
        action: auditAction,
        entity_type: 'profile',
        entity_id: staffId,
        entity_label: entityLabel ?? existing.full_name ?? null,
        before,
        after,
        reason: null,
        reverses_id: reversesId ?? null,
        origin: 'hub',
        created_at: new Date().toISOString(),
      };
      db.prepare(`
        INSERT OR IGNORE INTO audit_log
          (id, organization_id, actor_id, actor_name, action, entity_type, entity_id, entity_label, before, after, reason, reverses_id, origin, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.id, row.organization_id, row.actor_id, row.actor_name, row.action, row.entity_type, row.entity_id,
        row.entity_label, JSON.stringify(row.before), JSON.stringify(row.after), row.reason, row.reverses_id,
        row.origin, row.created_at,
      );
      queueSync(db, 'audit_log', 'INSERT', row.id, row);
      return row.id;
    };

    if (action === 'update_performance_commission') {
      const validation = validatePerformanceCommission(performanceCommissionType, performanceCommissionValue);
      if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 });
      db.prepare(`
        UPDATE profiles
        SET performance_commission_type = ?, performance_commission_value = ?
        WHERE id = ?
      `).run(validation.type, validation.value, staffId);
      const id = audit(
        'staff.performance_commission_changed',
        {
          type: existing.performance_commission_type ?? 'none',
          value: Number(existing.performance_commission_value) || 0,
        },
        { type: validation.type, value: validation.value },
      );
      queueSync(db, `${COMMAND_PREFIX}api/staff/update`, 'INSERT', `${staffId}:performance-commission`, {
        action, staffId,
        performanceCommissionType: validation.type,
        performanceCommissionValue: validation.value,
        auditId: id,
        actorName: actorName ?? null,
      });
      return NextResponse.json({ success: true, queued: true, auditId: id });
    }

    if (action === 'update_role') {
      if (!role || !ASSIGNABLE_ROLES.includes(role)) {
        return NextResponse.json({ error: `Unknown role: ${role}` }, { status: 400 });
      }
      const cleanRoleLabel = typeof roleLabel === 'string' ? roleLabel.trim().slice(0, 80) || null : null;
      db.prepare('UPDATE profiles SET role = ?, role_label = ? WHERE id = ?').run(role, cleanRoleLabel, staffId);
      const id = audit('staff.role_changed', { role: previousRole ?? existing.role ?? null }, { role });
      queueSync(db, `${COMMAND_PREFIX}api/staff/update`, 'INSERT', `${staffId}:role`, {
        action, staffId, role, roleLabel: cleanRoleLabel, auditId: id, previousRole: previousRole ?? existing.role ?? null,
        reversesId: reversesId ?? null, actorName: actorName ?? null,
      });
      return NextResponse.json({ success: true, queued: true, auditId: id });
    }

    if (action === 'remove_staff') {
      db.prepare('UPDATE profiles SET organization_id = NULL WHERE id = ?').run(staffId);
      const id = audit('staff.removed', { role: existing.role ?? null }, {});
      queueSync(db, `${COMMAND_PREFIX}api/staff/update`, 'INSERT', `${staffId}:remove`, {
        action, staffId, auditId: id, actorName: actorName ?? null,
      });
      return NextResponse.json({ success: true, queued: true, auditId: id });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API POST /api/staff/hub error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function validatePerformanceCommission(type: unknown, value: unknown): {
  type: 'none' | 'percentage' | 'flat'; value: number; error?: string;
} {
  if (type !== 'none' && type !== 'percentage' && type !== 'flat') {
    return { type: 'none', value: 0, error: 'Unknown commission plan' };
  }
  const amount = type === 'none' ? 0 : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return { type, value: 0, error: 'Commission value must be zero or greater' };
  }
  if (type === 'percentage' && amount > 100) {
    return { type, value: amount, error: 'Percentage commission cannot exceed 100%' };
  }
  return { type, value: amount };
}
