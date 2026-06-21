import { NextResponse } from 'next/server';
import { getDb } from '@/lib/localDb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');

    if (!userId && !organizationId) {
      return NextResponse.json({ error: 'Missing userId or organizationId' }, { status: 400 });
    }

    const db = getDb();

    if (userId) {
      const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId);
      if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      return NextResponse.json(profile);
    } else {
      const profiles = db.prepare('SELECT * FROM profiles WHERE organization_id = ?').all(organizationId);
      return NextResponse.json(profiles);
    }
  } catch (error: any) {
    console.error('Error in GET /api/profiles:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await request.json();
    if (!profile || !profile.id || !profile.full_name || !profile.role) {
      return NextResponse.json({ error: 'Missing required profile fields' }, { status: 400 });
    }

    const db = getDb();
    db.prepare(`
      INSERT INTO profiles (id, full_name, title, first_name, surname, last_name, signature_url, role, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        full_name = excluded.full_name,
        title = excluded.title,
        first_name = excluded.first_name,
        surname = excluded.surname,
        last_name = excluded.last_name,
        signature_url = excluded.signature_url,
        role = excluded.role,
        organization_id = excluded.organization_id
    `).run(
      profile.id,
      profile.full_name,
      profile.title || null,
      profile.first_name || null,
      profile.surname || null,
      profile.last_name || null,
      profile.signature_url || null,
      profile.role,
      profile.organization_id || null
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST /api/profiles:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
