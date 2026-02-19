/**
 * Tests for Storteboom Excel Validation
 * Wave 4 — A2-S5: validateForStorteboom
 *
 * REGRESSIE-CHECK:
 * - Pure function tests, no database
 * - Verifies validation logic for Storteboom export compatibility
 */

import { describe, it, expect } from 'vitest';
import { validateForStorteboom } from '@/lib/export/storteboomValidator';
import type { OrderSchemaData } from '@/types/database';

// ============================================================================
// Helpers
// ============================================================================

function makeSchemaData(overrides?: Partial<OrderSchemaData>): OrderSchemaData {
  return {
    slaughter_id: 'slaughter-test-1',
    snapshot_date: '2026-02-19',
    availability: [],
    orders: [
      {
        customer_id: 'cust-1',
        customer_name: 'Test Klant',
        lines: [{ product_id: 'filet', quantity_kg: 50 }],
      },
    ],
    surplus_deficit: [
      {
        product_id: 'filet',
        available_kg: 200,
        ordered_kg: 150,
        delta_kg: 50,
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// validateForStorteboom
// ============================================================================

describe('validateForStorteboom', () => {
  it('valid schema returns valid: true with no errors or warnings', () => {
    const data = makeSchemaData();
    const result = validateForStorteboom(data);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('empty surplus_deficit returns error', () => {
    const data = makeSchemaData({ surplus_deficit: [] });
    const result = validateForStorteboom(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Geen producten in bestelschema');
  });

  it('empty orders returns warning but still valid', () => {
    const data = makeSchemaData({ orders: [] });
    const result = validateForStorteboom(data);

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      'Geen orders in schema — export bevat alleen beschikbaarheid'
    );
  });

  it('negative available_kg returns error', () => {
    const data = makeSchemaData({
      surplus_deficit: [
        { product_id: 'filet', available_kg: -10, ordered_kg: 50, delta_kg: -60 },
      ],
    });
    const result = validateForStorteboom(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Negatief beschikbaar gewicht voor product filet');
  });

  it('negative ordered_kg returns error', () => {
    const data = makeSchemaData({
      surplus_deficit: [
        { product_id: 'bout', available_kg: 100, ordered_kg: -20, delta_kg: 120 },
      ],
    });
    const result = validateForStorteboom(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Negatief besteld gewicht voor product bout');
  });

  it('missing product_id returns error', () => {
    const data = makeSchemaData({
      surplus_deficit: [
        { product_id: '', available_kg: 100, ordered_kg: 50, delta_kg: 50 },
      ],
    });
    const result = validateForStorteboom(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Product ID ontbreekt in surplus/deficit entry');
  });

  it('large deficit returns warning', () => {
    const data = makeSchemaData({
      surplus_deficit: [
        { product_id: 'bout', available_kg: 50, ordered_kg: 200, delta_kg: -150 },
      ],
    });
    const result = validateForStorteboom(data);

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Groot deficit (-150.0 kg) voor bout');
  });

  it('multiple errors are all collected', () => {
    const data = makeSchemaData({
      surplus_deficit: [
        { product_id: '', available_kg: -10, ordered_kg: -20, delta_kg: 10 },
        { product_id: 'filet', available_kg: -5, ordered_kg: 50, delta_kg: -55 },
      ],
    });
    const result = validateForStorteboom(data);

    expect(result.valid).toBe(false);
    // Should have errors for: negative available_kg (2x), negative ordered_kg (1x), missing product_id (1x)
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    expect(result.errors).toContain('Product ID ontbreekt in surplus/deficit entry');
  });

  it('NaN available_kg returns error', () => {
    const data = makeSchemaData({
      surplus_deficit: [
        { product_id: 'filet', available_kg: NaN, ordered_kg: 50, delta_kg: NaN },
      ],
    });
    const result = validateForStorteboom(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Ongeldig beschikbaar gewicht voor product filet');
  });

  it('NaN ordered_kg returns error', () => {
    const data = makeSchemaData({
      surplus_deficit: [
        { product_id: 'filet', available_kg: 100, ordered_kg: NaN, delta_kg: NaN },
      ],
    });
    const result = validateForStorteboom(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Ongeldig besteld gewicht voor product filet');
  });
});
