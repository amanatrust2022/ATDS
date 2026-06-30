import { NextResponse } from 'next/server';
import { getDb, queueSync } from '@/lib/localDb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');
    const type = searchParams.get('type'); // 'doctors' or 'facilities' or 'all'

    if (!orgId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const db = getDb();

    if (type === 'facilities') {
      const stmt = db.prepare(`
        SELECT * FROM referring_facilities 
        WHERE organization_id = ? 
        ORDER BY name ASC
      `);
      const facilities = stmt.all(orgId) as any[];
      return NextResponse.json(facilities);
    }

    if (type === 'doctors') {
      const stmt = db.prepare(`
        SELECT rd.*, rf.name as facility_name 
        FROM referring_doctors rd
        LEFT JOIN referring_facilities rf ON rd.facility_id = rf.id
        WHERE rd.organization_id = ? 
        ORDER BY rd.name ASC
      `);
      const doctors = stmt.all(orgId) as any[];
      return NextResponse.json(doctors);
    }

    // Default: fetch both
    const facStmt = db.prepare(`
      SELECT * FROM referring_facilities 
      WHERE organization_id = ? 
      ORDER BY name ASC
    `);
    const facilities = facStmt.all(orgId) as any[];

    const docStmt = db.prepare(`
      SELECT rd.*, rf.name as facility_name 
      FROM referring_doctors rd
      LEFT JOIN referring_facilities rf ON rd.facility_id = rf.id
      WHERE rd.organization_id = ? 
      ORDER BY rd.name ASC
    `);
    const doctors = docStmt.all(orgId) as any[];

    return NextResponse.json({ doctors, facilities });
  } catch (error: any) {
    console.error('API GET /api/referrals error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { target, action } = body; // target: 'doctor' | 'facility'
    const db = getDb();
    const nowStr = new Date().toISOString();

    if (target === 'facility') {
      if (action === 'add') {
        const { facility, organizationId } = body;
        const facilityId = crypto.randomUUID();

        const stmt = db.prepare(`
          INSERT INTO referring_facilities (
            id, organization_id, name, address, phone, email, commission_type, commission_value, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          facilityId,
          organizationId,
          facility.name,
          facility.address || null,
          facility.phone || null,
          facility.email || null,
          facility.commission_type || 'percentage',
          facility.commission_value ?? 0,
          facility.is_active ? 1 : 0,
          facility.created_at || nowStr,
          nowStr
        );

        // Log in outbox
        queueSync(db, 'referring_facilities', 'INSERT', facilityId, {
          id: facilityId,
          organization_id: organizationId,
          name: facility.name,
          address: facility.address || null,
          phone: facility.phone || null,
          email: facility.email || null,
          commission_type: facility.commission_type || 'percentage',
          commission_value: facility.commission_value ?? 0,
          is_active: facility.is_active ?? true,
          created_at: facility.created_at || nowStr,
          updated_at: nowStr
        });

        return NextResponse.json({ id: facilityId, ...facility, organization_id: organizationId, created_at: nowStr });
      }

      if (action === 'update') {
        const { id, updates } = body;

        const stmt = db.prepare(`
          UPDATE referring_facilities SET
            name = ?,
            address = ?,
            phone = ?,
            email = ?,
            commission_type = ?,
            commission_value = ?,
            is_active = ?,
            updated_at = ?
          WHERE id = ?
        `);

        stmt.run(
          updates.name,
          updates.address || null,
          updates.phone || null,
          updates.email || null,
          updates.commission_type,
          updates.commission_value,
          updates.is_active ? 1 : 0,
          nowStr,
          id
        );

        // Log in outbox
        queueSync(db, 'referring_facilities', 'UPDATE', id, {
          name: updates.name,
          address: updates.address || null,
          phone: updates.phone || null,
          email: updates.email || null,
          commission_type: updates.commission_type,
          commission_value: updates.commission_value,
          is_active: updates.is_active ?? true,
          updated_at: nowStr
        });

        return NextResponse.json({ success: true });
      }

      if (action === 'delete') {
        const { id } = body;

        const stmt = db.prepare(`
          DELETE FROM referring_facilities 
          WHERE id = ?
        `);
        stmt.run(id);

        // Log in outbox
        queueSync(db, 'referring_facilities', 'DELETE', id, {});

        return NextResponse.json({ success: true });
      }
    }

    if (target === 'doctor') {
      if (action === 'add') {
        const { doctor, organizationId } = body;
        const doctorId = crypto.randomUUID();

        const stmt = db.prepare(`
          INSERT INTO referring_doctors (
            id, organization_id, facility_id, name, phone, email, commission_type, commission_value, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          doctorId,
          organizationId,
          doctor.facility_id || null,
          doctor.name,
          doctor.phone || null,
          doctor.email || null,
          doctor.commission_type || 'percentage',
          doctor.commission_value ?? 0,
          doctor.is_active ? 1 : 0,
          doctor.created_at || nowStr,
          nowStr
        );

        // Log in outbox
        queueSync(db, 'referring_doctors', 'INSERT', doctorId, {
          id: doctorId,
          organization_id: organizationId,
          facility_id: doctor.facility_id || null,
          name: doctor.name,
          phone: doctor.phone || null,
          email: doctor.email || null,
          commission_type: doctor.commission_type || 'percentage',
          commission_value: doctor.commission_value ?? 0,
          is_active: doctor.is_active ?? true,
          created_at: doctor.created_at || nowStr,
          updated_at: nowStr
        });

        return NextResponse.json({ id: doctorId, ...doctor, organization_id: organizationId, created_at: nowStr });
      }

      if (action === 'update') {
        const { id, updates } = body;

        const stmt = db.prepare(`
          UPDATE referring_doctors SET
            facility_id = ?,
            name = ?,
            phone = ?,
            email = ?,
            commission_type = ?,
            commission_value = ?,
            is_active = ?,
            updated_at = ?
          WHERE id = ?
        `);

        stmt.run(
          updates.facility_id || null,
          updates.name,
          updates.phone || null,
          updates.email || null,
          updates.commission_type,
          updates.commission_value,
          updates.is_active ? 1 : 0,
          nowStr,
          id
        );

        // Log in outbox
        queueSync(db, 'referring_doctors', 'UPDATE', id, {
          facility_id: updates.facility_id || null,
          name: updates.name,
          phone: updates.phone || null,
          email: updates.email || null,
          commission_type: updates.commission_type,
          commission_value: updates.commission_value,
          is_active: updates.is_active ?? true,
          updated_at: nowStr
        });

        return NextResponse.json({ success: true });
      }

      if (action === 'delete') {
        const { id } = body;

        const stmt = db.prepare(`
          DELETE FROM referring_doctors 
          WHERE id = ?
        `);
        stmt.run(id);

        // Log in outbox
        queueSync(db, 'referring_doctors', 'DELETE', id, {});

        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Unknown action or target' }, { status: 400 });
  } catch (error: any) {
    console.error('API POST /api/referrals error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
