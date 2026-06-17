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
      SELECT * FROM radiology_templates 
      WHERE organization_id = ? 
      ORDER BY name ASC
    `);
    const templates = stmt.all(orgId) as any[];

    return NextResponse.json(templates);
  } catch (error: any) {
    console.error('API GET /api/radiology-templates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const db = getDb();
    const nowStr = new Date().toISOString();

    if (action === 'add') {
      const { template, userId } = body;
      const templateId = crypto.randomUUID();

      const stmt = db.prepare(`
        INSERT INTO radiology_templates (
          id, organization_id, key, name, findings, impression, created_at, created_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        templateId,
        template.organization_id || template.organizationId,
        template.key,
        template.name,
        template.findings,
        template.impression,
        template.created_at || nowStr,
        userId || null,
        nowStr
      );

      // Log insert in outbox
      queueSync(db, 'radiology_templates', 'INSERT', templateId, {
        id: templateId,
        organization_id: template.organization_id || template.organizationId,
        key: template.key,
        name: template.name,
        findings: template.findings,
        impression: template.impression,
        created_at: template.created_at || nowStr,
        created_by: userId || null,
        updated_at: nowStr
      });

      return NextResponse.json({ 
        id: templateId, 
        organization_id: template.organization_id || template.organizationId,
        key: template.key,
        name: template.name,
        findings: template.findings,
        impression: template.impression,
        created_at: nowStr,
        created_by: userId || null
      });
    }

    if (action === 'update') {
      const { id, updates } = body;

      const stmt = db.prepare(`
        UPDATE radiology_templates SET
          key = ?,
          name = ?,
          findings = ?,
          impression = ?,
          updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        updates.key,
        updates.name,
        updates.findings,
        updates.impression,
        nowStr,
        id
      );

      // Log update in outbox
      queueSync(db, 'radiology_templates', 'UPDATE', id, {
        key: updates.key,
        name: updates.name,
        findings: updates.findings,
        impression: updates.impression,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const { id } = body;

      const stmt = db.prepare(`
        DELETE FROM radiology_templates 
        WHERE id = ?
      `);
      stmt.run(id);

      // Log delete in outbox
      queueSync(db, 'radiology_templates', 'DELETE', id, {});

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('API POST /api/radiology-templates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
