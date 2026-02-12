/**
 * OIL Costing Engine — Input Validation Helpers (Phase 1.1)
 *
 * Opt-in runtime validation for canonical cost engine inputs.
 * NEVER changes costing results — only returns warnings/errors.
 *
 * Usage:
 *   const warnings = validateByProductInputs(byProducts);
 *   const miniWarnings = validateMiniSVASOInputs(parentAllocation, subCuts);
 *   // Caller decides what to do with warnings (log, display, reject).
 */

import type {
  ByProductPhysical,
  JointProductAllocation,
  SubJointCutInput,
} from './canonical-cost';

// ============================================================================
// TYPES
// ============================================================================

export type ValidationSeverity = 'WARNING' | 'ERROR';

export interface ValidationMessage {
  severity: ValidationSeverity;
  code: string;
  message: string;
  context: Record<string, unknown>;
}

// ============================================================================
// BY-PRODUCT INPUT VALIDATION
// ============================================================================

/**
 * Validates by-product inputs before they enter Level 2.
 *
 * Checks:
 * - type:'other' without explicit id/reason → WARNING
 * - negative weight → ERROR
 * - zero weight → WARNING
 */
export function validateByProductInputs(
  byProducts: ByProductPhysical[]
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  for (const bp of byProducts) {
    if (bp.type === 'other' && (!bp.id || bp.id.trim() === '' || bp.id === 'other')) {
      messages.push({
        severity: 'WARNING',
        code: 'BP_OTHER_NO_SUBTYPE',
        message:
          `By-product "${bp.id}" has type "other" without an explicit subtype/reason. ` +
          `Consider using a descriptive id (e.g., "neck_skin", "trim_fat") for traceability.`,
        context: { id: bp.id, type: bp.type, weight_kg: bp.weight_kg },
      });
    }

    if (bp.weight_kg < 0) {
      messages.push({
        severity: 'ERROR',
        code: 'BP_NEGATIVE_WEIGHT',
        message: `By-product "${bp.id}" has negative weight (${bp.weight_kg} kg).`,
        context: { id: bp.id, type: bp.type, weight_kg: bp.weight_kg },
      });
    }

    if (bp.weight_kg === 0) {
      messages.push({
        severity: 'WARNING',
        code: 'BP_ZERO_WEIGHT',
        message: `By-product "${bp.id}" has zero weight. It will contribute €0.00 credit.`,
        context: { id: bp.id, type: bp.type, weight_kg: bp.weight_kg },
      });
    }
  }

  return messages;
}

// ============================================================================
// MINI-SVASO INPUT VALIDATION
// ============================================================================

/**
 * Validates Mini-SVASO inputs before Level 4.
 *
 * Checks:
 * - sub-cut weight sum exceeds parent weight → WARNING
 * - sub-cut weight sum significantly less than parent weight → WARNING
 * - negative sub-cut weight → ERROR
 * - zero shadow price → WARNING
 */
export function validateMiniSVASOInputs(
  parentAllocation: JointProductAllocation,
  subCuts: SubJointCutInput[]
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  const totalSubWeight = subCuts.reduce((s, sc) => s + sc.weight_kg, 0);

  if (totalSubWeight > parentAllocation.weight_kg) {
    const excess = totalSubWeight - parentAllocation.weight_kg;
    const excessPct = (excess / parentAllocation.weight_kg) * 100;
    messages.push({
      severity: 'WARNING',
      code: 'MINI_SVASO_WEIGHT_EXCEEDS_PARENT',
      message:
        `Sub-cut weights (${totalSubWeight.toFixed(2)} kg) exceed parent ` +
        `${parentAllocation.part_code} weight (${parentAllocation.weight_kg.toFixed(2)} kg) ` +
        `by ${excess.toFixed(2)} kg (${excessPct.toFixed(1)}%). ` +
        `This may indicate a data entry error or unaccounted yield gain.`,
      context: {
        parent_code: parentAllocation.part_code,
        parent_weight_kg: parentAllocation.weight_kg,
        total_sub_weight_kg: totalSubWeight,
        excess_kg: excess,
        excess_pct: Number(excessPct.toFixed(1)),
      },
    });
  }

  const weightRatio = parentAllocation.weight_kg > 0
    ? totalSubWeight / parentAllocation.weight_kg
    : 0;
  if (weightRatio > 0 && weightRatio < 0.80) {
    const missing = parentAllocation.weight_kg - totalSubWeight;
    messages.push({
      severity: 'WARNING',
      code: 'MINI_SVASO_WEIGHT_LOW_COVERAGE',
      message:
        `Sub-cut weights (${totalSubWeight.toFixed(2)} kg) cover only ` +
        `${(weightRatio * 100).toFixed(1)}% of parent ${parentAllocation.part_code} ` +
        `weight (${parentAllocation.weight_kg.toFixed(2)} kg). ` +
        `${missing.toFixed(2)} kg unaccounted — cost will be absorbed by named sub-cuts.`,
      context: {
        parent_code: parentAllocation.part_code,
        parent_weight_kg: parentAllocation.weight_kg,
        total_sub_weight_kg: totalSubWeight,
        coverage_pct: Number((weightRatio * 100).toFixed(1)),
        missing_kg: missing,
      },
    });
  }

  for (const sc of subCuts) {
    if (sc.weight_kg < 0) {
      messages.push({
        severity: 'ERROR',
        code: 'MINI_SVASO_NEGATIVE_WEIGHT',
        message: `Sub-cut "${sc.sub_cut_code}" has negative weight (${sc.weight_kg} kg).`,
        context: {
          sub_cut_code: sc.sub_cut_code,
          parent_code: sc.parent_joint_code,
          weight_kg: sc.weight_kg,
        },
      });
    }

    if (sc.shadow_price_per_kg === 0) {
      messages.push({
        severity: 'WARNING',
        code: 'MINI_SVASO_ZERO_PRICE',
        message:
          `Sub-cut "${sc.sub_cut_code}" has shadow price €0.00/kg. ` +
          `It will receive €0.00 allocated cost.`,
        context: {
          sub_cut_code: sc.sub_cut_code,
          parent_code: sc.parent_joint_code,
          shadow_price_per_kg: sc.shadow_price_per_kg,
        },
      });
    }
  }

  return messages;
}
