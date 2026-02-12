/**
 * Mass Balance Validation Module
 *
 * Validates that scenario yields respect mass balance with tight tolerance.
 */

import type { MergedInput, MassBalanceCheck } from './types';

/**
 * Tighter mass balance tolerance for scenario sandbox.
 * Uses EXACTLY 0.1% relative tolerance (0.001).
 *
 * Rule: abs(totalParts - grillerWeight) / grillerWeight <= 0.001
 *
 * Note: This is stricter than canonical engine's DEFAULT_VALIDATION_CONFIG (2%)
 * because scenarios require precise yield control for accurate what-if analysis.
 */
export const SANDBOX_MASS_BALANCE_TOLERANCE = 0.001;

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

  // Calculate relative error: abs(totalParts - grillerWeight) / grillerWeight
  const relative_error = griller_kg > 0 ? delta_kg / griller_kg : 0;
  const tolerance_kg = griller_kg * SANDBOX_MASS_BALANCE_TOLERANCE;

  // Validation: relative_error must be <= SANDBOX_MASS_BALANCE_TOLERANCE (0.001)
  if (relative_error > SANDBOX_MASS_BALANCE_TOLERANCE) {
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
