import { NextResponse } from 'next/server';
import { getDb, queueSync } from '@/lib/localDb';
import { sendEmail } from '@/lib/brevo';
import { getNextNumericID } from '@/lib/idGenerator';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');
    const action = searchParams.get('action');

    if (!orgId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const db = getDb();

    if (action === 'getPatientProfiles') {
      const profilesStmt = db.prepare(`
        SELECT * FROM patient_profiles 
        WHERE organization_id = ? 
        ORDER BY created_at DESC
      `);
      const profiles = profilesStmt.all(orgId) as any[];
      const formatted = profiles.map(p => ({
        id: p.id,
        organizationId: p.organization_id,
        firstName: p.first_name,
        surname: p.surname,
        middleName: p.middle_name || '',
        phone: p.phone,
        email: p.email || '',
        address: p.address || '',
        sex: p.sex,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));
      return NextResponse.json(formatted);
    }
    
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
    const testsByPatientId = new Map<number | string, any[]>();
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
        price: t.price || 0,
        commissionType: t.commission_type || 'none',
        commissionValue: t.commission_value || 0,
        commissionAmount: t.commission_amount || 0,
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
      totalAmount: p.total_amount || 0,
      discountType: p.discount_type || 'none',
      discountValue: p.discount_value || 0,
      discountAmount: p.discount_amount || 0,
      netAmount: p.net_amount || 0,
      paidAmount: p.paid_amount || 0,
      paymentStatus: p.payment_status || 'paid',
      paymentMethod: p.payment_method || 'cash',
      billingAccountId: p.billing_account_id || null,
      patientProfileId: p.patient_profile_id || null,
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
      
      const patientId = getNextNumericID(db, 'patients', 1);
      let patientProfileId = patient.patientProfileId ? Number(patient.patientProfileId) : null;

      let finalPaidAmount = patient.paidAmount ?? 0;
      let finalPaymentStatus = patient.paymentStatus || 'paid';

      if (patient.paymentMethod === 'wallet' && patient.billingAccountId) {
        finalPaidAmount = patient.netAmount ?? 0;
        finalPaymentStatus = 'paid';
      }

      // IMMEDIATE, not the default deferred: registration reads a wallet balance
      // and writes it back, and a deferred transaction only takes the write lock
      // at the first write, leaving room for a concurrent registration to read
      // the same balance first.
      db.exec('BEGIN IMMEDIATE');
      try {
        // If it's a new patient profile, we insert it
        if (!patientProfileId) {
          patientProfileId = getNextNumericID(db, 'patient_profiles', 1);
          
          const profileStmt = db.prepare(`
            INSERT INTO patient_profiles (
              id, organization_id, first_name, surname, middle_name, phone, email, address, sex, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          profileStmt.run(
            patientProfileId,
            organizationId,
            patient.firstName,
            patient.surname,
            patient.middleName || null,
            patient.phone,
            patient.email || null,
            patient.address,
            patient.sex,
            nowStr,
            nowStr
          );

          // Queue sync for the new patient profile
          queueSync(db, 'patient_profiles', 'INSERT', String(patientProfileId), {
            id: patientProfileId,
            organization_id: organizationId,
            first_name: patient.firstName,
            surname: patient.surname,
            middle_name: patient.middleName || null,
            phone: patient.phone,
            email: patient.email || null,
            address: patient.address,
            sex: patient.sex,
            created_at: nowStr,
            updated_at: nowStr
          });
        }

        if (patient.paymentMethod === 'wallet' && patient.billingAccountId) {
          // Fetch current account
          const accStmt = db.prepare(`SELECT balance, credit_limit, name FROM billing_accounts WHERE id = ?`);
          const acc = accStmt.get(patient.billingAccountId) as { balance: number; credit_limit: number; name: string } | undefined;
          if (!acc) {
            throw new Error('Billing account not found');
          }

          const currentBalance = acc.balance || 0;
          const creditLimit = acc.credit_limit || 0;
          const netAmount = patient.netAmount || 0;

          if (currentBalance + creditLimit < netAmount) {
            throw new Error(`Insufficient wallet balance on "${acc.name}". Available: ₦${(currentBalance + creditLimit).toLocaleString('en-NG')}`);
          }

          // Deduct balance
          const newBalance = currentBalance - netAmount;
          const upAccStmt = db.prepare(`UPDATE billing_accounts SET balance = ?, updated_at = ? WHERE id = ?`);
          upAccStmt.run(newBalance, nowStr, patient.billingAccountId);

          // Queue sync account update
          const fullAcc = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(patient.billingAccountId) as any;
          if (fullAcc) {
            queueSync(db, 'billing_accounts', 'UPDATE', patient.billingAccountId, {
              ...fullAcc,
              balance: newBalance,
              updated_at: nowStr
            });
          }
        }

        // Insert patient (Must happen before ledger transaction to satisfy FOREIGN KEY constraint on patient_id)
        const patientStmt = db.prepare(`
          INSERT INTO patients (
            id, patient_profile_id, slip_number, registered_at, first_name, surname, middle_name, age, sex, phone, email, address,
            referred_by, referring_facility, referring_doctor_id, referring_facility_id,
            commission_assigned, commission_type, commission_value, commission_amount, commission_status,
            total_amount, discount_type, discount_value, discount_amount, net_amount, paid_amount, payment_status, payment_method,
            organization_id, billing_account_id, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        patientStmt.run(
          patientId,
          patientProfileId,
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
          patient.totalAmount ?? 0,
          patient.discountType || 'none',
          patient.discountValue ?? 0,
          patient.discountAmount ?? 0,
          patient.netAmount ?? 0,
          finalPaidAmount,
          finalPaymentStatus,
          patient.paymentMethod || 'cash',
          organizationId,
          patient.billingAccountId || null,
          nowStr
        );

        // Log patient insert in outbox
        queueSync(db, 'patients', 'INSERT', String(patientId), {
          id: patientId,
          patient_profile_id: patientProfileId,
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
          total_amount: patient.totalAmount ?? 0,
          discount_type: patient.discountType || 'none',
          discount_value: patient.discountValue ?? 0,
          discount_amount: patient.discountAmount ?? 0,
          net_amount: patient.netAmount ?? 0,
          paid_amount: finalPaidAmount,
          payment_status: finalPaymentStatus,
          payment_method: patient.paymentMethod || 'cash',
          organization_id: organizationId,
          billing_account_id: patient.billingAccountId || null,
          updated_at: nowStr
        });

        // Insert ledger transaction (Only if wallet payment - now patient exists, so FK check succeeds)
        if (patient.paymentMethod === 'wallet' && patient.billingAccountId) {
          const txId = crypto.randomUUID();
          const txStmt = db.prepare(`
            INSERT INTO billing_ledger_transactions (
              id, organization_id, billing_account_id, patient_id, type, amount, description, reference_id, payment_method, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          txStmt.run(
            txId,
            organizationId,
            patient.billingAccountId,
            patientId,
            'charge',
            -patient.netAmount,
            `Diagnostics Charge - Slip: ${patient.slipNumber}`,
            patient.slipNumber,
            'wallet',
            'Reception Desk',
            nowStr
          );

          // Queue sync transaction
          queueSync(db, 'billing_ledger_transactions', 'INSERT', txId, {
            id: txId,
            organization_id: organizationId,
            billing_account_id: patient.billingAccountId,
            patient_id: patientId,
            type: 'charge',
            amount: -patient.netAmount,
            description: `Diagnostics Charge - Slip: ${patient.slipNumber}`,
            reference_id: patient.slipNumber,
            payment_method: 'wallet',
            created_by: 'Reception Desk',
            created_at: nowStr
          });
        }

        // Insert tests
        for (const t of tests) {
          const testId = crypto.randomUUID();
          const testStmt = db.prepare(`
            INSERT INTO patient_tests (
              id, patient_id, test_id, test_name, department, status, specimen, price, commission_type, commission_value, commission_amount, organization_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          testStmt.run(
            testId,
            patientId,
            t.testId,
            t.testName,
            t.department,
            t.status,
            t.specimen || null,
            t.price ?? 0,
            t.commissionType || 'none',
            t.commissionValue ?? 0,
            t.commissionAmount ?? 0,
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
            price: t.price ?? 0,
            commission_type: t.commissionType || 'none',
            commission_value: t.commissionValue ?? 0,
            commission_amount: t.commissionAmount ?? 0,
            organization_id: organizationId,
            updated_at: nowStr
          });
        }

        db.exec('COMMIT');
      } catch (err: any) {
        db.exec('ROLLBACK');
        console.error('Patient registration transaction failed, rolled back:', err);
        return NextResponse.json({ error: err.message }, { status: 400 });
      }

      // Send welcome email if email exists (async, safe - done outside of transaction)
      if (patient.email && patient.email.trim()) {
        try {
          const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(organizationId) as any;
          const orgName = org?.name || 'Amana Trust Diagnostics';
          const patientName = `${patient.firstName} ${patient.surname}`;
          const host = request.headers.get('host') || 'localhost:3000';
          const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
          const portalLink = `${protocol}://${host}/portal/login`;

          sendEmail({
            to: patient.email.trim(),
            subject: `Welcome to the Patient Portal — ${orgName}`,
            htmlContent: `
              <div style="font-family: 'Times New Roman', Times, serif; max-width: 520px; margin: 0 auto; color: #000000; line-height: 1.6;">
                <div style="background: #0563c1; padding: 28px 24px; text-align: center; border: 1px solid #0563c1;">
                  <h1 style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">WELCOME TO PATIENT PORTAL</h1>
                  <p style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 6px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${orgName}</p>
                </div>
                <div style="padding: 32px 24px; border: 1px solid #0563c1; border-top: none; background: #ffffff;">
                  <p style="margin: 0 0 16px; font-size: 16px; color: #000000;">Dear <strong>${patientName}</strong>,</p>
                  <p style="margin: 0 0 16px; font-size: 15px; color: #000000;">Thank you for registering at our clinical facility. Your patient record has been successfully created.</p>
                  <p style="margin: 0 0 24px; font-size: 15px; color: #000000;">You can securely access your medical history, check the status of your ongoing tests, and view or print your results directly from our Patient Portal at any time.</p>
                  <div style="text-align: center; margin-bottom: 28px;">
                    <a href="${portalLink}" style="display: inline-block; padding: 12px 24px; background-color: #0563c1; color: #ffffff !important; text-decoration: none; font-weight: bold; font-size: 15px; border-radius: 0px;">Access My Portal →</a>
                  </div>
                  <p style="margin: 0 0 8px; font-size: 14px; color: #555;">To log in, enter the email address you registered with (<strong>${patient.email.trim().toLowerCase()}</strong>) and we will send a secure verification code directly to your inbox.</p>
                  <p style="margin: 0; font-size: 15px; color: #000000; margin-top: 20px;">Thank you for choosing <strong>${orgName}</strong>.</p>
                </div>
                <div style="padding: 16px; text-align: center; font-size: 12px; color: #666; border: 1px solid #ddd; border-top: none;">
                  &copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.
                </div>
              </div>
            `
          }).catch(err => console.warn('Failed to send registration welcome email (possibly offline):', err.message));
        } catch (err: any) {
          console.warn('Failed to construct or queue welcome email:', err.message);
        }
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

      // Send result ready notification if this completes the order (async, safe)
      if (updates.status === 'completed') {
        try {
          const testInfo = db.prepare(`
            SELECT patient_id, test_name FROM patient_tests WHERE id = ?
          `).get(testId) as { patient_id: string; test_name: string } | undefined;

          if (testInfo) {
            const { patient_id } = testInfo;
            const patient = db.prepare(`
              SELECT first_name, surname, email, organization_id FROM patients WHERE id = ?
            `).get(patient_id) as { first_name: string; surname: string; email: string; organization_id: string } | undefined;

            if (patient && patient.email && patient.email.trim()) {
              // Check if all tests for this patient are completed
              const counts = db.prepare(`
                SELECT 
                  COUNT(*) as total,
                  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
                FROM patient_tests
                WHERE patient_id = ?
              `).get(patient_id) as { total: number; completed: number } | undefined;

              if (counts && counts.total === counts.completed) {
                const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(patient.organization_id) as any;
                const orgName = org?.name || 'Amana Trust Diagnostics';
                const patientName = `${patient.first_name || ''} ${patient.surname || ''}`.trim();
                const host = request.headers.get('host') || 'localhost:3000';
                const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
                const portalLink = `${protocol}://${host}/portal/login`;

                sendEmail({
                  to: patient.email.trim(),
                  subject: `All Your Diagnostic Results Are Ready — ${orgName}`,
                  htmlContent: `
                    <div style="font-family: 'Times New Roman', Times, serif; max-width: 520px; margin: 0 auto; color: #000000; line-height: 1.6;">
                      <div style="background: #0563c1; padding: 28px 24px; text-align: center; border: 1px solid #0563c1;">
                        <h1 style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">DIAGNOSTIC RESULTS READY</h1>
                        <p style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 6px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${orgName}</p>
                      </div>
                      <div style="padding: 32px 24px; border: 1px solid #0563c1; border-top: none; background: #ffffff;">
                        <p style="margin: 0 0 16px; font-size: 16px; color: #000000;">Dear <strong>${patientName}</strong>,</p>
                        <p style="margin: 0 0 16px; font-size: 15px; color: #000000;">We are pleased to inform you that all the diagnostic investigations ordered during your visit have been completed and verified by our medical professionals.</p>
                        <p style="margin: 0 0 24px; font-size: 15px; color: #000000;">You can view, save, or print your official results instantly from our secure Patient Portal by clicking the button below.</p>
                        <div style="text-align: center; margin-bottom: 28px;">
                          <a href="${portalLink}" style="display: inline-block; padding: 12px 24px; background-color: #0563c1; color: #ffffff !important; text-decoration: none; font-weight: bold; font-size: 15px; border-radius: 0px;">View My Results →</a>
                        </div>
                        <p style="margin: 0 0 12px; font-size: 14px; color: #555;">Please log in using your registered email: <strong>${patient.email.trim().toLowerCase()}</strong>.</p>
                        <p style="margin: 0 0 20px; font-size: 14px; color: #555; font-style: italic;">Note: We recommend consulting your referring doctor to discuss these results.</p>
                        <p style="margin: 0; font-size: 15px; color: #000000; margin-top: 20px;">Thank you for choosing <strong>${orgName}</strong>.</p>
                      </div>
                      <div style="padding: 16px; text-align: center; font-size: 12px; color: #666; border: 1px solid #ddd; border-top: none;">
                        &copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.
                      </div>
                    </div>
                  `
                }).catch(err => console.warn('Failed to send result ready email (possibly offline):', err.message));
              }
            }
          }
        } catch (err: any) {
          console.warn('Failed to construct or queue result ready email:', err.message);
        }
      }

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
