import { NextResponse } from 'next/server';

export async function GET() {
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
    isIdentical: anonKey && serviceKey && anonKey === serviceKey,
  });
}
