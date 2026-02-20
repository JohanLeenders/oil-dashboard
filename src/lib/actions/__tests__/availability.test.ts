import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn();

// Build a chainable mock that supports .from().select().eq().eq().single() etc.
function chainable() {
  const obj: Record<string, any> = {};
  obj.select = (...args: any[]) => { mockSelect(...args); return obj; };
  obj.eq = (...args: any[]) => { mockEq(...args); return obj; };
  obj.order = (...args: any[]) => { mockOrder(...args); return obj; };
  obj.single = () => mockSingle();
  return obj;
}

const mockFrom = vi.fn(() => chainable());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: mockFrom,
    })
  ),
}));

// We spy on the pure engine to verify what data the action passes through
vi.mock('@/lib/engine/availability/cascading', () => ({
  computeCascadedAvailability: vi.fn(() => ({
    griller_kg: 0,
    primary_products: [],
    secondary_products: [],
    total_sold_primary_kg: 0,
    total_forwarded_kg: 0,
    total_cascaded_kg: 0,
    total_loss_kg: 0,
    mass_balance_check: true,
  })),
}));

import { getCascadedAvailabilityForSlaughter } from '@/lib/actions/availability';
import { computeCascadedAvailability } from '@/lib/engine/availability/cascading';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SLAUGHTER_ID = '11111111-1111-1111-1111-111111111111';
const PUTTEN_LOC_ID = '22222222-2222-2222-2222-222222222222';
const PRODUCT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CHILD_PRODUCT_X = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ORDER_1 = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const ORDER_2 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

/**
 * Configure the mockFrom/mockSingle responses for each .from(table) call.
 * The action calls .from() in this order:
 *   1. slaughter_calendar  → .single()
 *   2. locations (putten)  → .single()
 *   3. location_yield_profiles → no .single(), returns array via last eq
 *   4. product_yield_chains → no .single(), returns array via order()
 *   5. customer_orders → returns array via last eq
 *   6..N. order_lines (per order) → returns array via last eq
 */
function setupMockResponses(config: {
  slaughter: { expected_birds: number; expected_live_weight_kg: number };
  profiles: Array<{ product_id: string; yield_percentage: number; products: { description: string } | null }>;
  chains: Array<{ parent_product_id: string; child_product_id: string; yield_pct: number; products: { description: string } | null }>;
  orders: Array<{ id: string }>;
  orderLines: Record<string, Array<{ product_id: string; quantity_kg: number }>>;
}) {
  let fromCallIndex = 0;

  mockFrom.mockImplementation((table: string) => {
    fromCallIndex++;
    const obj: Record<string, any> = {};

    // All chains return self
    obj.select = (..._args: any[]) => { mockSelect(..._args); return obj; };
    obj.eq = (..._args: any[]) => { mockEq(..._args); return obj; };
    obj.order = (..._args: any[]) => { mockOrder(..._args); return obj; };

    if (table === 'slaughter_calendar') {
      obj.single = () => Promise.resolve({ data: config.slaughter, error: null });
    } else if (table === 'locations') {
      obj.single = () => Promise.resolve({ data: { id: PUTTEN_LOC_ID }, error: null });
    } else if (table === 'location_yield_profiles') {
      // Profiles are returned from the last .eq() call — we make eq resolve
      obj.eq = (..._args: any[]) => {
        mockEq(..._args);
        // Return a thenable that also has eq/single methods
        const result = Promise.resolve({ data: config.profiles, error: null });
        (result as any).eq = (..._a: any[]) => result;
        (result as any).single = () => result;
        return result;
      };
    } else if (table === 'product_yield_chains') {
      obj.order = (..._args: any[]) => {
        mockOrder(..._args);
        return Promise.resolve({ data: config.chains, error: null });
      };
    } else if (table === 'customer_orders') {
      obj.eq = (..._args: any[]) => {
        mockEq(..._args);
        return Promise.resolve({ data: config.orders, error: null });
      };
    } else if (table === 'order_lines') {
      // Find which order this is for based on eq calls
      const orderId = config.orders[fromCallIndex - 7]?.id; // approximate
      obj.eq = (...args: any[]) => {
        mockEq(...args);
        // The second arg to eq('order_id', X) tells us which order
        const oid = args[1];
        const lines = config.orderLines[oid] || [];
        return Promise.resolve({ data: lines, error: null });
      };
    }

    return obj;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getCascadedAvailabilityForSlaughter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no_orders_full_availability — no orders exist, full primary + cascade availability', async () => {
    setupMockResponses({
      slaughter: { expected_birds: 1000, expected_live_weight_kg: 2500 },
      profiles: [
        { product_id: PRODUCT_A, yield_percentage: 0.5, products: { description: 'Filet' } },
        { product_id: PRODUCT_B, yield_percentage: 0.3, products: { description: 'Drumstick' } },
      ],
      chains: [
        { parent_product_id: PRODUCT_A, child_product_id: CHILD_PRODUCT_X, yield_pct: 0.8, products: { description: 'Filet Strip' } },
      ],
      orders: [],
      orderLines: {},
    });

    await getCascadedAvailabilityForSlaughter(SLAUGHTER_ID);

    expect(computeCascadedAvailability).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(computeCascadedAvailability).mock.calls[0][0];

    // griller_kg = 1000 * 2.5 * 0.704 = 1760
    expect(callArgs.griller_kg).toBeCloseTo(1760, 1);
    expect(callArgs.yield_profiles).toHaveLength(2);
    expect(callArgs.yield_profiles[0].product_id).toBe(PRODUCT_A);
    expect(callArgs.yield_profiles[0].product_description).toBe('Filet');
    expect(callArgs.yield_chains).toHaveLength(1);
    expect(callArgs.existing_orders_primary).toHaveLength(0);
    expect(callArgs.existing_orders_secondary).toHaveLength(0);
  });

  it('one_order_reduces_availability — one primary order → sold_primary_kg > 0', async () => {
    setupMockResponses({
      slaughter: { expected_birds: 1000, expected_live_weight_kg: 2500 },
      profiles: [
        { product_id: PRODUCT_A, yield_percentage: 0.5, products: { description: 'Filet' } },
      ],
      chains: [],
      orders: [{ id: ORDER_1 }],
      orderLines: {
        [ORDER_1]: [{ product_id: PRODUCT_A, quantity_kg: 200 }],
      },
    });

    await getCascadedAvailabilityForSlaughter(SLAUGHTER_ID);

    const callArgs = vi.mocked(computeCascadedAvailability).mock.calls[0][0];

    expect(callArgs.existing_orders_primary).toHaveLength(1);
    expect(callArgs.existing_orders_primary[0].product_id).toBe(PRODUCT_A);
    expect(callArgs.existing_orders_primary[0].quantity_kg).toBe(200);
  });

  it('oversubscribe_parent — order exceeds primary available → oversubscribed_kg > 0', async () => {
    setupMockResponses({
      slaughter: { expected_birds: 100, expected_live_weight_kg: 250 },
      profiles: [
        { product_id: PRODUCT_A, yield_percentage: 0.5, products: { description: 'Filet' } },
      ],
      chains: [],
      orders: [{ id: ORDER_1 }],
      orderLines: {
        [ORDER_1]: [{ product_id: PRODUCT_A, quantity_kg: 99999 }],
      },
    });

    await getCascadedAvailabilityForSlaughter(SLAUGHTER_ID);

    const callArgs = vi.mocked(computeCascadedAvailability).mock.calls[0][0];

    // griller_kg = 100 * 2.5 * 0.704 = 176 kg, primary available = 88 kg
    // Order of 99999 kg exceeds this heavily → engine will compute oversubscribed
    expect(callArgs.griller_kg).toBeCloseTo(176, 1);
    expect(callArgs.existing_orders_primary).toHaveLength(1);
    expect(callArgs.existing_orders_primary[0].quantity_kg).toBe(99999);
  });

  it('multiple_customers_aggregate — multiple orders for same product sum correctly', async () => {
    setupMockResponses({
      slaughter: { expected_birds: 1000, expected_live_weight_kg: 2500 },
      profiles: [
        { product_id: PRODUCT_A, yield_percentage: 0.5, products: { description: 'Filet' } },
      ],
      chains: [],
      orders: [{ id: ORDER_1 }, { id: ORDER_2 }],
      orderLines: {
        [ORDER_1]: [{ product_id: PRODUCT_A, quantity_kg: 100 }],
        [ORDER_2]: [{ product_id: PRODUCT_A, quantity_kg: 150 }],
      },
    });

    await getCascadedAvailabilityForSlaughter(SLAUGHTER_ID);

    const callArgs = vi.mocked(computeCascadedAvailability).mock.calls[0][0];

    // Both orders should appear in primary bucket
    expect(callArgs.existing_orders_primary).toHaveLength(2);
    const totalPrimaryKg = callArgs.existing_orders_primary.reduce(
      (sum: number, o: { quantity_kg: number }) => sum + o.quantity_kg,
      0
    );
    expect(totalPrimaryKg).toBe(250);
  });

  it('secondary_orders_classified_correctly — orders for child products go to secondary bucket', async () => {
    setupMockResponses({
      slaughter: { expected_birds: 1000, expected_live_weight_kg: 2500 },
      profiles: [
        { product_id: PRODUCT_A, yield_percentage: 0.5, products: { description: 'Filet' } },
      ],
      chains: [
        { parent_product_id: PRODUCT_A, child_product_id: CHILD_PRODUCT_X, yield_pct: 0.8, products: { description: 'Filet Strip' } },
      ],
      orders: [{ id: ORDER_1 }],
      orderLines: {
        [ORDER_1]: [
          { product_id: PRODUCT_A, quantity_kg: 100 },
          { product_id: CHILD_PRODUCT_X, quantity_kg: 50 },
        ],
      },
    });

    await getCascadedAvailabilityForSlaughter(SLAUGHTER_ID);

    const callArgs = vi.mocked(computeCascadedAvailability).mock.calls[0][0];

    // Primary order for PRODUCT_A
    expect(callArgs.existing_orders_primary).toHaveLength(1);
    expect(callArgs.existing_orders_primary[0].product_id).toBe(PRODUCT_A);
    expect(callArgs.existing_orders_primary[0].quantity_kg).toBe(100);

    // Secondary order for CHILD_PRODUCT_X
    expect(callArgs.existing_orders_secondary).toHaveLength(1);
    expect(callArgs.existing_orders_secondary[0].product_id).toBe(CHILD_PRODUCT_X);
    expect(callArgs.existing_orders_secondary[0].quantity_kg).toBe(50);
  });
});
