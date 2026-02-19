/**
 * Baseline Mapper Tests — Sprint 11A.4
 *
 * Tests for mapBatchToBaseline function.
 * CRITICAL: Prevents drift between batch data and sandbox baseline.
 */

import { describe, test, expect } from 'vitest';
import { mapBatchToBaseline } from '../mapBatchToBaseline';
import { runScenarioSandbox } from '@/lib/engine/scenario-sandbox';
import type { BatchDetail } from '@/lib/actions/batches';

describe('mapBatchToBaseline', () => {
  const MOCK_BATCH_DETAIL: BatchDetail = {
    batch: {
      id: 'test-batch-001',
      batch_ref: '2026-W05-TEST',
      slaughter_date: '2026-02-01',
      live_weight_kg: 2448,
      bird_count: 1200,
      avg_bird_weight_kg: 2.04,
      griller_weight_kg: 1728,
      griller_yield_pct: 70.6,
      rejection_kg: 0,
      slaughter_waste_kg: 0,
      production_date: null,
      expiry_date: null,
      status: 'cut_up',
      total_batch_cost: null,
      forecast_griller_yield_pct: 70.6,
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
    },
    yields: [
      { anatomical_part: 'breast_cap', actual_weight_kg: 604, yield_pct: 35.0, target_yield_min: 33, target_yield_max: 36, delta_from_target: 0, data_status: 'OK' },
      { anatomical_part: 'leg_quarter', actual_weight_kg: 743, yield_pct: 43.0, target_yield_min: 42, target_yield_max: 45, delta_from_target: 0, data_status: 'OK' },
      { anatomical_part: 'wings', actual_weight_kg: 179, yield_pct: 10.4, target_yield_min: 10, target_yield_max: 11, delta_from_target: 0, data_status: 'OK' },
      { anatomical_part: 'back_carcass', actual_weight_kg: 202, yield_pct: 11.7, target_yield_min: null, target_yield_max: null, delta_from_target: null, data_status: 'OK' },
    ],
    costs: [
      { cost_type: 'live_bird_purchase', description: 'Live birds', amount: 6364.80, invoice_ref: 'INV-001', cost_status: 'OK' },
      { cost_type: 'transport', description: 'Transport cost', amount: 91.68, invoice_ref: null, cost_status: 'OK' },
      { cost_type: 'catching', description: 'Catching fee', amount: 50.00, invoice_ref: null, cost_status: 'OK' },
    ],
    massBalance: null as any,
    tht: { status: 'green' as any, elapsed_pct: 50, days_remaining: 14, urgency_label: 'OK' },
    validation: { is_valid: true, data_status: 'COMPLETE', warnings: [] },
  };

  test('P0: maps batch detail to baseline data correctly', () => {
    const baseline = mapBatchToBaseline(MOCK_BATCH_DETAIL);

    expect(baseline.batch_id).toBe('test-batch-001');
    expect(baseline.batch_ref).toBe('2026-W05-TEST');
    expect(baseline.live_weight_kg).toBe(2448);
    expect(baseline.bird_count).toBe(1200);
    expect(baseline.griller_weight_kg).toBe(1728);

    // Costs should be extracted correctly
    expect(baseline.live_price_per_kg).toBeCloseTo(2.60, 2);
    expect(baseline.transport_cost_eur).toBe(91.68);
    expect(baseline.catching_fee_eur).toBe(50.00);

    // Joint products should be mapped (leg_quarter → legs for canonical engine)
    expect(baseline.joint_products).toHaveLength(3);
    expect(baseline.joint_products.find(jp => jp.part_code === 'breast_cap')?.weight_kg).toBe(604);
    expect(baseline.joint_products.find(jp => jp.part_code === 'legs')?.weight_kg).toBe(743);
    expect(baseline.joint_products.find(jp => jp.part_code === 'wings')?.weight_kg).toBe(179);

    // By-products should include back_carcass + blood + feathers
    expect(baseline.by_products.length).toBeGreaterThanOrEqual(3);
    const backCarcass = baseline.by_products.find(bp => bp.type === 'back_carcass');
    expect(backCarcass).toBeDefined();
    expect(backCarcass?.weight_kg).toBe(202);
  });

  test('P0: baseline waterfall should be computed using canonical engine', () => {
    const baseline = mapBatchToBaseline(MOCK_BATCH_DETAIL);

    // Waterfall should be pre-computed
    expect(baseline.waterfall).toBeDefined();
    expect(baseline.waterfall.l0_landed_cost).toBeDefined();
    expect(baseline.waterfall.l1_joint_cost_pool).toBeDefined();
    expect(baseline.waterfall.l2_net_joint_cost).toBeDefined();
    expect(baseline.waterfall.l3_svaso_allocation).toBeDefined();

    // L0 should match batch costs
    expect(baseline.waterfall.l0_landed_cost.landed_cost_eur).toBeGreaterThan(6000);
    expect(baseline.waterfall.l0_landed_cost.landed_cost_eur).toBeLessThan(7000);
  });

  test('P0: IDENTITY TEST — baseline == scenario when no overrides (DRIFT PREVENTION)', () => {
    const baseline = mapBatchToBaseline(MOCK_BATCH_DETAIL);

    // Run scenario with NO overrides
    const scenario_input = {
      scenario_id: 'identity-test',
      scenario_name: 'Identity Test',
      batch_id: baseline.batch_id,
      // NO overrides applied
    };

    const result = runScenarioSandbox(baseline, scenario_input);

    expect(result.success).toBe(true);
    expect(result.scenario).toBeDefined();

    // L0: Landed cost should be identical
    expect(result.scenario!.l0_landed_cost.landed_cost_eur).toBeCloseTo(
      baseline.waterfall.l0_landed_cost.landed_cost_eur,
      2
    );

    // L1: Joint cost pool should be identical
    expect(result.scenario!.l1_joint_cost_pool.joint_cost_pool_eur).toBeCloseTo(
      baseline.waterfall.l1_joint_cost_pool.joint_cost_pool_eur,
      2
    );

    // L2: Net joint cost should be identical
    expect(result.scenario!.l2_net_joint_cost.net_joint_cost_eur).toBeCloseTo(
      baseline.waterfall.l2_net_joint_cost.net_joint_cost_eur,
      2
    );

    // L3: k-factor should be identical
    expect(result.scenario!.l3_svaso_allocation.k_factor).toBeCloseTo(
      baseline.waterfall.l3_svaso_allocation.k_factor,
      4
    );

    // Deltas should all be zero
    expect(result.deltas!.l0_landed_cost_delta_eur).toBeCloseTo(0, 2);
    expect(result.deltas!.l1_joint_cost_pool_delta_eur).toBeCloseTo(0, 2);
    expect(result.deltas!.l2_net_joint_cost_delta_eur).toBeCloseTo(0, 2);
    expect(result.deltas!.l3_k_factor_delta).toBeCloseTo(0, 4);
  });

  test('P1: handles missing cost data with fallback defaults', () => {
    const batchWithMissingCosts: BatchDetail = {
      ...MOCK_BATCH_DETAIL,
      costs: [], // No cost data
    };

    const baseline = mapBatchToBaseline(batchWithMissingCosts);

    // Should use fallback defaults
    expect(baseline.live_price_per_kg).toBe(2.60);
    expect(baseline.transport_cost_eur).toBe(91.68);
    expect(baseline.catching_fee_eur).toBe(50.00);
  });
});
