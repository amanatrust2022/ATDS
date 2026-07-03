import { getDb } from './localDb';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function isLocalMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true' ||
    process.env.IS_LOCAL_HUB === 'true'
  );
}

/**
 * Gets a server-side Supabase client using the service role key (to bypass RLS for patient retrieval)
 * or falls back to anon key.
 */
function getPortalSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
  }

  // Warning for missing service role key in cloud production mode
  if (!isLocalMode() && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY is not defined in production mode. Portal auth will fall back to anon key, which will fail to bypass RLS for patient lookup queries.');
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Missing Supabase credentials (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  }
  
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Checks if a patient exists with the given email address.
 * Returns basic identifier fields if found, or null.
 */
export async function getPatientByEmail(email: string): Promise<{ id: string; first_name: string; surname: string; organization_id: string } | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (isLocalMode()) {
    const db = getDb();
    const row = db.prepare(
      `SELECT id, first_name, surname, organization_id FROM patients WHERE LOWER(email) = ? LIMIT 1`
    ).get(normalizedEmail) as any;
    return row || null;
  }

  const supabase = getPortalSupabaseClient();
  const { data, error } = await supabase
    .from('patients')
    .select('id, first_name, surname, organization_id')
    .ilike('email', normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('getPatientByEmail Supabase error:', error);
    throw new Error('Database query failed');
  }
  return data;
}

/**
 * Retrieves full patient record for a patient ID if it matches the authenticated email address.
 */
export async function getPatientByIdAndEmail(patientId: string, email: string): Promise<any | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (isLocalMode()) {
    const db = getDb();
    const row = db.prepare(
      `SELECT * FROM patients WHERE id = ? AND LOWER(email) = ?`
    ).get(patientId, normalizedEmail);
    return row || null;
  }

  const supabase = getPortalSupabaseClient();
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('getPatientByIdAndEmail Supabase error:', error);
    throw new Error('Database query failed');
  }
  return data;
}

/**
 * Retrieves the full registration history (all patients with matching email address)
 * along with grouped patient test records.
 */
export async function getPatientHistoryByEmail(email: string): Promise<{ patients: any[]; tests: Record<string, any[]> }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (isLocalMode()) {
    const db = getDb();
    const patients = db.prepare(`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM patient_tests pt WHERE pt.patient_id = p.id) as test_count,
        (SELECT COUNT(*) FROM patient_tests pt WHERE pt.patient_id = p.id AND pt.status = 'completed') as completed_count
      FROM patients p
      WHERE LOWER(p.email) = ?
      ORDER BY p.registered_at DESC
    `).all(normalizedEmail) as any[];

    if (!patients || patients.length === 0) {
      return { patients: [], tests: {} };
    }

    const patientIds = patients.map((p: any) => p.id);
    const placeholders = patientIds.map(() => '?').join(', ');
    const tests = db.prepare(`
      SELECT * FROM patient_tests 
      WHERE patient_id IN (${placeholders}) 
      ORDER BY completed_at DESC
    `).all(...patientIds) as any[];

    const testsByPatient: Record<string, any[]> = {};
    for (const test of tests) {
      if (!testsByPatient[test.patient_id]) {
        testsByPatient[test.patient_id] = [];
      }
      if (test.results && typeof test.results === 'string') {
        try {
          test.results = JSON.parse(test.results);
        } catch {}
      }
      testsByPatient[test.patient_id].push(test);
    }
    return { patients, tests: testsByPatient };
  }

  const supabase = getPortalSupabaseClient();
  const { data: patients, error } = await supabase
    .from('patients')
    .select('*, patient_tests(*)')
    .ilike('email', normalizedEmail)
    .order('registered_at', { ascending: false });

  if (error) {
    console.error('getPatientHistoryByEmail Supabase error:', error);
    throw new Error('Database query failed');
  }

  if (!patients || patients.length === 0) {
    return { patients: [], tests: {} };
  }

  const testsByPatient: Record<string, any[]> = {};
  const formattedPatients = patients.map((p: any) => {
    const rawTests = p.patient_tests || [];
    
    // Sort tests by completed_at desc
    const sortedTests = [...rawTests].sort((a: any, b: any) => {
      const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return timeB - timeA;
    });

    testsByPatient[p.id] = sortedTests;

    return {
      ...p,
      test_count: sortedTests.length,
      completed_count: sortedTests.filter((t: any) => t.status === 'completed').length,
      patient_tests: undefined, // strip raw nested table
    };
  });

  return { patients: formattedPatients, tests: testsByPatient };
}

/**
 * Retrieves all completed test records for a patient ID.
 */
export async function getCompletedTestsByPatientId(patientId: string): Promise<any[]> {
  if (isLocalMode()) {
    const db = getDb();
    const tests = db.prepare(`
      SELECT * FROM patient_tests 
      WHERE patient_id = ? AND status = 'completed'
      ORDER BY completed_at ASC
    `).all(patientId) as any[];

    return tests.map((t) => {
      if (t.results && typeof t.results === 'string') {
        try {
          t.results = JSON.parse(t.results);
        } catch {}
      }
      return t;
    });
  }

  const supabase = getPortalSupabaseClient();
  const { data: tests, error } = await supabase
    .from('patient_tests')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });

  if (error) {
    console.error('getCompletedTestsByPatientId Supabase error:', error);
    throw new Error('Database query failed');
  }
  return tests || [];
}

/**
 * Fetches organization details by ID.
 */
export async function getOrganizationById(orgId: string): Promise<any | null> {
  if (isLocalMode()) {
    const db = getDb();
    return db.prepare('SELECT * FROM organizations WHERE id = ? LIMIT 1').get(orgId) || null;
  }

  const supabase = getPortalSupabaseClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    console.error('getOrganizationById Supabase error:', error);
    throw new Error('Database query failed');
  }
  return data;
}
