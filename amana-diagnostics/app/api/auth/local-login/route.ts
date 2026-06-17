import { NextResponse } from 'next/server';
import { getDb } from '@/lib/localDb';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const emailKey = email.toLowerCase().trim();
    const db = getDb();

    // Check local_auth
    const authRow = db.prepare('SELECT * FROM local_auth WHERE email = ?').get(emailKey) as { email: string; password_hash: string; user_id: string } | undefined;
    if (!authRow) {
      return NextResponse.json({ error: 'No offline credentials cached for this user. You must log in online at least once.' }, { status: 401 });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (authRow.password_hash !== hash) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Match found! Fetch profile and organization
    const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(authRow.user_id) as any | undefined;
    let organizationRow = null;
    if (profileRow && profileRow.organization_id) {
      organizationRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(profileRow.organization_id) as any | undefined;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authRow.user_id,
        email: authRow.email
      },
      profile: profileRow || null,
      organization: organizationRow || null
    });
  } catch (error: any) {
    console.error('Error in local-login:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
