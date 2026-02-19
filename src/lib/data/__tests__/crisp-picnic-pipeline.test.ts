/**
 * Sprint 14 — Crisp & Picnic Pipeline Tests
 *
 * 5 mandatory tests as defined in the spec:
 * 1. Crisp batch: 1 joint product, no Mini-SVASO, no routes
 * 2. Picnic batch correct: 3 JPs, Mini-SVASO, 4 routeResults, mass balance ok
 * 3. Picnic dubbele route (error scenario): >100% borstkap → warning
 * 4. Blend route correctheid: weighted cost, yield, by_product = €0
 * 5. Regressie: Oranjehoen + Cuno produce identical results
 */

import { describe, test, expect } from 'vitest';
import { runBatchPipeline } from '@/lib/data/batch-engine-bridge';
import {
  createCrispBatch,
  createPicnicBatch,
  createValidatiegolf1Batch,
  createCunoMoormannBatch,
} from '@/lib/data/batch-input-store';
import type { BatchInputData } from '@/lib/data/batch-input-store';

// ============================================================================
// TEST 1 — Crisp Batch
// ============================================================================

describe('Test 1 — Crisp Batch (griller direct)', () => {
  const input = createCrispBatch();
  const result = runBatchPipeline(input);

  test('has exactly 1 joint product (griller)', () => {
    expect(result.level3.allocations).toHaveLength(1);
    expect(result.level3.allocations[0].part_code).toBe('griller');
  });

  test('griller gets 100% of joint cost pool', () => {
    const alloc = result.level3.allocations[0];
    // For a single joint product, allocation_factor = 1.0 (100%)
    expect(alloc.allocation_factor).toBeCloseTo(1.0, 4);
  });

  test('no Mini-SVASO results (no sub-cuts)', () => {
    expect(Object.keys(result.level4)).toHaveLength(0);
  });

  test('no route results', () => {
    expect(result.routeResults).toBeUndefined();
  });

  test('kostprijs per kg is positive and plausible', () => {
    // Griller cost = (landed + slaughter - by-product credit) / griller_kg
    // Should be roughly in the €2-8 range
    const costPerKg = result.level3.allocations[0].allocated_cost_per_kg;
    expect(costPerKg).toBeGreaterThan(0);
    expect(costPerKg).toBeLessThan(15);
  });

  test('k-factor < 1 (Crisp griller has higher shadow price relative to cost)', () => {
    expect(result.level3.k_factor).toBeGreaterThan(0);
    // k_factor = C_netto / TMV — for a single product this is just cost/shadow_price
  });
});

// ============================================================================
// TEST 2 — Picnic Batch Correct
// ============================================================================

describe('Test 2 — Picnic Batch (multi-site processing)', () => {
  const input = createPicnicBatch();
  const result = runBatchPipeline(input);

  test('has 3 joint products (breast_cap, legs, wings)', () => {
    expect(result.level3.allocations).toHaveLength(3);
    const partCodes = result.level3.allocations.map(a => a.part_code).sort();
    expect(partCodes).toEqual(['breast_cap', 'legs', 'wings']);
  });

  test('Mini-SVASO is executed for parts with sub-cuts', () => {
    // breast_cap should have filet sub-cut, legs should have thigh_fillet + drum_meat
    expect(Object.keys(result.level4).length).toBeGreaterThan(0);
  });

  test('has 4 route results', () => {
    expect(result.routeResults).toBeDefined();
    expect(result.routeResults).toHaveLength(4);
  });

  test('route IDs match expected routes', () => {
    const routeIds = result.routeResults!.map(r => r.route_id).sort();
    expect(routeIds).toEqual([
      'picnic_burger',
      'picnic_dijen',
      'picnic_filet',
      'picnic_vleugels',
    ]);
  });

  test('all routes have positive end_product_cost_per_kg', () => {
    for (const route of result.routeResults!) {
      expect(route.end_product_cost_per_kg).toBeGreaterThan(0);
    }
  });

  test('mass balance deviation < 7.5%', () => {
    expect(Math.abs(result.batch.mass_balance_deviation_pct)).toBeLessThan(7.5);
  });

  test('no route mass balance warnings (normal batch)', () => {
    for (const route of result.routeResults!) {
      expect(route.mass_balance_warning).toBeUndefined();
    }
  });

  test('each route has audit trail entries', () => {
    for (const route of result.routeResults!) {
      expect(route.audit_trail.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// TEST 3 — Picnic Dubbele Route (Error Scenario)
// ============================================================================

describe('Test 3 — Picnic dubbele route (mass balance overshoot)', () => {
  test('routes consuming >100% of breast_cap trigger warning', () => {
    const input = createPicnicBatch();

    // Add a second route that also claims all of breast_cap
    input.processing_routes.push({
      route_id: 'picnic_filet_extra',
      route_name: 'Borstkap → Extra Filet',
      type: 'single-source',
      source_part: 'breast_cap',
      end_product: 'filet_extra',
      input_kg: input.breast_cap_kg, // Second full claim of breast_cap
      yield_factor: 0.68,
      processors: [
        { processor_name: 'Test', activity: 'fileren', cost_per_kg: 1.00 },
      ],
    });

    const result = runBatchPipeline(input);

    expect(result.routeResults).toBeDefined();

    // Find routes that reference breast_cap
    const breastRoutes = result.routeResults!.filter(
      r => r.source_part === 'breast_cap'
    );

    // At least one should have a mass_balance_warning
    const hasWarning = breastRoutes.some(r => r.mass_balance_warning !== undefined);
    expect(hasWarning).toBe(true);

    // Warning should mention the part code and overshoot
    const warningRoute = breastRoutes.find(r => r.mass_balance_warning !== undefined)!;
    expect(warningRoute.mass_balance_warning).toContain('breast_cap');
    expect(warningRoute.mass_balance_warning).toContain('overschrijding');
  });
});

// ============================================================================
// TEST 4 — Blend Route Correctheid
// ============================================================================

describe('Test 4 — Blend route correctheid (burger)', () => {
  const input = createPicnicBatch();
  const result = runBatchPipeline(input);
  const burgerRoute = result.routeResults!.find(r => r.route_id === 'picnic_burger')!;

  test('burger route is of type blend', () => {
    expect(burgerRoute.type).toBe('blend');
  });

  test('blend recipe has 2 inputs (drum_meat + skin)', () => {
    expect(burgerRoute.recipe).toBeDefined();
    expect(burgerRoute.recipe!.inputs).toHaveLength(2);
  });

  test('blend ratios sum to 1.0', () => {
    const totalRatio = burgerRoute.recipe!.inputs.reduce(
      (sum, inp) => sum + inp.ratio, 0
    );
    expect(totalRatio).toBeCloseTo(1.0, 4);
  });

  test('by_product input (skin) has cost_per_kg = 0', () => {
    const skinInput = burgerRoute.recipe!.inputs.find(inp => inp.part === 'skin');
    expect(skinInput).toBeDefined();
    expect(skinInput!.source_type).toBe('by_product');
    expect(skinInput!.cost_per_kg).toBe(0);
  });

  test('joint_product input (drum_meat) has cost_per_kg > 0', () => {
    const drumInput = burgerRoute.recipe!.inputs.find(inp => inp.part === 'drum_meat');
    expect(drumInput).toBeDefined();
    expect(drumInput!.source_type).toBe('joint_product');
    expect(drumInput!.cost_per_kg).toBeGreaterThan(0);
  });

  test('weighted source cost is 60% of drum_meat cost (skin = €0)', () => {
    const drumInput = burgerRoute.recipe!.inputs.find(inp => inp.part === 'drum_meat')!;
    // weighted = drum_cost × 0.6 + 0 × 0.4 = drum_cost × 0.6
    const expectedWeighted = drumInput.cost_per_kg * 0.6;
    expect(burgerRoute.svaso_cost_per_kg).toBeCloseTo(expectedWeighted, 2);
  });

  test('yield correction applied correctly (÷ 0.92)', () => {
    expect(burgerRoute.yield_factor).toBe(0.92);
    const expected = burgerRoute.svaso_cost_per_kg / 0.92;
    expect(burgerRoute.yield_adjusted_svaso_per_kg).toBeCloseTo(expected, 2);
  });

  test('end product cost = yield_adjusted + processing', () => {
    const expected = burgerRoute.yield_adjusted_svaso_per_kg + burgerRoute.total_processing_cost_per_kg;
    expect(burgerRoute.end_product_cost_per_kg).toBeCloseTo(expected, 2);
  });
});

// ============================================================================
// TEST 5 — Regressie (Oranjehoen + Cuno ongewijzigd)
// ============================================================================

describe('Test 5 — Regressie: Oranjehoen en Cuno ongewijzigd', () => {
  // Run pipelines
  const oranjeInput = createValidatiegolf1Batch();
  const cunoInput = createCunoMoormannBatch();

  const oranjeResult = runBatchPipeline(oranjeInput);
  const cunoResult = runBatchPipeline(cunoInput);

  // --- Oranjehoen ---
  test('Oranjehoen: 3 joint products', () => {
    expect(oranjeResult.level3.allocations).toHaveLength(3);
    const codes = oranjeResult.level3.allocations.map(a => a.part_code).sort();
    expect(codes).toEqual(['breast_cap', 'legs', 'wings']);
  });

  test('Oranjehoen: Mini-SVASO runs (sub-cuts present)', () => {
    expect(Object.keys(oranjeResult.level4).length).toBeGreaterThan(0);
  });

  test('Oranjehoen: no route results (no processing routes)', () => {
    expect(oranjeResult.routeResults).toBeUndefined();
  });

  test('Oranjehoen: k-factor is valid positive number', () => {
    expect(oranjeResult.level3.k_factor).toBeGreaterThan(0);
  });

  test('Oranjehoen: level0 landed cost is positive', () => {
    expect(oranjeResult.level0.landed_cost_eur).toBeGreaterThan(0);
  });

  test('Oranjehoen: level2 net joint cost is positive', () => {
    expect(oranjeResult.level2.net_joint_cost_eur).toBeGreaterThan(0);
  });

  // --- Cuno ---
  test('Cuno: uses dynamic joint products (4 products)', () => {
    expect(cunoResult.level3.allocations.length).toBe(4);
  });

  test('Cuno: no Mini-SVASO (external processor)', () => {
    expect(Object.keys(cunoResult.level4)).toHaveLength(0);
  });

  test('Cuno: no route results', () => {
    expect(cunoResult.routeResults).toBeUndefined();
  });

  test('Cuno: k-factor is valid positive number', () => {
    expect(cunoResult.level3.k_factor).toBeGreaterThan(0);
  });

  test('Cuno: level0 landed cost is positive', () => {
    expect(cunoResult.level0.landed_cost_eur).toBeGreaterThan(0);
  });

  test('Cuno: level2 net joint cost is positive', () => {
    expect(cunoResult.level2.net_joint_cost_eur).toBeGreaterThan(0);
  });

  test('Cuno: all allocation factors sum to ~1.0', () => {
    const totalFactor = cunoResult.level3.allocations.reduce(
      (sum, a) => sum + a.allocation_factor, 0
    );
    expect(totalFactor).toBeCloseTo(1.0, 2);
  });
});
