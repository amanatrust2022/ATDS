import { NextResponse } from 'next/server';
import { getDb } from '@/lib/localDb';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isHubServer } from '@/lib/runtimeMode';
import { requireAdmin, assertSameOrganization, authErrorResponse } from '@/lib/apiAuth';

/** How far back the report reaches when the caller does not say. */
const DEFAULT_SINCE_DAYS = 365;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');

    if (!orgId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    // A bound on the window. This used to return every row the clinic had
    // ever written, for a report that shows at most the last thirty days.
    const sinceParam = searchParams.get('since');
    const since = sinceParam && !Number.isNaN(Date.parse(sinceParam))
      ? new Date(sinceParam).toISOString()
      : new Date(Date.now() - DEFAULT_SINCE_DAYS * 86_400_000).toISOString();

    // The server knows what it is; the browser does not get to say.
    const isLocalServer = isHubServer();

    // A hub is trusted on its own network, as every hub route is. The cloud
    // holds the service-role key and answers only to an administrator of the
    // clinic being asked about. This route had no check at all before.
    if (!isLocalServer) {
      const caller = await requireAdmin(request);
      assertSameOrganization(caller, orgId);
    }

    if (isLocalServer) {
      const db = getDb();

      // 1. Fetch completed tests with patient registration timestamps for Turnaround Time (TAT) and commission tracking
      const completedTests = db.prepare(`
        SELECT
          t.completed_by,
          t.test_name,
          t.price,
          t.completed_at,
          t.department,
          t.commission_type,
          t.commission_value,
          t.commission_amount,
          p.registered_at as patient_created_at
        FROM patient_tests t
        LEFT JOIN patients p ON t.patient_id = p.id
        WHERE t.organization_id = ? AND t.status = 'completed' AND t.completed_by IS NOT NULL
          AND t.completed_at >= ?
      `).all(orgId, since) as any[];

      // 2. Fetch transaction statistics (revenue collected by reception staff)
      const ledgerTransactions = db.prepare(`
        SELECT created_by, amount, created_at, type
        FROM billing_ledger_transactions
        WHERE organization_id = ? AND created_by IS NOT NULL AND created_at >= ?
      `).all(orgId, since) as any[];

      const externalCharges = db.prepare(`
        SELECT created_by, amount, created_at
        FROM external_department_charges
        WHERE organization_id = ? AND created_by IS NOT NULL AND created_at >= ?
      `).all(orgId, since) as any[];

      // 3. Fetch summary metrics for Billing Health (total billables)
      const patientBilling = db.prepare(`
        SELECT total_amount, net_amount, registered_at as created_at
        FROM patients
        WHERE organization_id = ? AND registered_at >= ?
      `).all(orgId, since) as any[];

      return NextResponse.json({
        completedTests,
        ledgerTransactions,
        externalCharges,
        patientBilling
      });
    } else {
      // Cloud Supabase query
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabaseAdmin = createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      // Join tests with patient registered_at
      const [testsRes, ledgerRes, externalRes, billingRes] = await Promise.all([
        supabaseAdmin
          .from('patient_tests')
          .select(`
            completed_by,
            test_name,
            price,
            completed_at,
            department,
            commission_type,
            commission_value,
            commission_amount,
            patients(registered_at)
          `)
          .eq('organization_id', orgId)
          .eq('status', 'completed')
          .not('completed_by', 'is', null)
          .gte('completed_at', since),
        supabaseAdmin.from('billing_ledger_transactions').select('created_by, amount, created_at, type').eq('organization_id', orgId).not('created_by', 'is', null).gte('created_at', since),
        supabaseAdmin.from('external_department_charges').select('created_by, amount, created_at').eq('organization_id', orgId).not('created_by', 'is', null).gte('created_at', since),
        supabaseAdmin.from('patients').select('total_amount, net_amount, registered_at').eq('organization_id', orgId).gte('registered_at', since)
      ]);

      // Map Supabase nested join response to flat patient_created_at
      const mappedTests = (testsRes.data || []).map((t: any) => ({
        ...t,
        patient_created_at: t.patients?.registered_at || null
      }));

      const mappedBilling = (billingRes.data || []).map((b: any) => ({
        ...b,
        created_at: b.registered_at
      }));

      return NextResponse.json({
        completedTests: mappedTests,
        ledgerTransactions: ledgerRes.data || [],
        externalCharges: externalRes.data || [],
        patientBilling: mappedBilling
      });
    }
  } catch (error: any) {
    const denied = authErrorResponse(error);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    console.error('API GET /api/admin/performance error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
