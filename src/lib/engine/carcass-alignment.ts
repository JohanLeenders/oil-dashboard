/**
 * Sprint 4: Carcass Alignment Engine
 *
 * Calculates customer intake alignment with carcass balance (vierkantsverwaarding).
 * ANALYTICAL ONLY - no scoring, no blame, no recommendations.
 *
 * Key concepts:
 * - Carcass proportions are fixed by anatomy (JA757 reference)
 * - Customer intake profiles may deviate from natural proportions
 * - Deviation = over-uptake or under-uptake vs carcass balance
 * - Alignment score = how close to natural proportions
 */

import type { AnatomicalPart } from '@/types/database';

// ============================================================================
// TYPES
// ============================================================================

/**
 * JA757 carcass reference proportions (NORMATIVE)
 * Source: Hubbard JA757 spec sheet, as defined in KPI_DEFINITIONS.md
 */
export interface CarcassReference {
  part_code: AnatomicalPart;
  carcass_share_pct: number;
  min_pct: number;
  max_pct: number;
}

/**
 * Customer intake profile for a single part
 */
export interface CustomerIntakeItem {
  customer_id: string;
  part_code: AnatomicalPart;
  quantity_kg: number;
  share_of_total_pct: number;
}

/**
 * Deviation result for a single part
 */
export interface PartDeviation {
  part_code: AnatomicalPart;
  customer_share_pct: number;
  carcass_share_pct: number;
  deviation_pct: number;
  deviation_category: DeviationCategory;
}

/**
 * Deviation categories - DESCRIPTIVE ONLY, no judgment
 */
export type DeviationCategory =
  | 'OVER_UPTAKE_HIGH'    // >10% above carcass proportion
  | 'OVER_UPTAKE_MODERATE' // 5-10% above
  | 'BALANCED'             // within ±5%
  | 'UNDER_UPTAKE_MODERATE' // 5-10% below
  | 'UNDER_UPTAKE_HIGH';   // >10% below

/**
 * Full alignment result for a customer
 */
export interface AlignmentResult {
  customer_id: string;
  alignment_score: number; // 0-100, higher = more aligned
  avg_abs_deviation_pct: number;
  max_deviation_pct: number;
  parts_analyzed: number;
  part_deviations: PartDeviation[];
  explanation: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * JA757 carcass reference (LOCKED - from KPI_DEFINITIONS.md)
 * Midpoints calculated from target ranges
 */
export const JA757_CARCASS_REFERENCE: CarcassReference[] = [
  { part_code: 'breast_cap', carcass_share_pct: 35.85, min_pct: 34.8, max_pct: 36.9 },
  { part_code: 'leg_quarter', carcass_share_pct: 43.40, min_pct: 42.0, max_pct: 44.8 },
  { part_code: 'wings', carcass_share_pct: 10.70, min_pct: 10.6, max_pct: 10.8 },
  { part_code: 'back_carcass', carcass_share_pct: 7.60, min_pct: 7.0, max_pct: 8.2 },
  { part_code: 'offal', carcass_share_pct: 4.00, min_pct: 3.0, max_pct: 5.0 },
];

/**
 * Deviation thresholds (configurable)
 */
export interface DeviationThresholds {
  moderate_pct: number;
  high_pct: number;
}

export const DEFAULT_DEVIATION_THRESHOLDS: DeviationThresholds = {
  moderate_pct: 5,
  high_pct: 10,
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get carcass share for a specific part
 */
export function getCarcassShare(part_code: AnatomicalPart): number {
  const ref = JA757_CARCASS_REFERENCE.find(r => r.part_code === part_code);
  return ref?.carcass_share_pct ?? 0;
}

/**
 * Calculate deviation from carcass proportion
 * Positive = over-uptake (buying more than carcass proportion)
 * Negative = under-uptake (buying less than carcass proportion)
 */
export function calculateDeviation(
  customer_share_pct: number,
  carcass_share_pct: number
): number {
  return Math.round((customer_share_pct - carcass_share_pct) * 100) / 100;
}

/**
 * Categorize deviation - DESCRIPTIVE ONLY
 */
export function categorizeDeviation(
  deviation_pct: number,
  thresholds: DeviationThresholds = DEFAULT_DEVIATION_THRESHOLDS
): DeviationCategory {
  if (deviation_pct > thresholds.high_pct) return 'OVER_UPTAKE_HIGH';
  if (deviation_pct > thresholds.moderate_pct) return 'OVER_UPTAKE_MODERATE';
  if (deviation_pct < -thresholds.high_pct) return 'UNDER_UPTAKE_HIGH';
  if (deviation_pct < -thresholds.moderate_pct) return 'UNDER_UPTAKE_MODERATE';
  return 'BALANCED';
}

/**
 * Calculate alignment score from average absolute deviation
 * Score 100 = perfect alignment (0% avg deviation)
 * Score 0 = maximum deviation (25%+ avg deviation)
 */
export function calculateAlignmentScore(avg_abs_deviation_pct: number): number {
  // 4 points per 1% deviation, max 100 points
  const score = 100 - (avg_abs_deviation_pct * 4);
  return Math.max(0, Math.round(score * 10) / 10);
}

/**
 * Calculate full alignment result for a customer
 */
export function calculateCustomerAlignment(
  customer_id: string,
  intake_items: CustomerIntakeItem[],
  thresholds: DeviationThresholds = DEFAULT_DEVIATION_THRESHOLDS
): AlignmentResult {
  // Filter to this customer's items
  const customerItems = intake_items.filter(i => i.customer_id === customer_id);

  if (customerItems.length === 0) {
    return {
      customer_id,
      alignment_score: 0,
      avg_abs_deviation_pct: 0,
      max_deviation_pct: 0,
      parts_analyzed: 0,
      part_deviations: [],
      explanation: 'Geen verkoopdata beschikbaar voor deze klant.',
    };
  }

  // Calculate deviation per part
  const part_deviations: PartDeviation[] = customerItems.map(item => {
    const carcass_share_pct = getCarcassShare(item.part_code);
    const deviation_pct = calculateDeviation(item.share_of_total_pct, carcass_share_pct);

    return {
      part_code: item.part_code,
      customer_share_pct: item.share_of_total_pct,
      carcass_share_pct,
      deviation_pct,
      deviation_category: categorizeDeviation(deviation_pct, thresholds),
    };
  });

  // Calculate aggregate metrics
  const abs_deviations = part_deviations.map(d => Math.abs(d.deviation_pct));
  const avg_abs_deviation_pct = abs_deviations.reduce((a, b) => a + b, 0) / abs_deviations.length;
  const max_deviation_pct = Math.max(...abs_deviations);
  const alignment_score = calculateAlignmentScore(avg_abs_deviation_pct);

  // Generate explanation
  const explanation = generateAlignmentExplanation(alignment_score, part_deviations);

  return {
    customer_id,
    alignment_score,
    avg_abs_deviation_pct: Math.round(avg_abs_deviation_pct * 100) / 100,
    max_deviation_pct: Math.round(max_deviation_pct * 100) / 100,
    parts_analyzed: part_deviations.length,
    part_deviations,
    explanation,
  };
}

/**
 * Calculate alignment for multiple customers
 */
export function calculateAllAlignments(
  intake_items: CustomerIntakeItem[],
  thresholds: DeviationThresholds = DEFAULT_DEVIATION_THRESHOLDS
): AlignmentResult[] {
  // Get unique customer IDs
  const customer_ids = [...new Set(intake_items.map(i => i.customer_id))];

  // Calculate alignment for each
  return customer_ids.map(customer_id =>
    calculateCustomerAlignment(customer_id, intake_items, thresholds)
  );
}

// ============================================================================
// EXPLANATION GENERATION (Dutch per contract)
// ============================================================================

/**
 * Generate Dutch explanation for alignment result
 * ANALYTICAL ONLY - no advice, no blame
 */
export function generateAlignmentExplanation(
  alignment_score: number,
  part_deviations: PartDeviation[]
): string {
  // Find significant deviations
  const overUptake = part_deviations.filter(d =>
    d.deviation_category === 'OVER_UPTAKE_HIGH' ||
    d.deviation_category === 'OVER_UPTAKE_MODERATE'
  );
  const underUptake = part_deviations.filter(d =>
    d.deviation_category === 'UNDER_UPTAKE_HIGH' ||
    d.deviation_category === 'UNDER_UPTAKE_MODERATE'
  );

  const parts: string[] = [];

  if (alignment_score >= 80) {
    parts.push('Afnameprofiel ligt dicht bij karkasbalans.');
  } else if (alignment_score >= 50) {
    parts.push('Afnameprofiel wijkt gedeeltelijk af van karkasbalans.');
  } else {
    parts.push('Afnameprofiel wijkt significant af van karkasbalans.');
  }

  if (overUptake.length > 0) {
    const partNames = overUptake.map(d => getPartNameDutch(d.part_code)).join(', ');
    parts.push(`Meer afname dan karkasratio: ${partNames}.`);
  }

  if (underUptake.length > 0) {
    const partNames = underUptake.map(d => getPartNameDutch(d.part_code)).join(', ');
    parts.push(`Minder afname dan karkasratio: ${partNames}.`);
  }

  return parts.join(' ');
}

/**
 * Get Dutch part name for display
 */
export function getPartNameDutch(part_code: AnatomicalPart): string {
  const names: Record<AnatomicalPart, string> = {
    breast_cap: 'Filet',
    leg_quarter: 'Poot',
    wings: 'Vleugels',
    back_carcass: 'Rug/karkas',
    offal: 'Organen',
  };
  return names[part_code] || part_code;
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get color class for alignment score
 */
export function getAlignmentColorClass(alignment_score: number): string {
  if (alignment_score >= 80) return 'text-green-600 bg-green-50';
  if (alignment_score >= 50) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

/**
 * Get color class for deviation category
 */
export function getDeviationColorClass(category: DeviationCategory): string {
  switch (category) {
    case 'OVER_UPTAKE_HIGH':
      return 'text-blue-700 bg-blue-50';
    case 'OVER_UPTAKE_MODERATE':
      return 'text-blue-500 bg-blue-50';
    case 'UNDER_UPTAKE_HIGH':
      return 'text-orange-700 bg-orange-50';
    case 'UNDER_UPTAKE_MODERATE':
      return 'text-orange-500 bg-orange-50';
    case 'BALANCED':
    default:
      return 'text-green-600 bg-green-50';
  }
}

/**
 * Get Dutch label for deviation category
 */
export function getDeviationLabel(category: DeviationCategory): string {
  switch (category) {
    case 'OVER_UPTAKE_HIGH':
      return 'Sterke over-afname';
    case 'OVER_UPTAKE_MODERATE':
      return 'Matige over-afname';
    case 'UNDER_UPTAKE_HIGH':
      return 'Sterke onder-afname';
    case 'UNDER_UPTAKE_MODERATE':
      return 'Matige onder-afname';
    case 'BALANCED':
    default:
      return 'Gebalanceerd';
  }
}

/**
 * Format deviation percentage with sign
 */
export function formatDeviation(deviation_pct: number): string {
  const sign = deviation_pct >= 0 ? '+' : '';
  return `${sign}${deviation_pct.toFixed(1)}%`;
}
