/**
 * Cascaded Availability Engine — Test Suite
 *
 * 20+ tests covering primary availability, cascade forwarding,
 * secondary order subtraction, mass balance invariants, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  computeCascadedAvailability,
  type LocationYieldProfile,
  type ProductYieldChain,
  type OrderLine,
} from '../cascading';

// ---------------------------------------------------------------------------
// Standard test data
// ---------------------------------------------------------------------------

const defaultProfiles: LocationYieldProfile[] = [
  { product_id: 'borstkap-id', product_description: 'Borstkap', yield_percentage: 0.235 },
  { product_id: 'zadel-id', product_description: 'Zadel', yield_percentage: 0.280 },
  { product_id: 'vleugel-id', product_description: 'Vleugels', yield_percentage: 0.107 },
  { product_id: 'rug-id', product_description: 'Rug/karkas', yield_percentage: 0.075 },
  { product_id: 'lever-id', product_description: 'Lever', yield_percentage: 0.018 },
  { product_id: 'maag-id', product_description: 'Maag', yield_percentage: 0.010 },
  { product_id: 'hart-id', product_description: 'Hart', yield_percentage: 0.005 },
  { product_id: 'hals-id', product_description: 'Hals', yield_percentage: 0.005 },
];

const defaultChains: ProductYieldChain[] = [
  { parent_product_id: 'borstkap-id', child_product_id: 'filet-met-haas-id', child_product_description: 'Filet met haas', yield_pct: 0.42 },
  { parent_product_id: 'borstkap-id', child_product_id: 'filet-zonder-haas-id', child_product_description: 'Filet zonder haas', yield_pct: 0.35 },
  { parent_product_id: 'borstkap-id', child_product_id: 'haasjes-id', child_product_description: 'Haasjes', yield_pct: 0.08 },
  { parent_product_id: 'zadel-id', child_product_id: 'dijfilet-id', child_product_description: 'Dijfilet', yield_pct: 0.35 },
  { parent_product_id: 'zadel-id', child_product_id: 'drumstick-id', child_product_description: 'Drumstick', yield_pct: 0.30 },
  { parent_product_id: 'zadel-id', child_product_id: 'drumvlees-id', child_product_description: 'Drumvlees', yield_pct: 0.20 },
];

// 1000 birds x 2.65 kg x 0.704 griller yield
const STANDARD_GRILLER_KG = 1865.6;

// ---------------------------------------------------------------------------
// Helper: run with defaults
// ---------------------------------------------------------------------------

function run(overrides: {
  griller_kg?: number;
  yield_profiles?: LocationYieldProfile[];
  yield_chains?: ProductYieldChain[];
  existing_orders_primary?: OrderLine[];
  existing_orders_secondary?: OrderLine[];
} = {}) {
  return computeCascadedAvailability({
    griller_kg: overrides.griller_kg ?? STANDARD_GRILLER_KG,
    yield_profiles: overrides.yield_profiles ?? defaultProfiles,
    yield_chains: overrides.yield_chains ?? defaultChains,
    existing_orders_primary: overrides.existing_orders_primary ?? [],
    existing_orders_secondary: overrides.existing_orders_secondary ?? [],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeCascadedAvailability', () => {
  // #1 — no_cascade_primary_only
  it('returns only primary products when no chains are defined', () => {
    const result = run({ yield_chains: [] });

    expect(result.primary_products).toHaveLength(defaultProfiles.length);
    expect(result.secondary_products).toHaveLength(0);
    result.primary_products.forEach((p) => {
      expect(p.cascaded_children).toHaveLength(0);
      expect(p.processing_loss_kg).toBe(0);
    });
  });

  // #2 — full_cascade_nothing_sold
  it('forwards all primary kg and computes children when nothing is sold', () => {
    const result = run();

    // Borstkap: 1865.6 * 0.235 = 438.416
    const borstkap = result.primary_products.find((p) => p.product_id === 'borstkap-id')!;
    expect(borstkap.primary_available_kg).toBeCloseTo(438.416, 1);
    expect(borstkap.sold_primary_kg).toBe(0);
    expect(borstkap.forwarded_kg).toBeCloseTo(438.416, 1);

    // Filet met haas: 438.416 * 0.42 = 184.134…
    const filetMetHaas = result.secondary_products.find((c) => c.product_id === 'filet-met-haas-id')!;
    expect(filetMetHaas.available_kg).toBeCloseTo(438.416 * 0.42, 1);
    expect(filetMetHaas.sold_kg).toBe(0);
    expect(filetMetHaas.net_available_kg).toBeCloseTo(438.416 * 0.42, 1);
  });

  // #3 — partial_cascade_mixed
  it('partially sells at primary and cascades the rest', () => {
    const orders: OrderLine[] = [
      { product_id: 'borstkap-id', quantity_kg: 200 },
    ];
    const result = run({ existing_orders_primary: orders });

    const borstkap = result.primary_products.find((p) => p.product_id === 'borstkap-id')!;
    expect(borstkap.sold_primary_kg).toBeCloseTo(200, 1);
    expect(borstkap.forwarded_kg).toBeCloseTo(438.416 - 200, 1);
    expect(borstkap.oversubscribed_kg).toBe(0);

    // Children should be based on forwarded (238.416)
    const forwarded = borstkap.forwarded_kg;
    const filetMetHaas = borstkap.cascaded_children.find(
      (c) => c.product_id === 'filet-met-haas-id',
    )!;
    expect(filetMetHaas.available_kg).toBeCloseTo(forwarded * 0.42, 1);
  });

  // #4 — all_sold_at_primary
  it('produces no children when everything is sold at primary level', () => {
    // Sell exactly the available amount of each primary product
    const orders: OrderLine[] = defaultProfiles.map((p) => ({
      product_id: p.product_id,
      quantity_kg: STANDARD_GRILLER_KG * p.yield_percentage,
    }));

    const result = run({ existing_orders_primary: orders });

    result.primary_products.forEach((p) => {
      expect(p.forwarded_kg).toBeCloseTo(0, 1);
      expect(p.cascaded_children).toHaveLength(0);
    });
    expect(result.secondary_products).toHaveLength(0);
    expect(result.total_cascaded_kg).toBeCloseTo(0, 1);
  });

  // #5 — oversubscribed_primary
  it('clamps sold to available and reports oversubscription', () => {
    const orders: OrderLine[] = [
      { product_id: 'borstkap-id', quantity_kg: 600 }, // more than 438.416
    ];
    const result = run({ existing_orders_primary: orders });

    const borstkap = result.primary_products.find((p) => p.product_id === 'borstkap-id')!;
    expect(borstkap.sold_primary_kg).toBeCloseTo(438.416, 1);
    expect(borstkap.oversubscribed_kg).toBeCloseTo(600 - 438.416, 1);
    expect(borstkap.forwarded_kg).toBeCloseTo(0, 1);
    // No children because nothing forwarded
    expect(borstkap.cascaded_children).toHaveLength(0);
  });

  // #6 — multi_parent_cascade
  it('cascades from multiple parents simultaneously', () => {
    const result = run();

    // Both borstkap and zadel should have children
    const borstkap = result.primary_products.find((p) => p.product_id === 'borstkap-id')!;
    const zadel = result.primary_products.find((p) => p.product_id === 'zadel-id')!;

    expect(borstkap.cascaded_children).toHaveLength(3);
    expect(zadel.cascaded_children).toHaveLength(3);

    // Zadel: 1865.6 * 0.280 = 522.368
    expect(zadel.forwarded_kg).toBeCloseTo(522.368, 1);

    const dijfilet = result.secondary_products.find((c) => c.product_id === 'dijfilet-id')!;
    expect(dijfilet.available_kg).toBeCloseTo(522.368 * 0.35, 1);

    // Total secondary products = 3 (borstkap children) + 3 (zadel children)
    expect(result.secondary_products).toHaveLength(6);
  });

  // #7 — zero_griller_kg
  it('returns all zeros for 0 griller kg', () => {
    const result = run({ griller_kg: 0 });

    expect(result.griller_kg).toBe(0);
    expect(result.primary_products).toHaveLength(0);
    expect(result.secondary_products).toHaveLength(0);
    expect(result.total_sold_primary_kg).toBe(0);
    expect(result.total_forwarded_kg).toBe(0);
    expect(result.total_cascaded_kg).toBe(0);
    expect(result.total_loss_kg).toBe(0);
    expect(result.mass_balance_check).toBe(true);
  });

  // #8 — single_parent_only
  it('works with a single yield profile', () => {
    const singleProfile: LocationYieldProfile[] = [
      { product_id: 'borstkap-id', product_description: 'Borstkap', yield_percentage: 0.235 },
    ];
    const singleChain: ProductYieldChain[] = [
      { parent_product_id: 'borstkap-id', child_product_id: 'filet-met-haas-id', child_product_description: 'Filet met haas', yield_pct: 0.42 },
    ];

    const result = run({
      yield_profiles: singleProfile,
      yield_chains: singleChain,
    });

    expect(result.primary_products).toHaveLength(1);
    expect(result.secondary_products).toHaveLength(1);
    expect(result.primary_products[0].cascaded_children).toHaveLength(1);
  });

  // #9 — yield_sum_over_100
  it('normalizes child yields proportionally when sum exceeds 1.0', () => {
    const overYieldChains: ProductYieldChain[] = [
      { parent_product_id: 'borstkap-id', child_product_id: 'child-a', child_product_description: 'Child A', yield_pct: 0.60 },
      { parent_product_id: 'borstkap-id', child_product_id: 'child-b', child_product_description: 'Child B', yield_pct: 0.60 },
    ];
    // Sum = 1.20 > 1.0 => normalize

    const result = run({ yield_chains: overYieldChains });

    const borstkap = result.primary_products.find((p) => p.product_id === 'borstkap-id')!;
    const forwarded = borstkap.forwarded_kg;

    // After normalization: each child gets 0.60/1.20 = 0.50 of forwarded
    const childA = borstkap.cascaded_children.find((c) => c.product_id === 'child-a')!;
    const childB = borstkap.cascaded_children.find((c) => c.product_id === 'child-b')!;
    expect(childA.available_kg).toBeCloseTo(forwarded * 0.5, 1);
    expect(childB.available_kg).toBeCloseTo(forwarded * 0.5, 1);

    // Total children kg should equal forwarded (no loss)
    expect(childA.available_kg + childB.available_kg).toBeCloseTo(forwarded, 1);
    expect(borstkap.processing_loss_kg).toBeCloseTo(0, 1);
  });

  // #10 — yield_sum_exactly_100
  it('has zero loss when child yields sum to exactly 1.0', () => {
    const exactYieldChains: ProductYieldChain[] = [
      { parent_product_id: 'borstkap-id', child_product_id: 'child-a', child_product_description: 'Child A', yield_pct: 0.60 },
      { parent_product_id: 'borstkap-id', child_product_id: 'child-b', child_product_description: 'Child B', yield_pct: 0.40 },
    ];

    const result = run({ yield_chains: exactYieldChains });

    const borstkap = result.primary_products.find((p) => p.product_id === 'borstkap-id')!;
    expect(borstkap.processing_loss_kg).toBeCloseTo(0, 1);

    const childSum = borstkap.cascaded_children.reduce((s, c) => s + c.available_kg, 0);
    expect(childSum).toBeCloseTo(borstkap.forwarded_kg, 1);
  });

  // #11 — loss_calculation_correct
  it('computes processing loss correctly as forwarded * (1 - sum(yields))', () => {
    // Borstkap chains: 0.42 + 0.35 + 0.08 = 0.85, loss = 0.15 of forwarded
    const result = run();

    const borstkap = result.primary_products.find((p) => p.product_id === 'borstkap-id')!;
    const expectedLoss = borstkap.forwarded_kg * (1 - 0.85);
    expect(borstkap.processing_loss_kg).toBeCloseTo(expectedLoss, 1);

    // Zadel chains: 0.35 + 0.30 + 0.20 = 0.85, loss = 0.15 of forwarded
    const zadel = result.primary_products.find((p) => p.product_id === 'zadel-id')!;
    const expectedLossZadel = zadel.forwarded_kg * (1 - 0.85);
    expect(zadel.processing_loss_kg).toBeCloseTo(expectedLossZadel, 1);
  });

  // #12 — mass_balance_invariant_1: sold + forwarded = available per parent
  it('maintains invariant: sold + forwarded = primary_available per parent', () => {
    const orders: OrderLine[] = [
      { product_id: 'borstkap-id', quantity_kg: 100 },
      { product_id: 'zadel-id', quantity_kg: 250 },
    ];
    const result = run({ existing_orders_primary: orders });

    result.primary_products.forEach((p) => {
      expect(p.sold_primary_kg + p.forwarded_kg).toBeCloseTo(p.primary_available_kg, 1);
    });
  });

  // #13 — mass_balance_invariant_2: sum(child yields) <= 1.0 per parent (or normalized)
  it('maintains invariant: cascaded children kg + loss = forwarded per parent', () => {
    const result = run();

    result.primary_products.forEach((p) => {
      if (p.forwarded_kg > 0 && p.cascaded_children.length > 0) {
        const childrenKg = p.cascaded_children.reduce((s, c) => s + c.available_kg, 0);
        expect(childrenKg + p.processing_loss_kg).toBeCloseTo(p.forwarded_kg, 1);
      }
    });
  });

  // #14 — mass_balance_invariant_3: sold_child <= child_available
  it('maintains invariant: sold_child <= child_available', () => {
    const secondaryOrders: OrderLine[] = [
      { product_id: 'filet-met-haas-id', quantity_kg: 50 },
      { product_id: 'dijfilet-id', quantity_kg: 30 },
    ];
    const result = run({ existing_orders_secondary: secondaryOrders });

    result.secondary_products.forEach((c) => {
      expect(c.sold_kg).toBeLessThanOrEqual(c.available_kg + 0.01);
    });
  });

  // #15 — mass_balance_invariant_4: global sum <= griller_kg
  it('maintains global mass balance: sold_primary + cascaded + loss <= griller_kg', () => {
    const result = run();

    const totalCheck =
      result.total_sold_primary_kg + result.total_cascaded_kg + result.total_loss_kg;
    expect(totalCheck).toBeLessThanOrEqual(result.griller_kg + 0.01);
    expect(result.mass_balance_check).toBe(true);
  });

  // #16 — secondary_orders_subtract
  it('subtracts secondary orders from cascaded child availability', () => {
    const secondaryOrders: OrderLine[] = [
      { product_id: 'filet-met-haas-id', quantity_kg: 50 },
    ];
    const result = run({ existing_orders_secondary: secondaryOrders });

    const filet = result.secondary_products.find((c) => c.product_id === 'filet-met-haas-id')!;
    expect(filet.sold_kg).toBeCloseTo(50, 1);
    expect(filet.net_available_kg).toBeCloseTo(filet.available_kg - 50, 1);
  });

  // #17 — empty_orders_arrays
  it('shows full availability everywhere when no orders exist', () => {
    const result = run({
      existing_orders_primary: [],
      existing_orders_secondary: [],
    });

    result.primary_products.forEach((p) => {
      expect(p.sold_primary_kg).toBe(0);
      expect(p.oversubscribed_kg).toBe(0);
      expect(p.forwarded_kg).toBeCloseTo(p.primary_available_kg, 1);
    });

    result.secondary_products.forEach((c) => {
      expect(c.sold_kg).toBe(0);
      expect(c.net_available_kg).toBeCloseTo(c.available_kg, 1);
    });
  });

  // #18 — unknown_product_in_orders
  it('ignores orders referencing products not in yield profiles', () => {
    const orders: OrderLine[] = [
      { product_id: 'nonexistent-product-id', quantity_kg: 500 },
    ];
    const result = run({ existing_orders_primary: orders });

    // No primary product should be affected
    result.primary_products.forEach((p) => {
      expect(p.sold_primary_kg).toBe(0);
      expect(p.forwarded_kg).toBeCloseTo(p.primary_available_kg, 1);
    });
    expect(result.mass_balance_check).toBe(true);
  });

  // #19 — large_batch_40k_birds
  it('handles 40,000 birds without floating point drift', () => {
    // 40,000 birds x 2.65 kg x 0.704 = 74,624 kg
    const largeGrillerKg = 40000 * 2.65 * 0.704;
    expect(largeGrillerKg).toBeCloseTo(74624, 1);

    const result = run({ griller_kg: largeGrillerKg });

    // Verify mass balance holds at scale
    expect(result.mass_balance_check).toBe(true);

    // Check individual product: borstkap = 74624 * 0.235 = 17536.64
    const borstkap = result.primary_products.find((p) => p.product_id === 'borstkap-id')!;
    expect(borstkap.primary_available_kg).toBeCloseTo(17536.64, 1);

    // Verify total doesn't exceed griller_kg
    const totalCheck =
      result.total_sold_primary_kg + result.total_cascaded_kg + result.total_loss_kg;
    expect(totalCheck).toBeLessThanOrEqual(largeGrillerKg + 0.01);
  });

  // #20 — negative_griller_kg
  it('treats negative griller_kg as 0', () => {
    const result = run({ griller_kg: -500 });

    expect(result.griller_kg).toBe(0);
    expect(result.primary_products).toHaveLength(0);
    expect(result.secondary_products).toHaveLength(0);
    expect(result.total_sold_primary_kg).toBe(0);
    expect(result.total_forwarded_kg).toBe(0);
    expect(result.total_cascaded_kg).toBe(0);
    expect(result.total_loss_kg).toBe(0);
    expect(result.mass_balance_check).toBe(true);
  });

  // --- Bonus tests ---

  // #21 — multiple orders for same product aggregate
  it('aggregates multiple order lines for the same product', () => {
    const orders: OrderLine[] = [
      { product_id: 'borstkap-id', quantity_kg: 100 },
      { product_id: 'borstkap-id', quantity_kg: 150 },
    ];
    const result = run({ existing_orders_primary: orders });

    const borstkap = result.primary_products.find((p) => p.product_id === 'borstkap-id')!;
    expect(borstkap.sold_primary_kg).toBeCloseTo(250, 1);
  });

  // #22 — products without chains still appear with no children and no loss
  it('handles products with no cascade chains (no children, no loss)', () => {
    const result = run();

    // vleugel-id has no chains defined
    const vleugel = result.primary_products.find((p) => p.product_id === 'vleugel-id')!;
    expect(vleugel.cascaded_children).toHaveLength(0);
    expect(vleugel.processing_loss_kg).toBe(0);
    // But it still has forwarded kg (full primary available since nothing sold)
    expect(vleugel.forwarded_kg).toBeCloseTo(STANDARD_GRILLER_KG * 0.107, 1);
  });

  // #23 — secondary order exceeding child availability clamps correctly
  it('clamps secondary sold_kg to available_kg when orders exceed availability', () => {
    const secondaryOrders: OrderLine[] = [
      { product_id: 'filet-met-haas-id', quantity_kg: 999999 },
    ];
    const result = run({ existing_orders_secondary: secondaryOrders });

    const filet = result.secondary_products.find((c) => c.product_id === 'filet-met-haas-id')!;
    expect(filet.sold_kg).toBeCloseTo(filet.available_kg, 1);
    expect(filet.net_available_kg).toBeCloseTo(0, 1);
  });
});
