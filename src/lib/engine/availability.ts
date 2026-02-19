/**
 * Theoretical availability calculation — Phase 1 (JA757 reference yields)
 *
 * REGRESSIE-CHECK:
 * - Pure function, no DB access
 * - Hardcoded JA757 theoretical yields (temporary Phase 1)
 * - Does NOT modify any existing engine files
 */

// JA757 theoretical yield percentages (of live weight)
// Source: Hubbard JA757 breed standard reference
export const JA757_YIELDS: Record<string, { name: string; yield_pct: number }> = {
  'griller': { name: 'Griller (heel)', yield_pct: 0.707 },
  'breast_fillet': { name: 'Borstfilet', yield_pct: 0.232 },
  'leg_quarter': { name: 'Bout', yield_pct: 0.282 },
  'wing': { name: 'Vleugel', yield_pct: 0.076 },
  'back': { name: 'Rug', yield_pct: 0.117 },
};

export interface TheoreticalAvailability {
  part: string;
  name: string;
  yield_pct: number;
  expected_kg: number;
}

export function computeTheoreticalAvailability(
  expectedLiveWeightKg: number
): TheoreticalAvailability[] {
  if (expectedLiveWeightKg <= 0) {
    return Object.entries(JA757_YIELDS).map(([part, config]) => ({
      part,
      name: config.name,
      yield_pct: config.yield_pct,
      expected_kg: 0,
    }));
  }

  return Object.entries(JA757_YIELDS).map(([part, config]) => ({
    part,
    name: config.name,
    yield_pct: config.yield_pct,
    expected_kg: Math.round(expectedLiveWeightKg * config.yield_pct * 100) / 100,
  }));
}
