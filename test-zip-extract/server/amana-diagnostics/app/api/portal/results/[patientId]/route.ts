import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/portalAuth';
import { getPatientByIdAndEmail, getCompletedTestsByPatientId, getOrganizationById } from '@/lib/portalDb';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const { patientId } = await params;

    // Verify this patient belongs to the authenticated email (using local/cloud helper)
    const patient = await getPatientByIdAndEmail(patientId, session.email);

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found or access denied' }, { status: 403 });
    }

    // Fetch completed tests for the patient using local/cloud helper
    const tests = await getCompletedTestsByPatientId(patientId);

    // Fetch org data
    const org = patient.organization_id
      ? await getOrganizationById(patient.organization_id)
      : null;

    return NextResponse.json({ patient, tests, org });
  } catch (error: any) {
    console.error('Portal patient results error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch results' }, { status: 500 });
  }
}
