import type { LocationYieldProfile } from '@/lib/engine/availability/cascading';

export interface DistributionLine {
  product_id: string;
  product_description: string;
  quantity_kg: number;
}

export interface DistributionPreview {
  bird_count: number;
  griller_kg: number;
  lines: DistributionLine[];
  total_kg: number;
}

/**
 * Distribute a bird count into Putten primary product suggestions.
 *
 * Logic: griller_kg = bird_count x avg_weight_kg x griller_yield_pct
 * Per profile: kg = griller_kg x yield_percentage
 *
 * Returns Putten-only lines. Does NOT create Nijkerk child lines.
 * Pure function — no DB access.
 */
export function distributeByBirds(input: {
  bird_count: number;
  avg_weight_kg: number;
  griller_yield_pct: number; // 0.0-1.0
  yield_profiles: LocationYieldProfile[];
}): DistributionPreview {
  const { bird_count, avg_weight_kg, griller_yield_pct, yield_profiles } = input;

  if (bird_count <= 0 || avg_weight_kg <= 0 || griller_yield_pct <= 0) {
    return { bird_count: 0, griller_kg: 0, lines: [], total_kg: 0 };
  }

  const griller_kg = bird_count * avg_weight_kg * griller_yield_pct;

  const lines: DistributionLine[] = yield_profiles.map(profile => ({
    product_id: profile.product_id,
    product_description: profile.product_description,
    quantity_kg: Math.round(griller_kg * profile.yield_percentage * 100) / 100,
  }));

  const total_kg = lines.reduce((sum, l) => sum + l.quantity_kg, 0);

  return {
    bird_count,
    griller_kg: Math.round(griller_kg * 100) / 100,
    lines,
    total_kg: Math.round(total_kg * 100) / 100,
  };
}
