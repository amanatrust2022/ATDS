import { NextResponse } from 'next/server';
import { getDb } from '@/lib/localDb';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email, password, userId } = await request.json();
    if (!email || !password || !userId) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const db = getDb();
    
    db.prepare(`
      INSERT INTO local_auth (email, password_hash, user_id)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        password_hash = excluded.password_hash,
        user_id = excluded.user_id
    `).run(email.toLowerCase().trim(), hash, userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in save-credentials:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
