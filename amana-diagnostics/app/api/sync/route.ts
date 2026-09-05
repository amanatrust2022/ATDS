import { NextResponse } from 'next/server';
import { getDb } from '@/lib/localDb';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { pushOutbox, countPending, countDeadLetters, requeueDeadLetters } from '@/lib/sync/outbox';
import { getPullCursor, setPullCursor } from '@/lib/sync/cursors';

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

async function fetchAllRemoteRows(
  supabase: any,
  tableName: string,
  organizationId: string,
  lastPull: string,
  filterCol: string = 'updated_at'
) {
  let allRows: any[] = [];
  let from = 0;
  const limit = 1000;

  while (true) {
    let query = supabase.from(tableName).select('*');

    if (tableName === 'organizations') {
      query = query.eq('id', organizationId);
    } else {
      query = query.eq('organization_id', organizationId);
    }

    if (tableName !== 'organizations' && tableName !== 'profiles' && tableName !== 'test_prices') {
      query = query.gt(filterCol, lastPull);
    }

    let orderCol = 'id';
    if (tableName === 'test_prices') {
      orderCol = 'test_id';
    }

    const { data, error } = await query
      .order(orderCol, { ascending: true })
      .range(from, from + limit - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows = allRows.concat(data);
    if (data.length < limit) {
      break;
    }
    from += limit;
  }
  return allRows;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');

    if (!orgId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const db = getDb();

    // Rows still queued, and rows set aside because the cloud kept refusing
    // them. The second number is the one that needs a human — it does not
    // clear itself.
    const pendingCount = countPending(db);
    const deadLetterCount = countDeadLetters(db);

    const deadLetters = deadLetterCount > 0
      ? db.prepare(
          'SELECT id, table_name, action, record_id, attempts, last_error, last_attempt_at FROM sync_outbox WHERE dead = 1 ORDER BY id ASC LIMIT 50',
        ).all()
      : [];

    return NextResponse.json({
      status: deadLetterCount > 0 ? 'needs_attention' : pendingCount > 0 ? 'pending_sync' : 'synced',
      pendingCount,
      deadLetterCount,
      deadLetters,
      lastPullTimestamp: getPullCursor(db, orgId, 'patients'),
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
    const { organizationId, action } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const db = getDb();

    // The way out of a poisoned queue without a developer: once whatever the
    // cloud was objecting to has been dealt with, put the set-aside rows back.
    if (action === 'requeueDeadLetters') {
      const requeued = requeueDeadLetters(db);
      console.warn(`[Sync] Re-queued ${requeued} set-aside outbox rows on request.`);
      return NextResponse.json({ status: 'requeued', requeued, pendingCount: countPending(db) });
    }

    const supabase = getSyncSupabaseClient(accessToken);

    // 1. Heartbeat Connection Check (pinging organizations table)
    try {
      const { error: pingError } = await supabase.from('organizations').select('id').eq('id', organizationId).maybeSingle();
      if (pingError) {
        throw pingError;
      }
    } catch (connError) {
      // Offline, stop sync and return pending count
      return NextResponse.json({
        status: 'offline',
        pendingCount: countPending(db),
        deadLetterCount: countDeadLetters(db),
        message: 'Supabase cloud unreachable'
      });
    }

    // 2. PUSH SYNC: send the local outbox up, oldest first.
    // Rows are deleted only once the cloud has accepted them; a row that keeps
    // failing is set aside rather than deleted or left to block the queue.
    const push = await pushOutbox(db, supabase);

    if (push.stalledOutboxId !== undefined) {
      return NextResponse.json({
        status: 'sync_stalled',
        pendingCount: countPending(db),
        deadLetterCount: countDeadLetters(db),
        failedOutboxId: push.stalledOutboxId,
        message: push.stalledReason,
      });
    }

    // 3. PULL SYNC: retrieve remote changes, each table since its own cursor.
    //
    // Captured before any read: a cursor set to a time after the read began
    // could skip a row written during it. Overlapping costs a repeat upsert.
    const nowStr = new Date().toISOString();

    /** Tables whose fetch failed this run. Their cursors are left where they were. */
    const pullFailures: { table: string; error: string }[] = [];

    /**
     * Fetches one table's changes since its own cursor.
     * Returns null if the fetch failed — the caller then leaves the cursor
     * alone, so those rows are asked for again next sync instead of being
     * skipped for good.
     */
    const pullSince = async (table: string, filterCol: 'updated_at' | 'created_at' = 'updated_at') => {
      try {
        return await fetchAllRemoteRows(supabase, table, organizationId, getPullCursor(db, organizationId, table), filterCol);
      } catch (err: any) {
        const error = err?.message || String(err);
        console.error(`[Sync] Pull failed for ${table}; cursor held: ${error}`);
        pullFailures.push({ table, error });
        return null;
      }
    };

    /** Moves a table's cursor up. Only called once that table's rows are written. */
    const commitPull = (table: string) => setPullCursor(db, organizationId, table, nowStr);

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
    const profilesData = await pullSince('profiles');
    if (profilesData && profilesData.length > 0) {
      const insertProfile = db.prepare(`
        INSERT INTO profiles (id, full_name, title, first_name, surname, last_name, signature_url, role, organization_id, email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          full_name = excluded.full_name,
          title = excluded.title,
          first_name = excluded.first_name,
          surname = excluded.surname,
          last_name = excluded.last_name,
          signature_url = excluded.signature_url,
          role = excluded.role,
          organization_id = excluded.organization_id,
          email = excluded.email
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
          p.organization_id || null,
          p.email || null
        );
      });
    }
    if (profilesData) commitPull('profiles');

    // Pull Referring Facilities
    const facs = await pullSince('referring_facilities');
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
    if (facs) commitPull('referring_facilities');

    // Pull Referring Doctors
    const docs = await pullSince('referring_doctors');
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
    if (docs) commitPull('referring_doctors');

    // Pull Test Prices (Note: pull all as it is very small)
    const prices = await pullSince('test_prices');
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
    if (prices) commitPull('test_prices');

    // Pull Custom Tests
    const cTests = await pullSince('custom_tests');
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
    if (cTests) commitPull('custom_tests');

    // Pull Radiology Templates
    const templates = await pullSince('radiology_templates');
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
    if (templates) commitPull('radiology_templates');

    // Pull Patient Profiles
    const patientProfiles = await pullSince('patient_profiles');
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
    if (patientProfiles) commitPull('patient_profiles');

    // Pull Patients
    const patients = await pullSince('patients');
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
    if (patients) commitPull('patients');

    // Pull Patient Tests
    const patientTests = await pullSince('patient_tests');
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
    if (patientTests) commitPull('patient_tests');

    // Pull Billing Accounts
    try {
      const accounts = await pullSince('billing_accounts');
      if (accounts && accounts.length > 0) {
        const insertAcc = db.prepare(`
          INSERT INTO billing_accounts (id, organization_id, name, owner_patient_id, balance, credit_limit, type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = CASE WHEN excluded.updated_at >= billing_accounts.updated_at THEN excluded.name ELSE billing_accounts.name END,
            owner_patient_id = CASE WHEN excluded.updated_at >= billing_accounts.updated_at THEN excluded.owner_patient_id ELSE billing_accounts.owner_patient_id END,
            balance = CASE WHEN excluded.updated_at >= billing_accounts.updated_at THEN excluded.balance ELSE billing_accounts.balance END,
            credit_limit = CASE WHEN excluded.updated_at >= billing_accounts.updated_at THEN excluded.credit_limit ELSE billing_accounts.credit_limit END,
            type = CASE WHEN excluded.updated_at >= billing_accounts.updated_at THEN excluded.type ELSE billing_accounts.type END,
            updated_at = CASE WHEN excluded.updated_at >= billing_accounts.updated_at THEN excluded.updated_at ELSE billing_accounts.updated_at END
        `);
        accounts.forEach((a: any) => {
          insertAcc.run(a.id, a.organization_id, a.name, a.owner_patient_id, a.balance, a.credit_limit, a.type, a.created_at, a.updated_at);
        });
      }
      if (accounts) commitPull('billing_accounts');
    } catch (pullAccError: any) {
      // Cursor deliberately not advanced, so these rows are pulled again.
      console.error('[Sync] Failed to store billing_accounts:', pullAccError.message);
      pullFailures.push({ table: 'billing_accounts', error: pullAccError.message });
    }

    // Pull Billing Ledger Transactions
    try {
      const txs = await pullSince('billing_ledger_transactions', 'created_at');
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
      if (txs) commitPull('billing_ledger_transactions');
    } catch (pullTxError: any) {
      // Cursor deliberately not advanced, so these rows are pulled again.
      console.error('[Sync] Failed to store billing_ledger_transactions:', pullTxError.message);
      pullFailures.push({ table: 'billing_ledger_transactions', error: pullTxError.message });
    }

    // Pull External Department Charges
    try {
      const charges = await pullSince('external_department_charges', 'created_at');
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
      if (charges) commitPull('external_department_charges');
    } catch (pullChargeError: any) {
      // Cursor deliberately not advanced, so these rows are pulled again.
      console.error('[Sync] Failed to store external_department_charges:', pullChargeError.message);
      pullFailures.push({ table: 'external_department_charges', error: pullChargeError.message });
    }

    // Each table's cursor was moved as it finished. There is deliberately no
    // organisation-wide "we are up to date" write here: that is what let a
    // failed pull be skipped for good.
    const deadLetterCount = countDeadLetters(db);

    return NextResponse.json({
      status: pullFailures.length > 0 ? 'partial_sync' : 'synced',
      pendingCount: countPending(db),
      deadLetterCount,
      // Named so the front desk can be told which data may be behind, rather
      // than being shown a clean tick over a sync that did not finish.
      failedTables: pullFailures.map(f => f.table),
      lastPullTimestamp: nowStr
    });
  } catch (error: any) {
    console.error('API POST /api/sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
