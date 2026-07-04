import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Decodes a JWT payload locally to retrieve the userId and check expiry.
// Security: The actual signature verification is delegated to the database
// when we query using the user's JWT, making local decoding 100% secure.
function getUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    let jsonPayload = '';
    if (typeof Buffer !== 'undefined') {
      jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    } else {
      jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    }
    
    const decoded = JSON.parse(jsonPayload);
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      console.warn('[/api/profile] Token is expired');
      return null;
    }
    return decoded.sub || null;
  } catch (e) {
    console.error('[/api/profile] Failed to decode JWT locally:', e);
    return null;
  }
}

// Creates a client authenticated as the incoming user.
function getUserClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes('placeholder') || anonKey.includes('placeholder')) {
    return null;
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

export async function GET(req: NextRequest) {
  // 1. Extract the bearer token
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  // 2. Decode user ID locally from token
  const userId = getUserIdFromToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // 3. Create user-scoped client
  const client = getUserClient(token);
  if (!client) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  // 4. Fetch profile using user-scoped client (PostgREST verifies JWT signature & applies RLS)
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, full_name, role, organization_id, email')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('[/api/profile] Profile fetch error:', profileError);
    // If PostgREST returns a JWT validation/signature error, return 401
    const isAuthErr = profileError.code === 'PGRST301' || profileError.message?.includes('JWT');
    return NextResponse.json(
      { error: profileError.message },
      { status: isAuthErr ? 401 : 500 }
    );
  }

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found', userId }, { status: 404 });
  }

  // 5. Fetch organization (PostgREST verifies JWT signature & applies RLS)
  let organization = null;
  if (profile.organization_id) {
    const { data: orgData, error: orgError } = await client
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

