/**
 * Planning Simulator Engine
 *
 * Pure function — no database access, no async, no side effects.
 *
 * Wraps the existing computeCascadedAvailability() with whole-bird-pull logic:
 *   1. Start with total birds & live weight → compute initial griller_kg
 *   2. Subtract whole-bird pulls (e.g., hele hoenen 1300-1600, 1700-1800)
 *   3. Recalculate average weight of remaining birds (lighter birds removed → avg goes up)
 *   4. Compute remaining griller_kg with adjusted average
 *   5. Feed into cascade engine for final product availability
 *
 * Key insight from Excel bestelschema:
 *   When lighter whole birds are pulled before cutting, the average weight
 *   of the remaining birds INCREASES → more kg per product part.
 */

import {
  computeCascadedAvailability,
  type CascadedAvailability,
  type LocationYieldProfile,
  type ProductYieldChain,
} from './cascading';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WholeBirdPull {
  /** Display label, e.g. "1300-1600" */
  label: string;
  /** Number of whole birds to pull out */
  count: number;
  /** Average griller weight per bird in this class (kg) */
  avg_kg: number;
}

export interface SimulatorInput {
  /** Total number of birds for this slaughter */
  total_birds: number;
  /** Total live weight in kg */
  total_live_weight_kg: number;
  /** Griller yield percentage (default 0.704 = 70.4%) */
  griller_yield_pct: number;
  /** Whole-bird pulls by weight class */
  whole_bird_pulls: WholeBirdPull[];
  /** Putten yield profiles */
  yield_profiles: LocationYieldProfile[];
  /** Nijkerk yield chains */
  yield_chains: ProductYieldChain[];
}

export interface WholeBirdPullResult {
  label: string;
  count: number;
  avg_kg: number;
  total_kg: number;
}

export interface SimulatedAvailability {
  /** Original inputs echoed back for display */
  input_birds: number;
  input_live_weight_kg: number;
  avg_live_weight_kg: number;
  griller_yield_pct: number;

  /** Initial griller kg before any pulls */
  original_griller_kg: number;

  /** Whole bird pull breakdown */
  whole_bird_pulls: WholeBirdPullResult[];
  total_whole_birds_pulled: number;
  total_whole_bird_kg: number;

  /** Adjusted values after pulls */
  remaining_birds: number;
  remaining_live_weight_kg: number;
  adjusted_avg_live_weight_kg: number;
  adjusted_avg_griller_weight_kg: number;
  remaining_griller_kg: number;

  /** Full cascaded availability from the remaining griller kg */
  cascaded: CascadedAvailability;
}

// ---------------------------------------------------------------------------
// Default whole-bird weight classes (from Storteboom bestelschema)
// ---------------------------------------------------------------------------

export const DEFAULT_WHOLE_BIRD_CLASSES: { label: string; avg_kg: number }[] = [
  { label: '1300-1600', avg_kg: 1.45 },
  { label: '1700-1800', avg_kg: 1.75 },
  { label: '1800-2100', avg_kg: 1.95 },
  { label: 'MAP', avg_kg: 1.80 },
];

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export function computeSimulatedAvailability(
  input: SimulatorInput
): SimulatedAvailability {
  const {
    total_birds,
    total_live_weight_kg,
    griller_yield_pct,
    whole_bird_pulls,
    yield_profiles,
    yield_chains,
  } = input;

  // Guard: no birds or no weight
  if (total_birds <= 0 || total_live_weight_kg <= 0) {
    return createEmptyResult(input, yield_profiles, yield_chains);
  }

  // Step 1: Compute initial values
  const avg_live_weight_kg = total_live_weight_kg / total_birds;
  const avg_griller_weight_kg = avg_live_weight_kg * griller_yield_pct;
  const original_griller_kg = total_birds * avg_griller_weight_kg;

  // Step 2: Process whole-bird pulls
  // Each pull removes `count` birds from the griller pool.
  // The pulled birds have a GRILLER weight of avg_kg (already converted, not live weight).
  let remaining_birds = total_birds;
  let remaining_griller_kg = original_griller_kg;

  const pullResults: WholeBirdPullResult[] = [];

  for (const pull of whole_bird_pulls) {
    if (pull.count <= 0) {
      pullResults.push({
        label: pull.label,
        count: 0,
        avg_kg: pull.avg_kg,
        total_kg: 0,
      });
      continue;
    }

    // Can't pull more than remaining birds
    const effectiveCount = Math.min(pull.count, remaining_birds);
    const pull_total_kg = effectiveCount * pull.avg_kg;

    // Can't pull more kg than remaining
    const effective_kg = Math.min(pull_total_kg, remaining_griller_kg);

    pullResults.push({
      label: pull.label,
      count: effectiveCount,
      avg_kg: pull.avg_kg,
      total_kg: effective_kg,
    });

    remaining_birds -= effectiveCount;
    remaining_griller_kg -= effective_kg;
  }

  const total_whole_birds_pulled = pullResults.reduce((s, p) => s + p.count, 0);
  const total_whole_bird_kg = pullResults.reduce((s, p) => s + p.total_kg, 0);

  // Step 3: Compute adjusted average weight of remaining birds
  // remaining_griller_kg / remaining_birds = new avg griller weight
  let adjusted_avg_griller_weight_kg = 0;
  let adjusted_avg_live_weight_kg = 0;
  let remaining_live_weight_kg = 0;

  if (remaining_birds > 0 && remaining_griller_kg > 0) {
    adjusted_avg_griller_weight_kg = remaining_griller_kg / remaining_birds;
    // Back-calculate adjusted live weight from griller weight
    adjusted_avg_live_weight_kg =
      griller_yield_pct > 0
        ? adjusted_avg_griller_weight_kg / griller_yield_pct
        : 0;
    remaining_live_weight_kg = remaining_birds * adjusted_avg_live_weight_kg;
  }

  // Step 4: Feed remaining griller kg into cascade engine
  // No existing orders in simulation mode — we're planning from scratch
  const cascaded = computeCascadedAvailability({
    griller_kg: remaining_griller_kg,
    yield_profiles,
    yield_chains,
    existing_orders_primary: [],
    existing_orders_secondary: [],
  });

  return {
    input_birds: total_birds,
    input_live_weight_kg: total_live_weight_kg,
    avg_live_weight_kg,
    griller_yield_pct,
    original_griller_kg,
    whole_bird_pulls: pullResults,
    total_whole_birds_pulled,
    total_whole_bird_kg,
    remaining_birds,
    remaining_live_weight_kg,
    adjusted_avg_live_weight_kg,
    adjusted_avg_griller_weight_kg,
    remaining_griller_kg,
    cascaded,
  };
}

// ---------------------------------------------------------------------------
// Helper: empty result for edge cases
// ---------------------------------------------------------------------------

function createEmptyResult(
  input: SimulatorInput,
  yield_profiles: LocationYieldProfile[],
  yield_chains: ProductYieldChain[]
): SimulatedAvailability {
  return {
    input_birds: input.total_birds,
    input_live_weight_kg: input.total_live_weight_kg,
    avg_live_weight_kg: 0,
    griller_yield_pct: input.griller_yield_pct,
    original_griller_kg: 0,
    whole_bird_pulls: [],
    total_whole_birds_pulled: 0,
    total_whole_bird_kg: 0,
    remaining_birds: 0,
    remaining_live_weight_kg: 0,
    adjusted_avg_live_weight_kg: 0,
    adjusted_avg_griller_weight_kg: 0,
    remaining_griller_kg: 0,
    cascaded: computeCascadedAvailability({
      griller_kg: 0,
      yield_profiles,
      yield_chains,
      existing_orders_primary: [],
      existing_orders_secondary: [],
    }),
  };
}
