import { describe, it, expect } from 'vitest';
import { distributeByBirds } from '../distributeByBirds';
import type { LocationYieldProfile } from '@/lib/engine/availability/cascading';

const profiles: LocationYieldProfile[] = [
  { product_id: 'borstkap', product_description: 'Borstkap', yield_percentage: 0.235 },
  { product_id: 'zadel', product_description: 'Zadel', yield_percentage: 0.280 },
  { product_id: 'vleugel', product_description: 'Vleugels', yield_percentage: 0.107 },
];

describe('distributeByBirds', () => {
  it('1000_birds_correct_distribution', () => {
    const result = distributeByBirds({
      bird_count: 1000,
      avg_weight_kg: 2.65,
      griller_yield_pct: 0.704,
      yield_profiles: profiles,
    });

    // griller_kg = 1000 * 2.65 * 0.704 = 1865.6
    expect(result.bird_count).toBe(1000);
    expect(result.griller_kg).toBe(1865.6);

    // borstkap: 1865.6 * 0.235 = 438.416 → 438.42
    expect(result.lines[0].product_id).toBe('borstkap');
    expect(result.lines[0].quantity_kg).toBe(438.42);

    // zadel: 1865.6 * 0.280 = 522.368 → 522.37
    expect(result.lines[1].product_id).toBe('zadel');
    expect(result.lines[1].quantity_kg).toBe(522.37);

    // vleugel: 1865.6 * 0.107 = 199.6192 → 199.62
    expect(result.lines[2].product_id).toBe('vleugel');
    expect(result.lines[2].quantity_kg).toBe(199.62);

    expect(result.total_kg).toBe(1160.41);
  });

  it('zero_birds_empty', () => {
    const result = distributeByBirds({
      bird_count: 0,
      avg_weight_kg: 2.65,
      griller_yield_pct: 0.704,
      yield_profiles: profiles,
    });

    expect(result.bird_count).toBe(0);
    expect(result.griller_kg).toBe(0);
    expect(result.lines).toEqual([]);
    expect(result.total_kg).toBe(0);
  });

  it('fractional_birds_handled', () => {
    const result = distributeByBirds({
      bird_count: 1.5,
      avg_weight_kg: 2.65,
      griller_yield_pct: 0.704,
      yield_profiles: profiles,
    });

    // griller_kg = 1.5 * 2.65 * 0.704 = 2.7984 → 2.8
    expect(result.bird_count).toBe(1.5);
    expect(result.griller_kg).toBe(2.8);
    expect(result.lines).toHaveLength(3);
    // Should not crash, all quantities should be valid numbers
    for (const line of result.lines) {
      expect(line.quantity_kg).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(line.quantity_kg)).toBe(true);
    }
  });

  it('custom_yield_profiles', () => {
    const customProfiles: LocationYieldProfile[] = [
      { product_id: 'drumstick', product_description: 'Drumstick', yield_percentage: 0.15 },
      { product_id: 'thigh', product_description: 'Thigh', yield_percentage: 0.20 },
    ];

    const result = distributeByBirds({
      bird_count: 500,
      avg_weight_kg: 3.0,
      griller_yield_pct: 0.70,
      yield_profiles: customProfiles,
    });

    // griller_kg = 500 * 3.0 * 0.70 = 1050
    expect(result.griller_kg).toBe(1050);

    // drumstick: 1050 * 0.15 = 157.5
    expect(result.lines[0].product_id).toBe('drumstick');
    expect(result.lines[0].quantity_kg).toBe(157.5);

    // thigh: 1050 * 0.20 = 210
    expect(result.lines[1].product_id).toBe('thigh');
    expect(result.lines[1].quantity_kg).toBe(210);

    expect(result.total_kg).toBe(367.5);
  });

  it('rounding_consistency', () => {
    const result = distributeByBirds({
      bird_count: 1000,
      avg_weight_kg: 2.65,
      griller_yield_pct: 0.704,
      yield_profiles: profiles,
    });

    // total_kg should equal sum of line quantities (both rounded to 2 decimals)
    const sumOfLines = result.lines.reduce((sum, l) => sum + l.quantity_kg, 0);
    const roundedSum = Math.round(sumOfLines * 100) / 100;

    expect(result.total_kg).toBe(roundedSum);

    // Each line should be rounded to at most 2 decimal places
    for (const line of result.lines) {
      const rounded = Math.round(line.quantity_kg * 100) / 100;
      expect(line.quantity_kg).toBe(rounded);
    }
  });
});
