/**
 * Sprint 6: Historical Trends Engine Tests
 *
 * Tests for trend analysis over time.
 * Verifies:
 * - Trend direction calculation
 * - Part trend summarization
 * - Customer trend summarization
 * - Dutch explanation generation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTrendDirection,
  calculateAverage,
  summarizePartTrend,
  summarizeCustomerTrend,
  summarizeAllPartTrends,
  generatePartTrendExplanation,
  generateCustomerTrendExplanation,
  getTrendLabel,
  getTrendColorClass,
  getTrendArrow,
  formatPeriodLabel,
  formatChange,
  TREND_THRESHOLDS,
  TREND_DISCLAIMER,
  type PartTrendPoint,
  type CustomerTrendPoint,
} from './historical-trends';

// ============================================================================
// TEST DATA
// ============================================================================

const mockPartTrendData: PartTrendPoint[] = [
  // Recent 3 periods (avg yield ~36, avg margin ~12)
  {
    part_code: 'breast_cap',
    period_start: '2026-01-06',
    period_type: 'week',
    period_number: 2,
    period_year: 2026,
    avg_yield_pct: 36.5,
    yield_stddev: 0.8,
    batch_count: 5,
    produced_kg: 500,
    total_sold_kg: 480,
    total_revenue_eur: 5760,
    total_margin_eur: 720,
    avg_margin_pct: 12.5,
    avg_dsi: 10,
    data_status: 'COMPLETE',
  },
  {
    part_code: 'breast_cap',
    period_start: '2025-12-30',
    period_type: 'week',
    period_number: 1,
    period_year: 2026,
    avg_yield_pct: 35.8,
    yield_stddev: 0.9,
    batch_count: 4,
    produced_kg: 400,
    total_sold_kg: 390,
    total_revenue_eur: 4680,
    total_margin_eur: 515,
    avg_margin_pct: 11.0,
    avg_dsi: 12,
    data_status: 'COMPLETE',
  },
  {
    part_code: 'breast_cap',
    period_start: '2025-12-23',
    period_type: 'week',
    period_number: 52,
    period_year: 2025,
    avg_yield_pct: 36.0,
    yield_stddev: 0.7,
    batch_count: 5,
    produced_kg: 450,
    total_sold_kg: 440,
    total_revenue_eur: 5280,
    total_margin_eur: 634,
    avg_margin_pct: 12.0,
    avg_dsi: 11,
    data_status: 'COMPLETE',
  },
  // Prior 3 periods (avg yield ~34, avg margin ~8 - showing improvement)
  {
    part_code: 'breast_cap',
    period_start: '2025-12-16',
    period_type: 'week',
    period_number: 51,
    period_year: 2025,
    avg_yield_pct: 34.5,
    yield_stddev: 1.0,
    batch_count: 4,
    produced_kg: 380,
    total_sold_kg: 350,
    total_revenue_eur: 4200,
    total_margin_eur: 336,
    avg_margin_pct: 8.0,
    avg_dsi: 14,
    data_status: 'COMPLETE',
  },
  {
    part_code: 'breast_cap',
    period_start: '2025-12-09',
    period_type: 'week',
    period_number: 50,
    period_year: 2025,
    avg_yield_pct: 34.0,
    yield_stddev: 1.1,
    batch_count: 4,
    produced_kg: 360,
    total_sold_kg: 340,
    total_revenue_eur: 4080,
    total_margin_eur: 286,
    avg_margin_pct: 7.0,
    avg_dsi: 16,
    data_status: 'COMPLETE',
  },
  {
    part_code: 'breast_cap',
    period_start: '2025-12-02',
    period_type: 'week',
    period_number: 49,
    period_year: 2025,
    avg_yield_pct: 34.2,
    yield_stddev: 1.2,
    batch_count: 3,
    produced_kg: 340,
    total_sold_kg: 320,
    total_revenue_eur: 3840,
    total_margin_eur: 346,
    avg_margin_pct: 9.0,
    avg_dsi: 15,
    data_status: 'COMPLETE',
  },
];

const mockCustomerTrendData: CustomerTrendPoint[] = [
  // Recent 3 months (avg margin ~15, avg alignment ~75)
  {
    customer_id: 'cust-001',
    customer_name: 'Test Klant',
    customer_code: 'TK001',
    period_start: '2026-01-01',
    period_type: 'month',
    period_number: 1,
    period_year: 2026,
    total_kg: 1000,
    total_revenue_eur: 12000,
    total_margin_eur: 1800,
    margin_pct: 15.0,
    alignment_score: 76,
    volume_change_pct: 5,
    margin_change_pct: 2,
    alignment_change: 1,
    data_status: 'COMPLETE',
  },
  {
    customer_id: 'cust-001',
    customer_name: 'Test Klant',
    customer_code: 'TK001',
    period_start: '2025-12-01',
    period_type: 'month',
    period_number: 12,
    period_year: 2025,
    total_kg: 950,
    total_revenue_eur: 11400,
    total_margin_eur: 1596,
    margin_pct: 14.0,
    alignment_score: 75,
    volume_change_pct: 3,
    margin_change_pct: 1,
    alignment_change: 2,
    data_status: 'COMPLETE',
  },
  {
    customer_id: 'cust-001',
    customer_name: 'Test Klant',
    customer_code: 'TK001',
    period_start: '2025-11-01',
    period_type: 'month',
    period_number: 11,
    period_year: 2025,
    total_kg: 920,
    total_revenue_eur: 11040,
    total_margin_eur: 1766,
    margin_pct: 16.0,
    alignment_score: 73,
    volume_change_pct: 2,
    margin_change_pct: 3,
    alignment_change: -1,
    data_status: 'COMPLETE',
  },
  // Prior 3 months (avg margin ~10, avg alignment ~65 - showing improvement)
  {
    customer_id: 'cust-001',
    customer_name: 'Test Klant',
    customer_code: 'TK001',
    period_start: '2025-10-01',
    period_type: 'month',
    period_number: 10,
    period_year: 2025,
    total_kg: 850,
    total_revenue_eur: 10200,
    total_margin_eur: 1122,
    margin_pct: 11.0,
    alignment_score: 68,
    volume_change_pct: 1,
    margin_change_pct: 1,
    alignment_change: 2,
    data_status: 'COMPLETE',
  },
  {
    customer_id: 'cust-001',
    customer_name: 'Test Klant',
    customer_code: 'TK001',
    period_start: '2025-09-01',
    period_type: 'month',
    period_number: 9,
    period_year: 2025,
    total_kg: 840,
    total_revenue_eur: 10080,
    total_margin_eur: 907,
    margin_pct: 9.0,
    alignment_score: 64,
    volume_change_pct: -2,
    margin_change_pct: -1,
    alignment_change: -2,
    data_status: 'COMPLETE',
  },
  {
    customer_id: 'cust-001',
    customer_name: 'Test Klant',
    customer_code: 'TK001',
    period_start: '2025-08-01',
    period_type: 'month',
    period_number: 8,
    period_year: 2025,
    total_kg: 860,
    total_revenue_eur: 10320,
    total_margin_eur: 1032,
    margin_pct: 10.0,
    alignment_score: 63,
    volume_change_pct: 0,
    margin_change_pct: 0,
    alignment_change: 0,
    data_status: 'COMPLETE',
  },
];

// ============================================================================
// TREND DIRECTION TESTS
// ============================================================================

describe('calculateTrendDirection', () => {
  it('should return UP when recent is significantly higher', () => {
    expect(calculateTrendDirection(110, 100, 5)).toBe('UP'); // 10% increase
    expect(calculateTrendDirection(106, 100, 5)).toBe('UP'); // 6% increase
  });

  it('should return DOWN when recent is significantly lower', () => {
    expect(calculateTrendDirection(90, 100, 5)).toBe('DOWN'); // 10% decrease
    expect(calculateTrendDirection(94, 100, 5)).toBe('DOWN'); // 6% decrease
  });

  it('should return STABLE when change is within threshold', () => {
    expect(calculateTrendDirection(103, 100, 5)).toBe('STABLE'); // 3% increase
    expect(calculateTrendDirection(97, 100, 5)).toBe('STABLE'); // 3% decrease
    expect(calculateTrendDirection(100, 100, 5)).toBe('STABLE'); // no change
  });

  it('should return INSUFFICIENT_DATA when values are null', () => {
    expect(calculateTrendDirection(null, 100, 5)).toBe('INSUFFICIENT_DATA');
    expect(calculateTrendDirection(100, null, 5)).toBe('INSUFFICIENT_DATA');
    expect(calculateTrendDirection(null, null, 5)).toBe('INSUFFICIENT_DATA');
  });

  it('should handle zero prior value', () => {
    expect(calculateTrendDirection(10, 0, 5)).toBe('UP');
    expect(calculateTrendDirection(-10, 0, 5)).toBe('DOWN');
    expect(calculateTrendDirection(0, 0, 5)).toBe('STABLE');
  });
});

describe('calculateAverage', () => {
  it('should calculate average of valid values', () => {
    expect(calculateAverage([10, 20, 30])).toBe(20);
    expect(calculateAverage([5, 10, 15, 20])).toBe(12.5);
  });

  it('should skip null values', () => {
    expect(calculateAverage([10, null, 30])).toBe(20);
    expect(calculateAverage([null, null, 30])).toBe(30);
  });

  it('should return null for empty or all-null arrays', () => {
    expect(calculateAverage([])).toBeNull();
    expect(calculateAverage([null, null, null])).toBeNull();
  });
});

// ============================================================================
// PART TREND TESTS
// ============================================================================

describe('summarizePartTrend', () => {
  it('should summarize part trends correctly', () => {
    const summary = summarizePartTrend(mockPartTrendData, 'breast_cap');

    expect(summary.part_code).toBe('breast_cap');
    expect(summary.periods_analyzed).toBe(6);

    // Recent avg yield = (36.5 + 35.8 + 36.0) / 3 = 36.1
    // Prior avg yield = (34.5 + 34.0 + 34.2) / 3 = 34.23
    // Change = ~5.5% => UP
    expect(summary.yield_trend).toBe('UP');

    // Recent avg margin = (12.5 + 11.0 + 12.0) / 3 = 11.83
    // Prior avg margin = (8.0 + 7.0 + 9.0) / 3 = 8.0
    // Change = ~48% => UP
    expect(summary.margin_trend).toBe('UP');
  });

  it('should return INSUFFICIENT_DATA when not enough periods', () => {
    const limitedData = mockPartTrendData.slice(0, 2);
    const summary = summarizePartTrend(limitedData, 'breast_cap');

    expect(summary.yield_trend).toBe('INSUFFICIENT_DATA');
    expect(summary.margin_trend).toBe('INSUFFICIENT_DATA');
    expect(summary.explanation).toContain('Onvoldoende data');
  });

  it('should handle missing part code', () => {
    const summary = summarizePartTrend(mockPartTrendData, 'wings');

    expect(summary.part_code).toBe('wings');
    expect(summary.periods_analyzed).toBe(0);
    expect(summary.yield_trend).toBe('INSUFFICIENT_DATA');
  });
});

describe('summarizeAllPartTrends', () => {
  it('should summarize all unique parts', () => {
    const summaries = summarizeAllPartTrends(mockPartTrendData);

    // Should have one summary per unique part
    expect(summaries.length).toBe(1); // Only breast_cap in test data
    expect(summaries[0].part_code).toBe('breast_cap');
  });
});

// ============================================================================
// CUSTOMER TREND TESTS
// ============================================================================

describe('summarizeCustomerTrend', () => {
  it('should summarize customer trends correctly', () => {
    const summary = summarizeCustomerTrend(mockCustomerTrendData, 'cust-001');

    expect(summary.customer_id).toBe('cust-001');
    expect(summary.customer_name).toBe('Test Klant');
    expect(summary.periods_analyzed).toBe(6);

    // Volume: recent avg ~957, prior avg ~850 => UP (~12.5%)
    expect(summary.volume_trend).toBe('UP');

    // Margin: recent avg ~15, prior avg ~10 => UP (~50%)
    expect(summary.margin_trend).toBe('UP');

    // Alignment: recent avg ~74.67, prior avg ~65 => UP (~15%)
    expect(summary.alignment_trend).toBe('UP');
  });

  it('should return INSUFFICIENT_DATA when not enough periods', () => {
    const limitedData = mockCustomerTrendData.slice(0, 2);
    const summary = summarizeCustomerTrend(limitedData, 'cust-001');

    expect(summary.volume_trend).toBe('INSUFFICIENT_DATA');
    expect(summary.explanation).toContain('Onvoldoende data');
  });
});

// ============================================================================
// EXPLANATION TESTS
// ============================================================================

describe('generatePartTrendExplanation', () => {
  it('should generate Dutch explanation for trends', () => {
    const explanation = generatePartTrendExplanation('breast_cap', 'UP', 'DOWN', 'STABLE');

    expect(explanation).toContain('Filet');
    expect(explanation).toContain('stijgend');
    expect(explanation).toContain('dalend');
    expect(explanation).toContain('stabiel');
  });

  it('should handle insufficient data', () => {
    const explanation = generatePartTrendExplanation(
      'wings',
      'INSUFFICIENT_DATA',
      'INSUFFICIENT_DATA',
      'INSUFFICIENT_DATA'
    );

    expect(explanation).toContain('Vleugels');
    expect(explanation).toContain('onvoldoende data');
  });
});

describe('generateCustomerTrendExplanation', () => {
  it('should generate Dutch explanation for customer trends', () => {
    const explanation = generateCustomerTrendExplanation('Test Klant', 'UP', 'UP', 'STABLE');

    expect(explanation).toContain('Test Klant');
    expect(explanation).toContain('stijgend');
    expect(explanation).toContain('stabiel');
  });
});

describe('getTrendLabel', () => {
  it('should return Dutch labels', () => {
    expect(getTrendLabel('UP')).toBe('stijgend');
    expect(getTrendLabel('DOWN')).toBe('dalend');
    expect(getTrendLabel('STABLE')).toBe('stabiel');
    expect(getTrendLabel('INSUFFICIENT_DATA')).toBe('onvoldoende data');
  });
});

// ============================================================================
// UI HELPER TESTS
// ============================================================================

describe('getTrendColorClass', () => {
  it('should return correct color classes', () => {
    expect(getTrendColorClass('UP')).toContain('green');
    expect(getTrendColorClass('DOWN')).toContain('red');
    expect(getTrendColorClass('STABLE')).toContain('gray');
    expect(getTrendColorClass('INSUFFICIENT_DATA')).toContain('gray');
  });
});

describe('getTrendArrow', () => {
  it('should return correct arrows', () => {
    expect(getTrendArrow('UP')).toBe('↗');
    expect(getTrendArrow('DOWN')).toBe('↘');
    expect(getTrendArrow('STABLE')).toBe('→');
    expect(getTrendArrow('INSUFFICIENT_DATA')).toBe('-');
  });
});

describe('formatPeriodLabel', () => {
  it('should format week labels', () => {
    expect(formatPeriodLabel('week', 5, 2026)).toBe('W5 2026');
    expect(formatPeriodLabel('week', 52, 2025)).toBe('W52 2025');
  });

  it('should format month labels in Dutch', () => {
    expect(formatPeriodLabel('month', 1, 2026)).toBe('Jan 2026');
    expect(formatPeriodLabel('month', 6, 2025)).toBe('Jun 2025');
    expect(formatPeriodLabel('month', 12, 2025)).toBe('Dec 2025');
  });

  it('should format quarter labels', () => {
    expect(formatPeriodLabel('quarter', 1, 2026)).toBe('Q1 2026');
    expect(formatPeriodLabel('quarter', 4, 2025)).toBe('Q4 2025');
  });
});

describe('formatChange', () => {
  it('should format positive changes with plus sign', () => {
    expect(formatChange(5)).toBe('+5.0%');
    expect(formatChange(12.34)).toBe('+12.3%');
  });

  it('should format negative changes with minus sign', () => {
    expect(formatChange(-5)).toBe('-5.0%');
    expect(formatChange(-12.34)).toBe('-12.3%');
  });

  it('should return dash for null', () => {
    expect(formatChange(null)).toBe('-');
  });
});

// ============================================================================
// SPRINT 6 CONTRACT COMPLIANCE TESTS
// ============================================================================

describe('Sprint 6 Contract Compliance', () => {
  it('should NOT provide forecasts or predictions in any output', () => {
    const partSummary = summarizePartTrend(mockPartTrendData, 'breast_cap');
    const customerSummary = summarizeCustomerTrend(mockCustomerTrendData, 'cust-001');

    // Check explanations don't contain prediction words
    const predictionWords = ['voorspelling', 'forecast', 'predict', 'verwacht', 'zal', 'gaat'];
    for (const word of predictionWords) {
      expect(partSummary.explanation.toLowerCase()).not.toContain(word);
      expect(customerSummary.explanation.toLowerCase()).not.toContain(word);
    }
  });

  it('should NOT provide optimization advice', () => {
    const partSummary = summarizePartTrend(mockPartTrendData, 'breast_cap');
    const customerSummary = summarizeCustomerTrend(mockCustomerTrendData, 'cust-001');

    // Check no advice words
    const adviceWords = ['advies', 'aanbeveling', 'moet', 'optimalisatie', 'verhoog', 'verlaag'];
    for (const word of adviceWords) {
      expect(partSummary.explanation.toLowerCase()).not.toContain(word);
      expect(customerSummary.explanation.toLowerCase()).not.toContain(word);
    }
  });

  it('should have disclaimer available', () => {
    expect(TREND_DISCLAIMER).toContain('beschrijvende trend');
    expect(TREND_DISCLAIMER).toContain('GEEN voorspelling');
  });

  it('should label trends as descriptive', () => {
    // All trend directions should be descriptive, not predictive
    expect(getTrendLabel('UP')).toBe('stijgend'); // Not "zal stijgen"
    expect(getTrendLabel('DOWN')).toBe('dalend'); // Not "zal dalen"
    expect(getTrendLabel('STABLE')).toBe('stabiel'); // Not "zal stabiel blijven"
  });
});
