/**
 * Tests for weight distribution parser & statistics
 */

import { describe, it, expect } from 'vitest';
import {
  parseWeightDistribution,
  validateWeightDistribution,
  calculateDistributionStats,
  SEED_DISTRIBUTIONS,
} from './weight-distribution-parser';

describe('parseWeightDistribution', () => {
  it('calculates total count correctly', () => {
    const dist = parseWeightDistribution({
      flock_number: 1,
      weigher_number: 1,
      bins: [
        { lower_g: 1500, count: 10 },
        { lower_g: 1550, count: 20 },
        { lower_g: 1600, count: 30 },
      ],
    });

    expect(dist.total_count).toBe(60);
  });

  it('calculates percentages correctly', () => {
    const dist = parseWeightDistribution({
      flock_number: 1,
      weigher_number: 1,
      bins: [
        { lower_g: 1500, count: 25 },
        { lower_g: 1550, count: 50 },
        { lower_g: 1600, count: 25 },
      ],
    });

    expect(dist.bins[0].pct).toBe(25);
    expect(dist.bins[1].pct).toBe(50);
    expect(dist.bins[2].pct).toBe(25);
  });

  it('sets upper_g correctly (50g bins)', () => {
    const dist = parseWeightDistribution({
      flock_number: 1,
      weigher_number: 1,
      bins: [{ lower_g: 1500, count: 10 }],
    });

    expect(dist.bins[0].lower_g).toBe(1500);
    expect(dist.bins[0].upper_g).toBe(1549);
  });

  it('handles empty bins', () => {
    const dist = parseWeightDistribution({
      flock_number: 1,
      weigher_number: 1,
      bins: [],
    });

    expect(dist.total_count).toBe(0);
    expect(dist.bins).toHaveLength(0);
  });

  it('preserves metadata', () => {
    const dist = parseWeightDistribution({
      flock_number: 6,
      flock_location: 'Groenstege 2',
      rapport_number: '2605409',
      weigher_number: 1,
      measured_at: '2026-02-23T14:19:00',
      bins: [{ lower_g: 1500, count: 10 }],
    });

    expect(dist.flock_number).toBe(6);
    expect(dist.flock_location).toBe('Groenstege 2');
    expect(dist.rapport_number).toBe('2605409');
    expect(dist.weigher_number).toBe(1);
    expect(dist.measured_at).toBe('2026-02-23T14:19:00');
  });
});

describe('validateWeightDistribution', () => {
  it('passes valid distribution', () => {
    const dist = parseWeightDistribution({
      flock_number: 6,
      weigher_number: 1,
      bins: [
        { lower_g: 1500, count: 25 },
        { lower_g: 1550, count: 50 },
        { lower_g: 1600, count: 25 },
      ],
    });

    const { errors } = validateWeightDistribution(dist);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid flock number', () => {
    const dist = parseWeightDistribution({
      flock_number: 0,
      weigher_number: 1,
      bins: [{ lower_g: 1500, count: 10 }],
    });

    const { errors } = validateWeightDistribution(dist);
    expect(errors.some(e => e.includes('Koppelnummer'))).toBe(true);
  });

  it('rejects empty distribution', () => {
    const dist = parseWeightDistribution({
      flock_number: 1,
      weigher_number: 1,
      bins: [],
    });

    const { errors } = validateWeightDistribution(dist);
    expect(errors.some(e => e.includes('Totaal aantal'))).toBe(true);
  });
});

describe('calculateDistributionStats', () => {
  it('calculates mean weight', () => {
    const dist = parseWeightDistribution({
      flock_number: 1,
      weigher_number: 1,
      bins: [
        { lower_g: 1500, count: 100 }, // midpoint 1524.5
        { lower_g: 1550, count: 100 }, // midpoint 1574.5
      ],
    });

    const stats = calculateDistributionStats(dist.bins);
    // Mean should be ~1549.5 (midpoint of both bins)
    expect(stats.meanWeight).toBeCloseTo(1550, -1);
    expect(stats.totalCount).toBe(200);
  });

  it('calculates stats for seed data (Groenstege koppel 6)', () => {
    const seedData = SEED_DISTRIBUTIONS[0].distributions[0];
    const dist = parseWeightDistribution(seedData);
    const stats = calculateDistributionStats(dist.bins);

    // From real data: 2,749 total birds, peak around 1700-1800g
    expect(stats.totalCount).toBeGreaterThan(2500);
    expect(stats.meanWeight).toBeGreaterThan(1700);
    expect(stats.meanWeight).toBeLessThan(2200);
    expect(stats.stdDev).toBeGreaterThan(0);
    expect(stats.cv).toBeGreaterThan(0);
  });

  it('calculates stats for seed data (Groenstege koppel 7)', () => {
    const seedData = SEED_DISTRIBUTIONS[0].distributions[1];
    const dist = parseWeightDistribution(seedData);
    const stats = calculateDistributionStats(dist.bins);

    // Koppel 7 is larger, heavier birds
    expect(stats.totalCount).toBeGreaterThan(5000);
    expect(stats.meanWeight).toBeGreaterThan(1800);
    expect(stats.meanWeight).toBeLessThan(2200);
  });

  it('handles empty bins', () => {
    const stats = calculateDistributionStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.meanWeight).toBe(0);
    expect(stats.stdDev).toBe(0);
  });

  it('calculates percentiles', () => {
    const dist = parseWeightDistribution({
      flock_number: 1,
      weigher_number: 1,
      bins: [
        { lower_g: 1000, count: 10 },
        { lower_g: 1500, count: 80 },
        { lower_g: 2000, count: 10 },
      ],
    });

    const stats = calculateDistributionStats(dist.bins);
    // P10 should be around 1500 (most birds are there)
    expect(stats.p10Weight).toBeGreaterThanOrEqual(1000);
    expect(stats.p90Weight).toBeLessThanOrEqual(2100);
    expect(stats.medianWeight).toBeCloseTo(1525, -1); // midpoint of 1500-1549 bin
  });
});
