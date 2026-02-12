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

// ============================================================================
// RE-EXPORTS FROM MODULES
// ============================================================================

// Core pipeline function
export { runScenarioSandbox } from './sandbox/runScenarioSandbox';

// Individual step functions
export { mergeOverrides } from './sandbox/mergeOverrides';
export { validateScenarioMassBalance, SANDBOX_MASS_BALANCE_TOLERANCE } from './sandbox/validateScenarioMassBalance';
export { computeDeltas } from './sandbox/computeDeltas';
export { autoDistributeYield } from './sandbox/autoDistributeYield';

// Types
export type {
  ScenarioInput,
  YieldOverride,
  PriceOverride,
  BaselineBatchData,
  WaterfallResult,
  ScenarioResult,
  DeltaResult,
  ScenarioMetadata,
  MassBalanceCheck,
  MergedInput,
} from './sandbox/types';

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
