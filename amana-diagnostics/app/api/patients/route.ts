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
    
    // Fetch patients
    const patientsStmt = db.prepare(`
      SELECT * FROM patients 
      WHERE organization_id = ? 
      ORDER BY registered_at DESC
    `);
    const patients = patientsStmt.all(orgId) as any[];

    // Fetch tests
    const testsStmt = db.prepare(`
      SELECT * FROM patient_tests 
      WHERE organization_id = ?
    `);
    const tests = testsStmt.all(orgId) as any[];

    // Map tests to patients
    const testsByPatientId = new Map<string, any[]>();
    tests.forEach((t) => {
      if (!testsByPatientId.has(t.patient_id)) {
        testsByPatientId.set(t.patient_id, []);
      }
      testsByPatientId.get(t.patient_id)!.push({
        id: t.id,
        patient_id: t.patient_id,
        testId: t.test_id,
        testName: t.test_name,
        department: t.department,
        status: t.status,
        specimen: t.specimen,
        results: t.results ? JSON.parse(t.results) : [],
        completedBy: t.completed_by,
        completedBySignatureUrl: t.completed_by_signature_url,
        completedByTitle: t.completed_by_title,
        completedAt: t.completed_at,
        notes: t.notes,
      });
    });

    const formattedPatients = patients.map((p) => ({
      id: p.id,
      slipNumber: p.slip_number,
      registeredAt: p.registered_at,
      firstName: p.first_name,
      surname: p.surname,
      middleName: p.middle_name || '',
      name: [p.first_name, p.middle_name, p.surname].filter(Boolean).join(' '),
      age: p.age,
      sex: p.sex,
      phone: p.phone,
      email: p.email || '',
      address: p.address,
      referredBy: p.referred_by || '',
      referringFacility: p.referring_facility || '',
      referringDoctorId: p.referring_doctor_id || '',
      referringFacilityId: p.referring_facility_id || '',
      commissionAssigned: p.commission_assigned === 1,
      commissionType: p.commission_type || null,
      commissionValue: p.commission_value || 0,
      commissionAmount: p.commission_amount || 0,
      commissionStatus: p.commission_status || null,
      commissionPaidAt: p.commission_paid_at || null,
      commissionPaidNotes: p.commission_paid_notes || null,
      tests: testsByPatientId.get(p.id) || []
    }));

    return NextResponse.json(formattedPatients);
  } catch (error: any) {
    console.error('API GET /api/patients error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const db = getDb();
    const nowStr = new Date().toISOString();

    if (action === 'addPatient') {
      const { patient, tests, organizationId } = body;
      const patientId = crypto.randomUUID();

      // Insert patient
      const patientStmt = db.prepare(`
        INSERT INTO patients (
          id, slip_number, registered_at, first_name, surname, middle_name, age, sex, phone, email, address,
          referred_by, referring_facility, referring_doctor_id, referring_facility_id,
          commission_assigned, commission_type, commission_value, commission_amount, commission_status,
          organization_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      patientStmt.run(
        patientId,
        patient.slipNumber,
        patient.registeredAt || nowStr,
        patient.firstName,
        patient.surname,
        patient.middleName || null,
        patient.age,
        patient.sex,
        patient.phone,
        patient.email || null,
        patient.address,
        patient.referredBy || null,
        patient.referringFacility || null,
        patient.referringDoctorId || null,
        patient.referringFacilityId || null,
        patient.commissionAssigned ? 1 : 0,
        patient.commissionType || null,
        patient.commissionValue || null,
        patient.commissionAmount || null,
        patient.commissionAssigned ? 'pending' : null,
        organizationId,
        nowStr
      );

      // Log patient insert in outbox
      queueSync(db, 'patients', 'INSERT', patientId, {
        id: patientId,
        slip_number: patient.slipNumber,
        registered_at: patient.registeredAt || nowStr,
        first_name: patient.firstName,
        surname: patient.surname,
        middle_name: patient.middleName || null,
        age: patient.age,
        sex: patient.sex,
        phone: patient.phone,
        email: patient.email || null,
        address: patient.address,
        referred_by: patient.referredBy || null,
        referring_facility: patient.referringFacility || null,
        referring_doctor_id: patient.referringDoctorId || null,
        referring_facility_id: patient.referringFacilityId || null,
        commission_assigned: patient.commissionAssigned ?? false,
        commission_type: patient.commissionType || null,
        commission_value: patient.commissionValue ?? null,
        commission_amount: patient.commissionAmount ?? null,
        commission_status: patient.commissionAssigned ? 'pending' : null,
        organization_id: organizationId,
        updated_at: nowStr
      });

      // Insert tests
      for (const t of tests) {
        const testId = crypto.randomUUID();
        const testStmt = db.prepare(`
          INSERT INTO patient_tests (
            id, patient_id, test_id, test_name, department, status, specimen, organization_id, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        testStmt.run(
          testId,
          patientId,
          t.testId,
          t.testName,
          t.department,
          t.status,
          t.specimen || null,
          organizationId,
          nowStr
        );

        // Log test insert in outbox
        queueSync(db, 'patient_tests', 'INSERT', testId, {
          id: testId,
          patient_id: patientId,
          test_id: t.testId,
          test_name: t.testName,
          department: t.department,
          status: t.status,
          specimen: t.specimen || null,
          organization_id: organizationId,
          updated_at: nowStr
        });
      }

      return NextResponse.json({ success: true, id: patientId });
    }

    if (action === 'updateTestResult') {
      const { testId, updates } = body;

      const updateStmt = db.prepare(`
        UPDATE patient_tests SET
          status = ?,
          results = ?,
          completed_by = ?,
          completed_by_signature_url = ?,
          completed_by_title = ?,
          completed_at = ?,
          notes = ?,
          specimen = ?,
          updated_at = ?
        WHERE id = ?
      `);

      const resultsStr = updates.results ? JSON.stringify(updates.results) : null;
      updateStmt.run(
        updates.status,
        resultsStr,
        updates.completedBy || null,
        updates.completedBySignatureUrl || null,
        updates.completedByTitle || null,
        updates.completedAt || null,
        updates.notes || null,
        updates.specimen || null,
        nowStr,
        testId
      );

      // Log update in outbox
      queueSync(db, 'patient_tests', 'UPDATE', testId, {
        status: updates.status,
        results: updates.results || null,
        completed_by: updates.completedBy || null,
        completed_by_signature_url: updates.completedBySignatureUrl || null,
        completed_by_title: updates.completedByTitle || null,
        completed_at: updates.completedAt || null,
        notes: updates.notes || null,
        specimen: updates.specimen || null,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'updatePatient') {
      const { patientId, updates } = body;

      const updateStmt = db.prepare(`
        UPDATE patients SET
          first_name = ?,
          surname = ?,
          middle_name = ?,
          age = ?,
          sex = ?,
          phone = ?,
          email = ?,
          address = ?,
          referred_by = ?,
          referring_facility = ?,
          updated_at = ?
        WHERE id = ?
      `);

      updateStmt.run(
        updates.firstName,
        updates.surname,
        updates.middleName || null,
        updates.age,
        updates.sex,
        updates.phone,
        updates.email || null,
        updates.address,
        updates.referredBy || null,
        updates.referringFacility || null,
        nowStr,
        patientId
      );

      // Log update in outbox
      queueSync(db, 'patients', 'UPDATE', patientId, {
        first_name: updates.firstName,
        surname: updates.surname,
        middle_name: updates.middleName || null,
        age: updates.age,
        sex: updates.sex,
        phone: updates.phone,
        email: updates.email || null,
        address: updates.address,
        referred_by: updates.referredBy || null,
        referring_facility: updates.referringFacility || null,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'markCommissionPaid') {
      const { patientId, notes } = body;

      const updateStmt = db.prepare(`
        UPDATE patients SET
          commission_status = 'paid',
          commission_paid_at = ?,
          commission_paid_notes = ?,
          updated_at = ?
        WHERE id = ?
      `);

      updateStmt.run(nowStr, notes || null, nowStr, patientId);

      // Log update in outbox
      queueSync(db, 'patients', 'UPDATE', patientId, {
        commission_status: 'paid',
        commission_paid_at: nowStr,
        commission_paid_notes: notes || null,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'markCommissionsUnpaid') {
      const { patientIds } = body;

      const updateStmt = db.prepare(`
        UPDATE patients SET
          commission_status = 'pending',
          commission_paid_at = NULL,
          commission_paid_notes = NULL,
          updated_at = ?
        WHERE id = ?
      `);

      for (const id of patientIds) {
        updateStmt.run(nowStr, id);

        // Log update in outbox
        queueSync(db, 'patients', 'UPDATE', id, {
          commission_status: 'pending',
          commission_paid_at: null,
          commission_paid_notes: null,
          updated_at: nowStr
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('API POST /api/patients error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
