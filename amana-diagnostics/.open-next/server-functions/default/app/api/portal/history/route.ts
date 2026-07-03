import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/portalAuth';
import { getPatientHistoryByEmail } from '@/lib/portalDb';

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

    return NextResponse.json({ 
      patients,
      tests,
      email
    });
  } catch (error: any) {
    console.error('Portal history error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch history' }, { status: 500 });
  }
}
