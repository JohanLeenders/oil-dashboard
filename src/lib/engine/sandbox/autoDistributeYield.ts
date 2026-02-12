/**
 * Auto Distribute Yield Module
 *
 * UX helper for proportionally distributing yield adjustments across parts.
 */

import type { YieldOverride } from './types';

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
