import { NextResponse } from 'next/server';
import { getDb } from '@/lib/localDb';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');
    const localModeParam = searchParams.get('localMode') === 'true';

    if (!orgId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const isLocalServer = process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true' || localModeParam;

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
      `).all(orgId) as any[];

      // 2. Fetch transaction statistics (revenue collected by reception staff)
      const ledgerTransactions = db.prepare(`
        SELECT created_by, amount, created_at, type
        FROM billing_ledger_transactions
        WHERE organization_id = ? AND created_by IS NOT NULL
      `).all(orgId) as any[];

      const externalCharges = db.prepare(`
        SELECT created_by, amount, created_at
        FROM external_department_charges
        WHERE organization_id = ? AND created_by IS NOT NULL
      `).all(orgId) as any[];

      // 3. Fetch summary metrics for Billing Health (total billables)
      const patientBilling = db.prepare(`
        SELECT total_amount, net_amount, registered_at as created_at
        FROM patients
        WHERE organization_id = ?
      `).all(orgId) as any[];

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
          .not('completed_by', 'is', null),
        supabaseAdmin.from('billing_ledger_transactions').select('created_by, amount, created_at, type').eq('organization_id', orgId).not('created_by', 'is', null),
        supabaseAdmin.from('external_department_charges').select('created_by, amount, created_at').eq('organization_id', orgId).not('created_by', 'is', null),
        supabaseAdmin.from('patients').select('total_amount, net_amount, registered_at').eq('organization_id', orgId)
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
    console.error('API GET /api/admin/performance error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
