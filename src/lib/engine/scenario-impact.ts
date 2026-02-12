/**
 * Sprint 4: Scenario Impact Engine
 *
 * Calculates projected impact of price elasticity scenarios.
 * CRITICAL: All scenarios are ASSUMPTIONS, explicitly labeled as non-binding.
 *
 * Key concepts:
 * - Scenarios are what-if analyses, NOT predictions
 * - Elasticity assumptions must be sourced and documented
 * - No optimization, no recommendations, no actions
 * - All outputs must include disclaimer
 */

import type { AnatomicalPart } from '@/types/database';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Elasticity assumption for a scenario/part combination
 */
export interface ElasticityAssumption {
  scenario_id: string;
  scenario_name: string;
  scenario_description?: string;
  part_code: AnatomicalPart;
  price_change_pct: number;
  expected_volume_change_pct: number;
  assumption_source: AssumptionSource;
  assumption_note?: string;
}

/**
 * Source of elasticity assumption - for transparency
 */
export type AssumptionSource = 'manual' | 'historical' | 'market_research' | 'expert_estimate';

/**
 * Current baseline data for a part
 */
export interface PartBaseline {
  part_code: AnatomicalPart;
  current_daily_kg: number;
  current_30d_kg: number;
}

/**
 * Scenario impact projection for a single part
 * CRITICAL: This is a PROJECTION based on ASSUMPTIONS
 */
export interface PartImpactProjection {
  scenario_id: string;
  scenario_name: string;
  part_code: AnatomicalPart;

  // Price assumption
  price_change_pct: number;

  // Volume projection
  expected_volume_change_pct: number;
  current_daily_kg: number;
  projected_daily_kg: number;
  volume_change_daily_kg: number;
  projected_30d_kg: number;

  // Balance effect
  balance_effect: BalanceEffect;

  // Transparency (CRITICAL)
  assumption_source: AssumptionSource;
  assumption_note?: string;
  disclaimer: string;
}

/**
 * Effect on carcass balance
 */
export type BalanceEffect = 'NO_BASELINE' | 'NEUTRAL' | 'CHANGES_BALANCE';

/**
 * Full scenario impact result
 */
export interface ScenarioImpactResult {
  scenario_id: string;
  scenario_name: string;
  scenario_description?: string;
  part_projections: PartImpactProjection[];
  total_volume_change_30d_kg: number;
  parts_affected: number;
  disclaimer: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Standard disclaimer for all scenario projections
 * MUST be displayed in any UI showing scenario data
 */
export const SCENARIO_DISCLAIMER =
  'Dit is een projectie gebaseerd op aannames. Dit is GEEN voorspelling of aanbeveling. Gebruik alleen ter illustratie.';

/**
 * Standard disclaimer in English
 */
export const SCENARIO_DISCLAIMER_EN =
  'This projection is based on assumptions and is NOT a prediction or recommendation. For illustration purposes only.';

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calculate projected volume change
 */
export function calculateVolumeChange(
  current_kg: number,
  volume_change_pct: number
): number {
  return Math.round(current_kg * (volume_change_pct / 100) * 100) / 100;
}

/**
 * Calculate projected volume
 */
export function calculateProjectedVolume(
  current_kg: number,
  volume_change_pct: number
): number {
  return Math.round(current_kg * (1 + volume_change_pct / 100) * 100) / 100;
}

/**
 * Determine balance effect
 */
export function determineBalanceEffect(
  current_daily_kg: number | null | undefined,
  volume_change_daily_kg: number
): BalanceEffect {
  if (current_daily_kg === null || current_daily_kg === undefined || current_daily_kg === 0) {
    return 'NO_BASELINE';
  }
  if (Math.abs(volume_change_daily_kg) < 0.01) {
    return 'NEUTRAL';
  }
  return 'CHANGES_BALANCE';
}

/**
 * Calculate impact projection for a single part
 */
export function calculatePartImpact(
  assumption: ElasticityAssumption,
  baseline: PartBaseline | undefined
): PartImpactProjection {
  const current_daily_kg = baseline?.current_daily_kg ?? 0;
  const current_30d_kg = baseline?.current_30d_kg ?? 0;

  const volume_change_daily_kg = calculateVolumeChange(
    current_daily_kg,
    assumption.expected_volume_change_pct
  );
  const projected_daily_kg = calculateProjectedVolume(
    current_daily_kg,
    assumption.expected_volume_change_pct
  );
  const projected_30d_kg = calculateProjectedVolume(
    current_30d_kg,
    assumption.expected_volume_change_pct
  );

  return {
    scenario_id: assumption.scenario_id,
    scenario_name: assumption.scenario_name,
    part_code: assumption.part_code,
    price_change_pct: assumption.price_change_pct,
    expected_volume_change_pct: assumption.expected_volume_change_pct,
    current_daily_kg,
    projected_daily_kg,
    volume_change_daily_kg,
    projected_30d_kg,
    balance_effect: determineBalanceEffect(current_daily_kg, volume_change_daily_kg),
    assumption_source: assumption.assumption_source,
    assumption_note: assumption.assumption_note,
    disclaimer: SCENARIO_DISCLAIMER,
  };
}

/**
 * Calculate full scenario impact
 */
export function calculateScenarioImpact(
  scenario_id: string,
  assumptions: ElasticityAssumption[],
  baselines: PartBaseline[]
): ScenarioImpactResult {
  // Filter assumptions for this scenario
  const scenarioAssumptions = assumptions.filter(a => a.scenario_id === scenario_id);

  if (scenarioAssumptions.length === 0) {
    return {
      scenario_id,
      scenario_name: 'Onbekend scenario',
      part_projections: [],
      total_volume_change_30d_kg: 0,
      parts_affected: 0,
      disclaimer: SCENARIO_DISCLAIMER,
    };
  }

  // Get scenario metadata from first assumption
  const first = scenarioAssumptions[0];

  // Create baseline lookup
  const baselineMap = new Map(baselines.map(b => [b.part_code, b]));

  // Calculate projections for each part
  const part_projections = scenarioAssumptions.map(assumption =>
    calculatePartImpact(assumption, baselineMap.get(assumption.part_code))
  );

  // Calculate totals
  const total_volume_change_30d_kg = part_projections.reduce(
    (sum, p) => sum + (p.projected_30d_kg - (baselineMap.get(p.part_code)?.current_30d_kg ?? 0)),
    0
  );

  return {
    scenario_id,
    scenario_name: first.scenario_name,
    scenario_description: first.scenario_description,
    part_projections,
    total_volume_change_30d_kg: Math.round(total_volume_change_30d_kg * 100) / 100,
    parts_affected: part_projections.filter(p => p.balance_effect === 'CHANGES_BALANCE').length,
    disclaimer: SCENARIO_DISCLAIMER,
  };
}

/**
 * Calculate impact for multiple scenarios
 */
export function calculateAllScenarioImpacts(
  assumptions: ElasticityAssumption[],
  baselines: PartBaseline[]
): ScenarioImpactResult[] {
  // Get unique scenario IDs
  const scenario_ids = [...new Set(assumptions.map(a => a.scenario_id))];

  // Calculate impact for each
  return scenario_ids.map(scenario_id =>
    calculateScenarioImpact(scenario_id, assumptions, baselines)
  );
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get color class for volume change
 */
export function getVolumeChangeColorClass(volume_change_pct: number): string {
  if (volume_change_pct > 0) return 'text-green-600';
  if (volume_change_pct < 0) return 'text-red-600';
  return 'text-gray-500';
}

/**
 * Get color class for price change
 */
export function getPriceChangeColorClass(price_change_pct: number): string {
  if (price_change_pct > 0) return 'text-blue-600';
  if (price_change_pct < 0) return 'text-orange-600';
  return 'text-gray-500';
}

/**
 * Format percentage with sign
 */
export function formatPercentageWithSign(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Get Dutch label for assumption source
 */
export function getAssumptionSourceLabel(source: AssumptionSource): string {
  switch (source) {
    case 'manual':
      return 'Handmatig ingevoerd';
    case 'historical':
      return 'Historische data';
    case 'market_research':
      return 'Marktonderzoek';
    case 'expert_estimate':
      return 'Expert inschatting';
    default:
      return source;
  }
}

/**
 * Get color class for assumption source
 */
export function getAssumptionSourceColorClass(source: AssumptionSource): string {
  switch (source) {
    case 'historical':
      return 'text-blue-600 bg-blue-50';
    case 'market_research':
      return 'text-purple-600 bg-purple-50';
    case 'expert_estimate':
      return 'text-green-600 bg-green-50';
    case 'manual':
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * Get Dutch label for balance effect
 */
export function getBalanceEffectLabel(effect: BalanceEffect): string {
  switch (effect) {
    case 'NO_BASELINE':
      return 'Geen baseline data';
    case 'NEUTRAL':
      return 'Neutraal';
    case 'CHANGES_BALANCE':
      return 'Beïnvloedt balans';
    default:
      return effect;
  }
}
