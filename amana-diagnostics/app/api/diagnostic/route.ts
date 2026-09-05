import { NextResponse } from 'next/server';
import { requireAdmin, authErrorResponse } from '@/lib/apiAuth';

/**
 * Reports whether this deployment's Supabase keys are configured correctly.
 *
 * Useful when a clinic's install is misbehaving, but it describes the server's
 * credentials, so it is for an administrator of a workspace — not for anyone
 * who finds the URL.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    let anonRole = 'missing';
    let serviceRole = 'missing';

    try {
      if (anonKey) {
        const payload = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64').toString());
        anonRole = payload.role;
      }
    } catch (e) {
      anonRole = 'invalid-jwt';
    }

    try {
      if (serviceKey) {
        const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64').toString());
        serviceRole = payload.role;
      }
    } catch (e) {
      serviceRole = 'invalid-jwt';
    }

    return NextResponse.json({
      anonKeyPresent: !!anonKey,
      anonKeyRole: anonRole,
      serviceKeyPresent: !!serviceKey,
      serviceKeyRole: serviceRole,
      isIdentical: !!anonKey && !!serviceKey && anonKey === serviceKey,
    });
  } catch (error: any) {
    const denied = authErrorResponse(error);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    console.error('API GET /api/diagnostic error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
