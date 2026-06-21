import { NextResponse } from 'next/server';
import { getDb, queueSync } from '@/lib/localDb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');

    if (!orgId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM custom_tests 
      WHERE organization_id = ? 
      ORDER BY name ASC
    `);
    const rows = stmt.all(orgId) as any[];

    // Parse parameters from JSON strings
    const tests = rows.map((r: any) => ({
      id: r.id,
      organization_id: r.organization_id,
      name: r.name,
      department: r.department,
      category: r.category,
      specimen: r.specimen,
      parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters) : r.parameters,
      is_active: r.is_active === 1,
      updated_at: r.updated_at
    }));

    return NextResponse.json(tests);
  } catch (error: any) {
    console.error('API GET /api/custom-tests error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, test, updates, organizationId } = body;
    const db = getDb();
    const nowStr = new Date().toISOString();

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    if (action === 'add') {
      const stmt = db.prepare(`
        INSERT INTO custom_tests (
          id, organization_id, name, department, category, specimen, parameters, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        test.id,
        organizationId,
        test.name,
        test.department,
        test.category,
        test.specimen,
        test.parameters || '[]',
        1,
        nowStr
      );

      // Log in outbox
      queueSync(db, 'custom_tests', 'INSERT', `${organizationId}:${test.id}`, {
        id: test.id,
        organization_id: organizationId,
        name: test.name,
        department: test.department,
        category: test.category,
        specimen: test.specimen,
        parameters: typeof test.parameters === 'string' ? JSON.parse(test.parameters) : test.parameters,
        is_active: true,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      const stmt = db.prepare(`
        INSERT INTO custom_tests (id, organization_id, name, department, category, specimen, parameters, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(organization_id, id) DO UPDATE SET
          name = COALESCE(excluded.name, custom_tests.name),
          department = COALESCE(excluded.department, custom_tests.department),
          category = COALESCE(excluded.category, custom_tests.category),
          specimen = COALESCE(excluded.specimen, custom_tests.specimen),
          parameters = COALESCE(excluded.parameters, custom_tests.parameters),
          is_active = COALESCE(excluded.is_active, custom_tests.is_active),
          updated_at = excluded.updated_at
      `);

      stmt.run(
        id,
        organizationId,
        updates.name !== undefined ? updates.name : null,
        updates.department !== undefined ? updates.department : null,
        updates.category !== undefined ? updates.category : null,
        updates.specimen !== undefined ? updates.specimen : null,
        updates.parameters !== undefined ? updates.parameters : null,
        updates.is_active !== undefined ? updates.is_active : null,
        nowStr
      );

      // Log in outbox
      // Fetch current state from DB to send correct full object for replication
      const getStmt = db.prepare(`SELECT * FROM custom_tests WHERE organization_id = ? AND id = ?`);
      const row = getStmt.get(organizationId, id) as any;

      queueSync(db, 'custom_tests', 'INSERT', `${organizationId}:${id}`, {
        id: row.id,
        organization_id: row.organization_id,
        name: row.name,
        department: row.department,
        category: row.category,
        specimen: row.specimen,
        parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
        is_active: row.is_active === 1,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const stmt = db.prepare(`
        DELETE FROM custom_tests 
        WHERE organization_id = ? AND id = ?
      `);
      stmt.run(organizationId, id);

      // Log in outbox
      queueSync(db, 'custom_tests', 'DELETE', `${organizationId}:${id}`, {});

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('API POST /api/custom-tests error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
