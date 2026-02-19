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
  it('moet cherry picker detecteren bij >28% filet afname', () => {
    // Klant met hoge filet percentage (>28%) en voldoende omzet
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

    // Filet > 28% = cherry picker (norm 20.5%, threshold 28%)
    expect(result.is_cherry_picker).toBe(true);

    // Filet percentage berekening
    const totalKg = 220 + 25 + 15; // 260 kg
    const filetPct = (220 / totalKg) * 100; // ~84.6%
    expect(filetPct).toBeGreaterThan(28);

    // Balance score moet laag zijn
    expect(result.balance_score).toBeLessThan(50);

    // Opportunity cost moet > 0 zijn
    expect(result.opportunity_cost).toBeGreaterThan(0);
  });

  it('moet balanced buyer herkennen', () => {
    // Gebalanceerde mix die de griller-rendementen benadert
    const productMix: CustomerProductMix[] = [
      { category: 'filet', quantity_kg: 41, revenue: 389.50 },   // 20.5%
      { category: 'dij', quantity_kg: 30, revenue: 217.50 },     // 15%
      { category: 'drumstick', quantity_kg: 28, revenue: 193.20 }, // 14%
      { category: 'vleugels', quantity_kg: 18, revenue: 99.00 }, // 9%
      { category: 'karkas', quantity_kg: 43, revenue: 96.75 },   // 21.5%
      { category: 'drumvlees', quantity_kg: 14, revenue: 110.60 }, // 7%
      { category: 'organen', quantity_kg: 10, revenue: 35.00 },  // 5%
      { category: 'vel', quantity_kg: 4, revenue: 8.00 },        // 2%
      { category: 'haas', quantity_kg: 5, revenue: 55.00 },      // 2.5%
    ];

    const result = analyzeCherryPicker(
      'CUST-001',
      'Restaurant De Gouden Kip',
      productMix,
      { minRevenue: 500 }
    );

    // Niet een cherry picker
    expect(result.is_cherry_picker).toBe(false);

    // Filet percentage: 41/193 ≈ 21.2%, ruim onder 28%
    const totalKg = productMix.reduce((sum, p) => sum + p.quantity_kg, 0);
    const filetPct = (41 / totalKg) * 100;
    expect(filetPct).toBeLessThan(28);

    // Balance score moet hoog zijn (goed gebalanceerd)
    expect(result.balance_score).toBeGreaterThan(70);
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

    // Filet anatomisch = 22.0%, dus deviation = 25 - 22.0 = +3.0
    expect(filetBreakdown?.deviation).toBeCloseTo(3.0, 0);
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

    // 300/370 = 81.1% filet, ruim boven 28% threshold
    expect(result.is_cherry_picker).toBe(true);
    expect(result.recommendation).toContain('Cherry picker');
    expect(result.recommendation.toLowerCase()).toContain('filet');
  });
});

describe('Opportunity cost breakdown & kippen_nodig (Sprint 16F)', () => {
  it('P0: filet-only cherry picker — breakdown toont surplus per categorie', () => {
    // Klant koopt 300 kg filet, 50 kg haas, 20 kg dij
    // Leading = filet: 300 / (0.22 * 1.96) = 300 / 0.4312 ≈ 695.7 kippen
    const productMix: CustomerProductMix[] = [
      { category: 'filet', quantity_kg: 300, revenue: 2850.00 },  // €9.50/kg
      { category: 'haas', quantity_kg: 50, revenue: 550.00 },     // €11.00/kg
      { category: 'dij', quantity_kg: 20, revenue: 150.00 },      // €7.50/kg
    ];

    const result = analyzeCherryPicker(
      'CHERRY-OPP',
      'Opportunity Test',
      productMix,
      { minRevenue: 1000 }
    );

    // Kippen nodig moet > 0 zijn
    expect(result.kippen_nodig).toBeGreaterThan(600);

    // Breakdown moet categorieën met surplus bevatten
    expect(result.opportunity_cost_breakdown.length).toBeGreaterThan(0);

    // Elke breakdown-item moet surplus_kg > 0 hebben
    for (const item of result.opportunity_cost_breakdown) {
      expect(item.surplus_kg).toBeGreaterThan(0);
      expect(item.opportunity_cost).toBeGreaterThan(0);
      expect(item.kg_prijs).toBeGreaterThan(0);
    }

    // Karkas moet €0.20/kg zijn (byproduct)
    const karkas = result.opportunity_cost_breakdown.find(b => b.category === 'karkas');
    expect(karkas).toBeDefined();
    expect(karkas!.kg_prijs).toBe(0.20);

    // Totaal opportunity cost moet overeenkomen met som van breakdown
    const sumFromBreakdown = result.opportunity_cost_breakdown
      .reduce((sum, b) => sum + b.opportunity_cost, 0);
    expect(result.opportunity_cost).toBeCloseTo(sumFromBreakdown, 0);

    // Gesorteerd: hoogste opportunity cost eerst
    for (let i = 1; i < result.opportunity_cost_breakdown.length; i++) {
      expect(result.opportunity_cost_breakdown[i - 1].opportunity_cost)
        .toBeGreaterThanOrEqual(result.opportunity_cost_breakdown[i].opportunity_cost);
    }
  });

  it('P0: gebalanceerde klant — minimale opportunity cost', () => {
    const productMix: CustomerProductMix[] = [
      { category: 'filet', quantity_kg: 41, revenue: 389.50 },
      { category: 'dij', quantity_kg: 30, revenue: 217.50 },
      { category: 'drumstick', quantity_kg: 28, revenue: 193.20 },
      { category: 'vleugels', quantity_kg: 18, revenue: 99.00 },
      { category: 'karkas', quantity_kg: 43, revenue: 96.75 },
      { category: 'drumvlees', quantity_kg: 14, revenue: 110.60 },
      { category: 'organen', quantity_kg: 10, revenue: 35.00 },
      { category: 'vel', quantity_kg: 4, revenue: 8.00 },
      { category: 'haas', quantity_kg: 5, revenue: 55.00 },
    ];

    const result = analyzeCherryPicker(
      'BAL-001',
      'Gebalanceerde Klant',
      productMix,
      { minRevenue: 500 }
    );

    // Kippen nodig > 0
    expect(result.kippen_nodig).toBeGreaterThan(0);

    // Opportunity cost breakdown is gesorteerd en consistent
    const sumFromBreakdown = result.opportunity_cost_breakdown
      .reduce((sum, b) => sum + b.opportunity_cost, 0);
    expect(result.opportunity_cost).toBeCloseTo(sumFromBreakdown, 0);
  });

  it('P0: onder revenue threshold — lege breakdown en 0 kippen', () => {
    const productMix: CustomerProductMix[] = [
      { category: 'filet', quantity_kg: 100, revenue: 950.00 },
    ];

    const result = analyzeCherryPicker('SMALL', 'Klein', productMix);

    expect(result.kippen_nodig).toBe(0);
    expect(result.opportunity_cost_breakdown).toHaveLength(0);
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
