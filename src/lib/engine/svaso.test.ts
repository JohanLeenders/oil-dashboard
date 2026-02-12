/**
 * Unit Tests voor SVASO Engine
 *
 * Acceptance Tests uit TRD:
 * 1. SVASO allocatiefactoren tellen op tot 1.0
 * 2. Hogere marktprijs filet => hogere allocated cost filet, lagere kostprijs leg
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSvasoAllocation,
  validateSvasoResult,
  simulatePriceImpact,
  type SvasoInputItem,
} from './svaso';

describe('calculateSvasoAllocation', () => {
  // Test data gebaseerd op TRD voorbeeld
  const testItems: SvasoInputItem[] = [
    { id: 'filet', quantity_kg: 100, market_price_per_kg: 9.50, category: 'filet' },
    { id: 'dij', quantity_kg: 120, market_price_per_kg: 7.00, category: 'dij' },
    { id: 'drumstick', quantity_kg: 80, market_price_per_kg: 6.80, category: 'drumstick' },
    { id: 'vleugels', quantity_kg: 45, market_price_per_kg: 5.50, category: 'vleugels' },
    { id: 'karkas', quantity_kg: 55, market_price_per_kg: 2.50, category: 'karkas' },
  ];
  const totalCost = 2500.00;

  it('moet allocatiefactoren berekenen die optellen tot 1.0', () => {
    const result = calculateSvasoAllocation(testItems, totalCost);

    // TRD Acceptance Test 1: Som = 1.0
    expect(result.sum_allocation_factors).toBeCloseTo(1.0, 4);

    // Elk individueel item heeft factor tussen 0 en 1
    result.allocations.forEach(a => {
      expect(a.allocation_factor).toBeGreaterThan(0);
      expect(a.allocation_factor).toBeLessThanOrEqual(1);
    });
  });

  it('moet hogere kosten toewijzen aan producten met hogere marktprijs', () => {
    const result = calculateSvasoAllocation(testItems, totalCost);

    const filet = result.allocations.find(a => a.id === 'filet')!;
    const karkas = result.allocations.find(a => a.id === 'karkas')!;

    // Filet (€9.50/kg) moet hoger cost_per_kg hebben dan karkas (€2.50/kg)
    expect(filet.cost_per_kg).toBeGreaterThan(karkas.cost_per_kg);

    // Filet moet hogere allocatie factor hebben dan karkas
    expect(filet.allocation_factor).toBeGreaterThan(karkas.allocation_factor);
  });

  it('moet som allocated costs gelijk hebben aan total cost', () => {
    const result = calculateSvasoAllocation(testItems, totalCost);

    const sumAllocated = result.allocations.reduce(
      (sum, a) => sum + a.allocated_cost,
      0
    );

    expect(sumAllocated).toBeCloseTo(totalCost, 2);
  });

  it('moet marge berekenen als marktwaarde minus allocated cost', () => {
    const result = calculateSvasoAllocation(testItems, totalCost);

    result.allocations.forEach(a => {
      const expectedMargin = a.market_value - a.allocated_cost;
      expect(a.gross_margin).toBeCloseTo(expectedMargin, 2);
    });
  });

  it('moet error geven bij lege items array', () => {
    expect(() => calculateSvasoAllocation([], totalCost)).toThrow(
      'Geen items opgegeven'
    );
  });

  it('moet error geven bij negatieve total cost', () => {
    expect(() => calculateSvasoAllocation(testItems, -100)).toThrow(
      'Totale kosten moeten groter dan 0 zijn'
    );
  });

  it('moet items met quantity_kg <= 0 uitsluiten', () => {
    const itemsWithZero = [
      ...testItems,
      { id: 'test', quantity_kg: 0, market_price_per_kg: 10.00 },
    ];

    const result = calculateSvasoAllocation(itemsWithZero, totalCost);

    expect(result.allocations.find(a => a.id === 'test')).toBeUndefined();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('validateSvasoResult', () => {
  it('moet valid teruggeven voor correcte berekening', () => {
    const testItems: SvasoInputItem[] = [
      { id: 'a', quantity_kg: 50, market_price_per_kg: 10.00 },
      { id: 'b', quantity_kg: 50, market_price_per_kg: 5.00 },
    ];

    const result = calculateSvasoAllocation(testItems, 500);
    const validation = validateSvasoResult(result);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

describe('simulatePriceImpact', () => {
  const baseItems: SvasoInputItem[] = [
    { id: 'filet', quantity_kg: 100, market_price_per_kg: 9.50 },
    { id: 'leg', quantity_kg: 100, market_price_per_kg: 7.00 },
  ];
  const totalCost = 1000;

  it('moet hogere filet prijs leiden tot hogere filet cost en lagere leg cost', () => {
    // TRD Acceptance Test 2
    const impact = simulatePriceImpact(baseItems, totalCost, {
      itemId: 'filet',
      newPrice: 12.00, // Verhogen van 9.50 naar 12.00
    });

    const filetImpact = impact.impact.find(i => i.id === 'filet')!;
    const legImpact = impact.impact.find(i => i.id === 'leg')!;

    // Filet cost moet stijgen
    expect(filetImpact.cost_change).toBeGreaterThan(0);

    // Leg cost moet dalen (ceteris paribus)
    expect(legImpact.cost_change).toBeLessThan(0);
  });

  it('moet som van cost changes gelijk zijn aan 0 (zero-sum)', () => {
    const impact = simulatePriceImpact(baseItems, totalCost, {
      itemId: 'filet',
      newPrice: 12.00,
    });

    const totalChange = impact.impact.reduce(
      (sum, i) => sum + i.cost_change,
      0
    );

    // Totale kosten blijven gelijk, dus som van changes = 0
    expect(totalChange).toBeCloseTo(0, 2);
  });
});

describe('SVASO met realistisch batch voorbeeld', () => {
  // Gebaseerd op Batch P2520210 uit seed data
  it('moet correcte allocatie geven voor demo batch', () => {
    const batchYields: SvasoInputItem[] = [
      { id: 'breast_cap', quantity_kg: 1230.18, market_price_per_kg: 9.50, name: 'Borstkap' },
      { id: 'leg_quarter', quantity_kg: 1555.40, market_price_per_kg: 7.25, name: 'Achterkwartier' },
      { id: 'wings', quantity_kg: 378.25, market_price_per_kg: 5.50, name: 'Vleugels' },
      { id: 'back_carcass', quantity_kg: 265.13, market_price_per_kg: 2.25, name: 'Karkas' },
      { id: 'offal', quantity_kg: 88.38, market_price_per_kg: 3.50, name: 'Organen' },
    ];

    // Batch kosten: €18,775 + extra kosten
    const totalBatchCost = 18775 + 3750 + 250 + 450;

    const result = calculateSvasoAllocation(batchYields, totalBatchCost);

    // Valideer
    expect(result.sum_allocation_factors).toBeCloseTo(1.0, 4);
    expect(result.total_cost).toBe(totalBatchCost);
    expect(result.total_kg).toBeCloseTo(3517.34, 1);

    // Borstkap (premium) moet hoogste allocatie hebben
    const breastCap = result.allocations.find(a => a.id === 'breast_cap')!;
    const backCarcass = result.allocations.find(a => a.id === 'back_carcass')!;

    expect(breastCap.allocation_factor).toBeGreaterThan(backCarcass.allocation_factor);
    expect(breastCap.cost_per_kg).toBeGreaterThan(backCarcass.cost_per_kg);

    // Alle marges moeten positief zijn (want marktprijs > cost)
    result.allocations.forEach(a => {
      expect(a.gross_margin).toBeGreaterThan(0);
      expect(a.margin_pct).toBeGreaterThan(0);
    });
  });
});
