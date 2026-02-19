/**
 * Integration tests: Availability + Surplus/Deficit + buildOrderSchema
 * Wave 3 — A1-S2+S3 through A2-S3+S4
 *
 * Tests the full flow: live weight -> theoretical availability -> surplus/deficit
 * Also tests buildOrderSchema produces valid OrderSchemaData suitable for export.
 *
 * REGRESSIE-CHECK:
 * - Pure function tests, no database
 * - No mocking
 */

import { describe, it, expect } from 'vitest';
import {
  computeTheoreticalAvailability,
  JA757_YIELDS,
} from '@/lib/engine/availability';
import { computeSurplusDeficit } from '@/lib/engine/orders/computeSurplusDeficit';
import { buildOrderSchema } from '@/lib/engine/orders/buildOrderSchema';
import type { OrderSchemaAvailability } from '@/types/database';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert theoretical availability output to OrderSchemaAvailability format
 * that can be fed into computeSurplusDeficit.
 */
function toOrderSchemaAvailability(
  theoretical: ReturnType<typeof computeTheoreticalAvailability>,
  location: 'putten' | 'nijkerk' = 'putten'
): OrderSchemaAvailability[] {
  return theoretical.map((t) => ({
    product_id: t.part,
    product_name: t.name,
    location,
    expected_kg: t.expected_kg,
  }));
}

// ============================================================================
// Availability -> Surplus/Deficit integration
// ============================================================================

describe('Availability + SurplusDeficit integration', () => {
  it('computeTheoreticalAvailability output feeds into computeSurplusDeficit', () => {
    const availability = computeTheoreticalAvailability(10000);
    const schemaAvailability = toOrderSchemaAvailability(availability);
    const orders = new Map<string, number>();

    // Should not throw
    const result = computeSurplusDeficit(schemaAvailability, orders);

    expect(result.length).toBe(availability.length);
  });

  it('with zero orders, surplus equals available_kg for each product', () => {
    const availability = computeTheoreticalAvailability(5000);
    const schemaAvailability = toOrderSchemaAvailability(availability);
    const emptyOrders = new Map<string, number>();

    const result = computeSurplusDeficit(schemaAvailability, emptyOrders);

    for (const sd of result) {
      expect(sd.ordered_kg).toBe(0);
      expect(sd.delta_kg).toBe(sd.available_kg);
      expect(sd.delta_kg).toBeGreaterThanOrEqual(0);
    }
  });

  it('with orders exceeding availability, delta is negative', () => {
    const availability = computeTheoreticalAvailability(1000);
    const schemaAvailability = toOrderSchemaAvailability(availability);

    // Order more than available for breast_fillet
    const breastAvail = availability.find((a) => a.part === 'breast_fillet');
    expect(breastAvail).toBeDefined();
    const excessOrder = breastAvail!.expected_kg + 100;

    const orders = new Map<string, number>([
      ['breast_fillet', excessOrder],
    ]);

    const result = computeSurplusDeficit(schemaAvailability, orders);
    const breastSd = result.find((r) => r.product_id === 'breast_fillet');

    expect(breastSd).toBeDefined();
    expect(breastSd!.delta_kg).toBeLessThan(0);
    expect(breastSd!.delta_kg).toBe(breastSd!.available_kg - excessOrder);
  });

  it('full flow: live weight -> availability -> surplus for a set of orders', () => {
    const liveWeightKg = 8000;

    // Step 1: compute availability
    const availability = computeTheoreticalAvailability(liveWeightKg);
    expect(availability.length).toBe(Object.keys(JA757_YIELDS).length);

    // Step 2: convert to schema format
    const schemaAvailability = toOrderSchemaAvailability(availability);

    // Step 3: create realistic orders
    const orders = new Map<string, number>([
      ['breast_fillet', 1500], // 8000 * 0.232 = 1856 available => surplus
      ['leg_quarter', 3000],   // 8000 * 0.282 = 2256 available => deficit
      ['wing', 200],           // 8000 * 0.076 = 608 available => surplus
    ]);

    // Step 4: compute surplus/deficit
    const result = computeSurplusDeficit(schemaAvailability, orders);

    // Verify breast_fillet: surplus
    const breastSd = result.find((r) => r.product_id === 'breast_fillet');
    expect(breastSd).toBeDefined();
    expect(breastSd!.available_kg).toBe(1856); // 8000 * 0.232
    expect(breastSd!.ordered_kg).toBe(1500);
    expect(breastSd!.delta_kg).toBe(356); // surplus

    // Verify leg_quarter: deficit
    const legSd = result.find((r) => r.product_id === 'leg_quarter');
    expect(legSd).toBeDefined();
    expect(legSd!.available_kg).toBe(2256); // 8000 * 0.282
    expect(legSd!.ordered_kg).toBe(3000);
    expect(legSd!.delta_kg).toBe(-744); // deficit

    // Verify wing: surplus
    const wingSd = result.find((r) => r.product_id === 'wing');
    expect(wingSd).toBeDefined();
    expect(wingSd!.available_kg).toBe(608); // 8000 * 0.076
    expect(wingSd!.ordered_kg).toBe(200);
    expect(wingSd!.delta_kg).toBe(408); // surplus

    // Verify unordered products still appear with full availability as surplus
    const grillerSd = result.find((r) => r.product_id === 'griller');
    expect(grillerSd).toBeDefined();
    expect(grillerSd!.ordered_kg).toBe(0);
    expect(grillerSd!.delta_kg).toBe(grillerSd!.available_kg);

    const backSd = result.find((r) => r.product_id === 'back');
    expect(backSd).toBeDefined();
    expect(backSd!.ordered_kg).toBe(0);
    expect(backSd!.delta_kg).toBe(backSd!.available_kg);
  });

  it('zero live weight gives zero availability and negative surplus for any orders', () => {
    const availability = computeTheoreticalAvailability(0);
    const schemaAvailability = toOrderSchemaAvailability(availability);

    const orders = new Map<string, number>([
      ['breast_fillet', 50],
    ]);

    const result = computeSurplusDeficit(schemaAvailability, orders);
    const breastSd = result.find((r) => r.product_id === 'breast_fillet');

    expect(breastSd).toBeDefined();
    expect(breastSd!.available_kg).toBe(0);
    expect(breastSd!.ordered_kg).toBe(50);
    expect(breastSd!.delta_kg).toBe(-50);
  });

  it('orders for products not in availability appear with available_kg = 0', () => {
    const availability = computeTheoreticalAvailability(5000);
    const schemaAvailability = toOrderSchemaAvailability(availability);

    // Order a product that does not exist in JA757_YIELDS
    const orders = new Map<string, number>([
      ['custom_product_xyz', 100],
    ]);

    const result = computeSurplusDeficit(schemaAvailability, orders);
    const customSd = result.find((r) => r.product_id === 'custom_product_xyz');

    expect(customSd).toBeDefined();
    expect(customSd!.available_kg).toBe(0);
    expect(customSd!.ordered_kg).toBe(100);
    expect(customSd!.delta_kg).toBe(-100);
  });
});

// ============================================================================
// buildOrderSchema -> valid OrderSchemaData for export
// ============================================================================

describe('buildOrderSchema produces exportable OrderSchemaData', () => {
  it('produces valid OrderSchemaData with all required fields', () => {
    const availability = computeTheoreticalAvailability(5000);
    const schemaAvailability = toOrderSchemaAvailability(availability);

    const orders = [
      {
        customer_id: 'cust-1',
        customer_name: 'Restaurant De Kroon',
        lines: [
          { product_id: 'breast_fillet', quantity_kg: 200 },
          { product_id: 'leg_quarter', quantity_kg: 100 },
        ],
      },
      {
        customer_id: 'cust-2',
        customer_name: 'Slagerij Van Dam',
        lines: [
          { product_id: 'breast_fillet', quantity_kg: 300 },
          { product_id: 'wing', quantity_kg: 50 },
        ],
      },
    ];

    const result = buildOrderSchema('slaughter-42', orders, schemaAvailability);

    // Validate structure
    expect(result.slaughter_id).toBe('slaughter-42');
    expect(result.snapshot_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.availability).toHaveLength(schemaAvailability.length);
    expect(result.orders).toHaveLength(2);
    expect(result.surplus_deficit.length).toBeGreaterThan(0);
  });

  it('surplus_deficit entries have correct aggregated ordered_kg', () => {
    const schemaAvailability: OrderSchemaAvailability[] = [
      { product_id: 'filet', product_name: 'Filet', location: 'putten', expected_kg: 500 },
    ];

    const orders = [
      {
        customer_id: 'cust-1',
        customer_name: 'A',
        lines: [{ product_id: 'filet', quantity_kg: 100 }],
      },
      {
        customer_id: 'cust-2',
        customer_name: 'B',
        lines: [{ product_id: 'filet', quantity_kg: 150 }],
      },
    ];

    const result = buildOrderSchema('slaughter-1', orders, schemaAvailability);

    const filetSd = result.surplus_deficit.find((s) => s.product_id === 'filet');
    expect(filetSd).toBeDefined();
    expect(filetSd!.ordered_kg).toBe(250); // 100 + 150
    expect(filetSd!.available_kg).toBe(500);
    expect(filetSd!.delta_kg).toBe(250);
  });

  it('schema with empty orders and availability is valid and exportable', () => {
    const result = buildOrderSchema('slaughter-empty', [], []);

    expect(result.slaughter_id).toBe('slaughter-empty');
    expect(result.orders).toEqual([]);
    expect(result.surplus_deficit).toEqual([]);
    expect(result.availability).toEqual([]);
    expect(result.snapshot_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('full end-to-end: live weight -> availability -> buildOrderSchema -> surplus check', () => {
    const liveWeightKg = 12000;

    // Step 1: availability
    const availability = computeTheoreticalAvailability(liveWeightKg);
    const schemaAvailability = toOrderSchemaAvailability(availability);

    // Step 2: customer orders
    const orders = [
      {
        customer_id: 'cust-1',
        customer_name: 'Horeca Groothandel',
        lines: [
          { product_id: 'breast_fillet', quantity_kg: 1000 },
          { product_id: 'leg_quarter', quantity_kg: 1500 },
        ],
      },
      {
        customer_id: 'cust-2',
        customer_name: 'Supermarkt Keten',
        lines: [
          { product_id: 'breast_fillet', quantity_kg: 2000 },
          { product_id: 'wing', quantity_kg: 500 },
          { product_id: 'griller', quantity_kg: 3000 },
        ],
      },
    ];

    // Step 3: build schema
    const schema = buildOrderSchema('slaughter-e2e', orders, schemaAvailability);

    // Validate structure
    expect(schema.slaughter_id).toBe('slaughter-e2e');
    expect(schema.orders).toHaveLength(2);
    expect(schema.availability).toHaveLength(5); // 5 JA757 parts

    // Validate surplus/deficit correctness
    // breast_fillet: avail = 12000 * 0.232 = 2784, ordered = 1000 + 2000 = 3000
    const breastSd = schema.surplus_deficit.find((s) => s.product_id === 'breast_fillet');
    expect(breastSd).toBeDefined();
    expect(breastSd!.available_kg).toBe(2784);
    expect(breastSd!.ordered_kg).toBe(3000);
    expect(breastSd!.delta_kg).toBe(-216); // deficit

    // leg_quarter: avail = 12000 * 0.282 = 3384, ordered = 1500
    const legSd = schema.surplus_deficit.find((s) => s.product_id === 'leg_quarter');
    expect(legSd).toBeDefined();
    expect(legSd!.available_kg).toBe(3384);
    expect(legSd!.ordered_kg).toBe(1500);
    expect(legSd!.delta_kg).toBe(1884); // surplus

    // wing: avail = 12000 * 0.076 = 912, ordered = 500
    const wingSd = schema.surplus_deficit.find((s) => s.product_id === 'wing');
    expect(wingSd).toBeDefined();
    expect(wingSd!.available_kg).toBe(912);
    expect(wingSd!.ordered_kg).toBe(500);
    expect(wingSd!.delta_kg).toBe(412); // surplus

    // griller: avail = 12000 * 0.707 = 8484, ordered = 3000
    const grillerSd = schema.surplus_deficit.find((s) => s.product_id === 'griller');
    expect(grillerSd).toBeDefined();
    expect(grillerSd!.available_kg).toBe(8484);
    expect(grillerSd!.ordered_kg).toBe(3000);
    expect(grillerSd!.delta_kg).toBe(5484); // surplus

    // back: avail = 12000 * 0.117 = 1404, ordered = 0
    const backSd = schema.surplus_deficit.find((s) => s.product_id === 'back');
    expect(backSd).toBeDefined();
    expect(backSd!.available_kg).toBe(1404);
    expect(backSd!.ordered_kg).toBe(0);
    expect(backSd!.delta_kg).toBe(1404); // full surplus

    // Every delta should equal available_kg - ordered_kg
    for (const sd of schema.surplus_deficit) {
      expect(sd.delta_kg).toBe(sd.available_kg - sd.ordered_kg);
    }
  });

  it('buildOrderSchema preserves availability data from input', () => {
    const availability: OrderSchemaAvailability[] = [
      { product_id: 'part-a', product_name: 'Part A', location: 'putten', expected_kg: 100 },
      { product_id: 'part-a', product_name: 'Part A', location: 'nijkerk', expected_kg: 75 },
    ];

    const result = buildOrderSchema('s-1', [], availability);

    expect(result.availability).toEqual(availability);
    // With no orders, availability from both locations is summed in surplus_deficit
    const partASd = result.surplus_deficit.find((s) => s.product_id === 'part-a');
    expect(partASd).toBeDefined();
    expect(partASd!.available_kg).toBe(175); // 100 + 75 aggregated
    expect(partASd!.delta_kg).toBe(175);
  });
});
