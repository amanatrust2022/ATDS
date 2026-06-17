import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    localMode: process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true'
  });
}
