/**
 * Batch Engine Bridge
 *
 * Converts BatchInputData → runs Canon Engine → produces CanonWaterfallData.
 * Engine is LOCKED — this file only CALLS engine functions.
 *
 * Sprint 13: Profile-aware pipeline routing.
 * Sprint 14: Crisp (griller direct) + Picnic (multi-site processing routes).
 *
 * Pipeline config per profiel:
 * | Profiel    | dynamicJP | miniSVASO | routes |
 * |------------|-----------|-----------|--------|
 * | Oranjehoen | false     | true      | false  |
 * | Cuno       | true      | false     | false  |
 * | Crisp      | true      | false     | false  |
 * | Picnic     | false     | true      | true   |
 */

import Decimal from 'decimal.js';
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
import type { MiniSVASOResult, AuditTrailEntry } from '@/lib/engine/canonical-cost';
import type { CanonWaterfallData, RouteResult } from '@/components/oil/CostWaterfallShell';
import type { BatchInputData, ProcessingRoute } from './batch-input-store';
import {
  computeDerivedValues,
  batchInputToLandedCost,
  batchInputToSlaughterFee,
  batchInputToByProducts,
  batchInputToJointProducts,
  batchInputToSubCuts,
  batchInputToABCDrivers,
  getDefaultSkuDefinition,
  getDefaultNRVInput,
} from './batch-input-store';

// ============================================================================
// PIPELINE CONFIGURATION
// ============================================================================

interface PipelineConfig {
  /** Uses dynamic joint_products[] array (Crisp/Cuno) vs named fields (Oranjehoen/Picnic) */
  usesDynamicJointProducts: boolean;
  /** Runs Level 4 Mini-SVASO (Oranjehoen/Picnic) */
  runMiniSVASO: boolean;
  /** Has processing routes at Level 5 (Picnic) */
  hasProcessingRoutes: boolean;
}

function getPipelineConfig(input: BatchInputData): PipelineConfig {
  const profile = input.batch_profile;

  if (profile === 'oranjehoen') {
    return { usesDynamicJointProducts: false, runMiniSVASO: true, hasProcessingRoutes: false };
  }
  if (profile === 'picnic') {
    return { usesDynamicJointProducts: false, runMiniSVASO: true, hasProcessingRoutes: true };
  }
  // Cuno, Crisp, and other external profiles
  return { usesDynamicJointProducts: true, runMiniSVASO: false, hasProcessingRoutes: false };
}

// ============================================================================
// ROUTE COST COMPUTATION (OUTSIDE ENGINE — Sprint 14)
// ============================================================================

/**
 * Look up the allocated cost per kg for a source_part.
 * First checks Mini-SVASO (Level 4) sub-allocations, then SVASO (Level 3).
 */
function getSourceCostPerKg(
  sourcePart: string,
  level3: { allocations: { part_code: string; allocated_cost_per_kg: number }[] },
  level4: Record<string, MiniSVASOResult>,
): number {
  // Check Mini-SVASO sub-allocations first
  for (const parentCode of Object.keys(level4)) {
    const miniResult = level4[parentCode];
    const subAlloc = miniResult.sub_allocations.find(sa => sa.sub_cut_code === sourcePart);
    if (subAlloc) return subAlloc.allocated_cost_per_kg;
  }

  // Fall back to SVASO Level 3 allocations
  const svasoAlloc = level3.allocations.find(a => a.part_code === sourcePart);
  if (svasoAlloc) return svasoAlloc.allocated_cost_per_kg;

  return 0;
}

/**
 * Compute route costs for all processing routes in a batch.
 * Runs OUTSIDE the engine — applies yield correction and sums processing steps.
 *
 * For single-source routes:
 *   end_cost = (source_cost / yield_factor) + Σ(step.cost_per_kg)
 *
 * For blend routes:
 *   weighted_source = Σ(ratio × source_cost)  (by_product inputs get €0)
 *   end_cost = (weighted_source / yield_factor) + Σ(step.cost_per_kg)
 */
function computeRouteCosts(
  routes: ProcessingRoute[],
  level3: { allocations: { part_code: string; allocated_cost_per_kg: number; weight_kg: number }[] },
  level4: Record<string, MiniSVASOResult>,
): RouteResult[] {
  return routes.map(route => {
    const audit_trail: AuditTrailEntry[] = [];
    const yieldFactor = route.yield_factor ?? 1.0;

    // Calculate source cost per kg
    let svaso_cost_per_kg: number;

    if (route.type === 'blend' && route.recipe) {
      // Blend: weighted average of inputs, by_product inputs get €0
      let weightedCost = new Decimal(0);
      const inputDetails: { part: string; ratio: number; source_type: string; cost_per_kg: number }[] = [];

      for (const inp of route.recipe.inputs) {
        const sourceCost = inp.source_type === 'by_product'
          ? 0 // By-products already credited at Level 2 — no double allocation
          : getSourceCostPerKg(inp.part, level3, level4);

        weightedCost = weightedCost.add(new Decimal(sourceCost).mul(inp.ratio));

        inputDetails.push({
          part: inp.part,
          ratio: inp.ratio,
          source_type: inp.source_type,
          cost_per_kg: sourceCost,
        });

        audit_trail.push({
          step: `Blend input: ${inp.part}`,
          formula: `source_cost × ratio (${inp.source_type === 'by_product' ? '€0 — al verrekend als by-product' : 'SVASO/Mini-SVASO'})`,
          inputs: { part: inp.part, ratio: inp.ratio, source_type: inp.source_type, source_cost_per_kg: sourceCost },
          output: new Decimal(sourceCost).mul(inp.ratio).toNumber(),
          source: 'Route Level 5: blend weighted cost',
        });
      }

      svaso_cost_per_kg = weightedCost.toDecimalPlaces(4).toNumber();

      audit_trail.push({
        step: 'Weighted source cost (blend)',
        formula: 'Σ(source_cost × ratio)',
        inputs: { inputs: inputDetails },
        output: svaso_cost_per_kg,
        source: 'Route Level 5',
      });
    } else {
      // Single-source
      svaso_cost_per_kg = getSourceCostPerKg(route.source_part, level3, level4);

      audit_trail.push({
        step: `Source cost: ${route.source_part}`,
        formula: 'Lookup from SVASO (Level 3) or Mini-SVASO (Level 4)',
        inputs: { source_part: route.source_part },
        output: svaso_cost_per_kg,
        source: 'Route Level 5: single-source',
      });
    }

    // Yield correction
    const yield_adjusted_svaso_per_kg = yieldFactor > 0
      ? new Decimal(svaso_cost_per_kg).div(yieldFactor).toDecimalPlaces(4).toNumber()
      : svaso_cost_per_kg;

    audit_trail.push({
      step: 'Yield-corrected source cost',
      formula: 'source_cost / yield_factor',
      inputs: { source_cost: svaso_cost_per_kg, yield_factor: yieldFactor },
      output: yield_adjusted_svaso_per_kg,
      source: 'Route Level 5: yield correction',
    });

    // Processing costs
    const processing_steps = route.processors.map(p => ({
      processor: p.processor_name,
      activity: p.activity,
      cost_per_kg: p.cost_per_kg,
    }));

    const total_processing_cost_per_kg = route.processors.reduce(
      (sum, p) => new Decimal(sum).add(p.cost_per_kg).toNumber(),
      0,
    );

    audit_trail.push({
      step: 'Total processing cost',
      formula: 'Σ(step.cost_per_kg)',
      inputs: { steps: processing_steps },
      output: total_processing_cost_per_kg,
      source: 'Route Level 5: ABC processing steps',
    });

    // End product cost
    const end_product_cost_per_kg = new Decimal(yield_adjusted_svaso_per_kg)
      .add(total_processing_cost_per_kg)
      .toDecimalPlaces(4)
      .toNumber();

    audit_trail.push({
      step: `End product cost: ${route.end_product}`,
      formula: 'yield_adjusted_svaso + total_processing_cost',
      inputs: { yield_adjusted_svaso: yield_adjusted_svaso_per_kg, processing: total_processing_cost_per_kg },
      output: end_product_cost_per_kg,
      source: 'Route Level 5→6: eindproduct kostprijs',
    });

    return {
      route_id: route.route_id,
      route_name: route.route_name,
      type: route.type,
      source_part: route.source_part,
      end_product: route.end_product,
      svaso_cost_per_kg,
      processing_steps,
      total_processing_cost_per_kg,
      yield_factor: yieldFactor,
      yield_adjusted_svaso_per_kg,
      end_product_cost_per_kg,
      input_kg: route.input_kg,
      recipe: route.type === 'blend' && route.recipe
        ? {
            inputs: route.recipe.inputs.map(inp => ({
              part: inp.part,
              ratio: inp.ratio,
              source_type: inp.source_type,
              cost_per_kg: inp.source_type === 'by_product'
                ? 0
                : getSourceCostPerKg(inp.part, level3, level4),
            })),
          }
        : undefined,
      mass_balance_warning: undefined, // Set by validateRouteMassBalance below
      audit_trail,
    };
  });
}

// ============================================================================
// ROUTE MASS BALANCE VALIDATION (Sprint 14)
// ============================================================================

/**
 * Validate that total input_kg per source_part across all routes
 * does not exceed the available kg from Level 3/4.
 *
 * Tolerance: 2% overshoot accepted. Above → warning in audit trail.
 */
function validateRouteMassBalance(
  routeResults: RouteResult[],
  level3: { allocations: { part_code: string; weight_kg: number }[] },
  level4: Record<string, MiniSVASOResult>,
): void {
  // Aggregate input_kg per source_part
  const consumedByPart: Record<string, number> = {};
  for (const r of routeResults) {
    if (r.type === 'blend' && r.recipe) {
      // For blend routes, consumption comes from each input part
      // (approximate: total input_kg distributed by ratio)
      for (const inp of r.recipe.inputs) {
        consumedByPart[inp.part] = (consumedByPart[inp.part] ?? 0) + r.input_kg * inp.ratio;
      }
    } else {
      consumedByPart[r.source_part] = (consumedByPart[r.source_part] ?? 0) + r.input_kg;
    }
  }

  // Check against available kg
  for (const [part, consumed] of Object.entries(consumedByPart)) {
    let available = 0;

    // Check Mini-SVASO sub-allocations
    for (const parentCode of Object.keys(level4)) {
      const subAlloc = level4[parentCode].sub_allocations.find(sa => sa.sub_cut_code === part);
      if (subAlloc) { available = subAlloc.weight_kg; break; }
    }

    // Fall back to SVASO Level 3
    if (available === 0) {
      const svasoAlloc = level3.allocations.find(a => a.part_code === part);
      if (svasoAlloc) available = svasoAlloc.weight_kg;
    }

    if (available > 0) {
      const overuse_pct = ((consumed - available) / available) * 100;
      if (overuse_pct > 2) {
        // Find all routes that consume this part and set warning
        for (const r of routeResults) {
          const routeUsesPart = r.source_part === part ||
            (r.recipe?.inputs.some(inp => inp.part === part));
          if (routeUsesPart) {
            r.mass_balance_warning =
              `Route massabalans warning: ${part} verbruikt ${consumed.toFixed(1)} kg ` +
              `maar slechts ${available.toFixed(1)} kg beschikbaar (${overuse_pct.toFixed(1)}% overschrijding)`;
          }
        }
      }
    }
  }
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

/**
 * Run full 7-level Canon pipeline from batch input data.
 * Returns CanonWaterfallData suitable for CostWaterfallShell.
 *
 * Profile-aware pipeline:
 * - Crisp: dynamic JP, skip Mini-SVASO, skip routes
 * - Cuno: dynamic JP, skip Mini-SVASO, skip routes
 * - Oranjehoen: named JP, run Mini-SVASO, skip routes
 * - Picnic: named JP, run Mini-SVASO, run routes
 */
export function runBatchPipeline(input: BatchInputData): CanonWaterfallData {
  const derived = computeDerivedValues(input);
  const profile = getBatchProfile(input.batch_profile);
  const config = getPipelineConfig(input);

  // Convert batch input to engine types
  const landedCostInput = batchInputToLandedCost(input);
  const slaughterFeeEur = batchInputToSlaughterFee(input);
  const byProducts = batchInputToByProducts(input);
  const jointProducts = batchInputToJointProducts(input);
  const subCuts = config.runMiniSVASO ? batchInputToSubCuts(input) : {};
  const abcDrivers = batchInputToABCDrivers(input);
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

  // Level 4: Mini-SVASO (only for profiles that have sub-cuts)
  const level4: Record<string, MiniSVASOResult> = {};
  if (config.runMiniSVASO) {
    for (const alloc of level3.allocations) {
      const partSubCuts = subCuts[alloc.part_code];
      if (partSubCuts && partSubCuts.length > 0) {
        level4[alloc.part_code] = calculateMiniSVASO(alloc, partSubCuts);
      }
    }
  }

  // Level 5: ABC Costs
  const level5 = calculateABCCosts(skuDefinition.sku_code, abcDrivers);

  // Level 5b: Processing Route Costs (Picnic only)
  let routeResults: RouteResult[] | undefined;
  if (config.hasProcessingRoutes && input.processing_routes.length > 0) {
    routeResults = computeRouteCosts(input.processing_routes, level3, level4);
    validateRouteMassBalance(routeResults, level3, level4);
  }

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
    routeResults,
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
