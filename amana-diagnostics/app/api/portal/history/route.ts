import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/portalAuth';
import { getPatientHistoryByEmail, getOrganizationById } from '@/lib/portalDb';
import { orgName as resolveOrgName } from '@/lib/branding';

export async function GET(request: Request) {
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

    const { email } = session;

    // Fetch patients and tests using the unified local/cloud database helper
    const { patients, tests } = await getPatientHistoryByEmail(email);

    // The portal pages had one clinic's name written into them. They can only
    // stop doing that if the response says whose portal this is.
    const orgId = patients[0]?.organization_id;
    const org = orgId ? await getOrganizationById(orgId) : null;

    return NextResponse.json({
      patients,
      tests,
      email,
      organization: {
        name: resolveOrgName(org),
        email: org?.email ?? null,
        phone: org?.phone ?? null,
        address: org?.address ?? null,
      },
    });
  } catch (error: any) {
    console.error('Portal history error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch history' }, { status: 500 });
  }
}
