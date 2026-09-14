import { NextResponse } from 'next/server';
import { getDb, queueSync } from '@/lib/localDb';
import { isHubServer } from '@/lib/runtimeMode';

/**
 * The hub's copy of the audit log.
 *
 * A row is written here and queued for the cloud in the same call, so what
 * an administrator did on a hub with no internet still reaches the cloud's
 * log when the sync next runs. The id travels with it and the cloud upserts
 * by id, so a row is never counted twice.
 *
 * Hub only. On the web the browser writes to Supabase directly, under the
 * administrator's own session.
 */

const AUDIT_COLUMNS = [
  'id', 'organization_id', 'actor_id', 'actor_name', 'action', 'entity_type', 'entity_id',
  'entity_label', 'before', 'after', 'reason', 'reverses_id', 'origin', 'created_at',
] as const;

export async function GET(request: Request) {
  if (!isHubServer()) {
    return NextResponse.json({ error: 'Not available in cloud mode' }, { status: 404 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');
    if (!orgId) return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });

    const since = searchParams.get('since');
    const action = searchParams.get('action');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1), 1000);

    const where = ['organization_id = ?'];
    const args: unknown[] = [orgId];
    if (since) { where.push('created_at >= ?'); args.push(since); }
    if (action) { where.push('action = ?'); args.push(action); }

    const rows = getDb()
      .prepare(`SELECT * FROM audit_log WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`)
      .all(...args, limit) as any[];

    return NextResponse.json(
      rows.map((r) => ({
        ...r,
        before: parseJson(r.before),
        after: parseJson(r.after),
      })),
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isHubServer()) {
    return NextResponse.json({ error: 'Not available in cloud mode' }, { status: 404 });
  }
  try {
    const body = await request.json();
    if (!body?.id || !body?.organization_id || !body?.action || !body?.entity_type || !body?.entity_id) {
      return NextResponse.json({ error: 'Missing audit fields' }, { status: 400 });
    }

    const row: Record<string, unknown> = {};
    for (const col of AUDIT_COLUMNS) row[col] = body[col] ?? null;
    row['origin'] = 'hub';
    row['created_at'] = body.created_at || new Date().toISOString();

    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO audit_log (${AUDIT_COLUMNS.join(', ')})
      VALUES (${AUDIT_COLUMNS.map(() => '?').join(', ')})
    `).run(
      ...AUDIT_COLUMNS.map((col) =>
        col === 'before' || col === 'after'
          ? row[col] == null ? null : JSON.stringify(row[col])
          : row[col],
      ),
    );

    queueSync(db, 'audit_log', 'INSERT', String(row['id']), row);

    return NextResponse.json({ success: true, id: row['id'] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
