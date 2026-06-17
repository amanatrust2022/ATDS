import { NextResponse } from 'next/server';
import { getDb } from '@/lib/localDb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const slug = searchParams.get('slug');

    if (!id && !slug) {
      return NextResponse.json({ error: 'Missing id or slug' }, { status: 400 });
    }

    const db = getDb();
    let org;
    if (id) {
      org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);
    } else {
      org = db.prepare('SELECT * FROM organizations WHERE slug = ?').get(slug);
    }

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(org);
  } catch (error: any) {
    console.error('Error in GET /api/organizations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const org = await request.json();
    if (!org || !org.id || !org.name || !org.slug) {
      return NextResponse.json({ error: 'Missing required organization fields' }, { status: 400 });
    }

    const db = getDb();
    db.prepare(`
      INSERT INTO organizations (id, name, slug, plan_tier, address, phone, email, letterhead_line2, letterhead_html)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        plan_tier = excluded.plan_tier,
        address = excluded.address,
        phone = excluded.phone,
        email = excluded.email,
        letterhead_line2 = excluded.letterhead_line2,
        letterhead_html = excluded.letterhead_html
    `).run(
      org.id,
      org.name,
      org.slug,
      org.plan_tier || null,
      org.address || null,
      org.phone || null,
      org.email || null,
      org.letterhead_line2 || null,
      org.letterhead_html || null
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST /api/organizations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
