/**
 * Planning Simulator Engine — Test Suite
 *
 * Tests whole-bird-pull logic, weight recalculation, and cascade integration.
 * Uses known values from the Storteboom bestelschema Excel.
 */

import { describe, it, expect } from 'vitest';
import {
  computeSimulatedAvailability,
  type SimulatorInput,
  type WholeBirdPull,
} from '../simulator';
import type { LocationYieldProfile, ProductYieldChain } from '../cascading';

// ---------------------------------------------------------------------------
// Standard test data (matches production Putten/Nijkerk config)
// ---------------------------------------------------------------------------

const puttenProfiles: LocationYieldProfile[] = [
  { product_id: 'borst-id', product_description: 'Borstkappen met vel', yield_percentage: 0.3675 },
  { product_id: 'dij-id', product_description: 'Dij anatomisch', yield_percentage: 0.1468 },
  { product_id: 'drum-id', product_description: 'Drumstick 10kg', yield_percentage: 0.1656 },
  { product_id: 'vleugel-id', product_description: 'Vleugels z/tip', yield_percentage: 0.0957 },
  { product_id: 'nekken-id', product_description: 'Nekken', yield_percentage: 0.0197 },
  { product_id: 'lever-id', product_description: 'Levertjes', yield_percentage: 0.0174 },
  { product_id: 'maag-id', product_description: 'Maagjes', yield_percentage: 0.0107 },
  { product_id: 'hart-id', product_description: 'Hartjes', yield_percentage: 0.0019 },
];

const nijkerkChains: ProductYieldChain[] = [
  { parent_product_id: 'borst-id', child_product_id: 'filet-id', child_product_description: 'Kipfilet', yield_pct: 0.6645 },
  { parent_product_id: 'borst-id', child_product_id: 'haas-id', child_product_description: 'Haasjes', yield_pct: 0.12 },
  { parent_product_id: 'borst-id', child_product_id: 'vel-id', child_product_description: 'Vel', yield_pct: 0.0863 },
  { parent_product_id: 'dij-id', child_product_id: 'dijvlees-id', child_product_description: 'Dijvlees', yield_pct: 0.63 },
  { parent_product_id: 'drum-id', child_product_id: 'drumvlees-id', child_product_description: 'Drumvlees', yield_pct: 0.49 },
];

// Excel reference: 24.176 birds, 67.692,8 kg live weight
const EXCEL_BIRDS = 24176;
const EXCEL_LIVE_WEIGHT_KG = 67692.8;
const GRILLER_YIELD = 0.704;

function defaultInput(overrides: Partial<SimulatorInput> = {}): SimulatorInput {
  return {
    total_birds: EXCEL_BIRDS,
    total_live_weight_kg: EXCEL_LIVE_WEIGHT_KG,
    griller_yield_pct: GRILLER_YIELD,
    whole_bird_pulls: [],
    yield_profiles: puttenProfiles,
    yield_chains: nijkerkChains,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeSimulatedAvailability', () => {
  // #1 — Basic: no pulls, verify griller kg calculation
  it('computes correct griller kg without any pulls', () => {
    const result = computeSimulatedAvailability(defaultInput());

    // avg live weight = 67692.8 / 24176 = 2.8 kg
    expect(result.avg_live_weight_kg).toBeCloseTo(2.8, 2);

    // griller kg = 24176 * 2.8 * 0.704 = 47655.6
    const expectedGriller = EXCEL_BIRDS * (EXCEL_LIVE_WEIGHT_KG / EXCEL_BIRDS) * GRILLER_YIELD;
    expect(result.original_griller_kg).toBeCloseTo(expectedGriller, 0);
    expect(result.remaining_griller_kg).toBeCloseTo(expectedGriller, 0);
    expect(result.total_whole_birds_pulled).toBe(0);
    expect(result.total_whole_bird_kg).toBe(0);
  });

  // #2 — Pull whole birds: griller_kg decreases
  it('reduces griller_kg when pulling whole birds', () => {
    const pulls: WholeBirdPull[] = [
      { label: '1300-1600', count: 200, avg_kg: 1.45 },
    ];

    const result = computeSimulatedAvailability(
      defaultInput({ whole_bird_pulls: pulls })
    );

    // 200 birds * 1.45 kg = 290 kg pulled
    expect(result.total_whole_bird_kg).toBeCloseTo(290, 1);
    expect(result.remaining_griller_kg).toBeCloseTo(
      result.original_griller_kg - 290,
      1
    );
    expect(result.remaining_birds).toBe(EXCEL_BIRDS - 200);
  });

  // #3 — Average weight increases when lighter birds are pulled
  it('increases average griller weight when lighter birds are pulled', () => {
    const noPulls = computeSimulatedAvailability(defaultInput());
    const avgBefore = noPulls.adjusted_avg_griller_weight_kg;

    // Pull 500 light birds (1.45 kg griller, lighter than avg ~1.97 kg)
    const pulls: WholeBirdPull[] = [
      { label: '1300-1600', count: 500, avg_kg: 1.45 },
    ];
    const withPulls = computeSimulatedAvailability(
      defaultInput({ whole_bird_pulls: pulls })
    );

    // Average weight should go UP because we removed lighter birds
    expect(withPulls.adjusted_avg_griller_weight_kg).toBeGreaterThan(avgBefore);
  });

  // #4 — Multiple pulls stack correctly
  it('handles multiple whole-bird pulls correctly', () => {
    const pulls: WholeBirdPull[] = [
      { label: '1300-1600', count: 200, avg_kg: 1.45 },
      { label: '1700-1800', count: 150, avg_kg: 1.75 },
    ];

    const result = computeSimulatedAvailability(
      defaultInput({ whole_bird_pulls: pulls })
    );

    // Total pulled: 200 * 1.45 + 150 * 1.75 = 290 + 262.5 = 552.5 kg
    expect(result.total_whole_bird_kg).toBeCloseTo(552.5, 1);
    expect(result.total_whole_birds_pulled).toBe(350);
    expect(result.remaining_birds).toBe(EXCEL_BIRDS - 350);
    expect(result.remaining_griller_kg).toBeCloseTo(
      result.original_griller_kg - 552.5,
      1
    );
  });

  // #5 — Cascade output is valid after pulls
  it('produces valid cascaded availability after whole-bird pulls', () => {
    const pulls: WholeBirdPull[] = [
      { label: '1300-1600', count: 200, avg_kg: 1.45 },
    ];

    const result = computeSimulatedAvailability(
      defaultInput({ whole_bird_pulls: pulls })
    );

    // Cascade should use the remaining griller kg
    expect(result.cascaded.griller_kg).toBeCloseTo(result.remaining_griller_kg, 1);

    // Primary products should exist
    expect(result.cascaded.primary_products.length).toBe(puttenProfiles.length);

    // Borstkappen should be 36.75% of remaining griller
    const borst = result.cascaded.primary_products.find(
      (p) => p.product_id === 'borst-id'
    )!;
    expect(borst.primary_available_kg).toBeCloseTo(
      result.remaining_griller_kg * 0.3675,
      1
    );

    // Mass balance should hold
    expect(result.cascaded.mass_balance_check).toBe(true);
  });

  // #6 — Cascade has no existing orders (simulator plans from scratch)
  it('has zero sold kg in cascaded result (no existing orders)', () => {
    const result = computeSimulatedAvailability(defaultInput());

    result.cascaded.primary_products.forEach((p) => {
      expect(p.sold_primary_kg).toBe(0);
      expect(p.oversubscribed_kg).toBe(0);
    });

    result.cascaded.secondary_products.forEach((c) => {
      expect(c.sold_kg).toBe(0);
    });
  });

  // #7 — Zero birds edge case
  it('handles zero birds gracefully', () => {
    const result = computeSimulatedAvailability(
      defaultInput({ total_birds: 0 })
    );

    expect(result.original_griller_kg).toBe(0);
    expect(result.remaining_griller_kg).toBe(0);
    expect(result.cascaded.griller_kg).toBe(0);
    expect(result.cascaded.primary_products).toHaveLength(0);
  });

  // #8 — Negative birds edge case
  it('handles negative birds gracefully', () => {
    const result = computeSimulatedAvailability(
      defaultInput({ total_birds: -100 })
    );

    expect(result.original_griller_kg).toBe(0);
    expect(result.remaining_griller_kg).toBe(0);
  });

  // #9 — Pull more birds than available
  it('clamps pulls to available birds', () => {
    const pulls: WholeBirdPull[] = [
      { label: '1300-1600', count: 30000, avg_kg: 1.45 }, // more than 24176
    ];

    const result = computeSimulatedAvailability(
      defaultInput({ whole_bird_pulls: pulls })
    );

    expect(result.whole_bird_pulls[0].count).toBe(EXCEL_BIRDS);
    expect(result.remaining_birds).toBe(0);
    expect(result.remaining_griller_kg).toBeGreaterThanOrEqual(0);
  });

  // #10 — Pull zero birds in a class
  it('handles zero-count pulls correctly', () => {
    const pulls: WholeBirdPull[] = [
      { label: '1300-1600', count: 0, avg_kg: 1.45 },
      { label: '1700-1800', count: 100, avg_kg: 1.75 },
    ];

    const result = computeSimulatedAvailability(
      defaultInput({ whole_bird_pulls: pulls })
    );

    expect(result.whole_bird_pulls[0].total_kg).toBe(0);
    expect(result.whole_bird_pulls[1].total_kg).toBeCloseTo(175, 1);
    expect(result.total_whole_birds_pulled).toBe(100);
  });

  // #11 — Adjusted live weight back-calculation
  it('correctly back-calculates adjusted live weight', () => {
    const pulls: WholeBirdPull[] = [
      { label: '1300-1600', count: 200, avg_kg: 1.45 },
    ];

    const result = computeSimulatedAvailability(
      defaultInput({ whole_bird_pulls: pulls })
    );

    // adjusted_avg_griller_weight * birds = remaining_griller_kg
    expect(
      result.adjusted_avg_griller_weight_kg * result.remaining_birds
    ).toBeCloseTo(result.remaining_griller_kg, 1);

    // adjusted_avg_live_weight = adjusted_avg_griller_weight / griller_yield
    expect(result.adjusted_avg_live_weight_kg).toBeCloseTo(
      result.adjusted_avg_griller_weight_kg / GRILLER_YIELD,
      2
    );
  });

  // #12 — All birds pulled → zero remaining
  it('handles pulling all birds', () => {
    const pulls: WholeBirdPull[] = [
      { label: 'All', count: EXCEL_BIRDS, avg_kg: 1.0 },
    ];

    const result = computeSimulatedAvailability(
      defaultInput({ whole_bird_pulls: pulls })
    );

    expect(result.remaining_birds).toBe(0);
    expect(result.remaining_griller_kg).toBeGreaterThanOrEqual(0);
    // With 0 remaining birds, adjusted weights should be 0
    expect(result.adjusted_avg_griller_weight_kg).toBe(0);
    expect(result.adjusted_avg_live_weight_kg).toBe(0);
  });

  // #13 — Verify Putten primary products match yield profiles
  it('produces correct number of primary products matching yield profiles', () => {
    const result = computeSimulatedAvailability(defaultInput());

    expect(result.cascaded.primary_products).toHaveLength(
      puttenProfiles.length
    );

    for (const profile of puttenProfiles) {
      const product = result.cascaded.primary_products.find(
        (p) => p.product_id === profile.product_id
      );
      expect(product).toBeDefined();
      expect(product!.primary_available_kg).toBeCloseTo(
        result.remaining_griller_kg * profile.yield_percentage,
        1
      );
    }
  });

  // #14 — Verify Nijkerk secondary products appear via cascade
  it('produces Nijkerk secondary products through cascade chains', () => {
    const result = computeSimulatedAvailability(defaultInput());

    // Kipfilet, Haasjes, Vel from kappen; Dijvlees from dij; Drumvlees from drum
    expect(result.cascaded.secondary_products.length).toBe(5);

    const filet = result.cascaded.secondary_products.find(
      (c) => c.product_id === 'filet-id'
    )!;
    expect(filet).toBeDefined();
    expect(filet.available_kg).toBeGreaterThan(0);
  });

  // #15 — Mass balance holds after pulls
  it('maintains mass balance invariant after whole-bird pulls', () => {
    const pulls: WholeBirdPull[] = [
      { label: '1300-1600', count: 500, avg_kg: 1.45 },
      { label: '1700-1800', count: 300, avg_kg: 1.75 },
      { label: '1800-2100', count: 200, avg_kg: 1.95 },
    ];

    const result = computeSimulatedAvailability(
      defaultInput({ whole_bird_pulls: pulls })
    );

    // Mass balance: whole_bird_kg + remaining_griller_kg = original_griller_kg
    expect(
      result.total_whole_bird_kg + result.remaining_griller_kg
    ).toBeCloseTo(result.original_griller_kg, 1);

    // Cascade mass balance
    expect(result.cascaded.mass_balance_check).toBe(true);
  });
});
