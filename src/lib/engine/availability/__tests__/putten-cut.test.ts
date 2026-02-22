/**
 * Putten Cut Co-Production Engine — Test Suite
 *
 * Wave 12: Tests for parent-pool routing with forced co-production.
 * Covers: no Putten orders, one child ordered, both children ordered,
 * oversubscription with cap, mass balance invariants, and backward compatibility.
 */

import { describe, it, expect } from 'vitest';
import {
  computeCascadedAvailability,
  type LocationYieldProfile,
  type ProductYieldChain,
  type OrderLine,
} from '../cascading';

// ---------------------------------------------------------------------------
// Test data: Zadel parent pool with Putten→Putten + Putten→Nijkerk chains
// ---------------------------------------------------------------------------

const GRILLER_KG = 10000; // 10,000 kg griller for easy math

const zadel_profiles: LocationYieldProfile[] = [
  { product_id: 'kappen-id', product_description: 'Kappen', yield_percentage: 0.360 },
  { product_id: 'zadel-id', product_description: 'Zadel (heel)', yield_percentage: 0.435 },
  { product_id: 'vleugels-id', product_description: 'Vleugels', yield_percentage: 0.095 },
];

const zadel_chains: ProductYieldChain[] = [
  // Kappen → Nijkerk (standard cascade, no change)
  { parent_product_id: 'kappen-id', child_product_id: 'filet-id', child_product_description: 'Filet', yield_pct: 0.6645, source_location_id: 'LOC_PUTTEN', target_location_id: 'LOC_NIJKERK' },
  { parent_product_id: 'kappen-id', child_product_id: 'haasjes-id', child_product_description: 'Haasjes', yield_pct: 0.1200, source_location_id: 'LOC_PUTTEN', target_location_id: 'LOC_NIJKERK' },
  { parent_product_id: 'kappen-id', child_product_id: 'vel-id', child_product_description: 'Vel', yield_pct: 0.0863, source_location_id: 'LOC_PUTTEN', target_location_id: 'LOC_NIJKERK' },

  // Zadel → Putten cut children (forced co-production)
  { parent_product_id: 'zadel-id', child_product_id: 'dij-id', child_product_description: 'Dij anatomisch', yield_pct: 0.3374, source_location_id: 'LOC_PUTTEN', target_location_id: 'LOC_PUTTEN' },
  { parent_product_id: 'zadel-id', child_product_id: 'drum-id', child_product_description: 'Drumstick 10kg', yield_pct: 0.3807, source_location_id: 'LOC_PUTTEN', target_location_id: 'LOC_PUTTEN' },
  { parent_product_id: 'zadel-id', child_product_id: 'zadel-loss-id', child_product_description: 'Zadel snijverlies Putten', yield_pct: 0.2819, source_location_id: 'LOC_PUTTEN', target_location_id: 'LOC_PUTTEN' },

  // Zadel → Nijkerk cascade children (when zadel goes whole to Nijkerk)
  { parent_product_id: 'zadel-id', child_product_id: 'dijvlees-id', child_product_description: 'Dijvlees', yield_pct: 0.2800, source_location_id: 'LOC_PUTTEN', target_location_id: 'LOC_NIJKERK' },
  { parent_product_id: 'zadel-id', child_product_id: 'drum15-id', child_product_description: 'Drumsticks 15kg', yield_pct: 0.3100, source_location_id: 'LOC_PUTTEN', target_location_id: 'LOC_NIJKERK' },
  { parent_product_id: 'zadel-id', child_product_id: 'drumvlees-id', child_product_description: 'Drumvlees', yield_pct: 0.1519, source_location_id: 'LOC_PUTTEN', target_location_id: 'LOC_NIJKERK' },
];

// Zadel available: 10000 * 0.435 = 4350 kg
const ZADEL_AVAILABLE = GRILLER_KG * 0.435; // 4350

function run(overrides: {
  griller_kg?: number;
  yield_profiles?: LocationYieldProfile[];
  yield_chains?: ProductYieldChain[];
  existing_orders_primary?: OrderLine[];
  existing_orders_secondary?: OrderLine[];
} = {}) {
  return computeCascadedAvailability({
    griller_kg: overrides.griller_kg ?? GRILLER_KG,
    yield_profiles: overrides.yield_profiles ?? zadel_profiles,
    yield_chains: overrides.yield_chains ?? zadel_chains,
    existing_orders_primary: overrides.existing_orders_primary ?? [],
    existing_orders_secondary: overrides.existing_orders_secondary ?? [],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Putten Cut Co-Production', () => {
  // ── Scenario 1: No Putten orders → all goes to Nijkerk ──

  it('forwards all zadel to Nijkerk when no Putten-cut orders exist', () => {
    const result = run();
    const zadel = result.primary_products.find(p => p.product_id === 'zadel-id')!;

    expect(zadel.putten_cut).toBeDefined();
    expect(zadel.putten_cut!.required_cut_kg).toBe(0);
    expect(zadel.putten_cut!.forwarded_to_nijkerk_kg).toBeCloseTo(ZADEL_AVAILABLE, 1);
    expect(zadel.putten_cut!.cut_loss_kg).toBe(0);

    // All co-product children should have 0 produced
    for (const child of zadel.putten_cut!.children) {
      expect(child.produced_kg).toBe(0);
    }

    // Nijkerk cascade should receive full zadel
    expect(zadel.forwarded_kg).toBeCloseTo(ZADEL_AVAILABLE, 1);
    expect(zadel.cascaded_children.length).toBeGreaterThan(0);

    // Dijvlees should get 4350 × 0.28 = 1218 kg
    const dijvlees = result.secondary_products.find(c => c.product_id === 'dijvlees-id')!;
    expect(dijvlees.available_kg).toBeCloseTo(ZADEL_AVAILABLE * 0.28, 1);
  });

  // ── Scenario 2: One child ordered → forced co-production ──

  it('cuts zadel when only dij anatomisch is ordered, producing co-product drumstick', () => {
    const orders: OrderLine[] = [
      { product_id: 'dij-id', quantity_kg: 500 },
    ];
    const result = run({ existing_orders_primary: orders });
    const zadel = result.primary_products.find(p => p.product_id === 'zadel-id')!;
    const cut = zadel.putten_cut!;

    // required_cut = 500 / 0.3374 = 1482.0 kg zadel
    const expectedCut = 500 / 0.3374;
    expect(cut.required_cut_kg).toBeCloseTo(expectedCut, 0);

    // Dij produced = 1482 × 0.3374 = 500 kg → sold 500, free 0
    const dij = cut.children.find(c => c.product_id === 'dij-id')!;
    expect(dij.produced_kg).toBeCloseTo(500, 0);
    expect(dij.sold_kg).toBeCloseTo(500, 0);
    expect(dij.co_product_free_kg).toBeCloseTo(0, 0);
    expect(dij.unfulfilled_kg).toBeCloseTo(0, 0);

    // Drumstick produced = 1482 × 0.3807 = 564.1 kg → sold 0, free 564.1
    const drum = cut.children.find(c => c.product_id === 'drum-id')!;
    expect(drum.produced_kg).toBeCloseTo(expectedCut * 0.3807, 0);
    expect(drum.sold_kg).toBe(0);
    expect(drum.co_product_free_kg).toBeCloseTo(expectedCut * 0.3807, 0);

    // Loss = 1482 × 0.2819 = 417.8 kg
    const loss = cut.children.find(c => c.product_id === 'zadel-loss-id')!;
    expect(loss.produced_kg).toBeCloseTo(expectedCut * 0.2819, 0);
    expect(loss.is_loss).toBe(true);

    // Forwarded to Nijkerk = 4350 - 1482 = 2868 kg
    expect(cut.forwarded_to_nijkerk_kg).toBeCloseTo(ZADEL_AVAILABLE - expectedCut, 0);

    // Nijkerk dijvlees gets only forwarded portion
    const dijvlees = result.secondary_products.find(c => c.product_id === 'dijvlees-id')!;
    expect(dijvlees.available_kg).toBeCloseTo(cut.forwarded_to_nijkerk_kg * 0.28, 0);
  });

  // ── Scenario 3: Both children ordered → max() determines cut ──

  it('uses max(required_per_child) when both dij and drum are ordered', () => {
    const orders: OrderLine[] = [
      { product_id: 'dij-id', quantity_kg: 500 },
      { product_id: 'drum-id', quantity_kg: 800 },
    ];
    const result = run({ existing_orders_primary: orders });
    const cut = result.primary_products.find(p => p.product_id === 'zadel-id')!.putten_cut!;

    // required for dij: 500 / 0.3374 = 1482.0
    // required for drum: 800 / 0.3807 = 2101.6
    // max() = 2101.6
    const expectedCut = 800 / 0.3807;
    expect(cut.required_cut_kg).toBeCloseTo(expectedCut, 0);

    // Dij produced = 2101.6 × 0.3374 = 709 kg → sold 500, free 209
    const dij = cut.children.find(c => c.product_id === 'dij-id')!;
    expect(dij.produced_kg).toBeCloseTo(expectedCut * 0.3374, 0);
    expect(dij.sold_kg).toBeCloseTo(500, 0);
    expect(dij.co_product_free_kg).toBeCloseTo(expectedCut * 0.3374 - 500, 0);
    expect(dij.unfulfilled_kg).toBe(0);

    // Drum produced = 2101.6 × 0.3807 = 800 kg → sold 800, free 0
    const drum = cut.children.find(c => c.product_id === 'drum-id')!;
    expect(drum.produced_kg).toBeCloseTo(800, 0);
    expect(drum.sold_kg).toBeCloseTo(800, 0);
    expect(drum.co_product_free_kg).toBeCloseTo(0, 0);
  });

  // ── Scenario 4: Oversubscription with cap ──

  it('caps required_cut_kg to remaining zadel and reports unfulfilled', () => {
    // Order 3000 kg dij — requires 3000/0.3374 = 8893 kg zadel, but only 4350 available
    const orders: OrderLine[] = [
      { product_id: 'dij-id', quantity_kg: 3000 },
    ];
    const result = run({ existing_orders_primary: orders });
    const cut = result.primary_products.find(p => p.product_id === 'zadel-id')!.putten_cut!;

    // Cap: required = min(8893, 4350) = 4350
    expect(cut.required_cut_kg).toBeCloseTo(ZADEL_AVAILABLE, 0);

    // Dij produced = 4350 × 0.3374 = 1468 kg → sold 1468, unfulfilled 1532
    const dij = cut.children.find(c => c.product_id === 'dij-id')!;
    const dijProduced = ZADEL_AVAILABLE * 0.3374;
    expect(dij.produced_kg).toBeCloseTo(dijProduced, 0);
    expect(dij.sold_kg).toBeCloseTo(dijProduced, 0); // capped to produced
    expect(dij.unfulfilled_kg).toBeCloseTo(3000 - dijProduced, 0);
    expect(dij.co_product_free_kg).toBeCloseTo(0, 0);

    // Drum produced as co-product = 4350 × 0.3807 = 1656 kg → all free
    const drum = cut.children.find(c => c.product_id === 'drum-id')!;
    expect(drum.produced_kg).toBeCloseTo(ZADEL_AVAILABLE * 0.3807, 0);
    expect(drum.sold_kg).toBe(0);
    expect(drum.co_product_free_kg).toBeCloseTo(ZADEL_AVAILABLE * 0.3807, 0);

    // Forwarded to Nijkerk = 0 (all zadel was cut)
    expect(cut.forwarded_to_nijkerk_kg).toBeCloseTo(0, 0);

    // No Nijkerk cascade children from zadel
    const dijvlees = result.secondary_products.find(c => c.product_id === 'dijvlees-id');
    expect(dijvlees?.available_kg ?? 0).toBeCloseTo(0, 0);
  });

  // ── Scenario 5: Mass balance invariants ──

  it('maintains mass balance: parent = sold_parent + cut_children + cut_loss + forwarded', () => {
    const orders: OrderLine[] = [
      { product_id: 'dij-id', quantity_kg: 500 },
      { product_id: 'drum-id', quantity_kg: 300 },
    ];
    const result = run({ existing_orders_primary: orders });
    const zadel = result.primary_products.find(p => p.product_id === 'zadel-id')!;
    const cut = zadel.putten_cut!;

    // parent_available = sold_parent + required_cut + forwarded_to_nijkerk
    const parentBalance = zadel.sold_primary_kg + cut.required_cut_kg + cut.forwarded_to_nijkerk_kg;
    expect(parentBalance).toBeCloseTo(zadel.primary_available_kg, 1);

    // required_cut = sum(produced children) = sum(child_yield × required_cut)
    const totalProduced = cut.children.reduce((s, c) => s + c.produced_kg, 0);
    expect(totalProduced).toBeCloseTo(cut.required_cut_kg, 1);

    // sold_child <= produced_child for each child
    for (const child of cut.children) {
      expect(child.sold_kg).toBeLessThanOrEqual(child.produced_kg + 0.01);
    }

    // co_product_free >= 0 for each child
    for (const child of cut.children) {
      expect(child.co_product_free_kg).toBeGreaterThanOrEqual(-0.01);
    }
  });

  it('maintains global mass balance check', () => {
    const orders: OrderLine[] = [
      { product_id: 'dij-id', quantity_kg: 500 },
      { product_id: 'kappen-id', quantity_kg: 1000 },
    ];
    const result = run({ existing_orders_primary: orders });
    expect(result.mass_balance_check).toBe(true);
  });

  // ── Scenario 6: Kappen backward compatibility ──

  it('cascades kappen normally (no Putten cut) even with zadel chains present', () => {
    const result = run();
    const kappen = result.primary_products.find(p => p.product_id === 'kappen-id')!;

    // Kappen should NOT have putten_cut (no Putten→Putten chains for kappen)
    expect(kappen.putten_cut).toBeUndefined();

    // Standard cascade: forwarded = 10000 * 0.36 = 3600 kg → filet = 3600 * 0.6645 = 2392.2
    expect(kappen.forwarded_kg).toBeCloseTo(3600, 0);
    const filet = kappen.cascaded_children.find(c => c.product_id === 'filet-id')!;
    expect(filet.available_kg).toBeCloseTo(3600 * 0.6645, 0);
  });

  // ── Scenario 7: Backward compatibility — chains without location info ──

  it('treats chains without location info as Nijkerk cascade (backward compatible)', () => {
    const legacyChains: ProductYieldChain[] = [
      // No source/target location — should behave as standard cascade
      { parent_product_id: 'zadel-id', child_product_id: 'dijvlees-id', child_product_description: 'Dijvlees', yield_pct: 0.63 },
      { parent_product_id: 'zadel-id', child_product_id: 'drumvlees-id', child_product_description: 'Drumvlees', yield_pct: 0.49 },
    ];

    const result = run({ yield_chains: legacyChains });
    const zadel = result.primary_products.find(p => p.product_id === 'zadel-id')!;

    // No putten_cut (no Putten→Putten chains detected)
    expect(zadel.putten_cut).toBeUndefined();

    // Standard cascade with normalization (0.63+0.49=1.12 > 1.0)
    expect(zadel.cascaded_children.length).toBe(2);
    const dijvlees = zadel.cascaded_children.find(c => c.product_id === 'dijvlees-id')!;
    const drumvlees = zadel.cascaded_children.find(c => c.product_id === 'drumvlees-id')!;
    expect(dijvlees.available_kg + drumvlees.available_kg).toBeCloseTo(zadel.forwarded_kg, 1);
    expect(zadel.processing_loss_kg).toBeCloseTo(0, 1); // normalized → no loss
  });

  // ── Scenario 8: Zero griller still works ──

  it('returns empty result for 0 griller kg', () => {
    const result = run({ griller_kg: 0 });
    expect(result.griller_kg).toBe(0);
    expect(result.primary_products).toHaveLength(0);
    expect(result.mass_balance_check).toBe(true);
  });

  // ── Scenario 9: Combined primary sales + Putten cut ──

  it('deducts direct zadel sales before computing Putten cut', () => {
    // Sell 1000 kg of zadel directly (if it were sellable), then order dij from remaining
    const orders: OrderLine[] = [
      { product_id: 'zadel-id', quantity_kg: 1000 }, // direct parent sale
      { product_id: 'dij-id', quantity_kg: 500 },     // triggers cut on remaining
    ];
    const result = run({ existing_orders_primary: orders });
    const zadel = result.primary_products.find(p => p.product_id === 'zadel-id')!;
    const cut = zadel.putten_cut!;

    // sold_primary = 1000, remaining = 4350 - 1000 = 3350
    expect(zadel.sold_primary_kg).toBeCloseTo(1000, 0);
    const remaining = ZADEL_AVAILABLE - 1000; // 3350

    // required_cut = 500 / 0.3374 = 1482 (within remaining 3350)
    const expectedCut = 500 / 0.3374;
    expect(cut.required_cut_kg).toBeCloseTo(expectedCut, 0);

    // forwarded = 3350 - 1482 = 1868
    expect(cut.forwarded_to_nijkerk_kg).toBeCloseTo(remaining - expectedCut, 0);

    // Mass balance: sold + cut + forwarded = available
    expect(zadel.sold_primary_kg + cut.required_cut_kg + cut.forwarded_to_nijkerk_kg)
      .toBeCloseTo(zadel.primary_available_kg, 1);
  });

  // ── Scenario 10: Large batch 40k birds ──

  it('handles large volumes without floating point drift', () => {
    const largeGriller = 40000 * 2.65 * 0.704; // 74624 kg
    const orders: OrderLine[] = [
      { product_id: 'dij-id', quantity_kg: 5000 },
      { product_id: 'drum-id', quantity_kg: 8000 },
    ];
    const result = run({ griller_kg: largeGriller, existing_orders_primary: orders });

    expect(result.mass_balance_check).toBe(true);

    const zadel = result.primary_products.find(p => p.product_id === 'zadel-id')!;
    const cut = zadel.putten_cut!;

    // Verify parent balance holds at scale
    expect(zadel.sold_primary_kg + cut.required_cut_kg + cut.forwarded_to_nijkerk_kg)
      .toBeCloseTo(zadel.primary_available_kg, 1);
  });
});
