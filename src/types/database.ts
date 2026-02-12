/**
 * OIL Database Types
 * Auto-generated types voor Supabase tables
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ProductCategory =
  | 'hele_kip'
  | 'filet'
  | 'haas'
  | 'dij'
  | 'drumstick'
  | 'drumvlees'
  | 'vleugels'
  | 'karkas'
  | 'organen'
  | 'vel'
  | 'kosten'
  | 'emballage';

export type AnatomicalPart =
  | 'breast_cap'
  | 'leg_quarter'
  | 'wings'
  | 'back_carcass'
  | 'offal';

export type ThtStatus = 'green' | 'orange' | 'red';

export type BatchStatus =
  | 'planned'
  | 'slaughtered'
  | 'cut_up'
  | 'in_sales'
  | 'closed';

export type SignalSeverity = 'info' | 'warning' | 'critical';

export type SignalStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';

// ============================================================================
// TABLE TYPES
// ============================================================================

export interface Product {
  id: string;
  sku_code: string;
  storteboom_plu: string | null;
  description: string;
  internal_name: string;
  category: ProductCategory;
  anatomical_part: AnatomicalPart | null;
  target_yield_min: number | null;
  target_yield_max: number | null;
  is_saleable: boolean;
  default_market_price_per_kg: number | null;
  packaging_type: string | null;
  standard_weight_kg: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductionBatch {
  id: string;
  batch_ref: string;
  slaughter_date: string;
  live_weight_kg: number;
  bird_count: number;
  avg_bird_weight_kg: number;
  griller_weight_kg: number | null;
  griller_yield_pct: number | null;
  rejection_kg: number;
  slaughter_waste_kg: number;
  production_date: string | null;
  expiry_date: string | null;
  status: BatchStatus;
  total_batch_cost: number | null;
  forecast_griller_yield_pct: number;
  created_at: string;
  updated_at: string;
}

export interface BatchYield {
  id: string;
  batch_id: string;
  anatomical_part: AnatomicalPart;
  actual_weight_kg: number;
  yield_pct: number | null;
  target_yield_min: number | null;
  target_yield_max: number | null;
  delta_from_target: number | null;
  measurement_source: string | null;
  measured_at: string;
  notes: string | null;
  is_correction: boolean;
  corrects_yield_id: string | null;
  created_at: string;
}

export interface MarketBenchmark {
  id: string;
  product_id: string;
  price_per_kg: number;
  price_source: string | null;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  created_by: string | null;
}

export interface BatchCost {
  id: string;
  batch_id: string;
  cost_type: string;
  description: string | null;
  amount: number;
  per_unit: string | null;
  quantity: number | null;
  invoice_ref: string | null;
  invoice_date: string | null;
  is_adjustment: boolean;
  adjusts_cost_id: string | null;
  adjustment_reason: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  segment: string | null;
  is_active: boolean;
  total_revenue_ytd: number;
  last_balance_score: number | null;
  last_score_calculated_at: string | null;
  is_cherry_picker: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalesTransaction {
  id: string;
  customer_id: string;
  product_id: string;
  batch_id: string | null;
  invoice_number: string;
  invoice_date: string;
  quantity_kg: number;
  quantity_pieces: number | null;
  unit_price: number;
  line_total: number;
  allocated_cost: number | null;
  gross_margin: number | null;
  margin_pct: number | null;
  batch_ref_source: string | null;
  is_credit: boolean;
  credits_transaction_id: string | null;
  credit_reason: string | null;
  created_at: string;
  synced_from: string | null;
}

export interface CommercialNorm {
  id: string;
  anatomical_part: AnatomicalPart;
  product_category: ProductCategory;
  anatomical_ratio_pct: number;
  cherry_picker_threshold_pct: number | null;
  valid_from: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
}

export interface ComputedSnapshot {
  id: string;
  batch_id: string;
  snapshot_type: string;
  computed_data: Record<string, unknown>;
  computed_at: string;
  is_stale: boolean;
  input_data_hash: string | null;
}

export interface CommercialSignal {
  id: string;
  signal_type: string;
  severity: SignalSeverity;
  customer_id: string | null;
  batch_id: string | null;
  product_id: string | null;
  title: string;
  description: string | null;
  metric_value: number | null;
  threshold_value: number | null;
  status: SignalStatus;
  assigned_to: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// VIEW TYPES
// ============================================================================

export interface BatchMassBalance {
  batch_id: string;
  batch_ref: string;
  slaughter_date: string;
  source_live_weight: number;
  loss_rejection: number;
  loss_slaughter: number;
  node_griller: number;
  node_breast_cap: number;
  node_leg_quarter: number;
  node_wings: number;
  node_back_carcass: number;
  node_offal: number;
  loss_unaccounted: number;
  /** Data quality status from effective views */
  data_status?: 'COMPLETE' | 'NEEDS_REVIEW' | 'HAS_CORRECTIONS';
}

// ============================================================================
// JOINED/ENRICHED TYPES
// ============================================================================

export interface SalesTransactionWithRelations extends SalesTransaction {
  customer: Customer;
  product: Product;
  batch: ProductionBatch | null;
}

export interface BatchWithYields extends ProductionBatch {
  yields: BatchYield[];
  costs: BatchCost[];
  tht_status: ThtStatus;
}

export interface CustomerWithSales extends Customer {
  sales: SalesTransaction[];
  product_mix: ProductMixItem[];
}

export interface ProductMixItem {
  category: ProductCategory;
  quantity_kg: number;
  percentage: number;
  anatomical_ratio: number;
  deviation: number; // Afwijking van anatomische ratio
}

// ============================================================================
// SPRINT 1 TYPES — Batch Massabalans & Carcass Balance
// ============================================================================

/**
 * Sprint 1: Slaughter report data from Map1 uploads
 * Source of batch truth
 */
export interface SlaughterReport {
  id: string;
  batch_id: string;
  source_document_id: string | null;
  source_filename: string | null;
  upload_timestamp: string;
  input_live_kg: number;
  input_count: number;
  cat2_kg: number;
  cat3_kg: number;
  parts_raw: Record<string, number> | null;
  report_date: string | null;
  created_at: string;
}

/**
 * Sprint 1: Delivery note (pakbon) data from Flow Automation
 * Commercial truth for what was shipped
 */
export interface DeliveryNote {
  id: string;
  batch_id: string | null;
  delivery_number: string;
  delivery_date: string;
  sku: string;
  product_description: string | null;
  net_weight_kg: number;
  gross_weight_kg: number | null;
  piece_count: number | null;
  customer_code: string | null;
  customer_name: string | null;
  source_document_id: string | null;
  source_filename: string | null;
  synced_from: string;
  upload_timestamp: string;
  created_at: string;
}

/**
 * Sprint 1: SKU to anatomical part mapping
 * Manual mapping allowed (temporary)
 */
export interface SkuPartMapping {
  id: string;
  sku: string;
  sku_description: string | null;
  part_code: string;
  confidence: 'manual' | 'inferred' | 'verified';
  mapped_by: string | null;
  mapped_at: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Sprint 1: Technical vs commercial output comparison
 * From v_batch_output_vs_pakbon view
 */
export interface BatchOutputComparison {
  batch_id: string;
  batch_ref: string;
  slaughter_date: string;
  part_code: string;
  technical_weight_kg: number;
  commercial_weight_kg: number;
  delta_kg: number;
  delta_pct: number | null;
  technical_source: string | null;
  commercial_source: string | null;
}

/**
 * Sprint 1: Yield vs expectation comparison
 * From v_batch_yield_vs_expectation view
 * JA757 is NORMATIVE, Ross308 is INDICATIVE ONLY
 */
export interface BatchYieldExpectation {
  yield_id: string;
  batch_id: string;
  batch_ref: string;
  slaughter_date: string;
  anatomical_part: AnatomicalPart;
  actual_weight_kg: number;
  realized_yield_pct: number | null;
  // JA757 - NORMATIVE
  ja757_min_pct: number;
  ja757_max_pct: number;
  ja757_midpoint_pct: number;
  delta_from_ja757_pct: number | null;
  yield_status: 'NO_DATA' | 'IN_RANGE' | 'BELOW_TARGET' | 'ABOVE_TARGET';
  // Ross308 - INDICATIVE ONLY
  ross308_indicative_min_pct: number;
  ross308_indicative_max_pct: number;
  ross308_usage_label: 'INDICATIVE_ONLY';
  // Data quality
  data_status: string;
  is_correction: boolean;
  measurement_source: string | null;
}

// ============================================================================
// SPRINT 2 TYPES — Split-Off & NRV Kostprijsmodel
// ============================================================================

/**
 * Sprint 2: Joint costs per batch
 * Only live_bird_purchase per Sprint 2 contract
 */
export interface JointCost {
  id: string;
  batch_id: string;
  cost_type: 'live_bird_purchase';
  amount_eur: number;
  cost_per_kg: number | null;
  cost_per_bird: number | null;
  invoice_ref: string | null;
  invoice_date: string | null;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

/**
 * Sprint 2: Processing costs applied AFTER split-off
 * For NRV calculation
 */
export interface ProcessingCost {
  id: string;
  process_step: 'cutting' | 'vacuum' | 'portioning' | 'packaging' | 'other';
  cost_per_kg: number;
  applies_to_part_code: string | null;
  applies_to_sku: string | null;
  source: 'manual' | 'abc' | 'contract';
  valid_from: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

/**
 * Sprint 2: Sales Value at Split-Off per batch/part
 * Used for SVASO allocation (NOT weight-based)
 */
export interface BatchSplitoffValue {
  id: string;
  batch_id: string;
  part_code: string;
  sales_value_eur: number;
  weight_kg: number;
  price_per_kg: number;
  price_source: 'market_benchmark' | 'contract' | 'manual';
  price_reference_date: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

/**
 * Sprint 2: Split-off allocation view result
 * From v_batch_splitoff_allocation
 */
export interface BatchSplitoffAllocation {
  splitoff_value_id: string;
  batch_id: string;
  batch_ref: string;
  slaughter_date: string;
  part_code: string;
  weight_kg: number;
  price_per_kg: number;
  price_source: string;
  sales_value_eur: number;
  total_sales_value_eur: number;
  allocation_pct: number;
  batch_joint_cost_eur: number;
  allocated_joint_cost_eur: number;
  allocation_factor: number;
}

/**
 * Sprint 2: Part cost at split-off view result
 * From v_batch_part_cost
 */
export interface BatchPartCost {
  splitoff_value_id: string;
  batch_id: string;
  batch_ref: string;
  slaughter_date: string;
  part_code: string;
  weight_kg: number;
  allocated_joint_cost_eur: number;
  cost_per_kg_splitoff: number;
  allocation_pct: number;
  allocation_factor: number;
  batch_joint_cost_eur: number;
  market_price_per_kg: number;
  price_source: string;
  validation_status: 'OK' | 'INVALID_WEIGHT' | 'NO_COST_ALLOCATED';
}

/**
 * Sprint 2: NRV cost per SKU view result
 * From v_batch_nrv_by_sku
 */
export interface BatchNrvBySku {
  batch_id: string;
  batch_ref: string;
  slaughter_date: string;
  sku: string | null;
  sku_description: string | null;
  part_code: string;
  allocated_joint_cost_eur: number;
  cost_per_kg_splitoff: number;
  extra_processing_cost_per_kg: number;
  nrv_cost_per_kg: number;
  nrv_total_eur: number;
  allocation_method: 'SVASO';
  costing_method: 'NRV';
}

// ============================================================================
// SPRINT 3 TYPES — Voorraaddruk & Sales Pressure
// ============================================================================

/**
 * Sprint 3: Inventory position per batch/part
 * Observational only - no actions
 */
export interface InventoryPosition {
  id: string;
  batch_id: string;
  part_code: string;
  quantity_kg: number;
  location: string;
  snapshot_date: string;
  snapshot_timestamp: string;
  source: 'manual' | 'system_sync' | 'calculated';
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

/**
 * Sprint 3: Sales by part view result
 * From v_sales_by_part
 */
export interface SalesByPart {
  transaction_id: string;
  sale_date: string;
  sku: string;
  part_code: string;
  quantity_kg: number;
  customer_id: string;
  batch_id: string | null;
  product_category: string;
  revenue_eur: number;
  invoice_number: string;
  data_source: string | null;
}

/**
 * Sprint 3: Inventory by part view result
 * From v_inventory_by_part
 */
export interface InventoryByPart {
  part_code: string;
  total_quantity_kg: number;
  batch_count: number;
  latest_snapshot_date: string;
  batch_distribution: unknown; // JSONB array
  data_status: 'OK' | 'NO_DATA' | 'ZERO_STOCK';
}

/**
 * Sprint 3: Sales velocity by part view result
 * From v_sales_velocity_by_part
 */
export interface SalesVelocityByPart {
  part_code: string;
  avg_daily_sales_kg: number;
  reference_period: string;
  avg_daily_sales_90d_kg: number;
  avg_daily_sales_7d_kg: number;
  total_sales_30d_kg: number;
  days_with_sales_30d: number;
  velocity_trend: 'ACCELERATING' | 'DECELERATING' | 'STABLE' | 'NO_DATA';
  data_status: 'OK' | 'NO_SALES_DATA' | 'LIMITED_DATA';
}

/**
 * Sprint 3: Pressure flag values
 */
export type PressureFlag = 'green' | 'orange' | 'red' | 'no_stock' | 'no_velocity';

/**
 * Sprint 3: Sales pressure score view result
 * From v_sales_pressure_score
 */
export interface SalesPressureScore {
  part_code: string;
  inventory_kg: number;
  batch_count: number;
  avg_daily_sales_kg: number;
  velocity_trend: 'ACCELERATING' | 'DECELERATING' | 'STABLE' | 'NO_DATA';
  days_sales_inventory: number | null;
  pressure_flag: PressureFlag;
  tht_batches_red: number;
  tht_batches_orange: number;
  tht_batches_green: number;
  explanation: string;
  batch_distribution: unknown; // JSONB array
  data_status: 'OK' | 'NO_DATA' | 'NO_INVENTORY_DATA' | 'NO_VELOCITY_DATA';
}

// ============================================================================
// SPRINT 4 TYPES — Klant-specifieke Vierkantsverwaarding
// ============================================================================

/**
 * Sprint 4: Elasticity assumption for scenarios
 * CRITICAL: These are ASSUMPTIONS, not predictions
 */
export interface ElasticityAssumption {
  id: string;
  scenario_id: string;
  scenario_name: string;
  scenario_description: string | null;
  part_code: string;
  price_change_pct: number;
  expected_volume_change_pct: number;
  assumption_source: 'manual' | 'historical' | 'market_research' | 'expert_estimate';
  assumption_note: string | null;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

/**
 * Sprint 4: Customer intake profile view result
 * From v_customer_intake_profile
 */
export interface CustomerIntakeProfile {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  part_code: string;
  quantity_kg: number;
  revenue_eur: number;
  transaction_count: number;
  share_of_total_pct: number;
  customer_total_kg: number;
  customer_total_revenue_eur: number;
  reference_period: string;
}

/**
 * Sprint 4: Deviation category
 */
export type DeviationCategory =
  | 'OVER_UPTAKE_HIGH'
  | 'OVER_UPTAKE_MODERATE'
  | 'BALANCED'
  | 'UNDER_UPTAKE_MODERATE'
  | 'UNDER_UPTAKE_HIGH';

/**
 * Sprint 4: Customer carcass alignment view result
 * From v_customer_carcass_alignment
 */
export interface CustomerCarcassAlignment {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  part_code: string;
  quantity_kg: number;
  customer_share_pct: number;
  carcass_share_pct: number;
  deviation_pct: number;
  customer_total_kg: number;
  alignment_score: number;
  deviation_category: DeviationCategory;
  avg_abs_deviation_pct: number;
  max_deviation_pct: number;
  parts_purchased: number;
  carcass_reference_source: string;
  reference_period: string;
}

/**
 * Sprint 4: Balance effect type
 */
export type BalanceEffect = 'NO_BASELINE' | 'NEUTRAL' | 'CHANGES_BALANCE';

/**
 * Sprint 4: Scenario impact view result
 * From v_scenario_impact
 * CRITICAL: All data is ASSUMPTION, not prediction
 */
export interface ScenarioImpact {
  scenario_id: string;
  scenario_name: string;
  scenario_description: string | null;
  part_code: string;
  price_change_pct: number;
  expected_volume_change_pct: number;
  current_daily_kg: number | null;
  projected_daily_kg: number | null;
  volume_change_daily_kg: number | null;
  projected_30d_kg: number | null;
  balance_effect: BalanceEffect;
  assumption_source: string;
  assumption_note: string | null;
  data_type: 'SCENARIO_ASSUMPTION';
  disclaimer: string;
  carcass_reference: string;
  projection_date: string;
}

// ============================================================================
// SPRINT 5 TYPES — Klantafspraken, Marges & Karkascontext
// ============================================================================

/**
 * Sprint 5: Customer contract for agreed share ranges
 */
export interface CustomerContract {
  id: string;
  customer_id: string;
  part_code: string;
  agreed_share_min: number;
  agreed_share_max: number;
  contract_start_date: string;
  contract_end_date: string | null;
  price_tier: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Sprint 5: Customer margin context (precomputed for explanation)
 */
export interface CustomerMarginContextRecord {
  id: string;
  customer_id: string;
  part_code: string;
  period_start: string;
  period_end: string;
  revenue_eur: number;
  cost_eur: number;
  margin_eur: number;
  margin_pct: number | null;
  quantity_kg: number;
  transaction_count: number;
  margin_explanation: string;
  customer_share_pct: number | null;
  carcass_share_pct: number | null;
  deviation_pct: number | null;
  data_completeness: 'COMPLETE' | 'PARTIAL' | 'ESTIMATED';
  calculated_at: string;
  calculation_version: string;
  created_at: string;
}

/**
 * Sprint 5: Customer margin by part view result
 * From v_customer_margin_by_part
 */
export interface CustomerMarginByPartView {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  part_code: string;
  quantity_kg: number;
  revenue_eur: number;
  cost_eur: number;
  margin_eur: number;
  margin_pct: number | null;
  customer_share_pct: number | null;
  customer_total_kg: number;
  customer_total_revenue_eur: number;
  customer_total_cost_eur: number;
  transaction_count: number;
  first_sale_date: string;
  last_sale_date: string;
  cost_data_status: 'COST_AVAILABLE' | 'NO_COST_DATA';
  reference_period: string;
}

/**
 * Sprint 5: Contract deviation flag
 */
export type ContractDeviationFlag = 'WITHIN_RANGE' | 'BELOW_RANGE' | 'ABOVE_RANGE' | 'NO_CONTRACT';

/**
 * Sprint 5: Customer contract deviation view result
 * From v_customer_contract_deviation
 */
export interface CustomerContractDeviationView {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  part_code: string;
  quantity_kg: number;
  actual_share: number;
  customer_total_kg: number;
  agreed_share_min: number | null;
  agreed_share_max: number | null;
  agreed_range: string | null;
  deviation_pct: number | null;
  deviation_flag: ContractDeviationFlag;
  explanation: string;
  price_tier: string | null;
  contract_notes: string | null;
  contract_start_date: string | null;
  reference_period: string;
  contract_status: 'CONTRACT_EXISTS' | 'NO_CONTRACT';
}

// ============================================================================
// SPRINT 6 TYPES — Historische Trends & Verwaarding
// ============================================================================

/**
 * Sprint 6: Batch history record for trend analysis
 */
export interface BatchHistory {
  id: string;
  batch_id: string;
  batch_ref: string;
  slaughter_date: string;
  slaughter_week: number;
  slaughter_month: number;
  slaughter_quarter: number;
  slaughter_year: number;
  season: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  key_metrics: Record<string, unknown>;
  griller_yield_pct: number | null;
  total_cost_eur: number | null;
  total_revenue_eur: number | null;
  total_margin_eur: number | null;
  total_margin_pct: number | null;
  bird_count: number | null;
  live_weight_kg: number | null;
  breast_cap_yield_pct: number | null;
  leg_quarter_yield_pct: number | null;
  wings_yield_pct: number | null;
  back_carcass_yield_pct: number | null;
  data_completeness: 'COMPLETE' | 'PARTIAL' | 'ESTIMATED';
  snapshot_at: string;
  snapshot_version: string;
  created_at: string;
}

/**
 * Sprint 6: Period type for aggregation
 */
export type TrendPeriodType = 'week' | 'month' | 'quarter';

/**
 * Sprint 6: Part trend over time view result
 * From v_part_trend_over_time
 */
export interface PartTrendOverTimeView {
  part_code: string;
  period_start: string;
  period_type: TrendPeriodType;
  period_number: number;
  period_year: number;
  avg_yield_pct: number | null;
  yield_stddev: number | null;
  batch_count: number | null;
  produced_kg: number | null;
  total_sold_kg: number | null;
  total_revenue_eur: number | null;
  total_cost_eur: number | null;
  total_margin_eur: number | null;
  avg_margin_pct: number | null;
  transaction_count: number | null;
  avg_inventory_kg: number | null;
  avg_dsi: number | null;
  data_status: 'COMPLETE' | 'PARTIAL' | 'NO_DATA';
  data_type: 'HISTORICAL_TREND';
}

/**
 * Sprint 6: Customer trend over time view result
 * From v_customer_trend_over_time
 */
export interface CustomerTrendOverTimeView {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  period_start: string;
  period_type: TrendPeriodType;
  period_number: number;
  period_year: number;
  total_kg: number;
  total_revenue_eur: number;
  total_cost_eur: number;
  total_margin_eur: number;
  margin_pct: number | null;
  transaction_count: number;
  alignment_score: number | null;
  avg_abs_deviation: number | null;
  parts_purchased: number | null;
  prev_period_kg: number | null;
  prev_period_margin_pct: number | null;
  prev_period_alignment: number | null;
  volume_change_pct: number | null;
  margin_change_pct: number | null;
  alignment_change: number | null;
  data_status: 'COMPLETE' | 'PARTIAL' | 'NO_DATA';
  data_type: 'HISTORICAL_TREND';
  carcass_reference: string;
}
