/**
 * Mass Balance Validation Engine
 *
 * Validates that batch mass flows are physically consistent:
 * - Live Weight -> Griller + Losses
 * - Griller -> Cut-up parts + Unaccounted
 *
 * Surfaces NEEDS_REVIEW signals when data is incomplete or inconsistent.
 */

import type { BatchMassBalance } from '@/types/database';

// ============================================================================
// TYPES
// ============================================================================

export interface MassBalanceValidation {
  batch_id: string;
  batch_ref: string;
  is_valid: boolean;
  errors: MassBalanceError[];
  warnings: MassBalanceWarning[];
  metrics: MassBalanceMetrics;
}

export interface MassBalanceError {
  code: string;
  message: string;
  severity: 'error' | 'critical';
  affected_field: string;
  expected?: number;
  actual?: number;
}

export interface MassBalanceWarning {
  code: string;
  message: string;
  severity: 'warning' | 'info';
  affected_field: string;
  value?: number;
}

export interface MassBalanceMetrics {
  /** Level 1: Live -> Griller */
  live_to_griller_balance_kg: number;
  live_to_griller_balance_pct: number;

  /** Level 2: Griller -> Parts */
  griller_to_parts_balance_kg: number;
  griller_to_parts_balance_pct: number;

  /** Total parts weight */
  total_parts_kg: number;

  /** Unaccounted percentage */
  unaccounted_pct: number;

  /** Data completeness */
  parts_present: number;
  parts_expected: number;
}

export interface ValidationConfig {
  /** Tolerance for balance check (percentage) */
  balance_tolerance_pct: number;
  /** Maximum acceptable unaccounted loss (percentage) */
  max_unaccounted_pct: number;
  /** Expected number of anatomical parts */
  expected_parts_count: number;
  /** Minimum yield for each part to be considered present */
  min_yield_kg: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  balance_tolerance_pct: 2.0,  // 2% tolerance for float/measurement errors
  max_unaccounted_pct: 5.0,    // Alert if >5% unaccounted
  expected_parts_count: 5,      // breast_cap, leg_quarter, wings, back_carcass, offal
  min_yield_kg: 0.1,           // Minimum weight to count as "present"
};

// ============================================================================
// CORE VALIDATION
// ============================================================================

/**
 * Validate mass balance for a single batch
 *
 * @param massBalance - Batch mass balance data
 * @param config - Validation configuration
 * @returns Validation result with errors, warnings, and metrics
 *
 * @example
 * ```ts
 * const result = validateMassBalance(batchData);
 * if (!result.is_valid) {
 *   console.log('Errors:', result.errors);
 * }
 * ```
 */
export function validateMassBalance(
  massBalance: BatchMassBalance,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): MassBalanceValidation {
  const errors: MassBalanceError[] = [];
  const warnings: MassBalanceWarning[] = [];

  // =========================================================================
  // LEVEL 1: Live -> Griller Balance Check
  // =========================================================================

  // Expected: Live = Griller + Rejection + Slaughter Waste
  const expectedLiveWeight =
    massBalance.node_griller +
    massBalance.loss_rejection +
    massBalance.loss_slaughter;

  const level1Balance = massBalance.source_live_weight - expectedLiveWeight;
  const level1BalancePct = massBalance.source_live_weight > 0
    ? (level1Balance / massBalance.source_live_weight) * 100
    : 0;

  if (Math.abs(level1BalancePct) > config.balance_tolerance_pct) {
    errors.push({
      code: 'LEVEL1_IMBALANCE',
      message: `Live weight balance off by ${level1Balance.toFixed(2)} kg (${level1BalancePct.toFixed(1)}%)`,
      severity: Math.abs(level1BalancePct) > 5 ? 'critical' : 'error',
      affected_field: 'live_to_griller',
      expected: massBalance.source_live_weight,
      actual: expectedLiveWeight,
    });
  }

  // =========================================================================
  // LEVEL 2: Griller -> Parts Balance Check
  // =========================================================================

  const totalPartsWeight =
    massBalance.node_breast_cap +
    massBalance.node_leg_quarter +
    massBalance.node_wings +
    massBalance.node_back_carcass +
    massBalance.node_offal;

  const level2Balance = massBalance.node_griller - totalPartsWeight;
  const level2BalancePct = massBalance.node_griller > 0
    ? (level2Balance / massBalance.node_griller) * 100
    : 0;

  // Check if parts are missing
  const partsPresent = countPartsPresent(massBalance, config.min_yield_kg);

  if (partsPresent < config.expected_parts_count) {
    warnings.push({
      code: 'INCOMPLETE_PARTS',
      message: `Only ${partsPresent} of ${config.expected_parts_count} expected parts recorded`,
      severity: 'warning',
      affected_field: 'cut_up_yields',
      value: partsPresent,
    });
  }

  // Check unaccounted loss
  const unaccountedPct = massBalance.node_griller > 0
    ? (massBalance.loss_unaccounted / massBalance.node_griller) * 100
    : 0;

  if (unaccountedPct > config.max_unaccounted_pct) {
    warnings.push({
      code: 'HIGH_UNACCOUNTED',
      message: `Unaccounted loss ${unaccountedPct.toFixed(1)}% exceeds threshold ${config.max_unaccounted_pct}%`,
      severity: 'warning',
      affected_field: 'loss_unaccounted',
      value: unaccountedPct,
    });
  }

  // Negative unaccounted = parts weigh more than griller (data error)
  if (massBalance.loss_unaccounted < 0) {
    errors.push({
      code: 'NEGATIVE_UNACCOUNTED',
      message: `Parts weight (${totalPartsWeight.toFixed(2)} kg) exceeds griller weight (${massBalance.node_griller.toFixed(2)} kg)`,
      severity: 'error',
      affected_field: 'loss_unaccounted',
      expected: massBalance.node_griller,
      actual: totalPartsWeight,
    });
  }

  // =========================================================================
  // COMPLETENESS CHECKS
  // =========================================================================

  if (massBalance.node_griller === 0 || massBalance.node_griller === null) {
    errors.push({
      code: 'MISSING_GRILLER',
      message: 'Griller weight is zero or missing',
      severity: 'critical',
      affected_field: 'node_griller',
    });
  }

  if (massBalance.source_live_weight === 0) {
    errors.push({
      code: 'MISSING_LIVE_WEIGHT',
      message: 'Live weight is zero or missing',
      severity: 'critical',
      affected_field: 'source_live_weight',
    });
  }

  // Check for zero parts (NEEDS_REVIEW scenario)
  if (partsPresent === 0 && massBalance.node_griller > 0) {
    warnings.push({
      code: 'NEEDS_REVIEW',
      message: 'No cut-up yields recorded for batch with griller weight. Manual review required.',
      severity: 'warning',
      affected_field: 'cut_up_yields',
    });
  }

  // =========================================================================
  // COMPILE RESULT
  // =========================================================================

  const metrics: MassBalanceMetrics = {
    live_to_griller_balance_kg: Number(level1Balance.toFixed(3)),
    live_to_griller_balance_pct: Number(level1BalancePct.toFixed(2)),
    griller_to_parts_balance_kg: Number(level2Balance.toFixed(3)),
    griller_to_parts_balance_pct: Number(level2BalancePct.toFixed(2)),
    total_parts_kg: Number(totalPartsWeight.toFixed(3)),
    unaccounted_pct: Number(unaccountedPct.toFixed(2)),
    parts_present: partsPresent,
    parts_expected: config.expected_parts_count,
  };

  const isValid = errors.length === 0;

  return {
    batch_id: massBalance.batch_id,
    batch_ref: massBalance.batch_ref,
    is_valid: isValid,
    errors,
    warnings,
    metrics,
  };
}

/**
 * Count how many anatomical parts have recorded yields
 */
function countPartsPresent(
  massBalance: BatchMassBalance,
  minYield: number
): number {
  let count = 0;
  if (massBalance.node_breast_cap >= minYield) count++;
  if (massBalance.node_leg_quarter >= minYield) count++;
  if (massBalance.node_wings >= minYield) count++;
  if (massBalance.node_back_carcass >= minYield) count++;
  if (massBalance.node_offal >= minYield) count++;
  return count;
}

/**
 * Validate multiple batches and return summary
 */
export function validateAllMassBalances(
  massBalances: BatchMassBalance[],
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): {
  total: number;
  valid: number;
  invalid: number;
  needs_review: number;
  results: MassBalanceValidation[];
} {
  const results = massBalances.map(mb => validateMassBalance(mb, config));

  const needsReview = results.filter(r =>
    r.warnings.some(w => w.code === 'NEEDS_REVIEW')
  ).length;

  return {
    total: results.length,
    valid: results.filter(r => r.is_valid).length,
    invalid: results.filter(r => !r.is_valid).length,
    needs_review: needsReview,
    results,
  };
}

/**
 * Generate a NEEDS_REVIEW signal for commercial_signals table
 */
export function generateNeedsReviewSignal(
  validation: MassBalanceValidation
): {
  signal_type: string;
  severity: string;
  batch_id: string;
  title: string;
  description: string;
  metric_value: number;
  threshold_value: number;
} | null {
  const needsReviewWarning = validation.warnings.find(
    w => w.code === 'NEEDS_REVIEW'
  );

  if (needsReviewWarning) {
    return {
      signal_type: 'yield_missing',
      severity: 'warning',
      batch_id: validation.batch_id,
      title: `Batch ${validation.batch_ref}: Yields ontbreken`,
      description: needsReviewWarning.message,
      metric_value: validation.metrics.parts_present,
      threshold_value: validation.metrics.parts_expected,
    };
  }

  // Generate signal for high unaccounted loss
  const highUnaccounted = validation.warnings.find(
    w => w.code === 'HIGH_UNACCOUNTED'
  );

  if (highUnaccounted) {
    return {
      signal_type: 'yield_alert',
      severity: 'warning',
      batch_id: validation.batch_id,
      title: `Batch ${validation.batch_ref}: Hoog onverklaard verlies`,
      description: highUnaccounted.message,
      metric_value: validation.metrics.unaccounted_pct,
      threshold_value: DEFAULT_VALIDATION_CONFIG.max_unaccounted_pct,
    };
  }

  return null;
}
