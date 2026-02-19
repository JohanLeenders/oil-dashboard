/**
 * Unit Tests voor Customer Profitability Engine
 *
 * TRD/Blueprint Acceptance Tests:
 * - SVASO-based margin calculation (not weight-based)
 * - Profitability status thresholds (healthy/marginal/unprofitable)
 * - Mix deviation scoring
 * - Margin trend detection
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCustomerProfitability,
  combineCustomerAnalysis,
  analyzeAllCustomerProfitability,
  getProfitabilityColorClass,
  getTrendArrow,
  MARGIN_THRESHOLDS,
  type CustomerSalesLine,
} from './customer-profitability';
import { analyzeCherryPicker } from './cherry-picker';

describe('calculateCustomerProfitability', () => {
  // Reference date for consistent trend testing
  const refDate = new Date('2026-01-24');

  it('moet correcte margin berekenen met SVASO kosten', () => {
    const salesLines: CustomerSalesLine[] = [
      { category: 'filet', quantity_kg: 100, revenue: 950, allocated_cost: 700, invoice_date: '2026-01-15' },
      { category: 'dij', quantity_kg: 80, revenue: 580, allocated_cost: 450, invoice_date: '2026-01-15' },
      { category: 'vleugels', quantity_kg: 50, revenue: 275, allocated_cost: 200, invoice_date: '2026-01-15' },
    ];

    const result = calculateCustomerProfitability(
      'CUST-001',
      'Test Klant',
      salesLines,
      { referenceDate: refDate }
    );

    // Total revenue = 950 + 580 + 275 = 1805
    expect(result.total_revenue).toBe(1805);

    // Total cost = 700 + 450 + 200 = 1350
    expect(result.total_allocated_cost).toBe(1350);

    // Gross margin = 1805 - 1350 = 455
    expect(result.total_gross_margin).toBe(455);

    // Margin % = 455 / 1805 * 100 = ~25.2%
    expect(result.margin_pct).toBeCloseTo(25.2, 1);

    // Should be healthy (above 20%)
    expect(result.profitability_status).toBe('healthy');
    expect(result.is_profitable).toBe(true);
  });

  it('moet unprofitable status herkennen bij negatieve marge', () => {
    const salesLines: CustomerSalesLine[] = [
      { category: 'filet', quantity_kg: 100, revenue: 500, allocated_cost: 700, invoice_date: '2026-01-15' },
    ];

    const result = calculateCustomerProfitability(
      'LOSS-001',
      'Verliesgevende Klant',
      salesLines,
      { referenceDate: refDate }
    );

    // Margin = 500 - 700 = -200 (negative)
    expect(result.total_gross_margin).toBe(-200);
    expect(result.margin_pct).toBeLessThan(0);
    expect(result.profitability_status).toBe('unprofitable');
    expect(result.is_profitable).toBe(false);

    // Should have critical warning
    const criticalWarning = result.warnings.find(w => w.severity === 'critical');
    expect(criticalWarning).toBeDefined();
    expect(criticalWarning?.type).toBe('negative_margin');
  });

  it('moet marginal status herkennen bij lage marge (0-10%)', () => {
    // Revenue: 1000, Cost: 925 -> Margin: 75 (7.5%)
    const salesLines: CustomerSalesLine[] = [
      { category: 'dij', quantity_kg: 100, revenue: 1000, allocated_cost: 925, invoice_date: '2026-01-15' },
    ];

    const result = calculateCustomerProfitability(
      'MARG-001',
      'Marginale Klant',
      salesLines,
      { referenceDate: refDate }
    );

    expect(result.margin_pct).toBeCloseTo(7.5, 1);
    expect(result.profitability_status).toBe('marginal');
    expect(result.is_profitable).toBe(true);

    // Should have warning for low margin
    const lowMarginWarning = result.warnings.find(w => w.type === 'low_margin');
    expect(lowMarginWarning).toBeDefined();
  });

  it('moet category margins correct aggregeren', () => {
    const salesLines: CustomerSalesLine[] = [
      { category: 'filet', quantity_kg: 50, revenue: 475, allocated_cost: 350, invoice_date: '2026-01-10' },
      { category: 'filet', quantity_kg: 30, revenue: 285, allocated_cost: 210, invoice_date: '2026-01-15' },
      { category: 'dij', quantity_kg: 40, revenue: 300, allocated_cost: 240, invoice_date: '2026-01-10' },
    ];

    const result = calculateCustomerProfitability(
      'AGG-001',
      'Aggregate Test',
      salesLines,
      { referenceDate: refDate }
    );

    // Filet: 50 + 30 = 80 kg, revenue: 475 + 285 = 760, cost: 350 + 210 = 560
    const filetMargin = result.category_margins.find(m => m.category === 'filet');
    expect(filetMargin).toBeDefined();
    expect(filetMargin?.quantity_kg).toBe(80);
    expect(filetMargin?.revenue).toBe(760);
    expect(filetMargin?.allocated_cost).toBe(560);
    expect(filetMargin?.gross_margin).toBe(200);

    // Dij: 40 kg, revenue: 300, cost: 240
    const dijMargin = result.category_margins.find(m => m.category === 'dij');
    expect(dijMargin).toBeDefined();
    expect(dijMargin?.quantity_kg).toBe(40);
  });

  it('moet mix deviation correct berekenen', () => {
    // 120 kg totaal: 80 kg filet (66.7%), 40 kg dij (33.3%)
    // Filet anatomisch = 23.5%, deviation = 66.7 - 23.5 = +43.2%
    const salesLines: CustomerSalesLine[] = [
      { category: 'filet', quantity_kg: 80, revenue: 760, allocated_cost: 560, invoice_date: '2026-01-15' },
      { category: 'dij', quantity_kg: 40, revenue: 300, allocated_cost: 240, invoice_date: '2026-01-15' },
    ];

    const result = calculateCustomerProfitability(
      'MIX-001',
      'Mix Test',
      salesLines,
      { referenceDate: refDate }
    );

    const filetMargin = result.category_margins.find(m => m.category === 'filet');
    expect(filetMargin?.volume_share_pct).toBeCloseTo(66.67, 1);
    expect(filetMargin?.anatomical_ratio_pct).toBe(22);
    expect(filetMargin?.deviation_pct).toBeCloseTo(44.67, 1);

    // Mix deviation score should be low due to high deviation
    expect(result.mix_deviation_score).toBeLessThan(60);

    // Worst deviation should be filet
    expect(result.worst_deviation_category).toBe('filet');
  });

  it('moet margin trend detecteren', () => {
    // Create lines with declining margin over time
    const salesLines: CustomerSalesLine[] = [
      // Prior period (31-60 days ago): high margin
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 600, invoice_date: '2025-12-05' },
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 600, invoice_date: '2025-12-10' },
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 600, invoice_date: '2025-12-15' },
      // Recent period (last 30 days): low margin
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 900, invoice_date: '2026-01-05' },
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 900, invoice_date: '2026-01-10' },
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 900, invoice_date: '2026-01-15' },
    ];

    const result = calculateCustomerProfitability(
      'TREND-001',
      'Declining Trend',
      salesLines,
      { referenceDate: refDate }
    );

    // Prior margin: (3000 - 1800) / 3000 = 40%
    // Recent margin: (3000 - 2700) / 3000 = 10%
    expect(result.margin_trend).toBe('declining');
    expect(result.prior_margin_pct).toBeCloseTo(40, 1);
    expect(result.recent_margin_pct).toBeCloseTo(10, 1);

    // Should have declining trend warning
    const trendWarning = result.warnings.find(w => w.type === 'declining_trend');
    expect(trendWarning).toBeDefined();
  });

  it('moet improving trend detecteren', () => {
    const salesLines: CustomerSalesLine[] = [
      // Prior period: low margin
      { category: 'dij', quantity_kg: 100, revenue: 1000, allocated_cost: 900, invoice_date: '2025-12-05' },
      { category: 'dij', quantity_kg: 100, revenue: 1000, allocated_cost: 900, invoice_date: '2025-12-10' },
      { category: 'dij', quantity_kg: 100, revenue: 1000, allocated_cost: 900, invoice_date: '2025-12-15' },
      // Recent period: high margin
      { category: 'dij', quantity_kg: 100, revenue: 1000, allocated_cost: 600, invoice_date: '2026-01-05' },
      { category: 'dij', quantity_kg: 100, revenue: 1000, allocated_cost: 600, invoice_date: '2026-01-10' },
      { category: 'dij', quantity_kg: 100, revenue: 1000, allocated_cost: 600, invoice_date: '2026-01-15' },
    ];

    const result = calculateCustomerProfitability(
      'TREND-002',
      'Improving Trend',
      salesLines,
      { referenceDate: refDate }
    );

    expect(result.margin_trend).toBe('improving');
    expect(result.prior_margin_pct).toBeCloseTo(10, 1);
    expect(result.recent_margin_pct).toBeCloseTo(40, 1);
  });

  it('moet stable trend detecteren bij kleine verandering', () => {
    const salesLines: CustomerSalesLine[] = [
      // Prior: 25% margin
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 750, invoice_date: '2025-12-05' },
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 750, invoice_date: '2025-12-10' },
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 750, invoice_date: '2025-12-15' },
      // Recent: 26% margin (within 2% threshold)
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 740, invoice_date: '2026-01-05' },
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 740, invoice_date: '2026-01-10' },
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 740, invoice_date: '2026-01-15' },
    ];

    const result = calculateCustomerProfitability(
      'TREND-003',
      'Stable Trend',
      salesLines,
      { referenceDate: refDate }
    );

    expect(result.margin_trend).toBe('stable');
  });

  it('moet insufficient_data retourneren bij te weinig datapunten', () => {
    const salesLines: CustomerSalesLine[] = [
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 700, invoice_date: '2026-01-15' },
    ];

    const result = calculateCustomerProfitability(
      'FEW-001',
      'Few Data Points',
      salesLines,
      { referenceDate: refDate }
    );

    expect(result.margin_trend).toBe('insufficient_data');
  });
});

describe('combineCustomerAnalysis', () => {
  const refDate = new Date('2026-01-24');

  it('moet cherry picker warning toevoegen aan profitability', () => {
    // Create a cherry picker scenario
    const salesLines: CustomerSalesLine[] = [
      { category: 'filet', quantity_kg: 200, revenue: 1900, allocated_cost: 1400, invoice_date: '2026-01-15' },
      { category: 'dij', quantity_kg: 20, revenue: 150, allocated_cost: 120, invoice_date: '2026-01-15' },
    ];

    const profitability = calculateCustomerProfitability(
      'CHERRY-001',
      'Cherry Picker',
      salesLines,
      { referenceDate: refDate }
    );

    // Create corresponding cherry picker analysis
    const cherryAnalysis = analyzeCherryPicker(
      'CHERRY-001',
      'Cherry Picker',
      [
        { category: 'filet', quantity_kg: 200, revenue: 1900 },
        { category: 'dij', quantity_kg: 20, revenue: 150 },
      ],
      { minRevenue: 1000 }
    );

    expect(cherryAnalysis.is_cherry_picker).toBe(true);

    const combined = combineCustomerAnalysis(profitability, cherryAnalysis);

    // Should have cherry picker warning added
    const cherryWarning = combined.profitability.warnings.find(
      w => w.type === 'cherry_picker'
    );
    expect(cherryWarning).toBeDefined();
    expect(cherryWarning?.severity).toBe('critical');

    // Priority should be high
    expect(combined.priority_rank).toBe('high');
  });

  it('moet combined health score berekenen', () => {
    const salesLines: CustomerSalesLine[] = [
      { category: 'filet', quantity_kg: 50, revenue: 475, allocated_cost: 350, invoice_date: '2026-01-15' },
      { category: 'dij', quantity_kg: 45, revenue: 340, allocated_cost: 260, invoice_date: '2026-01-15' },
      { category: 'drumstick', quantity_kg: 40, revenue: 280, allocated_cost: 220, invoice_date: '2026-01-15' },
      { category: 'vleugels', quantity_kg: 25, revenue: 138, allocated_cost: 100, invoice_date: '2026-01-15' },
      { category: 'karkas', quantity_kg: 20, revenue: 50, allocated_cost: 40, invoice_date: '2026-01-15' },
    ];

    const profitability = calculateCustomerProfitability(
      'HEALTHY-001',
      'Healthy Customer',
      salesLines,
      { referenceDate: refDate }
    );

    const cherryAnalysis = analyzeCherryPicker(
      'HEALTHY-001',
      'Healthy Customer',
      salesLines.map(l => ({
        category: l.category,
        quantity_kg: l.quantity_kg,
        revenue: l.revenue,
      })),
      { minRevenue: 1000 }
    );

    const combined = combineCustomerAnalysis(profitability, cherryAnalysis);

    // Both should be healthy
    expect(profitability.profitability_status).toBe('healthy');
    expect(cherryAnalysis.is_cherry_picker).toBe(false);

    // Combined health score should be reasonable (60% margin weight, 40% balance weight)
    expect(combined.combined_health_score).toBeGreaterThan(40);

    // Priority should be low for healthy customer
    expect(combined.priority_rank).toBe('low');
  });

  it('moet high priority toekennen aan unprofitable klant', () => {
    const salesLines: CustomerSalesLine[] = [
      { category: 'filet', quantity_kg: 100, revenue: 500, allocated_cost: 700, invoice_date: '2026-01-15' },
    ];

    const profitability = calculateCustomerProfitability(
      'LOSS-001',
      'Loss Customer',
      salesLines,
      { referenceDate: refDate }
    );

    const cherryAnalysis = analyzeCherryPicker(
      'LOSS-001',
      'Loss Customer',
      [{ category: 'filet', quantity_kg: 100, revenue: 500 }],
      { minRevenue: 100 }
    );

    const combined = combineCustomerAnalysis(profitability, cherryAnalysis);

    expect(combined.priority_rank).toBe('high');
    expect(combined.action_recommendation).toContain('ACTIE VEREIST');
  });
});

describe('analyzeAllCustomerProfitability', () => {
  it('moet klanten sorteren op profitability (worst first)', () => {
    const customers = [
      {
        id: 'PROF-001',
        name: 'Profitable',
        salesLines: [
          { category: 'filet' as const, quantity_kg: 100, revenue: 1000, allocated_cost: 600, invoice_date: '2026-01-15' },
        ],
      },
      {
        id: 'LOSS-001',
        name: 'Unprofitable',
        salesLines: [
          { category: 'filet' as const, quantity_kg: 100, revenue: 500, allocated_cost: 700, invoice_date: '2026-01-15' },
        ],
      },
      {
        id: 'MARG-001',
        name: 'Marginal',
        salesLines: [
          { category: 'filet' as const, quantity_kg: 100, revenue: 1000, allocated_cost: 925, invoice_date: '2026-01-15' },
        ],
      },
    ];

    const results = analyzeAllCustomerProfitability(customers);

    // Unprofitable should be first
    expect(results[0].customer_id).toBe('LOSS-001');
    expect(results[0].profitability_status).toBe('unprofitable');

    // Then marginal
    expect(results[1].customer_id).toBe('MARG-001');

    // Profitable last
    expect(results[2].customer_id).toBe('PROF-001');
  });
});

describe('Edge cases', () => {
  it('moet lege salesLines afhandelen', () => {
    const result = calculateCustomerProfitability(
      'EMPTY',
      'Empty Customer',
      []
    );

    expect(result.total_revenue).toBe(0);
    expect(result.total_allocated_cost).toBe(0);
    expect(result.margin_pct).toBe(0);
    expect(result.profitability_status).toBe('healthy');
    expect(result.category_margins).toHaveLength(0);
  });

  it('moet zero revenue afhandelen', () => {
    // Zero revenue but with cost = negative gross margin = unprofitable
    const salesLines: CustomerSalesLine[] = [
      { category: 'filet', quantity_kg: 100, revenue: 0, allocated_cost: 100, invoice_date: '2026-01-15' },
    ];

    const result = calculateCustomerProfitability(
      'ZERO-REV',
      'Zero Revenue',
      salesLines
    );

    expect(result.total_revenue).toBe(0);
    expect(result.margin_pct).toBe(0);
    // Although margin_pct is 0, gross_margin is -100 (negative)
    // So profitability_status should be unprofitable
    expect(result.total_gross_margin).toBe(-100);
    expect(result.profitability_status).toBe('unprofitable');
  });

  it('moet best margin category correct identificeren', () => {
    const salesLines: CustomerSalesLine[] = [
      { category: 'filet', quantity_kg: 100, revenue: 1000, allocated_cost: 800, invoice_date: '2026-01-15' }, // 20% margin
      { category: 'dij', quantity_kg: 100, revenue: 1000, allocated_cost: 600, invoice_date: '2026-01-15' }, // 40% margin
      { category: 'karkas', quantity_kg: 100, revenue: 300, allocated_cost: 250, invoice_date: '2026-01-15' }, // 16.7% margin
    ];

    const result = calculateCustomerProfitability(
      'BEST-001',
      'Best Margin Test',
      salesLines
    );

    expect(result.best_margin_category).toBe('dij');
  });
});

describe('UI Helpers', () => {
  it('moet correcte color classes retourneren', () => {
    expect(getProfitabilityColorClass('healthy')).toContain('green');
    expect(getProfitabilityColorClass('marginal')).toContain('yellow');
    expect(getProfitabilityColorClass('unprofitable')).toContain('red');
  });

  it('moet correcte trend arrows retourneren', () => {
    expect(getTrendArrow('improving')).toBe('\u2191'); // ↑
    expect(getTrendArrow('stable')).toBe('\u2192'); // →
    expect(getTrendArrow('declining')).toBe('\u2193'); // ↓
    expect(getTrendArrow('insufficient_data')).toBe('-');
  });
});

describe('Blueprint Acceptance Tests', () => {
  it('moet SVASO-based margin gebruiken, NIET gewicht-based', () => {
    // Two products with same weight but different market values
    // SVASO: costs should be allocated by market value, not weight
    const salesLines: CustomerSalesLine[] = [
      // Filet: high market price, high allocated cost
      { category: 'filet', quantity_kg: 100, revenue: 950, allocated_cost: 500, invoice_date: '2026-01-15' },
      // Karkas: low market price, low allocated cost (even though same weight)
      { category: 'karkas', quantity_kg: 100, revenue: 225, allocated_cost: 100, invoice_date: '2026-01-15' },
    ];

    const result = calculateCustomerProfitability(
      'SVASO-001',
      'SVASO Test',
      salesLines
    );

    // Verify allocated costs are not equal (would be 300 each if weight-based)
    const filetMargin = result.category_margins.find(m => m.category === 'filet');
    const karkasMargin = result.category_margins.find(m => m.category === 'karkas');

    expect(filetMargin?.allocated_cost).toBe(500); // Higher cost for premium product
    expect(karkasMargin?.allocated_cost).toBe(100); // Lower cost for rest product

    // Different margin percentages
    // Filet: (950 - 500) / 950 = 47.4%
    expect(filetMargin?.margin_pct).toBeCloseTo(47.4, 1);
    // Karkas: (225 - 100) / 225 = 55.6%
    expect(karkasMargin?.margin_pct).toBeCloseTo(55.6, 1);
  });

  it('moet profitability thresholds respecteren (LOCKED: 0/10/20)', () => {
    // Test exact boundaries
    expect(MARGIN_THRESHOLDS.UNPROFITABLE_PCT).toBe(0);
    expect(MARGIN_THRESHOLDS.MARGINAL_PCT).toBe(10);
    expect(MARGIN_THRESHOLDS.HEALTHY_PCT).toBe(20);
  });
});
