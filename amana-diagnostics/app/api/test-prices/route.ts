import { NextResponse } from 'next/server';
import { getDb, queueSync } from '@/lib/localDb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');

    if (!orgId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM test_prices 
      WHERE organization_id = ?
    `);
    const prices = stmt.all(orgId) as any[];

    return NextResponse.json(prices);
  } catch (error: any) {
    console.error('API GET /api/test-prices error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prices, organizationId } = body;
    const db = getDb();

    if (!prices || !organizationId) {
      return NextResponse.json({ error: 'Missing prices or organizationId' }, { status: 400 });
    }

    const stmt = db.prepare(`
      INSERT INTO test_prices (organization_id, test_id, test_name, price, commission_type, commission_value)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, test_id) DO UPDATE SET
        price = excluded.price,
        commission_type = excluded.commission_type,
        commission_value = excluded.commission_value
    `);

    for (const p of prices) {
      const commType = p.commission_type || p.commissionType || 'percentage';
      const commVal = p.commission_value ?? p.commissionValue ?? 0;
      stmt.run(organizationId, p.test_id || p.testId, p.test_name || p.testName, p.price, commType, commVal);

      // Log upsert in outbox (can sync using organization_id + test_id as composite key)
      queueSync(db, 'test_prices', 'UPDATE', `${organizationId}:${p.test_id || p.testId}`, {
        organization_id: organizationId,
        test_id: p.test_id || p.testId,
        test_name: p.test_name || p.testName,
        price: p.price,
        commission_type: commType,
        commission_value: commVal
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API POST /api/test-prices error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
