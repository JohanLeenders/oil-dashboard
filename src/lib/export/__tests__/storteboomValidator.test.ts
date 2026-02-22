/**
 * Tests for Storteboom Export Validator — Wave 8
 *
 * REGRESSIE-CHECK:
 * - Pure function tests, no database
 * - Validates StorteboomExportInput checks
 */

import { describe, it, expect } from 'vitest';
import { validateStorteboomExport } from '@/lib/export/storteboomValidator';
import type { StorteboomExportInput } from '@/lib/export/orderSchemaExport';

// ============================================================================
// Helper
// ============================================================================

function makeValidInput(overrides?: Partial<StorteboomExportInput>): StorteboomExportInput {
  return {
    slaughter_date: '2025-11-24',
    lot_number: 'P2520310',
    mester: 'Leenders',
    ras: 'Oranjehoen',
    hok_count: 2,

    total_birds: 15820,
    total_live_weight_kg: 41923,
    avg_live_weight_kg: 2.65,
    dead_on_arrival: 0,
    dead_weight_kg: 0,

    griller_yield_pct: 0.71,
    griller_kg: 29765,
    griller_count: 15820,
    avg_griller_weight_kg: 1.8815,
    rejected_count: 57,
    rejected_weight_kg: 151,

    whole_bird_pulls: [],
    remaining_birds_for_cutting: 15820,
    remaining_griller_kg: 29765,
    adjusted_avg_griller_weight: 1.8815,

    putten_products: [
      {
        product_id: 'p-borst',
        description: 'Borstkappen met vel',
        article_number_vacuum: null,
        article_number_niet_vacuum: '325016',
        yield_pct: 0.3675,
        kg_from_slaughter: 10938,
        packaging_size: '11,5kg',
      },
      {
        product_id: 'p-drum',
        description: 'Drumsticks 10kg',
        article_number_vacuum: null,
        article_number_niet_vacuum: '442133',
        yield_pct: 0.1656,
        kg_from_slaughter: 4928,
        packaging_size: '10kg',
      },
    ],

    nijkerk_products: [
      {
        product_id: 'n-filet',
        description: 'OH flt half z/vel z/haas',
        article_number_vacuum: '540457',
        article_number_niet_vacuum: '540327',
        yield_pct: 0.2442,
        kg_from_slaughter: 7268,
        source_product: 'Borstkappen',
        packaging_size: '15kg',
      },
    ],

    customer_orders: [
      {
        customer_id: 'c1',
        customer_name: 'Grutto',
        delivery_address: 'Pieter van Meel',
        transport_by_koops: true,
        putten_delivery_day: 'dinsdag',
        nijkerk_delivery_day: 'woensdag',
        putten_lines: [
          { product_id: 'p-borst', quantity_kg: 9000 },
          { product_id: 'p-drum', quantity_kg: 4000 },
        ],
        nijkerk_lines: [{ product_id: 'n-filet', quantity_kg: 6000 }],
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('validateStorteboomExport', () => {
  it('valid input passes', () => {
    const result = validateStorteboomExport(makeValidInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('missing article numbers → warning', () => {
    const input = makeValidInput({
      putten_products: [
        {
          product_id: 'p-x',
          description: 'Product zonder artnr',
          article_number_vacuum: null,
          article_number_niet_vacuum: null,
          yield_pct: 0.1,
          kg_from_slaughter: 100,
          packaging_size: null,
        },
      ],
    });
    const result = validateStorteboomExport(input);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('geen artikelnummer'))).toBe(true);
  });

  it('negative REST → warning (tekort)', () => {
    const input = makeValidInput({
      putten_products: [
        {
          product_id: 'p-borst',
          description: 'Borstkappen met vel',
          article_number_vacuum: null,
          article_number_niet_vacuum: '325016',
          yield_pct: 0.3675,
          kg_from_slaughter: 100,
          packaging_size: null,
        },
      ],
      nijkerk_products: [],
      customer_orders: [
        {
          customer_id: 'c1',
          customer_name: 'Grutto',
          delivery_address: 'addr',
          transport_by_koops: false,
          putten_delivery_day: null,
          nijkerk_delivery_day: null,
          putten_lines: [{ product_id: 'p-borst', quantity_kg: 90 }],
          nijkerk_lines: [],
        },
      ],
    });
    const result = validateStorteboomExport(input);
    // 90 of 100 = 90% utilization, but 90 < 100 so no tekort here
    // Let's actually make it 500 to get tekort
    const input2 = makeValidInput({
      putten_products: [
        {
          product_id: 'p-borst',
          description: 'Borstkappen met vel',
          article_number_vacuum: null,
          article_number_niet_vacuum: '325016',
          yield_pct: 0.3675,
          kg_from_slaughter: 100,
          packaging_size: null,
        },
      ],
      nijkerk_products: [],
      customer_orders: [
        {
          customer_id: 'c1',
          customer_name: 'Grutto',
          delivery_address: 'addr',
          transport_by_koops: false,
          putten_delivery_day: null,
          nijkerk_delivery_day: null,
          putten_lines: [{ product_id: 'p-borst', quantity_kg: 500 }],
          nijkerk_lines: [],
        },
      ],
    });
    const result2 = validateStorteboomExport(input2);
    expect(result2.warnings.some((w) => w.includes('Tekort'))).toBe(true);
  });

  it('mass balance mismatch → error when products exceed griller_kg', () => {
    const input = makeValidInput({
      remaining_griller_kg: 10000,
      putten_products: [
        {
          product_id: 'p-borst',
          description: 'Borstkappen',
          article_number_vacuum: null,
          article_number_niet_vacuum: '325016',
          yield_pct: 0.3675,
          kg_from_slaughter: 15000,  // Exceeds remaining_griller_kg
          packaging_size: null,
        },
      ],
    });
    const result = validateStorteboomExport(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Massabalans'))).toBe(true);
  });

  it('low utilization < 50% → error', () => {
    const input = makeValidInput({
      customer_orders: [
        {
          customer_id: 'c1',
          customer_name: 'Grutto',
          delivery_address: 'addr',
          transport_by_koops: false,
          putten_delivery_day: null,
          nijkerk_delivery_day: null,
          putten_lines: [{ product_id: 'p-borst', quantity_kg: 500 }],
          nijkerk_lines: [{ product_id: 'n-filet', quantity_kg: 300 }],
        },
      ],
    });
    const result = validateStorteboomExport(input);
    // 500 + 300 = 800 ordered vs 10938 + 4928 + 7268 = 23134 available → ~3.5%
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Massabalans') && e.includes('benut'))).toBe(true);
  });

  it('medium utilization 50-80% → warning', () => {
    const input = makeValidInput({
      customer_orders: [
        {
          customer_id: 'c1',
          customer_name: 'Grutto',
          delivery_address: 'addr',
          transport_by_koops: false,
          putten_delivery_day: null,
          nijkerk_delivery_day: null,
          putten_lines: [
            { product_id: 'p-borst', quantity_kg: 7500 },
            { product_id: 'p-drum', quantity_kg: 3500 },
          ],
          nijkerk_lines: [{ product_id: 'n-filet', quantity_kg: 3000 }],
        },
      ],
    });
    const result = validateStorteboomExport(input);
    // 7500 + 3500 + 3000 = 14000 ordered vs 10938 + 4928 + 7268 = 23134 available → ~60.5%
    expect(result.warnings.some((w) => w.includes('Massabalans') && w.includes('benut'))).toBe(true);
  });

  it('high utilization > 80% → no utilization warning', () => {
    const input = makeValidInput({
      customer_orders: [
        {
          customer_id: 'c1',
          customer_name: 'Grutto',
          delivery_address: 'addr',
          transport_by_koops: false,
          putten_delivery_day: null,
          nijkerk_delivery_day: null,
          putten_lines: [
            { product_id: 'p-borst', quantity_kg: 10000 },
            { product_id: 'p-drum', quantity_kg: 4500 },
          ],
          nijkerk_lines: [{ product_id: 'n-filet', quantity_kg: 6000 }],
        },
      ],
    });
    const result = validateStorteboomExport(input);
    // 10000 + 4500 + 6000 = 20500 ordered vs ~23134 available → ~88.6%
    expect(result.errors.filter((e) => e.includes('benut'))).toHaveLength(0);
    expect(result.warnings.filter((w) => w.includes('benut'))).toHaveLength(0);
  });

  it('missing delivery info → warning', () => {
    const input = makeValidInput({
      customer_orders: [
        {
          customer_id: 'c1',
          customer_name: 'KlantZonderAdres',
          delivery_address: null,
          transport_by_koops: null,
          putten_delivery_day: null,
          nijkerk_delivery_day: null,
          putten_lines: [{ product_id: 'p-borst', quantity_kg: 100 }],
          nijkerk_lines: [],
        },
      ],
    });
    const result = validateStorteboomExport(input);
    expect(result.warnings.some((w) => w.includes('geen afleveradres'))).toBe(true);
  });
});
