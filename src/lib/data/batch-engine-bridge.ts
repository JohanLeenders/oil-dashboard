/**
 * Batch Engine Bridge
 *
 * Converts BatchInputData → runs Canon Engine → produces CanonWaterfallData.
 * Engine is LOCKED — this file only CALLS engine functions.
 *
 * Sprint 13: Profile-aware pipeline routing.
 * External profiles skip sub-cuts (Level 4) and use profile scope for SVASO.
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
  getBatchProfile,
} from '@/lib/engine/canonical-cost';
import type { MiniSVASOResult } from '@/lib/engine/canonical-cost';
import type { CanonWaterfallData } from '@/components/oil/CostWaterfallShell';
import type { BatchInputData } from './batch-input-store';
import {
  computeDerivedValues,
  batchInputToLandedCost,
  batchInputToSlaughterFee,
  batchInputToByProducts,
  batchInputToJointProducts,
  batchInputToSubCuts,
  getDefaultABCDrivers,
  getDefaultSkuDefinition,
  getDefaultNRVInput,
} from './batch-input-store';

/**
 * Run full 7-level Canon pipeline from batch input data.
 * Returns CanonWaterfallData suitable for CostWaterfallShell.
 *
 * Profile-aware: external profiles use dynamic joint_products and skip mini-SVASO.
 */
export function runBatchPipeline(input: BatchInputData): CanonWaterfallData {
  const derived = computeDerivedValues(input);
  const profile = getBatchProfile(input.batch_profile);
  const isExternal = input.batch_profile !== 'oranjehoen' && input.joint_products.length > 0;

  // Convert batch input to engine types
  const landedCostInput = batchInputToLandedCost(input);
  const slaughterFeeEur = batchInputToSlaughterFee(input);
  const byProducts = batchInputToByProducts(input);
  const jointProducts = batchInputToJointProducts(input);
  const subCuts = isExternal ? {} : batchInputToSubCuts(input);
  const abcDrivers = getDefaultABCDrivers();
  const skuDefinition = getDefaultSkuDefinition();
  const nrvInput = getDefaultNRVInput();

  // Level 0: Landed Cost
  const level0 = calculateLandedCost(landedCostInput);

  // Level 1: Joint Cost Pool
  const level1 = calculateJointCostPool(
    input.batch_id,
    level0,
    slaughterFeeEur,
    input.griller_weight_kg,
  );

  // Level 2: By-product Credit
  const level2 = calculateByProductCredit(
    input.batch_id,
    level1,
    byProducts,
  );

  // Level 3: SVASO Allocation (profile-aware scope)
  const level3 = calculateSVASOAllocation(
    input.batch_id,
    level2,
    jointProducts,
    profile,
  );

  // Level 4: Mini-SVASO for each joint product
  // External profiles skip mini-SVASO (products are already final)
  const level4: Record<string, MiniSVASOResult> = {};
  if (!isExternal) {
    for (const alloc of level3.allocations) {
      const partSubCuts = subCuts[alloc.part_code];
      if (partSubCuts && partSubCuts.length > 0) {
        level4[alloc.part_code] = calculateMiniSVASO(alloc, partSubCuts);
      }
    }
  }

  // Level 5: ABC Costs
  const level5 = calculateABCCosts(skuDefinition.sku_code, abcDrivers);

  // Level 6: Full SKU Cost
  const filetAlloc = level4['breast_cap']?.sub_allocations?.[0];
  const meatCostPerKg = filetAlloc?.allocated_cost_per_kg ?? level3.allocations[0].allocated_cost_per_kg;
  const level6 = calculateFullSKUCost(skuDefinition, meatCostPerKg, level5);

  // Level 7: NRV Check
  const level7 = calculateNRV(nrvInput, level6.cost_per_kg);

  return {
    batch: {
      batch_id: input.batch_id,
      batch_ref: input.batch_ref,
      date: input.date,
      input_live_kg: input.live_weight_kg,
      input_count: input.bird_count,
      griller_output_kg: input.griller_weight_kg,
      griller_yield_pct: derived.griller_yield_pct,
      k_factor: level3.k_factor,
      k_factor_interpretation: level3.k_factor_interpretation,
      mass_balance_deviation_pct: derived.mass_balance_deviation_pct,
      mass_balance_status: derived.mass_balance_status,
    },
    level0,
    level1,
    level2,
    level3,
    level4,
    level5,
    level6,
    level7,
    inputs: {
      landedCostInput,
      slaughterFeeEur,
      grillerWeightKg: input.griller_weight_kg,
      byProducts,
      jointProducts,
      subCuts,
      abcDrivers,
      skuDefinition,
      nrvInput,
    },
  };
}
