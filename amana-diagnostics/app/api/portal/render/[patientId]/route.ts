import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/portalAuth';
import { getPatientByIdAndEmail, getCompletedTestsByPatientId, getOrganizationById } from '@/lib/portalDb';
import { getResultTemplate } from '@/lib/templates';

function mapDbPatientToStorePatient(p: any) {
  return {
    id: p.id,
    slipNumber: p.slip_number,
    registeredAt: p.registered_at,
    name: [p.first_name, p.middle_name, p.surname].filter(Boolean).join(' '),
    firstName: p.first_name,
    surname: p.surname,
    middleName: p.middle_name,
    age: p.age,
    sex: p.sex,
    phone: p.phone,
    email: p.email,
    address: p.address,
    referredBy: p.referred_by,
  };
}

function mapDbTestToStoreTest(t: any) {
  let results = t.results;
  if (typeof results === 'string') {
    try { results = JSON.parse(results); } catch { results = []; }
  }
  return {
    id: t.id,
    patient_id: t.patient_id,
    testId: t.test_id,
    testName: t.test_name,
    department: t.department,
    status: t.status,
    specimen: t.specimen,
    results: results || [],
    completedBy: t.completed_by,
    completedBySignatureUrl: t.completed_by_signature_url,
    completedByTitle: t.completed_by_title,
    completedAt: t.completed_at,
    notes: t.notes,
    price: t.price,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const session = verifyToken(token);
    if (!session) {
      return new NextResponse('Invalid or expired session', { status: 401 });
    }

    const { patientId } = await params;

    // Verify ownership using the hybrid DB helper
    const patient = await getPatientByIdAndEmail(patientId, session.email);

    if (!patient) {
      return new NextResponse('Patient not found or access denied', { status: 403 });
    }

    // Fetch completed tests only
    const tests = await getCompletedTestsByPatientId(patientId);

    if (!tests || tests.length === 0) {
      return new NextResponse('<html><body><p>No completed results yet.</p></body></html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Fetch organization using hybrid DB helper
    const org = patient.organization_id
      ? await getOrganizationById(patient.organization_id)
      : null;

    const storePatient = mapDbPatientToStorePatient(patient);
    const storeTests = tests.map(mapDbTestToStoreTest);

    const html = getResultTemplate(storePatient as any, storeTests as any, org as any);

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('Portal render error:', error);
    return new NextResponse(`Error: ${error.message}`, { status: 500 });
  }
}
