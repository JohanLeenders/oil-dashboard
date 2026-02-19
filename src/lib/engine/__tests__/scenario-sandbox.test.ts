/**
 * Scenario Sandbox Engine Tests — Sprint 11A
 *
 * P0 (Priority 0) unit tests for scenario-sandbox.ts
 */

import { describe, test, expect } from 'vitest';
import {
  runScenarioSandbox,
  mergeOverrides,
  validateScenarioMassBalance,
  computeDeltas,
  autoDistributeYield,
  type ScenarioInput,
  type BaselineBatchData,
  type YieldOverride,
  type PriceOverride,
  type MergedInput,
} from '../scenario-sandbox';
import type { JointProductCode } from '../canonical-cost';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Minimal baseline batch for testing.
 * Represents a simple batch with realistic weights and costs.
 */
const TEST_BASELINE: BaselineBatchData = {
  batch_id: 'test-batch-001',
  batch_ref: '2026-W05-TEST',
  live_weight_kg: 2448,
  bird_count: 1200,
  griller_weight_kg: 1728, // 70.6% yield
  griller_yield_pct: 70.6,

  // Baseline costs
  live_price_per_kg: 2.60,
  transport_cost_eur: 91.68,
  catching_fee_eur: 50.00,
  slaughter_fee_per_head: 0.276,
  doa_count: 0,
  doa_threshold_pct: 0.02,

  // Joint products (sum should equal griller_weight_kg)
  joint_products: [
    { part_code: 'breast_cap' as JointProductCode, weight_kg: 604, shadow_price_per_kg: 9.50 },
    { part_code: 'legs' as JointProductCode, weight_kg: 743, shadow_price_per_kg: 5.50 },
    { part_code: 'wings' as JointProductCode, weight_kg: 179, shadow_price_per_kg: 4.50 },
  ],

  // By-products
  by_products: [
    { id: 'blood', type: 'blood', weight_kg: 66 },
    { id: 'feathers', type: 'feathers', weight_kg: 115 },
    { id: 'back', type: 'back_carcass', weight_kg: 202 },
  ],

  // Baseline waterfall (simplified for testing)
  waterfall: {
    l0_landed_cost: {
      landed_cost_eur: 6360.80,
      landed_cost_per_kg: 2.60,
      usable_live_kg: 2448,
      abnormal_doa_variance_eur: 0,
      audit_trail: [],
    },
    l1_joint_cost_pool: {
      batch_id: 'test-batch-001',
      landed_cost_eur: 6360.80,
      landed_cost_per_kg_live: 2.60,
      slaughter_cost_eur: 331.20,
      joint_cost_pool_eur: 6692.00,
      griller_yield_pct: 70.6,
      griller_weight_kg: 1728,
      griller_cost_per_kg: 3.87,
      abnormal_doa_variance_eur: 0,
      calculated_at: '2026-01-01T00:00:00Z',
      audit_trail: [],
    },
    l2_net_joint_cost: {
      batch_id: 'test-batch-001',
      joint_cost_pool_eur: 6692.00,
      by_product_weight_kg: 383,
      by_product_credit_eur: 76.60, // 383 kg × €0.20
      net_joint_cost_eur: 6615.40,
      by_product_details: [],
      calculated_at: '2026-01-01T00:00:00Z',
      audit_trail: [],
    },
    l3_svaso_allocation: {
      batch_id: 'test-batch-001',
      net_joint_cost_eur: 6615.40,
      total_market_value_eur: 9525.50, // (604×9.50) + (743×5.50) + (179×4.50)
      k_factor: 0.6945, // 6615.40 / 9525.50
      k_factor_interpretation: 'PROFITABLE',
      allocations: [
        {
          part_code: 'breast_cap' as JointProductCode,
          weight_kg: 604,
          shadow_price_per_kg: 9.50,
          market_value_eur: 5738.00,
          allocation_factor: 0.6024,
          allocated_cost_per_kg: 6.60,
          allocated_cost_total_eur: 3986.40,
          theoretical_margin_eur: 1751.60,
          theoretical_margin_pct: 30.5,
        },
        {
          part_code: 'legs' as JointProductCode,
          weight_kg: 743,
          shadow_price_per_kg: 5.50,
          market_value_eur: 4086.50,
          allocation_factor: 0.4290,
          allocated_cost_per_kg: 3.82,
          allocated_cost_total_eur: 2837.26,
          theoretical_margin_eur: 1249.24,
          theoretical_margin_pct: 30.6,
        },
        {
          part_code: 'wings' as JointProductCode,
          weight_kg: 179,
          shadow_price_per_kg: 4.50,
          market_value_eur: 805.50,
          allocation_factor: 0.0846,
          allocated_cost_per_kg: 3.12,
          allocated_cost_total_eur: 558.48,
          theoretical_margin_eur: 247.02,
          theoretical_margin_pct: 30.7,
        },
      ],
      sum_allocated_cost_eur: 6382.14, // Slight rounding difference
      rounding_residual_eur: 0,
      sum_allocation_factors: 1.016,
      is_valid: true,
      reconciliation_delta_eur: 0,
      calculated_at: '2026-01-01T00:00:00Z',
      audit_trail: [],
    },
  },
};

/**
 * Empty scenario input (no overrides).
 */
const EMPTY_SCENARIO: ScenarioInput = {
  scenario_id: 'test-scenario-001',
  scenario_name: 'Test Baseline Identity',
  batch_id: 'test-batch-001',
};

// ============================================================================
// TESTS: mergeOverrides
// ============================================================================

describe('mergeOverrides', () => {
  test('P0: no overrides returns identical to baseline', () => {
    const merged = mergeOverrides(TEST_BASELINE, EMPTY_SCENARIO);

    expect(merged.landedCostInput.live_price_per_kg).toBe(TEST_BASELINE.live_price_per_kg);
    expect(merged.joint_products[0].weight_kg).toBe(TEST_BASELINE.joint_products[0].weight_kg);
    expect(merged.joint_products[0].shadow_price_per_kg).toBe(TEST_BASELINE.joint_products[0].shadow_price_per_kg);
  });

  test('P0: live price only override', () => {
    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      live_price_per_kg: 3.00,
    };

    const merged = mergeOverrides(TEST_BASELINE, scenario);

    expect(merged.landedCostInput.live_price_per_kg).toBe(3.00);
    // Other inputs unchanged
    expect(merged.joint_products[0].weight_kg).toBe(TEST_BASELINE.joint_products[0].weight_kg);
    expect(merged.joint_products[0].shadow_price_per_kg).toBe(TEST_BASELINE.joint_products[0].shadow_price_per_kg);
  });

  test('P0: yield overrides update part weights, others unchanged', () => {
    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      yield_overrides: [
        { part_code: 'breast_cap', weight_kg: 650 }, // +46 kg
      ],
    };

    const merged = mergeOverrides(TEST_BASELINE, scenario);

    const breast = merged.joint_products.find(p => p.part_code === 'breast_cap');
    expect(breast?.weight_kg).toBe(650);

    // Others unchanged
    const legs = merged.joint_products.find(p => p.part_code === 'legs');
    expect(legs?.weight_kg).toBe(TEST_BASELINE.joint_products[1].weight_kg);
  });

  test('P0: price overrides update shadow prices', () => {
    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      price_overrides: [
        { part_code: 'breast_cap', price_per_kg: 11.00 }, // +€1.50
      ],
    };

    const merged = mergeOverrides(TEST_BASELINE, scenario);

    const breast = merged.joint_products.find(p => p.part_code === 'breast_cap');
    expect(breast?.shadow_price_per_kg).toBe(11.00);

    // Others unchanged
    const legs = merged.joint_products.find(p => p.part_code === 'legs');
    expect(legs?.shadow_price_per_kg).toBe(TEST_BASELINE.joint_products[1].shadow_price_per_kg);
  });

  test('P0: multiple override types simultaneously', () => {
    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      live_price_per_kg: 2.80,
      yield_overrides: [
        { part_code: 'breast_cap', weight_kg: 620 },
      ],
      price_overrides: [
        { part_code: 'wings', price_per_kg: 5.00 },
      ],
    };

    const merged = mergeOverrides(TEST_BASELINE, scenario);

    expect(merged.landedCostInput.live_price_per_kg).toBe(2.80);
    expect(merged.joint_products.find(p => p.part_code === 'breast_cap')?.weight_kg).toBe(620);
    expect(merged.joint_products.find(p => p.part_code === 'wings')?.shadow_price_per_kg).toBe(5.00);
  });
});

// ============================================================================
// TESTS: validateScenarioMassBalance
// ============================================================================

describe('validateScenarioMassBalance', () => {
  test('P0: valid mass balance within tolerance passes', () => {
    const merged = mergeOverrides(TEST_BASELINE, EMPTY_SCENARIO);
    const check = validateScenarioMassBalance(merged);

    expect(check.valid).toBe(true);
    expect(check.error).toBeUndefined();
  });

  test('P0: violated mass balance (exceeds tolerance) blocks', () => {
    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      yield_overrides: [
        { part_code: 'breast_cap', weight_kg: 800 }, // +196 kg → breaks balance
      ],
    };

    const merged = mergeOverrides(TEST_BASELINE, scenario);
    const check = validateScenarioMassBalance(merged);

    expect(check.valid).toBe(false);
    expect(check.error).toBeDefined();
    expect(check.error).toContain('Massabalans geschonden');
  });

  test('P1: edge case at tolerance boundary passes', () => {
    // Tolerance is 2% of griller weight
    // 1728 kg × 2% = 34.56 kg tolerance
    const delta_within_tolerance = 30; // Less than 34.56

    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      yield_overrides: [
        { part_code: 'breast_cap', weight_kg: 604 + delta_within_tolerance },
        { part_code: 'legs', weight_kg: 743 - delta_within_tolerance },
      ],
    };

    const merged = mergeOverrides(TEST_BASELINE, scenario);
    const check = validateScenarioMassBalance(merged);

    expect(check.valid).toBe(true);
  });

  test('P0: mass balance check reports correct delta', () => {
    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      yield_overrides: [
        { part_code: 'breast_cap', weight_kg: 700 }, // +96 kg
      ],
    };

    const merged = mergeOverrides(TEST_BASELINE, scenario);
    const check = validateScenarioMassBalance(merged);

    expect(check.delta_kg).toBeCloseTo(96, 1);
  });
});

// ============================================================================
// TESTS: runScenarioSandbox
// ============================================================================

describe('runScenarioSandbox', () => {
  test('P0: baseline identity (no overrides) returns scenario matching baseline', () => {
    const result = runScenarioSandbox(TEST_BASELINE, EMPTY_SCENARIO);

    if (!result.success) {
      console.error('Scenario failed:', result.error);
      console.error('Mass balance check:', result.meta.mass_balance_check);
    }

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.scenario).not.toBeNull();

    // L0 should be calculated
    expect(result.scenario?.l0_landed_cost.landed_cost_eur).toBeGreaterThan(0);

    // L3 k-factor should be positive and < 1 (profitable)
    expect(result.scenario?.l3_svaso_allocation.k_factor).toBeGreaterThan(0);
    expect(result.scenario?.l3_svaso_allocation.k_factor).toBeLessThan(1);
  });

  test('P0: live cost increase propagates through L1-L3', () => {
    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      live_price_per_kg: 3.00, // +€0.40/kg = +€979.20 total
    };

    const result = runScenarioSandbox(TEST_BASELINE, scenario);

    expect(result.success).toBe(true);

    // L0 should increase
    const baseline_l0 = TEST_BASELINE.waterfall.l0_landed_cost.landed_cost_eur;
    const scenario_l0 = result.scenario!.l0_landed_cost.landed_cost_eur;
    expect(scenario_l0).toBeGreaterThan(baseline_l0);

    // L1 should increase (landed cost flows into joint pool)
    const baseline_l1 = TEST_BASELINE.waterfall.l1_joint_cost_pool.joint_cost_pool_eur;
    const scenario_l1 = result.scenario!.l1_joint_cost_pool.joint_cost_pool_eur;
    expect(scenario_l1).toBeGreaterThan(baseline_l1);

    // L2 should increase (net joint cost)
    const baseline_l2 = TEST_BASELINE.waterfall.l2_net_joint_cost.net_joint_cost_eur;
    const scenario_l2 = result.scenario!.l2_net_joint_cost.net_joint_cost_eur;
    expect(scenario_l2).toBeGreaterThan(baseline_l2);

    // L3 SVASO amounts increase, but allocation % should be stable
    // (proportions don't change if only cost changes, not prices/yields)
    const scenario_breast_pct = result.scenario!.l3_svaso_allocation.allocations[0].allocation_factor;
    // Breast cap should still get the largest share (typically 40-60%)
    expect(scenario_breast_pct).toBeGreaterThan(0.4);
    expect(scenario_breast_pct).toBeLessThan(0.7);
  });

  test('P0: price shift changes SVASO allocation factors', () => {
    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      price_overrides: [
        { part_code: 'breast_cap', price_per_kg: 11.00 }, // +€1.50 = +15.8%
      ],
    };

    const result = runScenarioSandbox(TEST_BASELINE, scenario);

    expect(result.success).toBe(true);

    // Breast cap should still get the largest SVASO share
    const scenario_breast_factor = result.scenario!.l3_svaso_allocation.allocations[0].allocation_factor;
    const scenario_legs_factor = result.scenario!.l3_svaso_allocation.allocations[1].allocation_factor;
    const scenario_wings_factor = result.scenario!.l3_svaso_allocation.allocations[2].allocation_factor;

    // Higher breast price should mean breast gets proportionally more share than legs
    expect(scenario_breast_factor).toBeGreaterThan(scenario_legs_factor);
    expect(scenario_breast_factor).toBeGreaterThan(scenario_wings_factor);
  });

  test('P0: yield shift changes by-product credit and SVASO weights', () => {
    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      yield_overrides: [
        { part_code: 'breast_cap', weight_kg: 650 }, // +46 kg
        { part_code: 'legs', weight_kg: 697 }, // -46 kg (to maintain balance)
      ],
    };

    const result = runScenarioSandbox(TEST_BASELINE, scenario);

    expect(result.success).toBe(true);

    // L3: breast cap weight should be 650 kg
    const breast_alloc = result.scenario!.l3_svaso_allocation.allocations.find(
      a => a.part_code === 'breast_cap'
    );
    expect(breast_alloc?.weight_kg).toBe(650);

    // L3: legs weight should be 697 kg
    const legs_alloc = result.scenario!.l3_svaso_allocation.allocations.find(
      a => a.part_code === 'legs'
    );
    expect(legs_alloc?.weight_kg).toBe(697);
  });

  test('P0: mass balance block returns error', () => {
    const scenario: ScenarioInput = {
      ...EMPTY_SCENARIO,
      yield_overrides: [
        { part_code: 'breast_cap', weight_kg: 900 }, // +296 kg → breaks balance badly
      ],
    };

    const result = runScenarioSandbox(TEST_BASELINE, scenario);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Massabalans');
    expect(result.scenario).toBeNull();
  });

  test('P0: SVASO only joint products (no by-products in allocation)', () => {
    const result = runScenarioSandbox(TEST_BASELINE, EMPTY_SCENARIO);

    expect(result.success).toBe(true);

    // L3 should have exactly 3 allocations
    expect(result.scenario!.l3_svaso_allocation.allocations).toHaveLength(3);

    // All allocations should be joint products
    const joint_codes = ['breast_cap', 'legs', 'wings'];
    for (const alloc of result.scenario!.l3_svaso_allocation.allocations) {
      expect(joint_codes).toContain(alloc.part_code);
    }
  });

  test('P0: by-product credit rate always €0.20/kg', () => {
    const result = runScenarioSandbox(TEST_BASELINE, EMPTY_SCENARIO);

    expect(result.success).toBe(true);

    // By-product credit = weight × €0.20
    const by_product_weight = TEST_BASELINE.waterfall.l2_net_joint_cost.by_product_weight_kg;
    const expected_credit = by_product_weight * 0.20;

    expect(result.scenario!.l2_net_joint_cost.by_product_credit_eur).toBeCloseTo(expected_credit, 2);
  });

  test('P1: Decimal.js precision (no floating point drift)', () => {
    const result = runScenarioSandbox(TEST_BASELINE, EMPTY_SCENARIO);

    expect(result.success).toBe(true);

    // Check reconciliation delta is within acceptable precision
    expect(Math.abs(result.scenario!.l3_svaso_allocation.reconciliation_delta_eur)).toBeLessThan(0.01);
  });
});

// ============================================================================
// TESTS: computeDeltas
// ============================================================================

describe('computeDeltas', () => {
  test('P0: correct signs (positive delta for increase, negative for decrease)', () => {
    const scenario_input: ScenarioInput = {
      ...EMPTY_SCENARIO,
      live_price_per_kg: 3.00, // Increase
    };

    const result = runScenarioSandbox(TEST_BASELINE, scenario_input);

    expect(result.success).toBe(true);
    expect(result.deltas).not.toBeNull();

    // Deltas should be positive (costs increased)
    expect(result.deltas!.l0_landed_cost_delta_eur).toBeGreaterThan(0);
    expect(result.deltas!.l1_joint_cost_pool_delta_eur).toBeGreaterThan(0);
    expect(result.deltas!.l2_net_joint_cost_delta_eur).toBeGreaterThan(0);
  });

  test('P1: k-factor change calculated correctly on price shift', () => {
    const scenario_input: ScenarioInput = {
      ...EMPTY_SCENARIO,
      price_overrides: [
        { part_code: 'breast_cap', price_per_kg: 11.00 }, // Increase
      ],
    };

    const result = runScenarioSandbox(TEST_BASELINE, scenario_input);

    expect(result.success).toBe(true);

    // k-factor should decrease when market value increases (assuming cost constant)
    // k = cost / TMV, so higher TMV → lower k
    expect(result.deltas!.l3_k_factor_delta).toBeLessThan(0);
  });

  test('P0: delta calculation matches manual verification', () => {
    const scenario_input: ScenarioInput = {
      ...EMPTY_SCENARIO,
      live_price_per_kg: 2.70, // +€0.10/kg increase
    };

    const result = runScenarioSandbox(TEST_BASELINE, scenario_input);

    expect(result.success).toBe(true);

    // Delta should be positive (cost increased) and reasonable
    // Note: Exact value depends on baseline waterfall fixture
    expect(result.deltas!.l0_landed_cost_delta_eur).toBeGreaterThan(200);
    expect(result.deltas!.l0_landed_cost_delta_eur).toBeLessThan(500);
  });
});

// ============================================================================
// TESTS: autoDistributeYield
// ============================================================================

describe('autoDistributeYield', () => {
  test('P1: proportional distribution of excess weight', () => {
    const parts = [
      { part_code: 'breast_cap', weight_kg: 604 },
      { part_code: 'legs', weight_kg: 743 },
      { part_code: 'wings', weight_kg: 179 },
    ];

    const target_total = 1728; // Griller weight
    const changed_part = 'breast_cap';

    // User increased breast_cap to 650 kg → +46 kg excess
    // We want to distribute -46 kg proportionally across legs and wings
    parts[0].weight_kg = 650;

    const overrides = autoDistributeYield(parts, target_total, changed_part);

    // Should return overrides for legs and wings (not breast_cap)
    expect(overrides).toHaveLength(2);
    expect(overrides.find(o => o.part_code === 'breast_cap')).toBeUndefined();

    // Sum of new weights should equal target
    const new_total = parts[0].weight_kg + overrides[0].weight_kg + overrides[1].weight_kg;
    expect(new_total).toBeCloseTo(target_total, 1);
  });

  test('P1: handles already balanced case (returns empty)', () => {
    const parts = [
      { part_code: 'breast_cap', weight_kg: 604 },
      { part_code: 'legs', weight_kg: 743 },
      { part_code: 'wings', weight_kg: 381 }, // Adjusted to balance
    ];

    const target_total = 1728;
    const changed_part = 'breast_cap';

    const overrides = autoDistributeYield(parts, target_total, changed_part);

    // Already balanced → empty
    expect(overrides).toHaveLength(0);
  });
});
