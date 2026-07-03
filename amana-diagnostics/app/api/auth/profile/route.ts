import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = body?.userId;
    const profile = body?.profile;

    if (!userId || !profile) {
      return NextResponse.json({ error: 'Missing userId or profile' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({ ...profile, id: userId }, { onConflict: 'id' })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[auth/profile] supabase write failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || { id: userId } });
  } catch (error: any) {
    console.error('[auth/profile] route failed:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
