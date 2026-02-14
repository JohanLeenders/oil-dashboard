/**
 * Shared types for Scenario Sandbox Engine
 */

import type {
  JointProductInput,
  ByProductPhysical,
  SubJointCutInput,
  SkuDefinition,
  NRVInput,
  JointProductCode,
  LandedCostInput,
  MiniSVASOResult,
  ABCCostResult,
  FullSKUCostResult,
  NRVAssessment,
} from '../canonical-cost';
import type { ProcessChain } from '../chain';

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

  /** Process chain for multi-step transformations (Sprint 11B) */
  process_chain?: ProcessChain;
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
  l0_landed_cost: ReturnType<typeof import('../canonical-cost').calculateLandedCost>;
  l1_joint_cost_pool: import('../canonical-cost').JointCostPoolResult;
  l2_net_joint_cost: import('../canonical-cost').NetJointCostResult;
  l3_svaso_allocation: import('../canonical-cost').SVASOAllocationResult;
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
    part_code: JointProductCode | string;
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
