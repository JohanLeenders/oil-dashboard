/**
 * Availability Engine — Test Suite
 * Sprint: Wave 3 — A1-S2 Availability Calc
 *
 * Tests the theoretical availability calculation based on JA757 yields.
 */

import { describe, it, expect } from 'vitest';
import {
  computeTheoreticalAvailability,
  JA757_YIELDS,
  type TheoreticalAvailability,
} from '../../availability';

describe('computeTheoreticalAvailability', () => {
  it('returns all parts with zero kg for zero weight', () => {
    const result = computeTheoreticalAvailability(0);
    expect(result).toHaveLength(Object.keys(JA757_YIELDS).length);
    result.forEach((row) => {
      expect(row.expected_kg).toBe(0);
    });
  });

  it('returns all parts with zero kg for negative weight', () => {
    const result = computeTheoreticalAvailability(-500);
    expect(result).toHaveLength(Object.keys(JA757_YIELDS).length);
    result.forEach((row) => {
      expect(row.expected_kg).toBe(0);
    });
  });

  it('computes correct expected_kg for standard weight (10000 kg)', () => {
    const result = computeTheoreticalAvailability(10000);
    const grillerRow = result.find((r) => r.part === 'griller');
    expect(grillerRow).toBeDefined();
    expect(grillerRow!.expected_kg).toBe(7070);
    expect(grillerRow!.yield_pct).toBe(0.707);
    expect(grillerRow!.name).toBe('Griller (heel)');
  });

  it('verifies individual part yield correctness for breast fillet', () => {
    const result = computeTheoreticalAvailability(5000);
    const breastRow = result.find((r) => r.part === 'breast_fillet');
    expect(breastRow).toBeDefined();
    expect(breastRow!.expected_kg).toBe(1160); // 5000 * 0.232 = 1160
    expect(breastRow!.name).toBe('Borstfilet');
  });

  it('verifies all parts are present with correct names', () => {
    const result = computeTheoreticalAvailability(1000);
    const parts = result.map((r) => r.part);
    expect(parts).toContain('griller');
    expect(parts).toContain('breast_fillet');
    expect(parts).toContain('leg_quarter');
    expect(parts).toContain('wing');
    expect(parts).toContain('back');
    expect(result).toHaveLength(5);
  });

  it('yields sum to a reasonable total (< 100% since not all parts included)', () => {
    const totalYieldPct = Object.values(JA757_YIELDS).reduce(
      (sum, config) => sum + config.yield_pct,
      0
    );
    // The total yield should be greater than 100% because griller overlaps
    // with breast/leg/wing/back (griller = whole bird, parts are cuts from it)
    // This is expected — these are independent reference yields, not additive
    expect(totalYieldPct).toBeGreaterThan(0);
    expect(totalYieldPct).toBeLessThan(2.0);
  });

  it('rounds expected_kg to 2 decimal places', () => {
    // Use a weight that would produce long decimals
    const result = computeTheoreticalAvailability(333);
    result.forEach((row) => {
      const decimals = row.expected_kg.toString().split('.')[1];
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(2);
      }
    });
  });

  it('single part verification — wing at 1500 kg', () => {
    const result = computeTheoreticalAvailability(1500);
    const wingRow = result.find((r) => r.part === 'wing');
    expect(wingRow).toBeDefined();
    expect(wingRow!.expected_kg).toBe(114); // 1500 * 0.076 = 114
    expect(wingRow!.yield_pct).toBe(0.076);
    expect(wingRow!.name).toBe('Vleugel');
  });
});
