import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { action, staffId, role } = await request.json();

    if (!staffId || !action) {
      return NextResponse.json({ error: 'Missing staffId or action' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!key) {
      return NextResponse.json({ error: 'Server misconfiguration: Service Role Key missing' }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    if (action === 'update_role') {
      if (!role) return NextResponse.json({ error: 'Missing role' }, { status: 400 });

      // 1. Update Auth metadata
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(staffId, {
        user_metadata: { role }
      });
      if (authErr) throw authErr;

      // 2. Update Profiles
      const { error: profErr } = await supabaseAdmin.from('profiles').update({ role }).eq('id', staffId);
      if (profErr) throw profErr;

      return NextResponse.json({ success: true });
    }

    if (action === 'remove_staff') {
      // 1. Get current metadata to preserve other fields
      const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(staffId);
      if (userErr || !user) throw userErr || new Error('User not found');

      // 2. Update Auth metadata
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(staffId, {
        user_metadata: { ...user.user_metadata, organization_id: null }
      });
      if (authErr) throw authErr;

      // 3. Update Profiles
      const { error: profErr } = await supabaseAdmin.from('profiles').update({ organization_id: null }).eq('id', staffId);
      if (profErr) throw profErr;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API /api/staff/update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
