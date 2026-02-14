/**
 * OIL Costing Engine — Phase 1
 *
 * Implements the 7-level cost accounting model for poultry processing.
 *
 * CANON SOURCE: "CLAUDE AGENT PROMPT — OIL COSTING ENGINE (PHASE 1)"
 * Supersedes the original "Poultry Cost Accounting Formalization.docx" on all conflicting points.
 *
 * Level 0: Input & biology (live batch)
 * Level 1: Joint cost pool (C_joint = live + slaughter)
 * Level 2: By-product credit (flat €0.20/kg → C_netto_joint)
 * Level 3: SVASO over 3 joint products ONLY (breast_cap, legs, wings)
 * Level 4: Mini-SVASO (sub-joint: breast→filet, legs→thigh_fillet+drum_meat)
 * Level 5: ABC costs (additive per SKU, NEVER redistributes joint cost)
 * Level 6: Full cost per SKU
 * Level 7: NRV (read-only simulation — may NEVER mutate costing objects)
 *
 * HARD RAILS:
 * 1. SVASO scope: ONLY breast_cap, legs, wings. Hard fail on anything else.
 * 2. Determinism: Same input → same output, always.
 * 3. NRV isolation: NRV layer may never write to or influence levels 0-6.
 * 4. Rounding residual: Applied to last allocation for exact reconciliation.
 *
 * NOT FOR:
 * - Price advice or optimization
 * - Forecasting or predictions
 * - Alternative allocation methods
 */

import Decimal from 'decimal.js';

// ============================================================================
// HARD CONSTANTS (from CANON — not configurable)
// ============================================================================

/**
 * Joint product codes — the ONLY products that participate in SVASO
 * for the default ORANJEHOEN profile (hele kip → uitsnijderij).
 * Per CANON: "Back/carcass is a by-product, NOT a joint product."
 */
export const JOINT_PRODUCT_CODES = ['breast_cap', 'legs', 'wings'] as const;
export type JointProductCode = (typeof JOINT_PRODUCT_CODES)[number];

// ============================================================================
// BATCH PROFILES — Generalised joint-product scope per processor type
// ============================================================================

/**
 * BatchProfile defines which products are "joint products" for SVASO allocation.
 *
 * ORANJEHOEN (default): hele kip → breast_cap, legs, wings (3 joint products)
 * External processors (e.g. Cuno Moormann): ontvangen al gesneden delen →
 *   hun joint products zijn de GEKOCHTE producten (filet_supremes, drumsticks, etc.)
 *
 * INVARIANT: Engine wiskunde (k-factor, SVASO, reconciliatie) is IDENTIEK
 * voor elk profiel. Alleen de SCOPE van wat een "joint product" is verschilt.
 */
export interface BatchProfile {
  /** Unique profile identifier */
  profile_id: string;
  /** Display name (NL) */
  profile_name: string;
  /** Joint product codes for this profile — determines SVASO scope */
  joint_product_codes: readonly string[];
  /** Description of the processing context */
  description: string;
}

/** Default profile: Oranjehoen hele kip verwerking */
export const PROFILE_ORANJEHOEN: BatchProfile = {
  profile_id: 'oranjehoen',
  profile_name: 'Oranjehoen (hele kip)',
  joint_product_codes: JOINT_PRODUCT_CODES,
  description: 'Hele kip slacht + uitsnij: borstkap, bouten, vleugels als joint products',
};

/** External processor: Cuno Moormann (ontvangt grillers, snijdt uit) */
export const PROFILE_CUNO_MOORMANN: BatchProfile = {
  profile_id: 'cuno_moormann',
  profile_name: 'Cuno Moormann (extern)',
  joint_product_codes: ['filet_supremes', 'drumsticks', 'dijfilet_vel', 'platte_vleugels'],
  description: 'Externe verwerker: ontvangt grillers, snijdt uit tot filet suprêmes, drumsticks, dijfilet met vel, platte vleugels',
};

/** All registered profiles */
export const BATCH_PROFILES: readonly BatchProfile[] = [
  PROFILE_ORANJEHOEN,
  PROFILE_CUNO_MOORMANN,
];

/** Get profile by ID, falls back to ORANJEHOEN */
export function getBatchProfile(profileId: string): BatchProfile {
  return BATCH_PROFILES.find(p => p.profile_id === profileId) ?? PROFILE_ORANJEHOEN;
}

/**
 * By-product flat rate per kg.
 * Per CANON: "By-product credit = flat €0.20/kg for ALL by-products."
 * This is NOT variable NRV — it is a fixed recovery rate.
 */
export const BY_PRODUCT_RATE_PER_KG = 0.20;

/**
 * Scenario disclaimer (mandatory on all simulation output).
 */
export const SCENARIO_DISCLAIMER =
  'Dit is een simulatie gebaseerd op aannames. Dit is GEEN voorspelling of aanbeveling. ' +
  'De uitkomsten zijn uitsluitend ter illustratie van de onderlinge samenhang.';

export const SCENARIO_DISCLAIMER_EN =
  'This is a simulation based on assumptions. This is NOT a prediction or recommendation. ' +
  'The results are for illustration of interdependencies only.';

// ============================================================================
// CANONICAL TYPES
// ============================================================================

/**
 * Cost Object Hierarchy Levels (per new CANON)
 */
export type CostObjectLevel =
  | 'LIVE_BATCH'      // Level 0: Input & biology
  | 'JOINT_COST_POOL' // Level 1: C_joint (live + slaughter)
  | 'BY_PRODUCT_NET'  // Level 2: C_netto_joint (after by-product credit)
  | 'PRIMAL_SVASO'    // Level 3: SVASO allocation (3 joint products)
  | 'SUB_JOINT'       // Level 4: Mini-SVASO (sub-joint cuts)
  | 'ABC_COST'        // Level 5: Activity-based costs (additive)
  | 'FULL_SKU'        // Level 6: Full cost per SKU
  | 'NRV_SIMULATION'; // Level 7: NRV (read-only)

/**
 * Product classification — determines routing through cost engine.
 */
export type ProductClassification =
  | 'JOINT_PRODUCT'   // breast_cap, legs, wings — enters SVASO
  | 'BY_PRODUCT';     // back, offal, blood, feathers, etc. — gets flat rate

/**
 * Audit Trail Entry — every calculation step is traceable.
 */
export interface AuditTrailEntry {
  step: string;
  formula: string;
  inputs: Record<string, unknown>;
  output: number;
  source: string;
}

// ============================================================================
// LEVEL 0: INPUT TYPES
// ============================================================================

/**
 * Landed Cost Input (Level 0)
 * Total cost to bring the birds to the factory gate.
 */
export interface LandedCostInput {
  batch_id: string;
  /** Live weight in kg */
  input_live_kg: number;
  /** Number of birds */
  input_count: number;
  /** Market price per kg for live birds */
  live_price_per_kg: number;
  /** Transport cost total */
  transport_cost_eur: number;
  /** Catching fee total */
  catching_fee_eur: number;
  /** Slaughter fee per head */
  slaughter_fee_per_head: number;
  /** Dead on Arrival count */
  doa_count: number;
  /** DOA threshold for abnormal mortality (e.g., 0.02 = 2%) */
  doa_threshold_pct: number;
}

/**
 * By-product physical data (for by-product credit calculation at Level 2).
 * Note: NRV price is NOT used here. Credit = flat €0.20/kg.
 */
export interface ByProductPhysical {
  id: string;
  type: 'blood' | 'feathers' | 'offal' | 'back_carcass' | 'cat3_waste' | 'other';
  weight_kg: number;
}

/**
 * Joint product physical data for SVASO allocation (Level 3).
 * HARD RAIL: part_code MUST be one of the profile's joint_product_codes.
 *
 * For default ORANJEHOEN profile: part_code is JointProductCode (breast_cap/legs/wings).
 * For external profiles: part_code can be any string defined in the profile
 * (e.g. 'filet_supremes', 'drumsticks' for CUNO_MOORMANN).
 *
 * Scope enforcement happens at runtime in assertJointProduct/calculateSVASOAllocation.
 */
export interface JointProductInput {
  part_code: JointProductCode | string;
  weight_kg: number;
  /** Shadow price per kg — derived, not entered. Used for SVASO allocation. */
  shadow_price_per_kg: number;
}

/**
 * Sub-joint cut input for Mini-SVASO (Level 4).
 */
export interface SubJointCutInput {
  /** Parent joint product */
  parent_joint_code: JointProductCode;
  /** Sub-cut product code */
  sub_cut_code: string;
  /** Weight in kg */
  weight_kg: number;
  /** Shadow price per kg for sub-allocation */
  shadow_price_per_kg: number;
}

/**
 * ABC cost driver for Level 5.
 * Per CANON: "ABC is additive per SKU, NEVER affects SVASO, NEVER redistributes joint costs."
 */
export interface ABCCostDriver {
  driver_code: string;
  driver_name: string;
  /** Cost per unit of driver */
  rate_per_unit: number;
  /** Number of units consumed by this SKU */
  units_consumed: number;
}

/**
 * SKU definition for Level 6.
 */
export interface SkuDefinition {
  sku_code: string;
  /** Source sub-cut or joint product */
  source_product_code: string;
  /** Meat content in kg */
  meat_content_kg: number;
  /** Packaging cost per unit */
  packaging_cost_eur: number;
  /** ABC cost drivers */
  abc_drivers: ABCCostDriver[];
  /** Fixed weight (E-mark) or catch weight */
  weight_type: 'fixed' | 'catch';
  /** Label weight (for fixed weight only) */
  label_weight_kg?: number;
  /** Actual fill weight (for fixed weight, includes giveaway) */
  actual_fill_weight_kg?: number;
}

/**
 * NRV input for Level 7 (read-only simulation).
 * Per CANON: "NRV may NEVER mutate costing objects."
 */
export interface NRVInput {
  product_code: string;
  /** Expected selling price per kg */
  selling_price_per_kg: number;
  /** Estimated costs to complete and sell per kg */
  completion_cost_per_kg: number;
  /** Selling cost per kg */
  selling_cost_per_kg: number;
}

/**
 * Scenario Price Vector for simulation.
 */
export interface ScenarioPriceVector {
  scenario_id: string;
  scenario_name: string;
  prices: Record<string, number>;
  description?: string;
}

// ============================================================================
// OUTPUT TYPES — Level 0
// ============================================================================

export interface LandedCostResult {
  landed_cost_eur: number;
  landed_cost_per_kg: number;
  usable_live_kg: number;
  abnormal_doa_variance_eur: number;
  audit_trail: AuditTrailEntry[];
}

// ============================================================================
// OUTPUT TYPES — Level 1
// ============================================================================

/**
 * Level 1: Joint Cost Pool (C_joint)
 * C_joint = landed_cost + slaughter_cost
 * NOTE: by-product credit is NOT subtracted here (that's Level 2).
 */
export interface JointCostPoolResult {
  batch_id: string;
  landed_cost_eur: number;
  landed_cost_per_kg_live: number;
  slaughter_cost_eur: number;
  /** C_joint = landed + slaughter (BEFORE by-product credit) */
  joint_cost_pool_eur: number;
  griller_yield_pct: number;
  griller_weight_kg: number;
  /** Cost per kg of griller at this level */
  griller_cost_per_kg: number;
  abnormal_doa_variance_eur: number;
  calculated_at: string;
  audit_trail: AuditTrailEntry[];
}

// ============================================================================
// OUTPUT TYPES — Level 2
// ============================================================================

/**
 * Level 2: By-product credit applied.
 * C_netto_joint = C_joint − by_product_credit
 * This is the pool that enters SVASO.
 */
export interface NetJointCostResult {
  batch_id: string;
  /** C_joint from Level 1 */
  joint_cost_pool_eur: number;
  /** Total by-product weight */
  by_product_weight_kg: number;
  /** By-product credit = weight × €0.20/kg (flat rate) */
  by_product_credit_eur: number;
  /** C_netto_joint = C_joint − by_product_credit */
  net_joint_cost_eur: number;
  /** Breakdown per by-product */
  by_product_details: ByProductCreditDetail[];
  calculated_at: string;
  audit_trail: AuditTrailEntry[];
}

export interface ByProductCreditDetail {
  id: string;
  type: string;
  weight_kg: number;
  rate_per_kg: number;
  credit_eur: number;
}

// ============================================================================
// OUTPUT TYPES — Level 3
// ============================================================================

/**
 * Level 3: SVASO Allocation Result.
 * Allocates C_netto_joint over 3 joint products ONLY.
 */
export interface SVASOAllocationResult {
  batch_id: string;
  /** C_netto_joint being allocated (from Level 2) */
  net_joint_cost_eur: number;
  /** Total Market Value (TMV) = Σ(weight × shadow_price) for joint products only */
  total_market_value_eur: number;
  /** k-factor = net_joint_cost / TMV */
  k_factor: number;
  k_factor_interpretation: 'PROFITABLE' | 'BREAK_EVEN' | 'LOSS';
  /** Allocations per joint product (exactly 3) */
  allocations: JointProductAllocation[];
  /** Sum of allocated costs (MUST equal net_joint_cost_eur) */
  sum_allocated_cost_eur: number;
  /** Rounding residual applied to last allocation */
  rounding_residual_eur: number;
  sum_allocation_factors: number;
  is_valid: boolean;
  /** Reconciliation delta (should be 0.00 after rounding adjustment) */
  reconciliation_delta_eur: number;
  calculated_at: string;
  audit_trail: AuditTrailEntry[];
}

export interface JointProductAllocation {
  part_code: JointProductCode | string;
  weight_kg: number;
  shadow_price_per_kg: number;
  market_value_eur: number;
  allocation_factor: number;
  allocated_cost_per_kg: number;
  allocated_cost_total_eur: number;
  theoretical_margin_eur: number;
  theoretical_margin_pct: number;
}

// ============================================================================
// OUTPUT TYPES — Level 4
// ============================================================================

/**
 * Level 4: Mini-SVASO Result.
 * Sub-allocates joint product cost to derived cuts.
 */
export interface MiniSVASOResult {
  parent_joint_code: JointProductCode | string;
  parent_allocated_cost_eur: number;
  sub_allocations: SubJointAllocation[];
  sum_sub_allocated_cost_eur: number;
  rounding_residual_eur: number;
  is_valid: boolean;
  audit_trail: AuditTrailEntry[];
}

export interface SubJointAllocation {
  sub_cut_code: string;
  weight_kg: number;
  shadow_price_per_kg: number;
  market_value_eur: number;
  allocation_factor: number;
  allocated_cost_per_kg: number;
  allocated_cost_total_eur: number;
}

// ============================================================================
// OUTPUT TYPES — Level 5
// ============================================================================

/**
 * Level 5: ABC Cost Result.
 * Additive per SKU. NEVER redistributes joint cost.
 */
export interface ABCCostResult {
  sku_code: string;
  abc_drivers: ABCDriverResult[];
  total_abc_cost_eur: number;
  audit_trail: AuditTrailEntry[];
}

export interface ABCDriverResult {
  driver_code: string;
  driver_name: string;
  rate_per_unit: number;
  units_consumed: number;
  cost_eur: number;
}

// ============================================================================
// OUTPUT TYPES — Level 6
// ============================================================================

/**
 * Level 6: Full SKU Cost.
 */
export interface FullSKUCostResult {
  sku_code: string;
  /** Meat cost from SVASO/Mini-SVASO allocation */
  meat_cost_per_kg: number;
  meat_content_kg: number;
  meat_cost_eur: number;
  /** Packaging */
  packaging_cost_eur: number;
  /** ABC costs (from Level 5) */
  abc_cost_eur: number;
  /** Giveaway cost (E-mark fixed weight) */
  giveaway_cost_eur: number;
  /** Total SKU cost */
  total_sku_cost_eur: number;
  /** Cost per kg of final product */
  cost_per_kg: number;
  audit_trail: AuditTrailEntry[];
}

// ============================================================================
// OUTPUT TYPES — Level 7 (READ-ONLY)
// ============================================================================

/**
 * Level 7: NRV Assessment (read-only).
 * Per CANON: "NRV is a simulation/decision layer ONLY — may NEVER mutate costing objects."
 *
 * This is a Readonly type to enforce immutability at the type system level.
 */
export interface NRVAssessment {
  readonly product_code: string;
  readonly nrv_per_kg: number;
  readonly cost_per_kg: number;
  readonly nrv_exceeds_cost: boolean;
  readonly writedown_required: boolean;
  readonly writedown_amount_per_kg: number;
  readonly audit_trail: readonly AuditTrailEntry[];
}

// ============================================================================
// BACKWARD COMPATIBILITY TYPES
// ============================================================================

/** @deprecated Use JointProductInput instead */
export interface PrimalCutInput {
  part_code: string;
  weight_kg: number;
  std_market_price_per_kg: number;
}

/**
 * ⚠️ DEPRECATED — NOT CANON CONFORM
 *
 * @deprecated Use ByProductPhysical instead (canonical type without nrv_price_per_kg)
 *
 * CANON VIOLATION: Has nrv_price_per_kg field which allows variable pricing
 * per by-product. Canon requires flat €0.20/kg for ALL by-products.
 */
export interface ByProductInput {
  id: string;
  type: 'blood' | 'feathers' | 'offal' | 'cat3_waste' | 'other';
  weight_kg: number;
  /** @deprecated CANON VIOLATION: should use flat BY_PRODUCT_RATE_PER_KG instead */
  nrv_price_per_kg: number;
}

/** @deprecated Kept for backward compatibility. Use JointCostPoolResult. */
export interface GrillerCostResult {
  batch_id: string;
  landed_cost_eur: number;
  landed_cost_per_kg_live: number;
  slaughter_cost_eur: number;
  by_product_credit_eur: number;
  joint_cost_pool_eur: number;
  griller_yield_pct: number;
  griller_weight_kg: number;
  griller_cost_per_kg: number;
  griller_cost_total_eur: number;
  abnormal_doa_variance_eur: number;
  calculated_at: string;
  audit_trail: AuditTrailEntry[];
}

/** @deprecated Kept for backward compatibility. Use SVASOAllocationResult. */
export interface PrimalAllocationResult {
  batch_id: string;
  joint_cost_pool_eur: number;
  total_market_value_eur: number;
  k_factor: number;
  k_factor_interpretation: 'PROFITABLE' | 'BREAK_EVEN' | 'LOSS';
  allocations: PrimalAllocation[];
  sum_allocated_cost_eur: number;
  rounding_residual_eur: number;
  sum_allocation_factors: number;
  is_valid: boolean;
  reconciliation_delta_eur: number;
  calculated_at: string;
  audit_trail: AuditTrailEntry[];
}

/** @deprecated */
export interface PrimalAllocation {
  part_code: string;
  weight_kg: number;
  std_market_price_per_kg: number;
  market_value_eur: number;
  allocation_factor: number;
  allocated_cost_per_kg: number;
  allocated_cost_total_eur: number;
  theoretical_margin_eur: number;
  theoretical_margin_pct: number;
}

/** @deprecated */
export interface SecondaryProcessingResult {
  product_code: string;
  input_part_code: string;
  input_cost_per_kg: number;
  input_kg: number;
  yield_pct: number;
  by_product_credit_eur: number;
  net_input_cost_per_kg: number;
  yield_adjusted_cost_per_kg: number;
  labor_cost_per_kg: number;
  total_cost_per_kg: number;
  output_meat_kg: number;
  total_cost_eur: number;
  audit_trail: AuditTrailEntry[];
}

/** @deprecated */
export interface SecondaryProcessingInput {
  input_part_code: string;
  output_product_code: string;
  input_kg: number;
  output_meat_kg: number;
  yield_pct: number;
  by_products: ByProductInput[];
  labor_cost_per_kg: number;
}

/** @deprecated */
export interface SkuAssemblyInput {
  sku_code: string;
  meat_content_kg: number;
  meat_cost_per_kg: number;
  packaging_cost_eur: number;
  labor_cost_eur: number;
  overhead_per_kg: number;
  weight_type: 'fixed' | 'catch';
  label_weight_kg?: number;
  actual_fill_weight_kg?: number;
}

/** @deprecated */
export interface SkuCostResult {
  sku_code: string;
  meat_cost_per_kg: number;
  meat_content_kg: number;
  packaging_cost_eur: number;
  labor_cost_eur: number;
  overhead_cost_eur: number;
  giveaway_cost_eur: number;
  total_sku_cost_eur: number;
  cost_per_kg: number;
  audit_trail: AuditTrailEntry[];
}

/** @deprecated */
export interface CostWaterfall {
  batch_id: string;
  level_0_landed_cost_eur: number;
  level_1_griller_cost_eur: number;
  level_1_yield_loss_eur: number;
  level_2_primal_cost_eur: number;
  level_2_k_factor: number;
  level_3_secondary_cost_eur: number;
  level_3_processing_added_eur: number;
  level_4_sku_cost_eur: number;
  level_4_assembly_added_eur: number;
  variances: CostVariance[];
  total_explained_eur: number;
  unexplained_delta_eur: number;
  calculated_at: string;
}

/** @deprecated */
export interface CostVariance {
  type: 'DOA' | 'YIELD' | 'PRICE' | 'EFFICIENCY' | 'UNEXPLAINED';
  description: string;
  amount_eur: number;
  classification: 'NORMAL' | 'ABNORMAL';
}

/** @deprecated */
export interface ScenarioSimulationResult {
  base: PrimalAllocationResult;
  scenario: PrimalAllocationResult;
  impact: ScenarioImpact[];
  disclaimer: string;
}

/** @deprecated */
export interface ScenarioImpact {
  part_code: string;
  base_cost_per_kg: number;
  scenario_cost_per_kg: number;
  cost_change_per_kg: number;
  cost_change_pct: number;
  explanation: string;
}

// ============================================================================
// CANONICAL CONSTANTS (backward compatibility)
// ============================================================================

export const JA757_CARCASS_SHARES: Record<string, number> = {
  breast_cap: 35.85,
  leg_quarter: 43.40,
  wings: 10.70,
  back_carcass: 7.60,
  offal: 4.00,
};

export const DEFAULT_STD_PRICES: Record<string, number> = {
  breast_cap: 9.50,
  leg_quarter: 5.50,
  wings: 4.50,
  back_carcass: 0.50,
};

export const CANONICAL_YIELDS = {
  live_to_griller: 0.705,
  bonein_to_boneless: 0.625,
};

export interface LiveToMeatMultiplierResult {
  multiplier: number;
  definition: string;
  audit_trail: AuditTrailEntry;
}

// ============================================================================
// HARD RAIL: SCOPE ENFORCEMENT
// ============================================================================

/**
 * Validates that a part_code is a joint product.
 * Per CANON: "SVASO accepts ONLY breast_cap, legs, wings. Hard fail on anything else."
 *
 * With optional profile parameter, validates against that profile's joint_product_codes.
 * Without profile (or profile=undefined), uses default ORANJEHOEN scope.
 */
export function assertJointProduct(part_code: string, profile?: BatchProfile): asserts part_code is JointProductCode {
  const codes = profile ? profile.joint_product_codes : (JOINT_PRODUCT_CODES as readonly string[]);
  if (!codes.includes(part_code)) {
    const profileLabel = profile ? profile.profile_name : 'Oranjehoen (default)';
    throw new Error(
      `SCOPE VIOLATION: "${part_code}" is NOT a joint product for profile "${profileLabel}". ` +
      `SVASO accepts ONLY: ${codes.join(', ')}. ` +
      `Back/carcass and other by-products must NOT enter SVASO allocation.`
    );
  }
}

/**
 * Checks if a part_code is a joint product (non-throwing version).
 * With optional profile, checks against that profile's scope.
 */
export function isJointProduct(part_code: string, profile?: BatchProfile): part_code is JointProductCode {
  const codes = profile ? profile.joint_product_codes : (JOINT_PRODUCT_CODES as readonly string[]);
  return codes.includes(part_code);
}

// ============================================================================
// LEVEL 0: LANDED COST CALCULATION
// ============================================================================

/**
 * Calculate landed cost (Level 0)
 *
 * Landed Cost = (Live_Weight × Live_Price) + Transport + Catching
 *
 * DOA Handling:
 * - Normal mortality: absorbed by surviving birds (raises per-kg cost)
 * - Abnormal mortality: separated into variance account
 */
export function calculateLandedCost(input: LandedCostInput): LandedCostResult {
  const audit_trail: AuditTrailEntry[] = [];

  const raw_material_cost = new Decimal(input.input_live_kg).mul(input.live_price_per_kg);
  audit_trail.push({
    step: 'Raw Material Cost',
    formula: 'input_live_kg × live_price_per_kg',
    inputs: { input_live_kg: input.input_live_kg, live_price_per_kg: input.live_price_per_kg },
    output: raw_material_cost.toNumber(),
    source: 'CANON Level 0',
  });

  const total_landed = raw_material_cost
    .add(input.transport_cost_eur)
    .add(input.catching_fee_eur);
  audit_trail.push({
    step: 'Total Landed Cost',
    formula: 'raw_material + transport + catching',
    inputs: {
      raw_material: raw_material_cost.toNumber(),
      transport: input.transport_cost_eur,
      catching: input.catching_fee_eur,
    },
    output: total_landed.toNumber(),
    source: 'CANON Level 0',
  });

  const doa_pct = input.input_count > 0 ? input.doa_count / input.input_count : 0;
  const is_abnormal_doa = doa_pct > input.doa_threshold_pct;

  let usable_live_kg: Decimal;
  let abnormal_doa_variance = new Decimal(0);
  const avg_bird_weight = input.input_count > 0 ? input.input_live_kg / input.input_count : 0;

  if (is_abnormal_doa) {
    const normal_doa_count = Math.floor(input.input_count * input.doa_threshold_pct);
    const abnormal_doa_count = input.doa_count - normal_doa_count;
    const abnormal_doa_kg = abnormal_doa_count * avg_bird_weight;

    usable_live_kg = new Decimal(input.input_live_kg).sub(input.doa_count * avg_bird_weight);
    abnormal_doa_variance = new Decimal(abnormal_doa_kg).mul(input.live_price_per_kg);

    audit_trail.push({
      step: 'Abnormal DOA Variance',
      formula: 'abnormal_doa_kg × live_price_per_kg',
      inputs: { abnormal_doa_kg, live_price_per_kg: input.live_price_per_kg },
      output: abnormal_doa_variance.toNumber(),
      source: 'CANON Level 0 (Abnormal Spoilage)',
    });
  } else {
    usable_live_kg = new Decimal(input.input_live_kg).sub(input.doa_count * avg_bird_weight);
  }

  const landed_cost_per_kg = usable_live_kg.gt(0)
    ? total_landed.div(usable_live_kg)
    : new Decimal(0);

  audit_trail.push({
    step: 'Landed Cost per kg',
    formula: 'total_landed / usable_live_kg',
    inputs: { total_landed: total_landed.toNumber(), usable_live_kg: usable_live_kg.toNumber() },
    output: landed_cost_per_kg.toNumber(),
    source: 'CANON Level 0',
  });

  return {
    landed_cost_eur: total_landed.toDecimalPlaces(2).toNumber(),
    landed_cost_per_kg: landed_cost_per_kg.toDecimalPlaces(4).toNumber(),
    usable_live_kg: usable_live_kg.toDecimalPlaces(2).toNumber(),
    abnormal_doa_variance_eur: abnormal_doa_variance.toDecimalPlaces(2).toNumber(),
    audit_trail,
  };
}

// ============================================================================
// LEVEL 1: JOINT COST POOL (C_joint)
// ============================================================================

/**
 * Calculate Joint Cost Pool (Level 1)
 *
 * C_joint = landed_cost + slaughter_cost
 *
 * IMPORTANT: By-product credit is NOT subtracted here.
 * That happens at Level 2 (C_netto_joint = C_joint − by_product_credit).
 */
export function calculateJointCostPool(
  batch_id: string,
  landedCost: LandedCostResult,
  slaughter_fee_eur: number,
  griller_weight_kg: number
): JointCostPoolResult {
  const audit_trail: AuditTrailEntry[] = [...landedCost.audit_trail];

  // C_joint = landed + slaughter (NO by-product credit at this level)
  const joint_cost_pool = new Decimal(landedCost.landed_cost_eur).add(slaughter_fee_eur);

  audit_trail.push({
    step: 'Joint Cost Pool (C_joint)',
    formula: 'landed_cost + slaughter_fee (NO by-product credit)',
    inputs: {
      landed_cost: landedCost.landed_cost_eur,
      slaughter_fee: slaughter_fee_eur,
    },
    output: joint_cost_pool.toNumber(),
    source: 'CANON Level 1: C_joint = live + slaughter',
  });

  const griller_yield_pct = landedCost.usable_live_kg > 0
    ? (griller_weight_kg / landedCost.usable_live_kg) * 100
    : 0;

  audit_trail.push({
    step: 'Griller Yield',
    formula: '(griller_kg / usable_live_kg) × 100',
    inputs: { griller_kg: griller_weight_kg, usable_live_kg: landedCost.usable_live_kg },
    output: griller_yield_pct,
    source: 'CANON Level 1',
  });

  const griller_cost_per_kg = griller_weight_kg > 0
    ? joint_cost_pool.div(griller_weight_kg)
    : new Decimal(0);

  audit_trail.push({
    step: 'Griller Cost per kg (at C_joint)',
    formula: 'C_joint / griller_weight_kg',
    inputs: { joint_cost_pool: joint_cost_pool.toNumber(), griller_weight_kg },
    output: griller_cost_per_kg.toNumber(),
    source: 'CANON Level 1',
  });

  const joint_cost_pool_rounded = joint_cost_pool.toDecimalPlaces(2);

  return {
    batch_id,
    landed_cost_eur: landedCost.landed_cost_eur,
    landed_cost_per_kg_live: landedCost.landed_cost_per_kg,
    slaughter_cost_eur: slaughter_fee_eur,
    joint_cost_pool_eur: joint_cost_pool_rounded.toNumber(),
    griller_yield_pct: Number(griller_yield_pct.toFixed(2)),
    griller_weight_kg,
    griller_cost_per_kg: griller_cost_per_kg.toDecimalPlaces(4).toNumber(),
    abnormal_doa_variance_eur: landedCost.abnormal_doa_variance_eur,
    calculated_at: new Date().toISOString(),
    audit_trail,
  };
}

// ============================================================================
// LEVEL 2: BY-PRODUCT CREDIT (C_netto_joint)
// ============================================================================

/**
 * Calculate by-product credit and net joint cost (Level 2)
 *
 * C_netto_joint = C_joint − Σ(by_product_weight × €0.20)
 *
 * Per CANON: "By-product credit = flat €0.20/kg for ALL by-products."
 * This is NOT variable NRV — it is a fixed recovery rate.
 */
export function calculateByProductCredit(
  batch_id: string,
  jointCostPool: JointCostPoolResult,
  byProducts: ByProductPhysical[]
): NetJointCostResult {
  const audit_trail: AuditTrailEntry[] = [];

  const details: ByProductCreditDetail[] = [];
  let total_weight = new Decimal(0);
  let total_credit = new Decimal(0);

  for (const bp of byProducts) {
    const credit = new Decimal(bp.weight_kg).mul(BY_PRODUCT_RATE_PER_KG);
    total_weight = total_weight.add(bp.weight_kg);
    total_credit = total_credit.add(credit);

    details.push({
      id: bp.id,
      type: bp.type,
      weight_kg: bp.weight_kg,
      rate_per_kg: BY_PRODUCT_RATE_PER_KG,
      credit_eur: credit.toDecimalPlaces(2).toNumber(),
    });

    audit_trail.push({
      step: `By-Product Credit: ${bp.type} (${bp.id})`,
      formula: `weight_kg × €${BY_PRODUCT_RATE_PER_KG}/kg (flat rate)`,
      inputs: { weight_kg: bp.weight_kg, rate_per_kg: BY_PRODUCT_RATE_PER_KG },
      output: credit.toNumber(),
      source: 'CANON Level 2: flat €0.20/kg',
    });
  }

  audit_trail.push({
    step: 'Total By-Product Credit',
    formula: `Σ(weight × €${BY_PRODUCT_RATE_PER_KG})`,
    inputs: { total_weight_kg: total_weight.toNumber(), count: byProducts.length },
    output: total_credit.toNumber(),
    source: 'CANON Level 2',
  });

  const net_joint_cost = new Decimal(jointCostPool.joint_cost_pool_eur).sub(total_credit);

  audit_trail.push({
    step: 'Net Joint Cost (C_netto_joint)',
    formula: 'C_joint − by_product_credit',
    inputs: {
      joint_cost_pool: jointCostPool.joint_cost_pool_eur,
      by_product_credit: total_credit.toNumber(),
    },
    output: net_joint_cost.toNumber(),
    source: 'CANON Level 2: C_netto_joint = C_joint − opbrengst_by_products',
  });

  return {
    batch_id,
    joint_cost_pool_eur: jointCostPool.joint_cost_pool_eur,
    by_product_weight_kg: total_weight.toDecimalPlaces(2).toNumber(),
    by_product_credit_eur: total_credit.toDecimalPlaces(2).toNumber(),
    net_joint_cost_eur: net_joint_cost.toDecimalPlaces(2).toNumber(),
    by_product_details: details,
    calculated_at: new Date().toISOString(),
    audit_trail,
  };
}

// ============================================================================
// LEVEL 3: SVASO ALLOCATION (3 JOINT PRODUCTS ONLY)
// ============================================================================

/**
 * SVASO Allocation (Level 3)
 *
 * Allocates C_netto_joint over joint products defined by the profile scope.
 * Default (no profile): exactly 3 joint products: breast_cap, legs, wings.
 *
 * HARD RAIL: This function THROWS if any non-joint product is passed.
 * Per CANON: "SVASO accepts ONLY joint products per profile. Hard fail on anything else."
 *
 * k-factor = C_netto_joint / TMV
 * allocation_factor_i = MV_i / TMV
 * allocated_cost_i = allocation_factor_i × C_netto_joint
 *
 * Rounding residual applied to last allocation for exact reconciliation.
 *
 * WISKUNDE IS IDENTIEK voor elk profiel. Alleen de scope verschilt.
 */
export function calculateSVASOAllocation(
  batch_id: string,
  netJointCost: NetJointCostResult,
  jointProducts: JointProductInput[],
  profile?: BatchProfile
): SVASOAllocationResult {
  const audit_trail: AuditTrailEntry[] = [];

  // HARD RAIL: Scope enforcement (profile-aware)
  for (const jp of jointProducts) {
    assertJointProduct(jp.part_code, profile);
  }

  const cost_pool = new Decimal(netJointCost.net_joint_cost_eur);

  audit_trail.push({
    step: 'SVASO Input: C_netto_joint',
    formula: 'From Level 2',
    inputs: { net_joint_cost_eur: netJointCost.net_joint_cost_eur },
    output: cost_pool.toNumber(),
    source: 'CANON Level 3: SVASO input = C_netto_joint',
  });

  // Calculate market value per joint product
  const productsWithMV = jointProducts.map(jp => {
    const market_value = new Decimal(jp.weight_kg).mul(jp.shadow_price_per_kg);
    return { ...jp, market_value };
  });

  const total_market_value = productsWithMV.reduce(
    (sum, jp) => sum.add(jp.market_value),
    new Decimal(0)
  );

  audit_trail.push({
    step: 'Total Market Value (TMV)',
    formula: 'Σ(weight_kg × shadow_price) — joint products ONLY',
    inputs: {
      product_count: jointProducts.length,
      products: productsWithMV.map(p => ({
        part: p.part_code,
        weight: p.weight_kg,
        price: p.shadow_price_per_kg,
        mv: p.market_value.toNumber(),
      })),
    },
    output: total_market_value.toNumber(),
    source: 'CANON Level 3',
  });

  // k-factor
  const k_factor = total_market_value.gt(0)
    ? cost_pool.div(total_market_value)
    : new Decimal(0);

  const k_factor_interpretation: 'PROFITABLE' | 'BREAK_EVEN' | 'LOSS' =
    k_factor.lt(1) ? 'PROFITABLE' :
    k_factor.eq(1) ? 'BREAK_EVEN' : 'LOSS';

  audit_trail.push({
    step: 'k-factor',
    formula: 'C_netto_joint / TMV',
    inputs: {
      net_joint_cost: cost_pool.toNumber(),
      tmv: total_market_value.toNumber(),
    },
    output: k_factor.toNumber(),
    source: 'CANON Level 3: k = C_netto_joint / TMV',
  });

  // Allocate cost per joint product
  const allocations: JointProductAllocation[] = productsWithMV.map(jp => {
    const allocation_factor = total_market_value.gt(0)
      ? jp.market_value.div(total_market_value)
      : new Decimal(0);

    const allocated_cost_total = allocation_factor.mul(cost_pool);

    const allocated_cost_per_kg = jp.weight_kg > 0
      ? allocated_cost_total.div(jp.weight_kg)
      : new Decimal(0);

    const theoretical_margin = jp.market_value.sub(allocated_cost_total);
    const theoretical_margin_pct = jp.market_value.gt(0)
      ? theoretical_margin.div(jp.market_value).mul(100)
      : new Decimal(0);

    audit_trail.push({
      step: `SVASO Allocation: ${jp.part_code}`,
      formula: 'allocated_cost = allocation_factor × C_netto_joint',
      inputs: {
        weight_kg: jp.weight_kg,
        shadow_price: jp.shadow_price_per_kg,
        market_value: jp.market_value.toNumber(),
        allocation_factor: allocation_factor.toNumber(),
      },
      output: allocated_cost_total.toNumber(),
      source: 'CANON Level 3',
    });

    return {
      part_code: jp.part_code,
      weight_kg: jp.weight_kg,
      shadow_price_per_kg: jp.shadow_price_per_kg,
      market_value_eur: jp.market_value.toDecimalPlaces(2).toNumber(),
      allocation_factor: allocation_factor.toDecimalPlaces(6).toNumber(),
      allocated_cost_per_kg: allocated_cost_per_kg.toDecimalPlaces(4).toNumber(),
      allocated_cost_total_eur: allocated_cost_total.toDecimalPlaces(2).toNumber(),
      theoretical_margin_eur: theoretical_margin.toDecimalPlaces(2).toNumber(),
      theoretical_margin_pct: theoretical_margin_pct.toDecimalPlaces(2).toNumber(),
    };
  });

  // Rounding residual → applied to last allocation
  const sum_before = allocations.reduce(
    (sum, a) => sum.add(new Decimal(a.allocated_cost_total_eur)),
    new Decimal(0)
  );

  const rounding_residual = cost_pool.sub(sum_before);

  if (allocations.length > 0 && !rounding_residual.eq(0)) {
    const lastIdx = allocations.length - 1;
    const adjusted_total = new Decimal(allocations[lastIdx].allocated_cost_total_eur)
      .add(rounding_residual)
      .toDecimalPlaces(2)
      .toNumber();
    allocations[lastIdx].allocated_cost_total_eur = adjusted_total;

    if (allocations[lastIdx].weight_kg > 0) {
      allocations[lastIdx].allocated_cost_per_kg = new Decimal(adjusted_total)
        .div(allocations[lastIdx].weight_kg)
        .toDecimalPlaces(4)
        .toNumber();
    }

    audit_trail.push({
      step: 'Rounding Residual Applied',
      formula: 'residual = C_netto_joint − Σ(allocated_costs)',
      inputs: {
        cost_pool: cost_pool.toNumber(),
        sum_before: sum_before.toNumber(),
        residual: rounding_residual.toNumber(),
        applied_to: allocations[lastIdx].part_code,
      },
      output: adjusted_total,
      source: 'CANON: rounding residual for exact reconciliation',
    });
  }

  // Final validation
  const sum_allocated = allocations.reduce((s, a) => s + a.allocated_cost_total_eur, 0);
  const sum_mv = allocations.reduce((s, a) => s + a.market_value_eur, 0);
  const sum_factors = allocations.reduce((s, a) => s + a.allocation_factor, 0);
  const reconciliation_delta = Math.abs(sum_allocated - cost_pool.toNumber());

  const factors_valid = Math.abs(sum_factors - 1.0) < 0.0001;
  const costs_reconcile = reconciliation_delta < 0.01;

  return {
    batch_id,
    net_joint_cost_eur: cost_pool.toNumber(),
    total_market_value_eur: sum_mv,
    k_factor: k_factor.toDecimalPlaces(6).toNumber(),
    k_factor_interpretation,
    allocations,
    sum_allocated_cost_eur: sum_allocated,
    rounding_residual_eur: rounding_residual.toDecimalPlaces(2).toNumber(),
    sum_allocation_factors: Number(sum_factors.toFixed(6)),
    is_valid: factors_valid && costs_reconcile,
    reconciliation_delta_eur: reconciliation_delta,
    calculated_at: new Date().toISOString(),
    audit_trail,
  };
}

// ============================================================================
// LEVEL 4: MINI-SVASO (SUB-JOINT ALLOCATION)
// ============================================================================

/**
 * Mini-SVASO: Sub-joint allocation (Level 4)
 *
 * Per CANON:
 * - breast_cap → 100% filet (single output, no sub-allocation needed)
 * - legs → thigh_fillet + drum_meat (via shadow prices)
 *
 * This uses the same SVASO math but within a single joint product's cost envelope.
 * The parent's allocated_cost_total_eur is the pool to sub-allocate.
 */
export function calculateMiniSVASO(
  parentAllocation: JointProductAllocation,
  subCuts: SubJointCutInput[]
): MiniSVASOResult {
  const audit_trail: AuditTrailEntry[] = [];

  const parent_cost = new Decimal(parentAllocation.allocated_cost_total_eur);

  audit_trail.push({
    step: `Mini-SVASO Input: ${parentAllocation.part_code}`,
    formula: 'parent_allocated_cost from SVASO Level 3',
    inputs: {
      parent_joint_code: parentAllocation.part_code,
      parent_cost: parentAllocation.allocated_cost_total_eur,
    },
    output: parent_cost.toNumber(),
    source: 'CANON Level 4: Mini-SVASO',
  });

  // Calculate sub-cut market values
  const subCutsWithMV = subCuts.map(sc => {
    const market_value = new Decimal(sc.weight_kg).mul(sc.shadow_price_per_kg);
    return { ...sc, market_value };
  });

  const total_sub_mv = subCutsWithMV.reduce(
    (sum, sc) => sum.add(sc.market_value),
    new Decimal(0)
  );

  // Sub-allocate
  const sub_allocations: SubJointAllocation[] = subCutsWithMV.map(sc => {
    const factor = total_sub_mv.gt(0)
      ? sc.market_value.div(total_sub_mv)
      : new Decimal(0);

    const allocated_total = factor.mul(parent_cost);
    const allocated_per_kg = sc.weight_kg > 0
      ? allocated_total.div(sc.weight_kg)
      : new Decimal(0);

    audit_trail.push({
      step: `Mini-SVASO: ${sc.sub_cut_code}`,
      formula: 'sub_allocated_cost = factor × parent_cost',
      inputs: {
        sub_cut_code: sc.sub_cut_code,
        weight_kg: sc.weight_kg,
        shadow_price: sc.shadow_price_per_kg,
        market_value: sc.market_value.toNumber(),
        factor: factor.toNumber(),
      },
      output: allocated_total.toNumber(),
      source: 'CANON Level 4',
    });

    return {
      sub_cut_code: sc.sub_cut_code,
      weight_kg: sc.weight_kg,
      shadow_price_per_kg: sc.shadow_price_per_kg,
      market_value_eur: sc.market_value.toDecimalPlaces(2).toNumber(),
      allocation_factor: factor.toDecimalPlaces(6).toNumber(),
      allocated_cost_per_kg: allocated_per_kg.toDecimalPlaces(4).toNumber(),
      allocated_cost_total_eur: allocated_total.toDecimalPlaces(2).toNumber(),
    };
  });

  // Rounding residual
  const sum_before = sub_allocations.reduce(
    (sum, a) => sum.add(new Decimal(a.allocated_cost_total_eur)),
    new Decimal(0)
  );
  const residual = parent_cost.sub(sum_before);

  if (sub_allocations.length > 0 && !residual.eq(0)) {
    const lastIdx = sub_allocations.length - 1;
    const adjusted = new Decimal(sub_allocations[lastIdx].allocated_cost_total_eur)
      .add(residual)
      .toDecimalPlaces(2)
      .toNumber();
    sub_allocations[lastIdx].allocated_cost_total_eur = adjusted;

    if (sub_allocations[lastIdx].weight_kg > 0) {
      sub_allocations[lastIdx].allocated_cost_per_kg = new Decimal(adjusted)
        .div(sub_allocations[lastIdx].weight_kg)
        .toDecimalPlaces(4)
        .toNumber();
    }

    audit_trail.push({
      step: 'Mini-SVASO Rounding Residual',
      formula: 'residual = parent_cost − Σ(sub_allocated)',
      inputs: {
        parent_cost: parent_cost.toNumber(),
        sum_before: sum_before.toNumber(),
        residual: residual.toNumber(),
      },
      output: adjusted,
      source: 'CANON Level 4: rounding residual',
    });
  }

  const sum_sub = sub_allocations.reduce((s, a) => s + a.allocated_cost_total_eur, 0);
  const reconciliation_ok = Math.abs(sum_sub - parent_cost.toNumber()) < 0.01;

  return {
    parent_joint_code: parentAllocation.part_code,
    parent_allocated_cost_eur: parentAllocation.allocated_cost_total_eur,
    sub_allocations,
    sum_sub_allocated_cost_eur: sum_sub,
    rounding_residual_eur: residual.toDecimalPlaces(2).toNumber(),
    is_valid: reconciliation_ok,
    audit_trail,
  };
}

// ============================================================================
// LEVEL 5: ABC COSTS (ADDITIVE)
// ============================================================================

/**
 * Calculate ABC costs for a SKU (Level 5)
 *
 * Per CANON: "ABC is additive per SKU, NEVER affects SVASO, NEVER redistributes joint costs."
 */
export function calculateABCCosts(
  sku_code: string,
  drivers: ABCCostDriver[]
): ABCCostResult {
  const audit_trail: AuditTrailEntry[] = [];
  const driver_results: ABCDriverResult[] = [];
  let total = new Decimal(0);

  for (const d of drivers) {
    const cost = new Decimal(d.rate_per_unit).mul(d.units_consumed);
    total = total.add(cost);

    driver_results.push({
      driver_code: d.driver_code,
      driver_name: d.driver_name,
      rate_per_unit: d.rate_per_unit,
      units_consumed: d.units_consumed,
      cost_eur: cost.toDecimalPlaces(2).toNumber(),
    });

    audit_trail.push({
      step: `ABC: ${d.driver_name}`,
      formula: 'rate × units_consumed',
      inputs: { rate: d.rate_per_unit, units: d.units_consumed },
      output: cost.toNumber(),
      source: 'CANON Level 5: ABC additive',
    });
  }

  return {
    sku_code,
    abc_drivers: driver_results,
    total_abc_cost_eur: total.toDecimalPlaces(2).toNumber(),
    audit_trail,
  };
}

// ============================================================================
// LEVEL 6: FULL SKU COST
// ============================================================================

/**
 * Calculate full SKU cost (Level 6)
 *
 * SKU_Cost = meat_cost + packaging + ABC + giveaway
 */
export function calculateFullSKUCost(
  sku: SkuDefinition,
  meat_cost_per_kg: number,
  abcResult: ABCCostResult
): FullSKUCostResult {
  const audit_trail: AuditTrailEntry[] = [];

  const meat_cost = new Decimal(sku.meat_content_kg).mul(meat_cost_per_kg);
  audit_trail.push({
    step: 'Meat Cost',
    formula: 'meat_content_kg × meat_cost_per_kg',
    inputs: { meat_content_kg: sku.meat_content_kg, meat_cost_per_kg },
    output: meat_cost.toNumber(),
    source: 'CANON Level 6',
  });

  // Giveaway for E-mark
  let giveaway_cost = new Decimal(0);
  if (sku.weight_type === 'fixed' && sku.label_weight_kg && sku.actual_fill_weight_kg) {
    const giveaway_kg = sku.actual_fill_weight_kg - sku.label_weight_kg;
    if (giveaway_kg > 0) {
      giveaway_cost = new Decimal(giveaway_kg).mul(meat_cost_per_kg);
      audit_trail.push({
        step: 'Giveaway Cost (E-mark)',
        formula: '(actual_fill − label_weight) × meat_cost_per_kg',
        inputs: {
          actual_fill: sku.actual_fill_weight_kg,
          label_weight: sku.label_weight_kg,
          giveaway_kg,
        },
        output: giveaway_cost.toNumber(),
        source: 'CANON Level 6 (E-mark)',
      });
    }
  }

  const total = meat_cost
    .add(sku.packaging_cost_eur)
    .add(abcResult.total_abc_cost_eur)
    .add(giveaway_cost);

  audit_trail.push({
    step: 'Total SKU Cost',
    formula: 'meat + packaging + ABC + giveaway',
    inputs: {
      meat: meat_cost.toNumber(),
      packaging: sku.packaging_cost_eur,
      abc: abcResult.total_abc_cost_eur,
      giveaway: giveaway_cost.toNumber(),
    },
    output: total.toNumber(),
    source: 'CANON Level 6',
  });

  const final_weight = sku.weight_type === 'fixed' && sku.actual_fill_weight_kg
    ? sku.actual_fill_weight_kg
    : sku.meat_content_kg;
  const cost_per_kg = final_weight > 0
    ? total.div(final_weight)
    : new Decimal(0);

  return {
    sku_code: sku.sku_code,
    meat_cost_per_kg,
    meat_content_kg: sku.meat_content_kg,
    meat_cost_eur: meat_cost.toDecimalPlaces(2).toNumber(),
    packaging_cost_eur: sku.packaging_cost_eur,
    abc_cost_eur: abcResult.total_abc_cost_eur,
    giveaway_cost_eur: giveaway_cost.toDecimalPlaces(2).toNumber(),
    total_sku_cost_eur: total.toDecimalPlaces(2).toNumber(),
    cost_per_kg: cost_per_kg.toDecimalPlaces(4).toNumber(),
    audit_trail,
  };
}

// ============================================================================
// LEVEL 7: NRV (READ-ONLY SIMULATION)
// ============================================================================

/**
 * Calculate NRV assessment (Level 7 — READ-ONLY)
 *
 * Per CANON: "NRV is a simulation/decision layer ONLY — may NEVER mutate costing objects."
 *
 * NRV = selling_price − completion_cost − selling_cost
 *
 * Returns a frozen (readonly) object. The return type is Readonly<NRVAssessment>.
 */
export function calculateNRV(
  input: NRVInput,
  cost_per_kg: number
): Readonly<NRVAssessment> {
  const audit_trail: AuditTrailEntry[] = [];

  const nrv = new Decimal(input.selling_price_per_kg)
    .sub(input.completion_cost_per_kg)
    .sub(input.selling_cost_per_kg);

  audit_trail.push({
    step: 'NRV Calculation',
    formula: 'selling_price − completion_cost − selling_cost',
    inputs: {
      selling_price: input.selling_price_per_kg,
      completion_cost: input.completion_cost_per_kg,
      selling_cost: input.selling_cost_per_kg,
    },
    output: nrv.toNumber(),
    source: 'CANON Level 7: NRV (READ-ONLY)',
  });

  const nrv_per_kg = nrv.toDecimalPlaces(4).toNumber();
  const nrv_exceeds_cost = nrv_per_kg >= cost_per_kg;
  const writedown_required = !nrv_exceeds_cost;
  const writedown_amount = writedown_required
    ? Number((cost_per_kg - nrv_per_kg).toFixed(4))
    : 0;

  audit_trail.push({
    step: 'NRV Assessment',
    formula: 'writedown = cost − NRV (if NRV < cost)',
    inputs: { nrv_per_kg, cost_per_kg },
    output: writedown_amount,
    source: 'CANON Level 7: READ-ONLY — does NOT mutate costing',
  });

  // Return frozen object — enforces read-only at runtime
  return Object.freeze({
    product_code: input.product_code,
    nrv_per_kg,
    cost_per_kg,
    nrv_exceeds_cost,
    writedown_required,
    writedown_amount_per_kg: writedown_amount,
    audit_trail: Object.freeze([...audit_trail]),
  });
}

// ============================================================================
// BACKWARD COMPATIBILITY LAYER
// ============================================================================

/**
 * ⚠️ DEPRECATED — NOT CANON CONFORM — DO NOT USE
 *
 * @deprecated Use calculateJointCostPool + calculateByProductCredit instead.
 *
 * This function violates canon by using VARIABLE NRV per by-product instead of
 * the canonical flat €0.20/kg rate. It exists only for backward compatibility
 * with the cost-waterfall demo page.
 *
 * CANON VIOLATION: Uses bp.nrv_price_per_kg (variable) instead of BY_PRODUCT_RATE_PER_KG (flat €0.20).
 *
 * For canon-compliant calculations, use:
 * 1. calculateJointCostPool() → Level 1
 * 2. calculateByProductCredit() → Level 2 (flat €0.20/kg)
 *
 * Legacy adapter: wraps the new 2-level calculation into the old GrillerCostResult shape.
 * Uses the old variable NRV approach for backward compatibility with existing tests.
 */
export function calculateGrillerCost(
  batch_id: string,
  landedCost: {
    landed_cost_eur: number;
    usable_live_kg: number;
    abnormal_doa_variance_eur: number;
    audit_trail: AuditTrailEntry[];
  },
  slaughter_fee_eur: number,
  griller_weight_kg: number,
  byProducts: ByProductInput[]
): GrillerCostResult {
  const audit_trail: AuditTrailEntry[] = [...landedCost.audit_trail];

  // Legacy: variable NRV per by-product (NOT the new flat rate)
  let by_product_credit = new Decimal(0);
  for (const bp of byProducts) {
    const bp_value = new Decimal(bp.weight_kg).mul(bp.nrv_price_per_kg);
    by_product_credit = by_product_credit.add(bp_value);
    audit_trail.push({
      step: `By-Product Credit: ${bp.type}`,
      formula: 'weight_kg × nrv_price_per_kg',
      inputs: { weight_kg: bp.weight_kg, nrv_price_per_kg: bp.nrv_price_per_kg },
      output: bp_value.toNumber(),
      source: 'Legacy: variable NRV (deprecated)',
    });
  }

  const joint_cost_pool = new Decimal(landedCost.landed_cost_eur)
    .add(slaughter_fee_eur)
    .sub(by_product_credit);

  audit_trail.push({
    step: 'Joint Cost Pool (Legacy)',
    formula: 'landed + slaughter − by_product_credit',
    inputs: {
      landed_cost: landedCost.landed_cost_eur,
      slaughter_fee: slaughter_fee_eur,
      by_product_credit: by_product_credit.toNumber(),
    },
    output: joint_cost_pool.toNumber(),
    source: 'Legacy: combined Level 1+2',
  });

  const griller_yield_pct = landedCost.usable_live_kg > 0
    ? (griller_weight_kg / landedCost.usable_live_kg) * 100
    : 0;

  const griller_cost_per_kg = griller_weight_kg > 0
    ? joint_cost_pool.div(griller_weight_kg)
    : new Decimal(0);

  const joint_cost_pool_rounded = joint_cost_pool.toDecimalPlaces(2);
  const landed_cost_per_kg_live = landedCost.usable_live_kg > 0
    ? landedCost.landed_cost_eur / landedCost.usable_live_kg
    : 0;

  return {
    batch_id,
    landed_cost_eur: landedCost.landed_cost_eur,
    landed_cost_per_kg_live,
    slaughter_cost_eur: slaughter_fee_eur,
    by_product_credit_eur: by_product_credit.toDecimalPlaces(2).toNumber(),
    joint_cost_pool_eur: joint_cost_pool_rounded.toNumber(),
    griller_yield_pct: Number(griller_yield_pct.toFixed(2)),
    griller_weight_kg,
    griller_cost_per_kg: griller_cost_per_kg.toDecimalPlaces(4).toNumber(),
    griller_cost_total_eur: joint_cost_pool_rounded.toNumber(),
    abnormal_doa_variance_eur: landedCost.abnormal_doa_variance_eur,
    calculated_at: new Date().toISOString(),
    audit_trail,
  };
}

/**
 * ⚠️ DEPRECATED — NOT CANON CONFORM — DO NOT USE
 *
 * @deprecated Use calculateSVASOAllocation instead.
 *
 * This function violates canon by allowing ANY part_code (including back_carcass)
 * to be treated as a joint product. The canon requires EXACTLY 3 joint products:
 * breast_cap, legs, wings.
 *
 * CANON VIOLATION: Does NOT enforce JOINT_PRODUCT_CODES. Allows back_carcass
 * to enter SVASO allocation, which is forbidden by canon.
 *
 * For canon-compliant calculations, use:
 * - calculateSVASOAllocation() → Level 3 (enforces 3 joint products only)
 *
 * Legacy adapter: accepts any part_code (including back_carcass) for backward compat.
 */
export function calculatePrimalAllocation(
  batch_id: string,
  grillerCost: GrillerCostResult,
  primalCuts: PrimalCutInput[]
): PrimalAllocationResult {
  const audit_trail: AuditTrailEntry[] = [];
  const joint_cost_pool = new Decimal(grillerCost.joint_cost_pool_eur);

  const cutsWithValue = primalCuts.map(cut => {
    const market_value = new Decimal(cut.weight_kg).mul(cut.std_market_price_per_kg);
    return { ...cut, market_value };
  });

  const total_market_value_exact = cutsWithValue.reduce(
    (sum, cut) => sum.add(cut.market_value),
    new Decimal(0)
  );

  const k_factor = total_market_value_exact.gt(0)
    ? joint_cost_pool.div(total_market_value_exact)
    : new Decimal(0);

  const k_factor_interpretation: 'PROFITABLE' | 'BREAK_EVEN' | 'LOSS' =
    k_factor.lt(1) ? 'PROFITABLE' :
    k_factor.eq(1) ? 'BREAK_EVEN' : 'LOSS';

  const allocations: PrimalAllocation[] = cutsWithValue.map(cut => {
    const allocation_factor_exact = total_market_value_exact.gt(0)
      ? cut.market_value.div(total_market_value_exact)
      : new Decimal(0);

    const allocated_cost_total_exact = allocation_factor_exact.mul(joint_cost_pool);
    const allocated_cost_per_kg = cut.weight_kg > 0
      ? allocated_cost_total_exact.div(cut.weight_kg)
      : new Decimal(0);

    const theoretical_margin = cut.market_value.sub(allocated_cost_total_exact);
    const theoretical_margin_pct = cut.market_value.gt(0)
      ? theoretical_margin.div(cut.market_value).mul(100)
      : new Decimal(0);

    return {
      part_code: cut.part_code,
      weight_kg: cut.weight_kg,
      std_market_price_per_kg: cut.std_market_price_per_kg,
      market_value_eur: cut.market_value.toDecimalPlaces(2).toNumber(),
      allocation_factor: allocation_factor_exact.toDecimalPlaces(6).toNumber(),
      allocated_cost_per_kg: allocated_cost_per_kg.toDecimalPlaces(4).toNumber(),
      allocated_cost_total_eur: allocated_cost_total_exact.toDecimalPlaces(2).toNumber(),
      theoretical_margin_eur: theoretical_margin.toDecimalPlaces(2).toNumber(),
      theoretical_margin_pct: theoretical_margin_pct.toDecimalPlaces(2).toNumber(),
    };
  });

  // Rounding residual
  const sum_before_adjustment = allocations.reduce(
    (sum, a) => sum.add(new Decimal(a.allocated_cost_total_eur)),
    new Decimal(0)
  );
  const rounding_residual = joint_cost_pool.sub(sum_before_adjustment);

  if (allocations.length > 0 && !rounding_residual.eq(0)) {
    const lastIdx = allocations.length - 1;
    const adjusted_total = new Decimal(allocations[lastIdx].allocated_cost_total_eur)
      .add(rounding_residual)
      .toDecimalPlaces(2)
      .toNumber();
    allocations[lastIdx].allocated_cost_total_eur = adjusted_total;
    if (allocations[lastIdx].weight_kg > 0) {
      allocations[lastIdx].allocated_cost_per_kg = new Decimal(adjusted_total)
        .div(allocations[lastIdx].weight_kg)
        .toDecimalPlaces(4)
        .toNumber();
    }
  }

  const sum_allocated_cost = allocations.reduce((s, a) => s + a.allocated_cost_total_eur, 0);
  const sum_market_value = allocations.reduce((s, a) => s + a.market_value_eur, 0);
  const sum_allocation_factors = allocations.reduce((s, a) => s + a.allocation_factor, 0);
  const reconciliation_delta = Math.abs(sum_allocated_cost - joint_cost_pool.toNumber());

  return {
    batch_id,
    joint_cost_pool_eur: joint_cost_pool.toNumber(),
    total_market_value_eur: sum_market_value,
    k_factor: k_factor.toDecimalPlaces(6).toNumber(),
    k_factor_interpretation,
    allocations,
    sum_allocated_cost_eur: sum_allocated_cost,
    rounding_residual_eur: rounding_residual.toDecimalPlaces(2).toNumber(),
    sum_allocation_factors: Number(sum_allocation_factors.toFixed(6)),
    is_valid: Math.abs(sum_allocation_factors - 1.0) < 0.0001 && reconciliation_delta < 0.01,
    reconciliation_delta_eur: reconciliation_delta,
    calculated_at: new Date().toISOString(),
    audit_trail,
  };
}

/**
 * ⚠️ DEPRECATED — NOT CANON CONFORM — DO NOT USE
 *
 * @deprecated Use new Level 4/5/6 flow (Mini-SVASO + ABC + Full SKU)
 *
 * This function uses outdated secondary processing logic that may not align
 * with the canonical 8-level cost model. It predates the separation of
 * Mini-SVASO (Level 4) and ABC costs (Level 5).
 *
 * For canon-compliant calculations, use:
 * 1. calculateMiniSVASO() → Level 4
 * 2. calculateABCCosts() → Level 5
 * 3. calculateFullSKUCost() → Level 6
 */
export function calculateSecondaryProcessingCost(
  input_part_code: string,
  input_cost_per_kg: number,
  processing: SecondaryProcessingInput
): SecondaryProcessingResult {
  const audit_trail: AuditTrailEntry[] = [];

  let by_product_credit = new Decimal(0);
  for (const bp of processing.by_products) {
    const bp_value = new Decimal(bp.weight_kg).mul(bp.nrv_price_per_kg);
    by_product_credit = by_product_credit.add(bp_value);
    audit_trail.push({
      step: `By-Product Credit: ${bp.type}`,
      formula: 'weight_kg × nrv_price_per_kg',
      inputs: { weight_kg: bp.weight_kg, nrv_price_per_kg: bp.nrv_price_per_kg },
      output: bp_value.toNumber(),
      source: 'Legacy Level 3',
    });
  }

  const by_product_credit_per_kg = processing.input_kg > 0
    ? by_product_credit.div(processing.input_kg)
    : new Decimal(0);

  const net_input_cost_per_kg = new Decimal(input_cost_per_kg).sub(by_product_credit_per_kg);
  const yield_adjusted_cost_per_kg = processing.yield_pct > 0
    ? net_input_cost_per_kg.div(processing.yield_pct / 100)
    : new Decimal(0);

  const total_cost_per_kg = yield_adjusted_cost_per_kg.add(processing.labor_cost_per_kg);
  const total_cost = total_cost_per_kg.mul(processing.output_meat_kg);

  return {
    product_code: processing.output_product_code,
    input_part_code,
    input_cost_per_kg,
    input_kg: processing.input_kg,
    yield_pct: processing.yield_pct,
    by_product_credit_eur: by_product_credit.toDecimalPlaces(2).toNumber(),
    net_input_cost_per_kg: net_input_cost_per_kg.toDecimalPlaces(4).toNumber(),
    yield_adjusted_cost_per_kg: yield_adjusted_cost_per_kg.toDecimalPlaces(4).toNumber(),
    labor_cost_per_kg: processing.labor_cost_per_kg,
    total_cost_per_kg: total_cost_per_kg.toDecimalPlaces(4).toNumber(),
    output_meat_kg: processing.output_meat_kg,
    total_cost_eur: total_cost.toDecimalPlaces(2).toNumber(),
    audit_trail,
  };
}

/** @deprecated Use calculateFullSKUCost instead */
export function calculateSkuCost(sku: SkuAssemblyInput): SkuCostResult {
  const audit_trail: AuditTrailEntry[] = [];

  const meat_cost = new Decimal(sku.meat_content_kg).mul(sku.meat_cost_per_kg);
  audit_trail.push({
    step: 'Meat Cost',
    formula: 'meat_content_kg × meat_cost_per_kg',
    inputs: { meat_content_kg: sku.meat_content_kg, meat_cost_per_kg: sku.meat_cost_per_kg },
    output: meat_cost.toNumber(),
    source: 'Legacy Level 4',
  });

  let giveaway_cost = new Decimal(0);
  if (sku.weight_type === 'fixed' && sku.label_weight_kg && sku.actual_fill_weight_kg) {
    const giveaway_kg = sku.actual_fill_weight_kg - sku.label_weight_kg;
    if (giveaway_kg > 0) {
      giveaway_cost = new Decimal(giveaway_kg).mul(sku.meat_cost_per_kg);
    }
  }

  const overhead_cost = new Decimal(sku.meat_content_kg).mul(sku.overhead_per_kg);
  const total_sku_cost = meat_cost
    .add(sku.packaging_cost_eur)
    .add(sku.labor_cost_eur)
    .add(overhead_cost)
    .add(giveaway_cost);

  const final_weight = sku.weight_type === 'fixed' && sku.actual_fill_weight_kg
    ? sku.actual_fill_weight_kg
    : sku.meat_content_kg;
  const cost_per_kg = final_weight > 0
    ? total_sku_cost.div(final_weight)
    : new Decimal(0);

  return {
    sku_code: sku.sku_code,
    meat_cost_per_kg: sku.meat_cost_per_kg,
    meat_content_kg: sku.meat_content_kg,
    packaging_cost_eur: sku.packaging_cost_eur,
    labor_cost_eur: sku.labor_cost_eur,
    overhead_cost_eur: overhead_cost.toDecimalPlaces(2).toNumber(),
    giveaway_cost_eur: giveaway_cost.toDecimalPlaces(2).toNumber(),
    total_sku_cost_eur: total_sku_cost.toDecimalPlaces(2).toNumber(),
    cost_per_kg: cost_per_kg.toDecimalPlaces(4).toNumber(),
    audit_trail,
  };
}

/** @deprecated */
export function simulateScenarioImpact(
  batch_id: string,
  grillerCost: GrillerCostResult,
  basePrimalCuts: PrimalCutInput[],
  scenarioPrices: ScenarioPriceVector
): ScenarioSimulationResult {
  const base = calculatePrimalAllocation(batch_id, grillerCost, basePrimalCuts);
  const scenarioCuts: PrimalCutInput[] = basePrimalCuts.map(cut => ({
    ...cut,
    std_market_price_per_kg: scenarioPrices.prices[cut.part_code] ?? cut.std_market_price_per_kg,
  }));
  const scenario = calculatePrimalAllocation(batch_id, grillerCost, scenarioCuts);

  const impact: ScenarioImpact[] = base.allocations.map(baseAlloc => {
    const scenarioAlloc = scenario.allocations.find(a => a.part_code === baseAlloc.part_code);
    if (!scenarioAlloc) {
      return {
        part_code: baseAlloc.part_code,
        base_cost_per_kg: baseAlloc.allocated_cost_per_kg,
        scenario_cost_per_kg: baseAlloc.allocated_cost_per_kg,
        cost_change_per_kg: 0,
        cost_change_pct: 0,
        explanation: 'Onderdeel niet gevonden in scenario',
      };
    }

    const cost_change = scenarioAlloc.allocated_cost_per_kg - baseAlloc.allocated_cost_per_kg;
    const cost_change_pct = baseAlloc.allocated_cost_per_kg > 0
      ? (cost_change / baseAlloc.allocated_cost_per_kg) * 100
      : 0;

    let explanation: string;
    if (Math.abs(cost_change_pct) < 0.5) {
      explanation = `Kostprijs ${getPartNameDutch(baseAlloc.part_code)} blijft stabiel.`;
    } else if (cost_change > 0) {
      explanation = `Kostprijs ${getPartNameDutch(baseAlloc.part_code)} stijgt met €${cost_change.toFixed(4)}/kg ` +
        `(${cost_change_pct.toFixed(1)}%) door verschuiving in marktwaardeverhouding.`;
    } else {
      explanation = `Kostprijs ${getPartNameDutch(baseAlloc.part_code)} daalt met €${Math.abs(cost_change).toFixed(4)}/kg ` +
        `(${Math.abs(cost_change_pct).toFixed(1)}%) door verschuiving in marktwaardeverhouding.`;
    }

    return {
      part_code: baseAlloc.part_code,
      base_cost_per_kg: baseAlloc.allocated_cost_per_kg,
      scenario_cost_per_kg: scenarioAlloc.allocated_cost_per_kg,
      cost_change_per_kg: Number(cost_change.toFixed(4)),
      cost_change_pct: Number(cost_change_pct.toFixed(2)),
      explanation,
    };
  });

  return { base, scenario, impact, disclaimer: SCENARIO_DISCLAIMER };
}

/** @deprecated */
export function generateCostWaterfall(
  batch_id: string,
  grillerCost: GrillerCostResult,
  primalAllocation: PrimalAllocationResult,
  secondaryProcessing: SecondaryProcessingResult[],
  skuCosts: SkuCostResult[]
): CostWaterfall {
  const level_0 = grillerCost.landed_cost_eur;
  const level_1 = grillerCost.griller_cost_total_eur;
  const level_1_yield_loss = level_0 + grillerCost.slaughter_cost_eur -
    grillerCost.by_product_credit_eur - level_1;

  const level_2 = primalAllocation.allocations.reduce(
    (sum, a) => sum + a.allocated_cost_total_eur, 0
  );
  const level_3 = secondaryProcessing.reduce(
    (sum, sp) => sum + sp.total_cost_eur, 0
  );
  const level_3_processing_added = secondaryProcessing.reduce(
    (sum, sp) => sum + (sp.labor_cost_per_kg * sp.output_meat_kg), 0
  );
  const level_4 = skuCosts.reduce(
    (sum, sku) => sum + sku.total_sku_cost_eur, 0
  );
  const level_4_assembly_added = skuCosts.reduce(
    (sum, sku) => sum + sku.packaging_cost_eur + sku.labor_cost_eur + sku.overhead_cost_eur + sku.giveaway_cost_eur, 0
  );

  const variances: CostVariance[] = [];
  if (grillerCost.abnormal_doa_variance_eur > 0) {
    variances.push({
      type: 'DOA',
      description: 'Abnormale uitval (boven drempelwaarde)',
      amount_eur: grillerCost.abnormal_doa_variance_eur,
      classification: 'ABNORMAL',
    });
  }

  const total_explained = level_0 + grillerCost.slaughter_cost_eur - grillerCost.by_product_credit_eur +
    level_3_processing_added + level_4_assembly_added +
    variances.reduce((sum, v) => sum + v.amount_eur, 0);
  const unexplained_delta = level_4 > 0 ? level_4 - total_explained : 0;

  if (Math.abs(unexplained_delta) > 0.01) {
    variances.push({
      type: 'UNEXPLAINED',
      description: 'Niet-verklaard verschil',
      amount_eur: unexplained_delta,
      classification: 'ABNORMAL',
    });
  }

  return {
    batch_id,
    level_0_landed_cost_eur: Number(level_0.toFixed(2)),
    level_1_griller_cost_eur: Number(level_1.toFixed(2)),
    level_1_yield_loss_eur: Number(level_1_yield_loss.toFixed(2)),
    level_2_primal_cost_eur: Number(level_2.toFixed(2)),
    level_2_k_factor: primalAllocation.k_factor,
    level_3_secondary_cost_eur: Number(level_3.toFixed(2)),
    level_3_processing_added_eur: Number(level_3_processing_added.toFixed(2)),
    level_4_sku_cost_eur: Number(level_4.toFixed(2)),
    level_4_assembly_added_eur: Number(level_4_assembly_added.toFixed(2)),
    variances,
    total_explained_eur: Number(total_explained.toFixed(2)),
    unexplained_delta_eur: Number(unexplained_delta.toFixed(2)),
    calculated_at: new Date().toISOString(),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getPartNameDutch(partCode: string): string {
  const names: Record<string, string> = {
    breast_cap: 'Filet',
    legs: 'Poot',
    leg_quarter: 'Poot',
    wings: 'Vleugels',
    back_carcass: 'Rug/karkas',
    offal: 'Organen',
    thigh_fillet: 'Dijfilet',
    drum_meat: 'Drumstick vlees',
    // External processor products (Sprint 13)
    filet_supremes: 'Filet Suprêmes',
    drumsticks: 'Drumsticks',
    dijfilet_vel: 'Dijfilet met vel',
    platte_vleugels: 'Platte vleugels',
    karkassen: 'Karkassen',
  };
  return names[partCode] || partCode;
}

export function getKFactorBadgeClass(k: number): string {
  if (k < 0.95) return 'bg-green-100 text-green-800';
  if (k <= 1.05) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

export function getKFactorInterpretation(k: number): string {
  if (k < 0.95) return 'Theoretisch winstgevend';
  if (k <= 1.05) return 'Break-even';
  return 'Theoretisch verliesgevend';
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCostPerKg(cost: number): string {
  return `€${cost.toFixed(4)}/kg`;
}

export function calculateLiveToMeatMultiplier(
  landed_cost_per_kg: number,
  griller_cost_per_kg: number
): LiveToMeatMultiplierResult {
  const multiplier = landed_cost_per_kg > 0
    ? griller_cost_per_kg / landed_cost_per_kg
    : 0;

  return {
    multiplier: Number(multiplier.toFixed(4)),
    definition: 'griller_cost_per_kg / landed_cost_per_kg',
    audit_trail: {
      step: 'Live-to-Meat Multiplier',
      formula: 'griller_cost_per_kg / landed_cost_per_kg',
      inputs: { griller_cost_per_kg, landed_cost_per_kg },
      output: multiplier,
      source: 'CANON: Cost Multiplier',
    },
  };
}

/** @deprecated Use calculateLiveToMeatMultiplier with result object */
export function calculateLiveToMeatMultiplierSimple(
  landed_cost_per_kg: number,
  griller_cost_per_kg: number
): number {
  if (landed_cost_per_kg <= 0) return 0;
  return griller_cost_per_kg / landed_cost_per_kg;
}
