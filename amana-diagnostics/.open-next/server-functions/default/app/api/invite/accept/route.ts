import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabaseAdmin = createSupabaseClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Update accepted_at for the invitation with matching token
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token)
      .select()
      .single();

    if (error) {
      console.error('Failed to update invitation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Invitation not found or invalid token' }, { status: 404 });
    }

    return NextResponse.json({ success: true, invitation: data });
  } catch (error: any) {
    console.error('API /api/invite/accept error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
