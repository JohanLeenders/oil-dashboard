/**
 * OIL Order Module — Test Factories (A7-S1)
 *
 * Factory functions that generate valid test fixtures for the order module.
 * Each factory returns a complete, valid object with sensible defaults.
 * All fields can be overridden via the `overrides` parameter.
 *
 * Based on Data Contracts v1 (§4.9) and real data from bestelschema 24-11-2025.
 *
 * GOVERNANCE:
 * - File owned by A7 (QA)
 * - Types imported from database.ts (owned by A0)
 * - No side effects — pure factory functions
 */

import type {
  SlaughterCalendar,
  CustomerOrder,
  OrderLine,
  OrderSchemaSnapshot,
  OrderSchemaData,
  MesterBreakdown,
  SlaughterStatus,
  OrderStatus,
  SnapshotType,
} from '@/types/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;
function nextId(): string {
  counter += 1;
  return `00000000-0000-4000-a000-${String(counter).padStart(12, '0')}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function isoDate(daysFromNow = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Slaughter Calendar
// ---------------------------------------------------------------------------

/**
 * Creates a mock slaughter calendar entry.
 * Default: ~15,820 birds, ~41,923 kg live weight (bestelschema 24-11-2025 reference).
 */
export function createMockSlaughter(
  overrides?: Partial<SlaughterCalendar>
): SlaughterCalendar {
  const now = isoNow();
  return {
    id: nextId(),
    slaughter_date: isoDate(14), // 2 weeks from now
    week_number: 8,
    year: 2026,
    expected_birds: 15820,
    expected_live_weight_kg: 41923,
    mester_breakdown: [
      { mester: 'Leenders', birds: 8000, avg_weight_kg: 2.65 },
      { mester: 'Rob', birds: 4820, avg_weight_kg: 2.65 },
      { mester: 'Kuinre', birds: 3000, avg_weight_kg: 2.65 },
    ],
    slaughter_location: 'putten',
    status: 'planned' as SlaughterStatus,
    order_deadline: null,
    notes: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Customer Order
// ---------------------------------------------------------------------------

/**
 * Creates a mock customer order.
 */
export function createMockOrder(
  slaughterId: string,
  customerId: string,
  overrides?: Partial<CustomerOrder>
): CustomerOrder {
  const now = isoNow();
  return {
    id: nextId(),
    slaughter_id: slaughterId,
    customer_id: customerId,
    status: 'draft' as OrderStatus,
    total_kg: 0,
    total_lines: 0,
    notes: null,
    submitted_at: null,
    confirmed_at: null,
    confirmed_by: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Order Line
// ---------------------------------------------------------------------------

/**
 * Creates a mock order line.
 */
export function createMockOrderLine(
  orderId: string,
  productId: string,
  quantityKg: number,
  overrides?: Partial<OrderLine>
): OrderLine {
  const now = isoNow();
  return {
    id: nextId(),
    order_id: orderId,
    product_id: productId,
    quantity_kg: quantityKg,
    quantity_pieces: null,
    unit_price_eur: null,
    notes: null,
    sort_order: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Order Schema Snapshot
// ---------------------------------------------------------------------------

/**
 * Creates a mock order schema snapshot.
 * The schema_data field follows Data Contract v1 (§4.9).
 */
export function createMockSnapshot(
  slaughterId: string,
  overrides?: Partial<OrderSchemaSnapshot>
): OrderSchemaSnapshot {
  const now = isoNow();
  const defaultSchemaData: OrderSchemaData = {
    slaughter_id: slaughterId,
    snapshot_date: now,
    availability: [],
    orders: [],
    surplus_deficit: [],
  };

  return {
    id: nextId(),
    slaughter_id: slaughterId,
    snapshot_type: 'draft' as SnapshotType,
    schema_data: defaultSchemaData,
    version: 1,
    snapshot_date: now,
    notes: null,
    created_at: now,
    created_by: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mester Breakdown (helper for slaughter calendar)
// ---------------------------------------------------------------------------

/**
 * Creates a mock mester breakdown entry.
 */
export function createMockMester(
  overrides?: Partial<MesterBreakdown>
): MesterBreakdown {
  return {
    mester: 'Leenders',
    birds: 5000,
    avg_weight_kg: 2.65,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset counter (for test isolation)
// ---------------------------------------------------------------------------

/**
 * Resets the internal ID counter. Call in beforeEach() for deterministic IDs.
 */
export function resetFactoryCounter(): void {
  counter = 0;
}
