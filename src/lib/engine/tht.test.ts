/**
 * Unit Tests voor THT Status Engine
 *
 * Blueprint Spec (DEFINITIEF):
 * - Green: < 70% verstreken
 * - Orange: 70-90% verstreken
 * - Red: > 90% verstreken
 */

import { describe, it, expect } from 'vitest';
import { calculateThtStatus, type ThtCalculation } from './tht';

describe('calculateThtStatus', () => {
  // Basis test data: 30 dagen houdbaarheid
  const productionDate = new Date('2026-01-15');
  const expiryDate = new Date('2026-02-14'); // 30 dagen later

  it('moet GREEN status geven bij < 70% verstreken (Blueprint)', () => {
    // 10 dagen verstreken = 33.3%
    const checkDate = new Date('2026-01-25');

    const result = calculateThtStatus(productionDate, expiryDate, checkDate);

    expect(result.status).toBe('green');
    expect(result.elapsed_pct).toBeCloseTo(33.3, 0);
    expect(result.elapsed_pct).toBeLessThan(70);
    expect(result.is_expired).toBe(false);
  });

  it('moet ORANGE status geven bij 70-90% verstreken (Blueprint)', () => {
    // 24 dagen verstreken = 80%
    const checkDate = new Date('2026-02-08');

    const result = calculateThtStatus(productionDate, expiryDate, checkDate);

    expect(result.status).toBe('orange');
    expect(result.elapsed_pct).toBeGreaterThanOrEqual(70);
    expect(result.elapsed_pct).toBeLessThan(90);
    expect(result.is_expired).toBe(false);
  });

  it('moet RED status geven bij > 90% verstreken (Blueprint)', () => {
    // 28 dagen verstreken = 93.3%
    const checkDate = new Date('2026-02-12');

    const result = calculateThtStatus(productionDate, expiryDate, checkDate);

    expect(result.status).toBe('red');
    expect(result.elapsed_pct).toBeGreaterThanOrEqual(90);
    expect(result.is_expired).toBe(false);
  });

  it('moet RED status en is_expired geven na expiry date', () => {
    // 2 dagen na expiry
    const checkDate = new Date('2026-02-16');

    const result = calculateThtStatus(productionDate, expiryDate, checkDate);

    expect(result.status).toBe('red');
    expect(result.is_expired).toBe(true);
    expect(result.days_remaining).toBe(0);
    expect(result.urgency_label).toContain('VERLOPEN');
  });

  // Blueprint Acceptance Tests: exacte percentages
  describe('Blueprint Acceptance Tests (70/90 thresholds)', () => {
    it('60% verstreken = GREEN (under 70% threshold)', () => {
      // 18 dagen van 30 = 60%
      const checkDate = new Date('2026-02-02');

      const result = calculateThtStatus(productionDate, expiryDate, checkDate);

      expect(result.status).toBe('green');
      expect(result.elapsed_pct).toBeCloseTo(60, 0);
    });

    it('70% verstreken = ORANGE (at threshold)', () => {
      // 21 dagen van 30 = 70%
      const checkDate = new Date('2026-02-05');

      const result = calculateThtStatus(productionDate, expiryDate, checkDate);

      expect(result.status).toBe('orange');
      expect(result.elapsed_pct).toBeCloseTo(70, 0);
    });

    it('80% verstreken = ORANGE (within 70-90 range)', () => {
      // 24 dagen van 30 = 80%
      const checkDate = new Date('2026-02-08');

      const result = calculateThtStatus(productionDate, expiryDate, checkDate);

      expect(result.status).toBe('orange');
      expect(result.elapsed_pct).toBeCloseTo(80, 0);
    });

    it('90% verstreken = RED (at threshold)', () => {
      // 27 dagen van 30 = 90%
      const checkDate = new Date('2026-02-11');

      const result = calculateThtStatus(productionDate, expiryDate, checkDate);

      expect(result.status).toBe('red');
      expect(result.elapsed_pct).toBeCloseTo(90, 0);
    });

    it('95% verstreken = RED (urgent)', () => {
      // 28.5 dagen van 30 = 95%
      const checkDate = new Date('2026-02-12');

      const result = calculateThtStatus(productionDate, expiryDate, checkDate);

      expect(result.status).toBe('red');
      expect(result.urgency_label).toContain('URGENT');
    });
  });

  it('moet string dates accepteren', () => {
    const result = calculateThtStatus(
      '2026-01-15',
      '2026-02-14',
      '2026-01-25'
    );

    expect(result.status).toBe('green');
    expect(result.days_remaining).toBe(20);
  });

  it('moet correcte days_remaining berekenen', () => {
    const result = calculateThtStatus(
      new Date('2026-01-15'),
      new Date('2026-02-14'),
      new Date('2026-01-25')
    );

    expect(result.days_remaining).toBe(20);
    expect(result.days_elapsed).toBe(10);
    expect(result.total_days).toBe(30);
  });

  it('moet custom thresholds respecteren', () => {
    // Met custom thresholds: orange bij 50%, red bij 80%
    const result = calculateThtStatus(
      productionDate,
      expiryDate,
      new Date('2026-02-02'), // 18 dagen = 60%
      { orange_pct: 50, red_pct: 80 }
    );

    expect(result.status).toBe('orange');
  });

  it('moet default Blueprint thresholds (70/90) gebruiken', () => {
    // Verify default thresholds match Blueprint spec
    // At 75% elapsed, should be orange (between 70-90)
    const result = calculateThtStatus(
      productionDate,
      expiryDate,
      new Date('2026-02-06') // ~73% elapsed
    );

    expect(result.status).toBe('orange');
  });

  it('moet edge case 0 dagen houdbaarheid afhandelen', () => {
    const result = calculateThtStatus(
      new Date('2026-01-15'),
      new Date('2026-01-15'), // Zelfde dag
      new Date('2026-01-15')
    );

    expect(result.status).toBe('red');
    expect(result.total_days).toBe(0);
  });
});
