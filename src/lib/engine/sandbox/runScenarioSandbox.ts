/**
 * Run Scenario Sandbox Module
 *
 * Main pipeline orchestrator for scenario analysis.
 */

import {
  calculateLandedCost,
  calculateJointCostPool,
  calculateByProductCredit,
  calculateSVASOAllocation,
  calculateMiniSVASO,
  calculateABCCosts,
  calculateFullSKUCost,
  calculateNRV,
  SCENARIO_DISCLAIMER,
  type MiniSVASOResult,
} from '../canonical-cost';
import type {
  BaselineBatchData,
  ScenarioInput,
  ScenarioResult,
  ScenarioMetadata,
  WaterfallResult,
} from './types';
import { mergeOverrides } from './mergeOverrides';
import { validateScenarioMassBalance } from './validateScenarioMassBalance';
import { computeDeltas } from './computeDeltas';

/**
 * Main scenario sandbox pipeline.
 *
 * Takes baseline batch data and scenario overrides, validates mass balance,
 * then recomputes full L0-L7 waterfall using canonical engine functions.
 *
 * @param baseline - Complete baseline batch data
 * @param input - Scenario overrides
 * @returns ScenarioResult with baseline, scenario, deltas, and metadata
 */
export function runScenarioSandbox(
  baseline: BaselineBatchData,
  input: ScenarioInput
): ScenarioResult {
  const meta: ScenarioMetadata = {
    computed_at: new Date().toISOString(),
    engine_version: 'canonical-cost-v1.0.0',
    disclaimer: SCENARIO_DISCLAIMER,
    mass_balance_check: {
      valid: false,
      griller_kg: 0,
      parts_total_kg: 0,
      delta_kg: 0,
      tolerance_kg: 0,
    },
  };

  try {
    // Step 1: Merge overrides onto baseline
    const merged = mergeOverrides(baseline, input);

    // Step 2: Validate mass balance (HARD BLOCK)
    const mbCheck = validateScenarioMassBalance(merged);
    meta.mass_balance_check = mbCheck;

    if (!mbCheck.valid) {
      return {
        success: false,
        error: mbCheck.error || 'Mass balance validation failed',
        baseline: baseline.waterfall,
        scenario: null,
        deltas: null,
        meta,
      };
    }

    // Step 3-10: Run canonical engine pipeline
    const l0 = calculateLandedCost(merged.landedCostInput);

    const l1 = calculateJointCostPool(
      merged.batch_id,
      l0,
      merged.slaughter_fee_eur,
      merged.griller_weight_kg
    );

    const l2 = calculateByProductCredit(
      merged.batch_id,
      l1,
      merged.by_products
    );

    const l3 = calculateSVASOAllocation(
      merged.batch_id,
      l2,
      merged.joint_products
    );

    // L4: Mini-SVASO (optional, if sub-cuts exist)
    const l4 = merged.sub_cuts
      ? Object.entries(merged.sub_cuts).map(([parent_code, sub_cuts]) => {
          const parent_alloc = l3.allocations.find(a => a.part_code === parent_code);
          if (!parent_alloc) return null;

          return calculateMiniSVASO(parent_alloc, sub_cuts);
        }).filter(Boolean) as MiniSVASOResult[]
      : undefined;

    // L5: ABC Costs (pass-through unchanged in v1)
    const l5 = merged.skus?.map(sku =>
      calculateABCCosts(sku.sku_code, sku.abc_drivers)
    );

    // L6: Full SKU Cost (if SKUs exist)
    const l6 = merged.skus?.map(sku => {
      // Find allocated cost per kg from L3 or L4
      const source_alloc = l3.allocations.find(a => a.part_code === sku.source_product_code);
      const meat_cost_per_kg = source_alloc?.allocated_cost_per_kg || 0;

      // Get ABC costs for this SKU
      const abc_result = calculateABCCosts(sku.sku_code, sku.abc_drivers);

      return calculateFullSKUCost(sku, meat_cost_per_kg, abc_result);
    });

    // L7: NRV Assessment (if NRV inputs exist)
    const l7 = merged.nrv_inputs?.map(nrv_input => {
      // Find cost per kg from L6 or L3
      const sku_cost = l6?.find(s => s.sku_code === nrv_input.product_code);
      const cost_per_kg = sku_cost?.cost_per_kg || 0;

      return calculateNRV(nrv_input, cost_per_kg);
    });

    const scenarioWaterfall: WaterfallResult = {
      l0_landed_cost: l0,
      l1_joint_cost_pool: l1,
      l2_net_joint_cost: l2,
      l3_svaso_allocation: l3,
      l4_mini_svaso: l4,
      l5_abc_costs: l5,
      l6_full_sku_costs: l6,
      l7_nrv_assessments: l7,
    };

    // Compute deltas
    const deltas = computeDeltas(baseline.waterfall, scenarioWaterfall);

    return {
      success: true,
      error: null,
      baseline: baseline.waterfall,
      scenario: scenarioWaterfall,
      deltas,
      meta,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      baseline: baseline.waterfall,
      scenario: null,
      deltas: null,
      meta,
    };
  }
}
