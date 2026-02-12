/**
 * Scenario Sandbox Engine — Sprint 11A
 *
 * Wraps the canonical cost engine to enable what-if scenario analysis.
 * DOES NOT MODIFY canonical-cost.ts — uses it as-is.
 *
 * Key Features:
 * - Override yields (part weights)
 * - Override live cost (€/kg)
 * - Override shadow prices (SVASO allocation keys)
 * - Full L0-L7 recomputation
 * - Mass balance guardrail (hard block if violated)
 * - Delta calculation (baseline vs scenario)
 *
 * CANON COMPLIANCE:
 * - Uses canonical engine functions unchanged
 * - Respects BY_PRODUCT_RATE_PER_KG (€0.20/kg, always)
 * - Respects JOINT_PRODUCT_CODES (breast_cap, legs, wings only)
 * - All calculations use Decimal.js
 * - Includes mandatory scenario disclaimer
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
  type LandedCostInput,
  type JointCostPoolResult,
  type NetJointCostResult,
  type SVASOAllocationResult,
  type MiniSVASOResult,
  type ABCCostResult,
  type FullSKUCostResult,
  type NRVAssessment,
  type JointProductInput,
  type ByProductPhysical,
  type SubJointCutInput,
  type ABCCostDriver,
  type SkuDefinition,
  type NRVInput,
  type JointProductCode,
  SCENARIO_DISCLAIMER,
  SCENARIO_DISCLAIMER_EN,
} from './canonical-cost';
import { DEFAULT_VALIDATION_CONFIG } from './mass-balance';

// ============================================================================
// TYPES: SCENARIO INPUTS
// ============================================================================

/**
 * Scenario override inputs.
 * All fields optional — undefined/null means "use baseline value".
 */
export interface ScenarioInput {
  scenario_id: string;
  scenario_name: string;
  description?: string;
  batch_id: string;

  /** Override live bird price (€/kg) */
  live_price_per_kg?: number;

  /** Override part yields (kg) */
  yield_overrides?: YieldOverride[];

  /** Override shadow prices (€/kg) for SVASO allocation */
  price_overrides?: PriceOverride[];
}

export interface YieldOverride {
  part_code: string;
  weight_kg: number;
}

export interface PriceOverride {
  part_code: string;
  price_per_kg: number;
}

// ============================================================================
// TYPES: BASELINE DATA
// ============================================================================

/**
 * Complete baseline batch data (actual values from production).
 * This is what we start with before applying scenario overrides.
 */
export interface BaselineBatchData {
  batch_id: string;
  batch_ref: string;

  // Physical facts
  live_weight_kg: number;
  bird_count: number;
  griller_weight_kg: number;
  griller_yield_pct: number;

  // Costs (baseline)
  live_price_per_kg: number;
  transport_cost_eur: number;
  catching_fee_eur: number;
  slaughter_fee_per_head: number;
  doa_count: number;
  doa_threshold_pct: number;

  // Parts (joint products + by-products)
  joint_products: JointProductInput[];
  by_products: ByProductPhysical[];

  // Sub-cuts (for Mini-SVASO)
  sub_cuts?: Record<string, SubJointCutInput[]>;

  // SKUs (for L6)
  skus?: SkuDefinition[];

  // NRV inputs (for L7)
  nrv_inputs?: NRVInput[];

  // Baseline waterfall (pre-computed)
  waterfall: WaterfallResult;
}

/**
 * Full cost waterfall result (L0-L7).
 */
export interface WaterfallResult {
  l0_landed_cost: ReturnType<typeof calculateLandedCost>;
  l1_joint_cost_pool: JointCostPoolResult;
  l2_net_joint_cost: NetJointCostResult;
  l3_svaso_allocation: SVASOAllocationResult;
  l4_mini_svaso?: MiniSVASOResult[];
  l5_abc_costs?: ABCCostResult[];
  l6_full_sku_costs?: FullSKUCostResult[];
  l7_nrv_assessments?: NRVAssessment[];
}

// ============================================================================
// TYPES: SCENARIO RESULTS
// ============================================================================

/**
 * Complete scenario computation result.
 */
export interface ScenarioResult {
  success: boolean;
  error: string | null;

  /** Original baseline waterfall */
  baseline: WaterfallResult | null;

  /** Recomputed scenario waterfall */
  scenario: WaterfallResult | null;

  /** Deltas between baseline and scenario */
  deltas: DeltaResult | null;

  /** Metadata */
  meta: ScenarioMetadata;
}

export interface DeltaResult {
  l0_landed_cost_delta_eur: number;
  l0_landed_cost_delta_pct: number;

  l1_joint_cost_pool_delta_eur: number;
  l1_joint_cost_pool_delta_pct: number;

  l2_by_product_credit_delta_eur: number;
  l2_net_joint_cost_delta_eur: number;
  l2_net_joint_cost_delta_pct: number;

  l3_k_factor_delta: number;
  l3_allocations: Array<{
    part_code: JointProductCode;
    baseline_allocation_pct: number;
    scenario_allocation_pct: number;
    delta_pp: number;
    baseline_cost_per_kg: number;
    scenario_cost_per_kg: number;
    delta_cost_per_kg: number;
    delta_cost_per_kg_pct: number;
  }>;
}

export interface ScenarioMetadata {
  computed_at: string;
  engine_version: string;
  disclaimer: string;
  mass_balance_check: MassBalanceCheck;
}

// ============================================================================
// TYPES: MASS BALANCE
// ============================================================================

export interface MassBalanceCheck {
  valid: boolean;
  error?: string;
  griller_kg: number;
  parts_total_kg: number;
  delta_kg: number;
  tolerance_kg: number;
}

// ============================================================================
// TYPES: MERGED INPUT
// ============================================================================

/**
 * Intermediate structure after merging overrides onto baseline.
 */
export interface MergedInput {
  batch_id: string;

  // For L0
  landedCostInput: LandedCostInput;

  // For L1
  slaughter_fee_eur: number;
  griller_weight_kg: number;

  // For L2
  by_products: ByProductPhysical[];

  // For L3
  joint_products: JointProductInput[];

  // For L4
  sub_cuts?: Record<string, SubJointCutInput[]>;

  // For L6
  skus?: SkuDefinition[];

  // For L7
  nrv_inputs?: NRVInput[];

  // For mass balance validation
  all_parts: Array<{ part_code: string; weight_kg: number }>;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

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

/**
 * Merges scenario overrides onto baseline data.
 *
 * Creates a deep copy of baseline inputs, then applies:
 * - live_price_per_kg override (if provided)
 * - yield_overrides (if provided)
 * - price_overrides (if provided)
 *
 * @param baseline - Original batch data
 * @param input - Scenario overrides
 * @returns Merged input ready for canonical engine
 */
export function mergeOverrides(
  baseline: BaselineBatchData,
  input: ScenarioInput
): MergedInput {
  // Deep clone to avoid mutation
  const merged: MergedInput = {
    batch_id: baseline.batch_id,
    landedCostInput: {
      batch_id: baseline.batch_id,
      input_live_kg: baseline.live_weight_kg,
      input_count: baseline.bird_count,
      live_price_per_kg: baseline.live_price_per_kg, // Will be overridden if input has it
      transport_cost_eur: baseline.transport_cost_eur,
      catching_fee_eur: baseline.catching_fee_eur,
      slaughter_fee_per_head: baseline.slaughter_fee_per_head,
      doa_count: baseline.doa_count,
      doa_threshold_pct: baseline.doa_threshold_pct,
    },
    slaughter_fee_eur: baseline.bird_count * baseline.slaughter_fee_per_head,
    griller_weight_kg: baseline.griller_weight_kg,
    by_products: [...baseline.by_products],
    joint_products: baseline.joint_products.map(jp => ({ ...jp })),
    sub_cuts: baseline.sub_cuts
      ? Object.fromEntries(
          Object.entries(baseline.sub_cuts).map(([key, subs]) => [
            key,
            subs.map(s => ({ ...s })),
          ])
        )
      : undefined,
    skus: baseline.skus?.map(sku => ({ ...sku })),
    nrv_inputs: baseline.nrv_inputs?.map(nrv => ({ ...nrv })),
    all_parts: [],
  };

  // Override 1: Live price
  if (input.live_price_per_kg !== undefined && input.live_price_per_kg !== null) {
    merged.landedCostInput.live_price_per_kg = input.live_price_per_kg;
  }

  // Override 2: Yields
  if (input.yield_overrides?.length) {
    for (const yo of input.yield_overrides) {
      // Check joint products
      const jp = merged.joint_products.find(p => p.part_code === yo.part_code);
      if (jp) {
        jp.weight_kg = yo.weight_kg;
        continue;
      }

      // Check by-products
      const bp = merged.by_products.find(p => p.id === yo.part_code || p.type === yo.part_code);
      if (bp) {
        bp.weight_kg = yo.weight_kg;
        continue;
      }

      // Check sub-cuts
      if (merged.sub_cuts) {
        for (const subs of Object.values(merged.sub_cuts)) {
          const sub = subs.find(s => s.sub_cut_code === yo.part_code);
          if (sub) {
            sub.weight_kg = yo.weight_kg;
            break;
          }
        }
      }
    }
  }

  // Override 3: Shadow prices
  if (input.price_overrides?.length) {
    for (const po of input.price_overrides) {
      // Check joint products
      const jp = merged.joint_products.find(p => p.part_code === po.part_code);
      if (jp) {
        jp.shadow_price_per_kg = po.price_per_kg;
        continue;
      }

      // Check sub-cuts
      if (merged.sub_cuts) {
        for (const subs of Object.values(merged.sub_cuts)) {
          const sub = subs.find(s => s.sub_cut_code === po.part_code);
          if (sub) {
            sub.shadow_price_per_kg = po.price_per_kg;
            break;
          }
        }
      }

      // Check NRV inputs (selling price override)
      if (merged.nrv_inputs) {
        const nrv = merged.nrv_inputs.find(n => n.product_code === po.part_code);
        if (nrv) {
          nrv.selling_price_per_kg = po.price_per_kg;
        }
      }
    }
  }

  // Build all_parts for mass balance validation
  // Only include parts that come FROM the griller (cut-up parts)
  // Do NOT include slaughter by-products (blood, feathers) - those were removed BEFORE griller
  // DO include back_carcass - that comes from cutting up the griller
  merged.all_parts = [
    ...merged.joint_products.map(jp => ({ part_code: jp.part_code, weight_kg: jp.weight_kg })),
    ...merged.by_products
      .filter(bp => bp.type === 'back_carcass' || bp.type === 'offal')
      .map(bp => ({ part_code: bp.id, weight_kg: bp.weight_kg })),
  ];

  return merged;
}

/**
 * Validates that scenario yields respect mass balance.
 *
 * Rule: Sum of all part weights MUST equal griller weight (within tolerance).
 *
 * @param merged - Merged input with scenario overrides applied
 * @returns MassBalanceCheck with valid=true/false and error message if invalid
 */
export function validateScenarioMassBalance(merged: MergedInput): MassBalanceCheck {
  const griller_kg = merged.griller_weight_kg;
  const parts_total_kg = merged.all_parts.reduce((sum, p) => sum + p.weight_kg, 0);
  const delta_kg = Math.abs(parts_total_kg - griller_kg);
  const tolerance_kg = griller_kg * (DEFAULT_VALIDATION_CONFIG.balance_tolerance_pct / 100);

  if (delta_kg > tolerance_kg) {
    return {
      valid: false,
      error: `Massabalans geschonden: onderdelen wegen ${parts_total_kg.toFixed(2)} kg, ` +
             `griller weegt ${griller_kg.toFixed(2)} kg ` +
             `(verschil: ${delta_kg.toFixed(2)} kg, tolerantie: ${tolerance_kg.toFixed(2)} kg)`,
      griller_kg,
      parts_total_kg,
      delta_kg,
      tolerance_kg,
    };
  }

  return {
    valid: true,
    griller_kg,
    parts_total_kg,
    delta_kg,
    tolerance_kg,
  };
}

/**
 * Computes deltas between baseline and scenario waterfalls.
 *
 * @param baseline - Original waterfall
 * @param scenario - Recomputed waterfall with overrides
 * @returns Delta values for key metrics
 */
export function computeDeltas(
  baseline: WaterfallResult,
  scenario: WaterfallResult
): DeltaResult {
  // L0 deltas
  const l0_delta_eur = scenario.l0_landed_cost.landed_cost_eur - baseline.l0_landed_cost.landed_cost_eur;
  const l0_delta_pct = baseline.l0_landed_cost.landed_cost_eur > 0
    ? (l0_delta_eur / baseline.l0_landed_cost.landed_cost_eur) * 100
    : 0;

  // L1 deltas
  const l1_delta_eur = scenario.l1_joint_cost_pool.joint_cost_pool_eur - baseline.l1_joint_cost_pool.joint_cost_pool_eur;
  const l1_delta_pct = baseline.l1_joint_cost_pool.joint_cost_pool_eur > 0
    ? (l1_delta_eur / baseline.l1_joint_cost_pool.joint_cost_pool_eur) * 100
    : 0;

  // L2 deltas
  const l2_bp_delta_eur = scenario.l2_net_joint_cost.by_product_credit_eur - baseline.l2_net_joint_cost.by_product_credit_eur;
  const l2_net_delta_eur = scenario.l2_net_joint_cost.net_joint_cost_eur - baseline.l2_net_joint_cost.net_joint_cost_eur;
  const l2_net_delta_pct = baseline.l2_net_joint_cost.net_joint_cost_eur > 0
    ? (l2_net_delta_eur / baseline.l2_net_joint_cost.net_joint_cost_eur) * 100
    : 0;

  // L3 deltas
  const l3_k_delta = scenario.l3_svaso_allocation.k_factor - baseline.l3_svaso_allocation.k_factor;

  const l3_allocations = baseline.l3_svaso_allocation.allocations.map(base_alloc => {
    const scen_alloc = scenario.l3_svaso_allocation.allocations.find(
      a => a.part_code === base_alloc.part_code
    );

    if (!scen_alloc) {
      return {
        part_code: base_alloc.part_code,
        baseline_allocation_pct: base_alloc.allocation_factor * 100,
        scenario_allocation_pct: 0,
        delta_pp: -base_alloc.allocation_factor * 100,
        baseline_cost_per_kg: base_alloc.allocated_cost_per_kg,
        scenario_cost_per_kg: 0,
        delta_cost_per_kg: -base_alloc.allocated_cost_per_kg,
        delta_cost_per_kg_pct: -100,
      };
    }

    const base_pct = base_alloc.allocation_factor * 100;
    const scen_pct = scen_alloc.allocation_factor * 100;
    const delta_pp = scen_pct - base_pct;

    const delta_cost = scen_alloc.allocated_cost_per_kg - base_alloc.allocated_cost_per_kg;
    const delta_cost_pct = base_alloc.allocated_cost_per_kg > 0
      ? (delta_cost / base_alloc.allocated_cost_per_kg) * 100
      : 0;

    return {
      part_code: base_alloc.part_code,
      baseline_allocation_pct: base_pct,
      scenario_allocation_pct: scen_pct,
      delta_pp,
      baseline_cost_per_kg: base_alloc.allocated_cost_per_kg,
      scenario_cost_per_kg: scen_alloc.allocated_cost_per_kg,
      delta_cost_per_kg: delta_cost,
      delta_cost_per_kg_pct: delta_cost_pct,
    };
  });

  return {
    l0_landed_cost_delta_eur: l0_delta_eur,
    l0_landed_cost_delta_pct: l0_delta_pct,
    l1_joint_cost_pool_delta_eur: l1_delta_eur,
    l1_joint_cost_pool_delta_pct: l1_delta_pct,
    l2_by_product_credit_delta_eur: l2_bp_delta_eur,
    l2_net_joint_cost_delta_eur: l2_net_delta_eur,
    l2_net_joint_cost_delta_pct: l2_net_delta_pct,
    l3_k_factor_delta: l3_k_delta,
    l3_allocations,
  };
}

/**
 * Auto-distributes yield difference proportionally across remaining parts.
 *
 * UX helper: When user changes one part's yield, this function calculates
 * how to adjust other parts to maintain mass balance.
 *
 * @param parts - Current part weights
 * @param target_total_kg - Target griller weight
 * @param changed_part_code - Part code that was manually changed (exclude from distribution)
 * @returns Array of YieldOverride for other parts
 */
export function autoDistributeYield(
  parts: Array<{ part_code: string; weight_kg: number }>,
  target_total_kg: number,
  changed_part_code: string
): YieldOverride[] {
  const current_total = parts.reduce((sum, p) => sum + p.weight_kg, 0);
  const difference_kg = target_total_kg - current_total;

  if (Math.abs(difference_kg) < 0.01) {
    return []; // Already balanced
  }

  // Parts to distribute difference across (exclude the changed part)
  const distribute_parts = parts.filter(p => p.part_code !== changed_part_code);

  if (distribute_parts.length === 0) {
    return []; // Can't distribute
  }

  // Total weight of parts we're distributing to
  const distribute_total_kg = distribute_parts.reduce((sum, p) => sum + p.weight_kg, 0);

  if (distribute_total_kg === 0) {
    // Equal distribution
    const per_part = difference_kg / distribute_parts.length;
    return distribute_parts.map(p => ({
      part_code: p.part_code,
      weight_kg: p.weight_kg + per_part,
    }));
  }

  // Proportional distribution
  return distribute_parts.map(p => {
    const proportion = p.weight_kg / distribute_total_kg;
    const adjustment = difference_kg * proportion;
    return {
      part_code: p.part_code,
      weight_kg: p.weight_kg + adjustment,
    };
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats a delta value with sign and color class.
 */
export function formatDelta(value: number, precision: number = 2): string {
  if (value === 0) return '±0.00';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(precision)}`;
}

/**
 * Formats a percentage delta.
 */
export function formatDeltaPct(value: number, precision: number = 1): string {
  if (value === 0) return '±0.0%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(precision)}%`;
}

/**
 * Gets color class for delta display (Tailwind).
 */
export function getDeltaColorClass(value: number): string {
  if (value === 0) return 'text-gray-500';
  return value > 0 ? 'text-green-600' : 'text-red-600';
}
