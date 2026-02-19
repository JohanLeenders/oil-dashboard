/**
 * Tests for Orders Engine: buildOrderSchema + computeSurplusDeficit
 *
 * REGRESSIE-CHECK:
 * - Pure function tests, no database
 */

import { describe, it, expect } from 'vitest';
import { buildOrderSchema } from '../buildOrderSchema';
import { computeSurplusDeficit } from '../computeSurplusDeficit';
import type { OrderSchemaAvailability } from '@/types/database';

// ============================================================================
// computeSurplusDeficit
// ============================================================================

describe('computeSurplusDeficit', () => {
  it('returns empty array when both inputs are empty', () => {
    const result = computeSurplusDeficit([], new Map());
    expect(result).toEqual([]);
  });

  it('returns negative delta when availability is empty (Wave 2 stub)', () => {
    const orders = new Map<string, number>([
      ['prod-1', 100],
      ['prod-2', 50],
    ]);
    const result = computeSurplusDeficit([], orders);

    expect(result).toHaveLength(2);

    const prod1 = result.find((r) => r.product_id === 'prod-1');
    expect(prod1).toEqual({
      product_id: 'prod-1',
      available_kg: 0,
      ordered_kg: 100,
      delta_kg: -100,
    });

    const prod2 = result.find((r) => r.product_id === 'prod-2');
    expect(prod2).toEqual({
      product_id: 'prod-2',
      available_kg: 0,
      ordered_kg: 50,
      delta_kg: -50,
    });
  });

  it('returns positive delta when availability exceeds orders', () => {
    const availability: OrderSchemaAvailability[] = [
      { product_id: 'prod-1', product_name: 'Filet', location: 'putten', expected_kg: 200 },
    ];
    const orders = new Map<string, number>([['prod-1', 150]]);
    const result = computeSurplusDeficit(availability, orders);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      product_id: 'prod-1',
      available_kg: 200,
      ordered_kg: 150,
      delta_kg: 50,
    });
  });

  it('includes products that exist only in availability', () => {
    const availability: OrderSchemaAvailability[] = [
      { product_id: 'prod-1', product_name: 'Filet', location: 'putten', expected_kg: 100 },
    ];
    const result = computeSurplusDeficit(availability, new Map());

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      product_id: 'prod-1',
      available_kg: 100,
      ordered_kg: 0,
      delta_kg: 100,
    });
  });

  it('aggregates availability across multiple locations', () => {
    const availability: OrderSchemaAvailability[] = [
      { product_id: 'prod-1', product_name: 'Filet', location: 'putten', expected_kg: 100 },
      { product_id: 'prod-1', product_name: 'Filet', location: 'nijkerk', expected_kg: 80 },
    ];
    const orders = new Map<string, number>([['prod-1', 150]]);
    const result = computeSurplusDeficit(availability, orders);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      product_id: 'prod-1',
      available_kg: 180,
      ordered_kg: 150,
      delta_kg: 30,
    });
  });
});

// ============================================================================
// buildOrderSchema
// ============================================================================

describe('buildOrderSchema', () => {
  it('returns valid schema with empty orders and empty availability', () => {
    const result = buildOrderSchema('slaughter-1', [], []);

    expect(result.slaughter_id).toBe('slaughter-1');
    expect(result.snapshot_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.availability).toEqual([]);
    expect(result.orders).toEqual([]);
    expect(result.surplus_deficit).toEqual([]);
  });

  it('builds schema with single customer and single line', () => {
    const orders = [
      {
        customer_id: 'cust-1',
        customer_name: 'Restaurant A',
        lines: [{ product_id: 'prod-1', quantity_kg: 50 }],
      },
    ];

    const result = buildOrderSchema('slaughter-1', orders, []);

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toEqual({
      customer_id: 'cust-1',
      customer_name: 'Restaurant A',
      lines: [{ product_id: 'prod-1', quantity_kg: 50 }],
    });

    expect(result.surplus_deficit).toHaveLength(1);
    expect(result.surplus_deficit[0].ordered_kg).toBe(50);
    expect(result.surplus_deficit[0].delta_kg).toBe(-50);
  });

  it('aggregates orders from multiple customers for the same product', () => {
    const orders = [
      {
        customer_id: 'cust-1',
        customer_name: 'Restaurant A',
        lines: [{ product_id: 'prod-1', quantity_kg: 30 }],
      },
      {
        customer_id: 'cust-2',
        customer_name: 'Slagerij B',
        lines: [{ product_id: 'prod-1', quantity_kg: 70 }],
      },
    ];

    const result = buildOrderSchema('slaughter-1', orders, []);

    expect(result.orders).toHaveLength(2);
    const sd = result.surplus_deficit.find((s) => s.product_id === 'prod-1');
    expect(sd).toBeDefined();
    expect(sd!.ordered_kg).toBe(100);
    expect(sd!.delta_kg).toBe(-100);
  });

  it('handles multiple products across multiple customers', () => {
    const orders = [
      {
        customer_id: 'cust-1',
        customer_name: 'Restaurant A',
        lines: [
          { product_id: 'prod-1', quantity_kg: 20 },
          { product_id: 'prod-2', quantity_kg: 15 },
        ],
      },
      {
        customer_id: 'cust-2',
        customer_name: 'Slagerij B',
        lines: [
          { product_id: 'prod-1', quantity_kg: 30 },
          { product_id: 'prod-3', quantity_kg: 10 },
        ],
      },
    ];

    const result = buildOrderSchema('slaughter-1', orders, []);

    expect(result.surplus_deficit).toHaveLength(3);

    const sd1 = result.surplus_deficit.find((s) => s.product_id === 'prod-1');
    expect(sd1!.ordered_kg).toBe(50);

    const sd2 = result.surplus_deficit.find((s) => s.product_id === 'prod-2');
    expect(sd2!.ordered_kg).toBe(15);

    const sd3 = result.surplus_deficit.find((s) => s.product_id === 'prod-3');
    expect(sd3!.ordered_kg).toBe(10);
  });

  it('includes availability data in schema output', () => {
    const availability: OrderSchemaAvailability[] = [
      { product_id: 'prod-1', product_name: 'Filet', location: 'putten', expected_kg: 200 },
    ];

    const orders = [
      {
        customer_id: 'cust-1',
        customer_name: 'Restaurant A',
        lines: [{ product_id: 'prod-1', quantity_kg: 150 }],
      },
    ];

    const result = buildOrderSchema('slaughter-1', orders, availability);

    expect(result.availability).toHaveLength(1);
    expect(result.availability[0]).toEqual(availability[0]);

    const sd = result.surplus_deficit.find((s) => s.product_id === 'prod-1');
    expect(sd!.available_kg).toBe(200);
    expect(sd!.ordered_kg).toBe(150);
    expect(sd!.delta_kg).toBe(50);
  });

  it('preserves customer order structure with all lines', () => {
    const orders = [
      {
        customer_id: 'cust-1',
        customer_name: 'Restaurant A',
        lines: [
          { product_id: 'prod-1', quantity_kg: 10 },
          { product_id: 'prod-2', quantity_kg: 20 },
          { product_id: 'prod-3', quantity_kg: 30 },
        ],
      },
    ];

    const result = buildOrderSchema('slaughter-1', orders, []);

    expect(result.orders[0].lines).toHaveLength(3);
    expect(result.orders[0].lines[0]).toEqual({ product_id: 'prod-1', quantity_kg: 10 });
    expect(result.orders[0].lines[1]).toEqual({ product_id: 'prod-2', quantity_kg: 20 });
    expect(result.orders[0].lines[2]).toEqual({ product_id: 'prod-3', quantity_kg: 30 });
  });
});
