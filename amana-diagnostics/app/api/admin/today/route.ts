import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { getDb } from '@/lib/localDb';
import { isHubServer } from '@/lib/runtimeMode';
import { requireAdmin, assertSameOrganization, authErrorResponse } from '@/lib/apiAuth';
import { TODAY_ROW_CAP, TODAY_WINDOW_DAYS, type TodayPayload, type TodayTest, type TodayVisit } from '@/lib/today/types';

/**
 * The rows behind the administrator's Today screen.
 *
 * One call, bounded: visits and tests from the last sixty-one days (the
 * thirty shown plus the thirty compared against), and — whatever their date
 * — every unfinished test, every visit still owing money, and every visit
 * whose referrer is still owed commission, each capped so a neglected
 * ledger cannot make the page unloadable. The browser adds them up, because
 * "today" is the clinic's today and this server may be in another time zone.
 *
 * A hub answers from its own database and trusts its own network, as every
 * hub route does. The cloud holds the service-role key and answers only an
 * administrator of the clinic being asked about.
 */

const ACK_MARK = '[Critical value acknowledged by';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');
    if (!orgId) return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });

    const now = new Date();
    const since = new Date(now.getTime() - TODAY_WINDOW_DAYS * 86_400_000).toISOString();
    const isLocalServer = isHubServer();

    if (!isLocalServer) {
      const caller = await requireAdmin(request);
      assertSameOrganization(caller, orgId);
    }

    const payload = isLocalServer ? fromHub(orgId, since) : await fromCloud(orgId, since);
    return NextResponse.json({ ...payload, generatedAt: now.toISOString(), since });
  } catch (error: any) {
    const denied = authErrorResponse(error);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });
    console.error('API GET /api/admin/today error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

type Rows = Omit<TodayPayload, 'generatedAt' | 'since'>;

const VISIT_COLUMNS =
  'id, slip_number, registered_at, first_name, surname, referred_by, referring_doctor_id, ' +
  'referring_facility_id, commission_assigned, commission_amount, commission_status, ' +
  'commission_paid_at, net_amount, paid_amount, payment_status, payment_method';

/* --- Hub ------------------------------------------------------------------ */

function fromHub(orgId: string, since: string): Rows {
  const db = getDb();
  const cap = TODAY_ROW_CAP + 1;

  const recent = db.prepare(
    `SELECT ${VISIT_COLUMNS} FROM patients WHERE organization_id = ? AND registered_at >= ?`,
  ).all(orgId, since) as any[];
  const unpaid = db.prepare(
    `SELECT ${VISIT_COLUMNS} FROM patients WHERE organization_id = ? AND payment_status <> 'paid'
     ORDER BY registered_at DESC LIMIT ?`,
  ).all(orgId, cap) as any[];
  const owing = db.prepare(
    `SELECT ${VISIT_COLUMNS} FROM patients WHERE organization_id = ?
       AND commission_assigned = 1 AND commission_status = 'pending'
     ORDER BY registered_at ASC LIMIT ?`,
  ).all(orgId, cap) as any[];

  const tests = db.prepare(`
    SELECT t.id, t.patient_id, t.test_name, t.department, t.status, t.completed_by, t.completed_by_profile_id, t.completed_at,
           t.price, t.commission_amount, t.results, t.notes,
           p.registered_at, p.first_name, p.surname, p.slip_number
    FROM patient_tests t
    JOIN patients p ON p.id = t.patient_id
    WHERE t.organization_id = ? AND (t.completed_at >= ? OR t.status <> 'completed')
  `).all(orgId, since) as any[];

  const ledger = db.prepare(
    `SELECT created_at, type, amount, created_by FROM billing_ledger_transactions
     WHERE organization_id = ? AND created_at >= ?`,
  ).all(orgId, since) as any[];
  const charges = db.prepare(
    `SELECT created_at, amount, department, created_by FROM external_department_charges
     WHERE organization_id = ? AND created_at >= ?`,
  ).all(orgId, since) as any[];
  const staff = db.prepare(
    'SELECT id, full_name, role, signature_url FROM profiles WHERE organization_id = ?',
  ).all(orgId) as any[];
  const doctors = db.prepare(
    'SELECT id, name, is_active FROM referring_doctors WHERE organization_id = ?',
  ).all(orgId) as any[];
  const facilities = db.prepare(
    'SELECT id, name, is_active FROM referring_facilities WHERE organization_id = ?',
  ).all(orgId) as any[];
  const pendingTests = db.prepare(
    'SELECT id, name, department FROM custom_tests WHERE organization_id = ? AND is_active = 0',
  ).all(orgId) as any[];

  return assemble({ recent, unpaid, owing, tests, ledger, charges, staff, doctors, facilities, pendingTests, invites: null });
}

/* --- Cloud ---------------------------------------------------------------- */

async function fromCloud(orgId: string, since: string): Promise<Rows> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Server misconfiguration: Service Role Key missing');
  const admin = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const cap = TODAY_ROW_CAP + 1;

  const TEST_SELECT =
    'id, patient_id, test_name, department, status, completed_by, completed_by_profile_id, completed_at, price, ' +
    'commission_amount, results, notes, patients!inner(registered_at, first_name, surname, slip_number)';

  const [recent, unpaid, owing, recentTests, openTests, ledger, charges, staff, doctors, facilities, pendingTests, invites] =
    await Promise.all([
      fetchAllResult((from, to) => admin.from('patients').select(VISIT_COLUMNS).eq('organization_id', orgId)
        .gte('registered_at', since).order('registered_at').order('id').range(from, to)),
      admin.from('patients').select(VISIT_COLUMNS).eq('organization_id', orgId).neq('payment_status', 'paid')
        .order('registered_at', { ascending: false }).limit(cap),
      admin.from('patients').select(VISIT_COLUMNS).eq('organization_id', orgId)
        .eq('commission_assigned', true).eq('commission_status', 'pending')
        .order('registered_at', { ascending: true }).limit(cap),
      fetchAllResult((from, to) => admin.from('patient_tests').select(TEST_SELECT).eq('organization_id', orgId)
        .gte('completed_at', since).order('completed_at').order('id').range(from, to)),
      admin.from('patient_tests').select(TEST_SELECT).eq('organization_id', orgId).neq('status', 'completed'),
      fetchAllResult((from, to) => admin.from('billing_ledger_transactions').select('created_at, type, amount, created_by')
        .eq('organization_id', orgId).gte('created_at', since).order('created_at').order('id').range(from, to)),
      fetchAllResult((from, to) => admin.from('external_department_charges').select('created_at, amount, department, created_by')
        .eq('organization_id', orgId).gte('created_at', since).order('created_at').order('id').range(from, to)),
      admin.from('profiles').select('id, full_name, role, signature_url').eq('organization_id', orgId),
      admin.from('referring_doctors').select('id, name, is_active').eq('organization_id', orgId),
      admin.from('referring_facilities').select('id, name, is_active').eq('organization_id', orgId),
      admin.from('custom_tests').select('id, name, department').eq('organization_id', orgId).eq('is_active', false),
      admin.from('invitations').select('id, email, role, expires_at').eq('organization_id', orgId).is('accepted_at', null),
    ]);

  for (const r of [recent, unpaid, owing, recentTests, openTests, ledger, charges, staff, doctors, facilities, pendingTests]) {
    if (r.error) throw new Error(r.error.message);
  }

  // The nested join arrives as an object; flatten it to the hub's shape.
  const flatten = (rows: any[]) =>
    rows.map((t) => ({
      ...t,
      registered_at: t.patients?.registered_at ?? null,
      first_name: t.patients?.first_name ?? null,
      surname: t.patients?.surname ?? null,
      slip_number: t.patients?.slip_number ?? null,
    }));

  return assemble({
    recent: recent.data ?? [],
    unpaid: unpaid.data ?? [],
    owing: owing.data ?? [],
    tests: [...flatten(recentTests.data ?? []), ...flatten(openTests.data ?? [])],
    ledger: ledger.data ?? [],
    charges: charges.data ?? [],
    staff: staff.data ?? [],
    doctors: doctors.data ?? [],
    facilities: facilities.data ?? [],
    pendingTests: pendingTests.data ?? [],
    // Invitations are optional: a clinic without the table still gets a page.
    invites: invites.error ? null : (invites.data ?? []),
  });
}

/* --- Shared --------------------------------------------------------------- */

function assemble(raw: {
  recent: any[]; unpaid: any[]; owing: any[]; tests: any[]; ledger: any[]; charges: any[];
  staff: any[]; doctors: any[]; facilities: any[]; pendingTests: any[]; invites: any[] | null;
}): Rows {
  const visits = new Map<string, TodayVisit>();
  for (const row of [...raw.recent, ...raw.unpaid.slice(0, TODAY_ROW_CAP), ...raw.owing.slice(0, TODAY_ROW_CAP)]) {
    const v = toVisit(row);
    if (!visits.has(v.id)) visits.set(v.id, v);
  }

  const tests = new Map<string, TodayTest>();
  let unfinishedCount = 0;
  for (const row of raw.tests) {
    const t = toTest(row);
    if (tests.has(t.id)) continue;
    if (t.status !== 'completed') {
      unfinishedCount += 1;
      if (unfinishedCount > TODAY_ROW_CAP) continue;
    }
    tests.set(t.id, t);
  }

  return {
    visits: [...visits.values()],
    tests: [...tests.values()],
    ledger: raw.ledger.map((l) => ({ created_at: l.created_at, type: l.type, amount: num(l.amount), created_by: l.created_by ?? null })),
    charges: raw.charges.map((c) => ({ created_at: c.created_at, amount: num(c.amount), department: c.department, created_by: c.created_by ?? null })),
    staff: raw.staff.map((s) => ({ id: String(s.id), full_name: s.full_name ?? null, role: s.role ?? null, signature_url: s.signature_url ?? null })),
    doctors: raw.doctors.map((d) => ({ id: String(d.id), name: d.name, is_active: truthy(d.is_active) })),
    facilities: raw.facilities.map((f) => ({ id: String(f.id), name: f.name, is_active: truthy(f.is_active) })),
    pendingTests: raw.pendingTests.map((t) => ({ id: String(t.id), name: t.name, department: t.department })),
    invites: raw.invites
      ? raw.invites.map((i) => ({ id: String(i.id), email: i.email, role: i.role, expires_at: i.expires_at ?? null }))
      : null,
    truncated: {
      unpaid: raw.unpaid.length > TODAY_ROW_CAP,
      pendingCommission: raw.owing.length > TODAY_ROW_CAP,
      unfinished: unfinishedCount > TODAY_ROW_CAP,
    },
  };
}

function toVisit(r: any): TodayVisit {
  return {
    id: String(r.id),
    slip_number: r.slip_number ?? '',
    registered_at: r.registered_at,
    first_name: r.first_name ?? null,
    surname: r.surname ?? null,
    referred_by: r.referred_by ?? null,
    referring_doctor_id: r.referring_doctor_id ? String(r.referring_doctor_id) : null,
    referring_facility_id: r.referring_facility_id ? String(r.referring_facility_id) : null,
    commission_assigned: truthy(r.commission_assigned),
    commission_amount: num(r.commission_amount),
    commission_status: r.commission_status ?? null,
    commission_paid_at: r.commission_paid_at ?? null,
    net_amount: num(r.net_amount),
    paid_amount: num(r.paid_amount),
    payment_status: r.payment_status ?? 'paid',
    payment_method: r.payment_method ?? null,
  };
}

function toTest(r: any): TodayTest {
  const results = parseResults(r.results);
  return {
    id: String(r.id),
    patient_id: String(r.patient_id),
    test_name: r.test_name,
    department: r.department,
    status: r.status,
    completed_by: r.completed_by ?? null,
    completed_by_profile_id: r.completed_by_profile_id ? String(r.completed_by_profile_id) : null,
    completed_at: r.completed_at ?? null,
    price: num(r.price),
    commission_amount: num(r.commission_amount),
    flags: results.map((row) => String(row?.flag ?? '')).filter(Boolean),
    acknowledged: typeof r.notes === 'string' && r.notes.includes(ACK_MARK),
    registered_at: r.registered_at,
    patient_name: [r.first_name, r.surname].filter(Boolean).join(' ') || r.slip_number || '',
    slip_number: r.slip_number ?? '',
  };
}

function parseResults(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const truthy = (v: unknown) => v === true || v === 1 || v === '1';

const PAGE_SIZE = 1000;

/** Return a Supabase-shaped result after walking past its per-response cap. */
async function fetchAllResult(makeQuery: (from: number, to: number) => PromiseLike<any>) {
  const data: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await makeQuery(from, from + PAGE_SIZE - 1);
    if (result.error) return { data: null, error: result.error };
    const page = result.data ?? [];
    data.push(...page);
    if (page.length < PAGE_SIZE) return { data, error: null };
  }
}
