import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side admin client — uses service role to bypass RLS.
// This is safe because we verify the JWT before returning any data.
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes('placeholder') || key.includes('placeholder')) {
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  // 1. Extract the bearer token
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  // 2. Verify the JWT — getUser() calls the Supabase auth server,
  //    so it works even if the access token is fresh from a PKCE exchange.
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    console.warn('[/api/profile] JWT verification failed:', authError?.message);
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // 3. Fetch profile using service role (bypasses RLS — safe because we verified identity above)
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name, role, organization_id, email')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[/api/profile] Profile fetch error:', profileError);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found', userId: user.id }, { status: 404 });
  }

  // 4. Fetch organization (if profile has one)
  let organization = null;
  if (profile.organization_id) {
    const { data: orgData, error: orgError } = await admin
      .from('organizations')
      .select('id, slug, name, plan_tier, address, phone, email, letterhead_line2, letterhead_html')
      .eq('id', profile.organization_id)
      .maybeSingle();
    if (orgError) {
      console.warn('[/api/profile] Organization fetch error:', orgError);
    } else {
      organization = orgData;
    }
  }

  return NextResponse.json({ profile, organization });
}
