import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import { postJson } from './localHttp';
import type { TestPrice } from '@/lib/store';

/** Per-organisation price list and referral commission rates for each test. */
export interface TestPricesRepository {
  list(organizationId: string): Promise<TestPrice[]>;
  upsertMany(prices: Omit<TestPrice, 'id'>[], organizationId: string): Promise<void>;
}

export const localTestPricesRepository: TestPricesRepository = {
  async list(organizationId) {
    const res = await fetch(`/api/test-prices?organizationId=${organizationId}`);
    return res.json();
  },

  async upsertMany(prices, organizationId) {
    await postJson('/api/test-prices', { prices, organizationId }, 'Failed to upsert test prices locally');
  },
};

export const cloudTestPricesRepository: TestPricesRepository = {
  async list(organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('test_prices')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) { console.error('fetchTestPrices error:', error); return []; }
    return data || [];
  },

  async upsertMany(prices, organizationId) {
    const supabase = createClient();
    // Callers have historically passed either snake_case or camelCase keys.
    const rows = prices.map(p => ({
      organization_id: organizationId,
      test_id: p.test_id || (p as any).testId,
      test_name: p.test_name || (p as any).testName,
      price: p.price,
      commission_type: p.commission_type || 'percentage',
      commission_value: p.commission_value || 0,
    }));
    const { error } = await supabase
      .from('test_prices')
      .upsert(rows, { onConflict: 'organization_id,test_id' });
    if (error) throw error;
  },
};

export const getTestPricesRepository = (mode: RuntimeMode = RUNTIME_MODE): TestPricesRepository =>
  mode === 'local' ? localTestPricesRepository : cloudTestPricesRepository;
