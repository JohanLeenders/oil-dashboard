import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

const store: any[] = [];

function makeChainable(resolveData: () => any) {
  const obj: Record<string, any> = {};
  let filters: Record<string, any> = {};
  let isUpsert = false;
  let upsertPayload: any = null;

  obj.select = (..._args: any[]) => obj;
  obj.eq = (col: string, val: any) => { filters[col] = val; return obj; };
  obj.in = (col: string, vals: any[]) => { filters[col] = vals; return obj; };
  obj.upsert = (data: any, _opts?: any) => { isUpsert = true; upsertPayload = data; return obj; };
  obj.single = () => {
    if (isUpsert) {
      // Simulate upsert: add to store and return
      const row = { id: 'new-id', ...upsertPayload, created_at: '2026-02-20', updated_at: '2026-02-20' };
      const existIdx = store.findIndex((r) => r.customer_id === upsertPayload.customer_id);
      if (existIdx >= 0) {
        store[existIdx] = { ...store[existIdx], ...upsertPayload };
        return Promise.resolve({ data: store[existIdx], error: null });
      }
      store.push(row);
      return Promise.resolve({ data: row, error: null });
    }
    return Promise.resolve({ data: resolveData(), error: null });
  };
  obj.then = (resolve: any, reject?: any) => {
    try {
      let data = resolveData();
      if (filters['customer_id'] && Array.isArray(filters['customer_id'])) {
        data = data.filter((r: any) => filters['customer_id'].includes(r.customer_id));
      }
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    } catch (e) {
      return Promise.resolve({ data: null, error: { message: String(e) } }).then(resolve, reject);
    }
  };
  return obj;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: (_table: string) => makeChainable(() => [...store]),
    })
  ),
}));

import { getDeliveryInfoForCustomers, upsertDeliveryInfo } from '@/lib/actions/delivery-info';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CUSTOMER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CUSTOMER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('delivery-info server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.length = 0;
    store.push({
      id: '1',
      customer_id: CUSTOMER_A,
      delivery_address: 'Pieter van Meel',
      transport_provider: 'Koops',
      transport_by_koops: true,
      putten_delivery_day: 'dinsdag',
      nijkerk_delivery_day: 'woensdag',
      notes: null,
      created_at: '2026-02-20',
      updated_at: '2026-02-20',
      customers: { name: 'Grutto' },
    });
  });

  it('returns delivery info for known customer IDs with customer name', async () => {
    const result = await getDeliveryInfoForCustomers([CUSTOMER_A]);
    expect(result.length).toBe(1);
    expect(result[0].delivery_address).toBe('Pieter van Meel');
    expect(result[0].customer_name).toBe('Grutto');
  });

  it('returns empty for customers without delivery info', async () => {
    const result = await getDeliveryInfoForCustomers([CUSTOMER_B]);
    expect(result).toHaveLength(0);
  });

  it('upserts delivery info (creates new row)', async () => {
    const result = await upsertDeliveryInfo(CUSTOMER_B, {
      delivery_address: 'Zaandam',
      transport_by_koops: false,
      putten_delivery_day: 'woensdag',
    });
    expect(result.customer_id).toBe(CUSTOMER_B);
    expect(result.delivery_address).toBe('Zaandam');
  });
});
