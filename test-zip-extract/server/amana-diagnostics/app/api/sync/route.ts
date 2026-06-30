import { NextResponse } from 'next/server';
import { getDb } from '@/lib/localDb';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Helper to create a client using the user's access token (for RLS enforcement),
// falling back to the service role key or anon key.
function getSyncSupabaseClient(accessToken?: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const options: any = {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  };

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    };
  }

  return createSupabaseClient(url, key, options);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');

    if (!orgId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const db = getDb();
    
    // Check pending outbox count
    const outboxCountRow = db.prepare('SELECT COUNT(*) as count FROM sync_outbox').get() as { count: number };
    const pendingCount = outboxCountRow.count;

    // Get last pull timestamp
    const metaStmt = db.prepare(`SELECT value FROM sync_metadata WHERE key = 'last_pull_timestamp'`);
    const metaRow = metaStmt.get() as { value: string } | undefined;
    const lastPull = metaRow ? metaRow.value : 'Never';

    return NextResponse.json({
      status: pendingCount > 0 ? 'pending_sync' : 'synced',
      pendingCount,
      lastPullTimestamp: lastPull
    });
  } catch (error: any) {
    console.error('API GET /api/sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const db = getDb();
    const supabase = getSyncSupabaseClient(accessToken);

    // 1. Heartbeat Connection Check (pinging organizations table)
    try {
      const { error: pingError } = await supabase.from('organizations').select('id').eq('id', organizationId).maybeSingle();
      if (pingError) {
        throw pingError;
      }
    } catch (connError) {
      // Offline, stop sync and return pending count
      const countRow = db.prepare('SELECT COUNT(*) as count FROM sync_outbox').get() as { count: number };
      return NextResponse.json({
        status: 'offline',
        pendingCount: countRow.count,
        message: 'Supabase cloud unreachable'
      });
    }

    // 2. PUSH SYNC: Process local outbox items
    const outboxStmt = db.prepare('SELECT * FROM sync_outbox ORDER BY id ASC');
    const outboxItems = outboxStmt.all() as any[];

    for (const item of outboxItems) {
      const { id: outboxId, table_name, action, record_id, payload } = item;
      const data = JSON.parse(payload);
      let success = false;
      let skipStall = false;

      try {
        if (action === 'DELETE') {
          let deleteQuery;
          if (table_name === 'test_prices') {
            const [orgId, testId] = record_id.split(':');
            deleteQuery = supabase.from(table_name).delete().eq('organization_id', orgId).eq('test_id', testId);
          } else if (table_name === 'custom_tests') {
            const [orgId, testId] = record_id.split(':');
            deleteQuery = supabase.from(table_name).delete().eq('organization_id', orgId).eq('id', testId);
          } else {
            deleteQuery = supabase.from(table_name).delete().eq('id', record_id);
          }
          const { error } = await deleteQuery;
          if (error) {
            console.error(`Supabase DELETE error for outbox item ${outboxId}:`, error);
            if (error.code === '42P01') skipStall = true;
          } else {
            success = true;
          }
        } else if (action === 'UPDATE') {
          // Ensure results are handled as actual JSON objects in Supabase
          if (table_name === 'patient_tests' && data.results && typeof data.results === 'string') {
            data.results = JSON.parse(data.results);
          }
          if (table_name === 'custom_tests' && data.parameters && typeof data.parameters === 'string') {
            data.parameters = JSON.parse(data.parameters);
          }
          
          // Map boolean values for Supabase
          if (table_name === 'patients' && 'commission_assigned' in data) {
            data.commission_assigned = data.commission_assigned === 1 || data.commission_assigned === true;
          }
          if (table_name === 'referring_doctors' && 'is_active' in data) {
            data.is_active = data.is_active === 1 || data.is_active === true;
          }
          if (table_name === 'referring_facilities' && 'is_active' in data) {
            data.is_active = data.is_active === 1 || data.is_active === true;
          }
          if (table_name === 'custom_tests' && 'is_active' in data) {
            data.is_active = data.is_active === 1 || data.is_active === true;
          }

          let updateQuery;
          if (table_name === 'test_prices') {
            const [orgId, testId] = record_id.split(':');
            updateQuery = supabase.from(table_name).update(data).eq('organization_id', orgId).eq('test_id', testId);
          } else if (table_name === 'custom_tests') {
            const [orgId, testId] = record_id.split(':');
            updateQuery = supabase.from(table_name).update(data).eq('organization_id', orgId).eq('id', testId);
          } else {
            updateQuery = supabase.from(table_name).update(data).eq('id', record_id);
          }
          const { error } = await updateQuery;
          if (error) {
            console.error(`Supabase UPDATE error for outbox item ${outboxId}:`, error);
            if (error.code === '42P01') skipStall = true;
          } else {
            success = true;
          }
        } else {
          // action === 'INSERT'
          // Ensure results are handled as actual JSON objects in Supabase
          if (table_name === 'patient_tests' && data.results && typeof data.results === 'string') {
            data.results = JSON.parse(data.results);
          }
          if (table_name === 'custom_tests' && data.parameters && typeof data.parameters === 'string') {
            data.parameters = JSON.parse(data.parameters);
          }
          
          // Map boolean values for Supabase
          if (table_name === 'patients' && 'commission_assigned' in data) {
            data.commission_assigned = data.commission_assigned === 1 || data.commission_assigned === true;
          }
          if (table_name === 'referring_doctors' && 'is_active' in data) {
            data.is_active = data.is_active === 1 || data.is_active === true;
          }
          if (table_name === 'referring_facilities' && 'is_active' in data) {
            data.is_active = data.is_active === 1 || data.is_active === true;
          }
          if (table_name === 'custom_tests' && 'is_active' in data) {
            data.is_active = data.is_active === 1 || data.is_active === true;
          }

          const { error } = await supabase.from(table_name).upsert(data);
          if (error) {
            console.error(`Supabase INSERT (upsert) error for outbox item ${outboxId}:`, error);
            if (error.code === '42P01') skipStall = true;
          } else {
            success = true;
          }
        }
      } catch (err) {
        console.error(`Replication failed for outbox item ${outboxId}:`, err);
      }

      if (success || skipStall) {
        db.prepare('DELETE FROM sync_outbox WHERE id = ?').run(outboxId);
      } else {
        // Stop sequential processing if an item fails to preserve dependency ordering (e.g. patients before tests)
        const countRow = db.prepare('SELECT COUNT(*) as count FROM sync_outbox').get() as { count: number };
        return NextResponse.json({
          status: 'sync_stalled',
          pendingCount: countRow.count,
          failedOutboxId: outboxId
        });
      }
    }

    // 3. PULL SYNC: Retrieve remote changes since last pull timestamp
    const metaStmt = db.prepare(`SELECT value FROM sync_metadata WHERE key = 'last_pull_timestamp'`);
    const metaRow = metaStmt.get() as { value: string } | undefined;
    const lastPull = metaRow ? metaRow.value : '1970-01-01T00:00:00.000Z';
    const nowStr = new Date().toISOString();

    // Pull Organization
    const { data: orgData } = await supabase.from('organizations').select('*').eq('id', organizationId).maybeSingle();
    if (orgData) {
      db.prepare(`
        INSERT INTO organizations (id, name, slug, plan_tier, address, phone, email, letterhead_line2, letterhead_html)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          slug = excluded.slug,
          plan_tier = excluded.plan_tier,
          address = excluded.address,
          phone = excluded.phone,
          email = excluded.email,
          letterhead_line2 = excluded.letterhead_line2,
          letterhead_html = excluded.letterhead_html
      `).run(
        orgData.id,
        orgData.name,
        orgData.slug,
        orgData.plan_tier || null,
        orgData.address || null,
        orgData.phone || null,
        orgData.email || null,
        orgData.letterhead_line2 || null,
        orgData.letterhead_html || null
      );
    }

    // Pull Profiles
    const { data: profilesData } = await supabase.from('profiles').select('*').eq('organization_id', organizationId);
    if (profilesData && profilesData.length > 0) {
      const insertProfile = db.prepare(`
        INSERT INTO profiles (id, full_name, title, first_name, surname, last_name, signature_url, role, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          full_name = excluded.full_name,
          title = excluded.title,
          first_name = excluded.first_name,
          surname = excluded.surname,
          last_name = excluded.last_name,
          signature_url = excluded.signature_url,
          role = excluded.role,
          organization_id = excluded.organization_id
      `);
      profilesData.forEach((p) => {
        insertProfile.run(
          p.id,
          p.full_name,
          p.title || null,
          p.first_name || null,
          p.surname || null,
          p.last_name || null,
          p.signature_url || null,
          p.role,
          p.organization_id || null
        );
      });
    }

    // Pull Referring Facilities
    const { data: facs } = await supabase.from('referring_facilities').select('*').eq('organization_id', organizationId).gt('updated_at', lastPull);
    if (facs && facs.length > 0) {
      const insertFac = db.prepare(`
        INSERT INTO referring_facilities (id, organization_id, name, address, phone, email, commission_type, commission_value, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          address = excluded.address,
          phone = excluded.phone,
          email = excluded.email,
          commission_type = excluded.commission_type,
          commission_value = excluded.commission_value,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
      `);
      facs.forEach((f) => {
        insertFac.run(f.id, f.organization_id, f.name, f.address, f.phone, f.email, f.commission_type, f.commission_value, f.is_active ? 1 : 0, f.created_at, f.updated_at);
      });
    }

    // Pull Referring Doctors
    const { data: docs } = await supabase.from('referring_doctors').select('*').eq('organization_id', organizationId).gt('updated_at', lastPull);
    if (docs && docs.length > 0) {
      const insertDoc = db.prepare(`
        INSERT INTO referring_doctors (id, organization_id, facility_id, name, phone, email, commission_type, commission_value, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          facility_id = excluded.facility_id,
          name = excluded.name,
          phone = excluded.phone,
          email = excluded.email,
          commission_type = excluded.commission_type,
          commission_value = excluded.commission_value,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
      `);
      docs.forEach((d) => {
        insertDoc.run(d.id, d.organization_id, d.facility_id, d.name, d.phone, d.email, d.commission_type, d.commission_value, d.is_active ? 1 : 0, d.created_at, d.updated_at);
      });
    }

    // Pull Test Prices (Note: pull all as it is very small)
    const { data: prices } = await supabase.from('test_prices').select('*').eq('organization_id', organizationId);
    if (prices && prices.length > 0) {
      const insertPrice = db.prepare(`
        INSERT INTO test_prices (organization_id, test_id, test_name, price, commission_type, commission_value)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(organization_id, test_id) DO UPDATE SET
          price = excluded.price,
          commission_type = excluded.commission_type,
          commission_value = excluded.commission_value
      `);
      prices.forEach((p) => {
        insertPrice.run(p.organization_id, p.test_id, p.test_name, p.price, p.commission_type || 'percentage', p.commission_value ?? 0);
      });
    }

    // Pull Custom Tests
    const { data: cTests } = await supabase.from('custom_tests').select('*').eq('organization_id', organizationId).gt('updated_at', lastPull);
    if (cTests && cTests.length > 0) {
      const insertCTest = db.prepare(`
        INSERT INTO custom_tests (id, organization_id, name, department, category, specimen, parameters, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(organization_id, id) DO UPDATE SET
          name = excluded.name,
          department = excluded.department,
          category = excluded.category,
          specimen = excluded.specimen,
          parameters = excluded.parameters,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
      `);
      cTests.forEach((t) => {
        insertCTest.run(
          t.id,
          t.organization_id,
          t.name,
          t.department,
          t.category,
          t.specimen,
          t.parameters ? JSON.stringify(t.parameters) : '[]',
          t.is_active ? 1 : 0,
          t.updated_at
        );
      });
    }

    // Pull Radiology Templates
    const { data: templates } = await supabase.from('radiology_templates').select('*').eq('organization_id', organizationId).gt('updated_at', lastPull);
    if (templates && templates.length > 0) {
      const insertTemplate = db.prepare(`
        INSERT INTO radiology_templates (id, organization_id, key, name, findings, impression, created_at, created_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          key = excluded.key,
          name = excluded.name,
          findings = excluded.findings,
          impression = excluded.impression,
          updated_at = excluded.updated_at
      `);
      templates.forEach((t) => {
        insertTemplate.run(t.id, t.organization_id, t.key, t.name, t.findings, t.impression, t.created_at, t.created_by, t.updated_at);
      });
    }

    // Pull Patient Profiles
    const { data: patientProfiles } = await supabase.from('patient_profiles').select('*').eq('organization_id', organizationId).gt('updated_at', lastPull);
    if (patientProfiles && patientProfiles.length > 0) {
      const insertProfile = db.prepare(`
        INSERT INTO patient_profiles (
          id, organization_id, first_name, surname, middle_name, phone, email, address, sex, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          first_name = excluded.first_name,
          surname = excluded.surname,
          middle_name = excluded.middle_name,
          phone = excluded.phone,
          email = excluded.email,
          address = excluded.address,
          sex = excluded.sex,
          updated_at = excluded.updated_at
      `);
      patientProfiles.forEach((p) => {
        insertProfile.run(
          p.id, p.organization_id, p.first_name, p.surname, p.middle_name, p.phone, p.email, p.address, p.sex, p.created_at, p.updated_at
        );
      });
    }

    // Pull Patients
    const { data: patients } = await supabase.from('patients').select('*').eq('organization_id', organizationId).gt('updated_at', lastPull);
    if (patients && patients.length > 0) {
      const insertPatient = db.prepare(`
        INSERT INTO patients (
          id, patient_profile_id, slip_number, registered_at, first_name, surname, middle_name, age, sex, phone, email, address,
          referred_by, referring_facility, referring_doctor_id, referring_facility_id,
          commission_assigned, commission_type, commission_value, commission_amount, commission_status,
          commission_paid_at, commission_paid_notes, total_amount, discount_type, discount_value, discount_amount,
          net_amount, paid_amount, payment_status, payment_method, organization_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          patient_profile_id = excluded.patient_profile_id,
          slip_number = excluded.slip_number,
          registered_at = excluded.registered_at,
          first_name = excluded.first_name,
          surname = excluded.surname,
          middle_name = excluded.middle_name,
          age = excluded.age,
          sex = excluded.sex,
          phone = excluded.phone,
          email = excluded.email,
          address = excluded.address,
          referred_by = excluded.referred_by,
          referring_facility = excluded.referring_facility,
          referring_doctor_id = excluded.referring_doctor_id,
          referring_facility_id = excluded.referring_facility_id,
          commission_assigned = excluded.commission_assigned,
          commission_type = excluded.commission_type,
          commission_value = excluded.commission_value,
          commission_amount = excluded.commission_amount,
          commission_status = excluded.commission_status,
          commission_paid_at = excluded.commission_paid_at,
          commission_paid_notes = excluded.commission_paid_notes,
          total_amount = excluded.total_amount,
          discount_type = excluded.discount_type,
          discount_value = excluded.discount_value,
          discount_amount = excluded.discount_amount,
          net_amount = excluded.net_amount,
          paid_amount = excluded.paid_amount,
          payment_status = excluded.payment_status,
          payment_method = excluded.payment_method,
          updated_at = excluded.updated_at
      `);
      patients.forEach((p) => {
        insertPatient.run(
          p.id, p.patient_profile_id, p.slip_number, p.registered_at, p.first_name, p.surname, p.middle_name, p.age, p.sex, p.phone, p.email, p.address,
          p.referred_by, p.referring_facility, p.referring_doctor_id, p.referring_facility_id,
          p.commission_assigned ? 1 : 0, p.commission_type, p.commission_value, p.commission_amount, p.commission_status,
          p.commission_paid_at, p.commission_paid_notes, p.total_amount ?? 0, p.discount_type || 'none', p.discount_value ?? 0, p.discount_amount ?? 0,
          p.net_amount ?? 0, p.paid_amount ?? 0, p.payment_status || 'paid', p.payment_method || 'cash', p.organization_id, p.updated_at
        );
      });
    }

    // Pull Patient Tests
    const { data: patientTests } = await supabase.from('patient_tests').select('*').eq('organization_id', organizationId).gt('updated_at', lastPull);
    if (patientTests && patientTests.length > 0) {
      const insertTest = db.prepare(`
        INSERT INTO patient_tests (
          id, patient_id, test_id, test_name, department, status, specimen, results,
          completed_by, completed_by_signature_url, completed_by_title, completed_at, notes,
          price, commission_type, commission_value, commission_amount, organization_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          patient_id = excluded.patient_id,
          test_id = excluded.test_id,
          test_name = excluded.test_name,
          department = excluded.department,
          status = excluded.status,
          specimen = excluded.specimen,
          results = excluded.results,
          completed_by = excluded.completed_by,
          completed_by_signature_url = excluded.completed_by_signature_url,
          completed_by_title = excluded.completed_by_title,
          completed_at = excluded.completed_at,
          notes = excluded.notes,
          price = excluded.price,
          commission_type = excluded.commission_type,
          commission_value = excluded.commission_value,
          commission_amount = excluded.commission_amount,
          updated_at = excluded.updated_at
      `);
      patientTests.forEach((t) => {
        insertTest.run(
          t.id, t.patient_id, t.test_id, t.test_name, t.department, t.status, t.specimen,
          t.results ? JSON.stringify(t.results) : null,
          t.completed_by, t.completed_by_signature_url, t.completed_by_title, t.completed_at, t.notes,
          t.price ?? 0, t.commission_type || 'none', t.commission_value ?? 0, t.commission_amount ?? 0,
          t.organization_id, t.updated_at
        );
      });
    }

    // Pull Billing Accounts (Safe Try-Catch)
    try {
      const { data: accounts } = await supabase.from('billing_accounts').select('*').eq('organization_id', organizationId).gt('updated_at', lastPull);
      if (accounts && accounts.length > 0) {
        const insertAcc = db.prepare(`
          INSERT INTO billing_accounts (id, organization_id, name, owner_patient_id, balance, credit_limit, type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            owner_patient_id = excluded.owner_patient_id,
            balance = excluded.balance,
            credit_limit = excluded.credit_limit,
            type = excluded.type,
            updated_at = excluded.updated_at
        `);
        accounts.forEach((a: any) => {
          insertAcc.run(a.id, a.organization_id, a.name, a.owner_patient_id, a.balance, a.credit_limit, a.type, a.created_at, a.updated_at);
        });
      }
    } catch (pullAccError: any) {
      console.warn('[Sync] Skipping pull for billing_accounts:', pullAccError.message);
    }

    // Pull Billing Ledger Transactions (Safe Try-Catch)
    try {
      const { data: txs } = await supabase.from('billing_ledger_transactions').select('*').eq('organization_id', organizationId).gt('created_at', lastPull);
      if (txs && txs.length > 0) {
        const insertTx = db.prepare(`
          INSERT INTO billing_ledger_transactions (id, organization_id, billing_account_id, patient_id, type, amount, description, reference_id, payment_method, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            patient_id = excluded.patient_id,
            type = excluded.type,
            amount = excluded.amount,
            description = excluded.description,
            reference_id = excluded.reference_id,
            payment_method = excluded.payment_method,
            created_by = excluded.created_by
        `);
        txs.forEach((t: any) => {
          insertTx.run(t.id, t.organization_id, t.billing_account_id, t.patient_id || null, t.type, t.amount, t.description, t.reference_id || null, t.payment_method || null, t.created_by || null, t.created_at);
        });
      }
    } catch (pullTxError: any) {
      console.warn('[Sync] Skipping pull for billing_ledger_transactions:', pullTxError.message);
    }

    // Pull External Department Charges (Safe Try-Catch)
    try {
      const { data: charges } = await supabase.from('external_department_charges').select('*').eq('organization_id', organizationId).gt('created_at', lastPull);
      if (charges && charges.length > 0) {
        const insertCharge = db.prepare(`
          INSERT INTO external_department_charges (id, organization_id, patient_id, billing_account_id, department, receipt_number, amount, payment_method, status, description, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            patient_id = excluded.patient_id,
            billing_account_id = excluded.billing_account_id,
            department = excluded.department,
            receipt_number = excluded.receipt_number,
            amount = excluded.amount,
            payment_method = excluded.payment_method,
            status = excluded.status,
            description = excluded.description,
            created_by = excluded.created_by
        `);
        charges.forEach((c: any) => {
          insertCharge.run(c.id, c.organization_id, c.patient_id, c.billing_account_id || null, c.department, c.receipt_number, c.amount, c.payment_method, c.status || 'paid', c.description || null, c.created_by || null, c.created_at);
        });
      }
    } catch (pullChargeError: any) {
      console.warn('[Sync] Skipping pull for external_department_charges:', pullChargeError.message);
    }

    // Update metadata last pull timestamp
    db.prepare(`
      INSERT INTO sync_metadata (key, value)
      VALUES ('last_pull_timestamp', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(nowStr);

    return NextResponse.json({
      status: 'synced',
      pendingCount: 0,
      lastPullTimestamp: nowStr
    });
  } catch (error: any) {
    console.error('API POST /api/sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
