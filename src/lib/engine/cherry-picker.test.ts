/**
 * Unit Tests voor Cherry-Picker Detectie
 *
 * TRD Acceptance Test:
 * - Klant die alleen filet koopt krijgt score < 50 en opportunity cost > 0
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeCherryPicker,
  MINIMUM_REVENUE_THRESHOLD,
  type CustomerProductMix,
} from './cherry-picker';

describe('analyzeCherryPicker', () => {
  it('moet cherry picker detecteren bij >30% filet afname', () => {
    // Klant met hoge filet percentage (>30%) en voldoende omzet
    const productMix: CustomerProductMix[] = [
      { category: 'filet', quantity_kg: 220, revenue: 8000.00 },
      { category: 'haas', quantity_kg: 25, revenue: 1500.00 },
      { category: 'dij', quantity_kg: 15, revenue: 1000.00 },
    ];

    const result = analyzeCherryPicker(
      'CUST-002',
      'Slagerij Van der Berg',
      productMix
    );

    // TRD: filet > 30% = cherry picker
    expect(result.is_cherry_picker).toBe(true);

    // Filet percentage berekening
    const totalKg = 220 + 25 + 15; // 260 kg
    const filetPct = (220 / totalKg) * 100; // ~84.6%
    expect(filetPct).toBeGreaterThan(30);

    // Balance score moet laag zijn
    expect(result.balance_score).toBeLessThan(50);

    // Opportunity cost moet > 0 zijn
    expect(result.opportunity_cost).toBeGreaterThan(0);
  });

  it('moet balanced buyer herkennen', () => {
    // Klant 1 uit seed data: gebalanceerde mix
    const productMix: CustomerProductMix[] = [
      { category: 'filet', quantity_kg: 50, revenue: 475.00 },
      { category: 'dij', quantity_kg: 45, revenue: 337.50 },
      { category: 'drumstick', quantity_kg: 40, revenue: 280.00 },
      { category: 'vleugels', quantity_kg: 25, revenue: 137.50 },
      { category: 'karkas', quantity_kg: 20, revenue: 50.00 },
    ];

    const result = analyzeCherryPicker(
      'CUST-001',
      'Restaurant De Gouden Kip',
      productMix
    );

    // Niet een cherry picker
    expect(result.is_cherry_picker).toBe(false);

    // Filet percentage
    const totalKg = 50 + 45 + 40 + 25 + 20; // 180 kg
    const filetPct = (50 / totalKg) * 100; // ~27.8%
    expect(filetPct).toBeLessThan(30);

    // Balance score moet redelijk zijn
    expect(result.balance_score).toBeGreaterThan(50);
  });

  it('moet geen analyse doen onder revenue threshold', () => {
    const productMix: CustomerProductMix[] = [
      { category: 'filet', quantity_kg: 100, revenue: 950.00 }, // < €10.000
    ];

    const result = analyzeCherryPicker(
      'SMALL-001',
      'Kleine Klant',
      productMix
    );

    // Onder threshold = geen cherry picker analyse
    expect(result.is_cherry_picker).toBe(false);
    expect(result.balance_score).toBe(100); // Default
    expect(result.category_breakdown).toHaveLength(0);
    expect(result.recommendation).toContain('onder drempel');
  });

  it('moet alerts genereren voor extreme afwijkingen', () => {
    const productMix: CustomerProductMix[] = [
      { category: 'filet', quantity_kg: 500, revenue: 4750.00 },
      { category: 'haas', quantity_kg: 100, revenue: 1100.00 },
      // Totaal: €5850, maar we override de threshold
    ];

    const result = analyzeCherryPicker(
      'CHERRY-001',
      'Extreme Cherry Picker',
      productMix,
      { minRevenue: 1000 } // Lagere threshold voor test
    );

    expect(result.alerts.length).toBeGreaterThan(0);

    // Filet alert moet critical zijn (premium category)
    const filetAlert = result.alerts.find(a => a.category === 'filet');
    expect(filetAlert).toBeDefined();
    expect(filetAlert?.severity).toBe('critical');
  });

  it('moet correcte deviation berekenen per categorie', () => {
    const productMix: CustomerProductMix[] = [
      { category: 'filet', quantity_kg: 100, revenue: 950.00 },
      { category: 'dij', quantity_kg: 100, revenue: 750.00 },
      { category: 'vleugels', quantity_kg: 100, revenue: 550.00 },
      { category: 'karkas', quantity_kg: 100, revenue: 250.00 },
    ];

    const result = analyzeCherryPicker(
      'TEST-001',
      'Test Klant',
      productMix,
      { minRevenue: 1000 }
    );

    // Elke categorie = 25% (400 kg totaal, 100 kg elk)
    const filetBreakdown = result.category_breakdown.find(c => c.category === 'filet');
    expect(filetBreakdown?.percentage_of_total).toBeCloseTo(25, 0);

    // Filet anatomisch = 24%, dus deviation = 25 - 24 = +1
    expect(filetBreakdown?.deviation).toBeCloseTo(1, 0);
  });

  it('moet recommendation genereren met opportunity cost', () => {
    const productMix: CustomerProductMix[] = [
      { category: 'filet', quantity_kg: 300, revenue: 2850.00 },
      { category: 'haas', quantity_kg: 50, revenue: 550.00 },
      { category: 'dij', quantity_kg: 20, revenue: 150.00 },
    ];

    const result = analyzeCherryPicker(
      'CHERRY-002',
      'High Value Cherry Picker',
      productMix,
      { minRevenue: 1000 }
    );

    expect(result.is_cherry_picker).toBe(true);
    expect(result.recommendation).toContain('Cherry picker');
    expect(result.recommendation.toLowerCase()).toContain('filet');
  });
});

describe('Edge cases', () => {
  it('moet lege productMix afhandelen', () => {
    const result = analyzeCherryPicker('EMPTY', 'Lege Klant', []);

    expect(result.is_cherry_picker).toBe(false);
    expect(result.total_kg).toBe(0);
    expect(result.total_revenue).toBe(0);
  });

  it('moet hele_kip correct behandelen (altijd balanced)', () => {
    const productMix: CustomerProductMix[] = [
      { category: 'hele_kip', quantity_kg: 500, revenue: 3250.00 },
    ];

    const result = analyzeCherryPicker(
      'WHOLE-001',
      'Hele Kip Klant',
      productMix,
      { minRevenue: 1000 }
    );

    // Hele kip = per definitie gebalanceerd
    expect(result.is_cherry_picker).toBe(false);
  });
});
