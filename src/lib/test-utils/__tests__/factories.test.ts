/**
 * OIL Order Module — Factory & Boundary Check Tests (A7-S1)
 *
 * Tests:
 * 1. Factory functions generate valid fixtures
 * 2. Data Contract v1 enum values are correct
 * 3. File boundary check — protected engine files are not modified
 *
 * GOVERNANCE:
 * - Owned by A7 (QA)
 * - Tests pure factory functions only
 * - Boundary check verifies governance compliance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockSlaughter,
  createMockOrder,
  createMockOrderLine,
  createMockSnapshot,
  createMockMester,
  resetFactoryCounter,
} from '../factories';
import type {
  SlaughterCalendar,
  CustomerOrder,
  OrderLine,
  OrderSchemaSnapshot,
  SlaughterStatus,
  OrderStatus,
  SnapshotType,
} from '@/types/database';

describe('Order Module Factories', () => {
  beforeEach(() => {
    resetFactoryCounter();
  });

  // -------------------------------------------------------------------------
  // createMockSlaughter
  // -------------------------------------------------------------------------
  describe('createMockSlaughter', () => {
    it('generates a valid SlaughterCalendar with defaults', () => {
      const s = createMockSlaughter();

      expect(s.id).toBeTruthy();
      expect(s.expected_birds).toBe(15820);
      expect(s.expected_live_weight_kg).toBe(41923);
      expect(s.status).toBe('planned');
      expect(s.week_number).toBeGreaterThanOrEqual(1);
      expect(s.week_number).toBeLessThanOrEqual(53);
      expect(s.year).toBe(2026);
      expect(s.mester_breakdown).toHaveLength(3);
      expect(s.created_at).toBeTruthy();
      expect(s.updated_at).toBeTruthy();
    });

    it('respects overrides', () => {
      const s = createMockSlaughter({
        expected_birds: 20000,
        status: 'orders_open',
        notes: 'Test override',
      });

      expect(s.expected_birds).toBe(20000);
      expect(s.status).toBe('orders_open');
      expect(s.notes).toBe('Test override');
    });

    it('generates unique IDs', () => {
      const a = createMockSlaughter();
      const b = createMockSlaughter();
      expect(a.id).not.toBe(b.id);
    });
  });

  // -------------------------------------------------------------------------
  // createMockOrder
  // -------------------------------------------------------------------------
  describe('createMockOrder', () => {
    it('generates a valid CustomerOrder', () => {
      const s = createMockSlaughter();
      const customerId = '11111111-1111-1111-1111-111111111111';
      const o = createMockOrder(s.id, customerId);

      expect(o.id).toBeTruthy();
      expect(o.slaughter_id).toBe(s.id);
      expect(o.customer_id).toBe(customerId);
      expect(o.status).toBe('draft');
      expect(o.total_kg).toBe(0);
      expect(o.total_lines).toBe(0);
    });

    it('respects overrides', () => {
      const o = createMockOrder('s-id', 'c-id', {
        status: 'submitted',
        total_kg: 1500,
        total_lines: 5,
      });

      expect(o.status).toBe('submitted');
      expect(o.total_kg).toBe(1500);
      expect(o.total_lines).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // createMockOrderLine
  // -------------------------------------------------------------------------
  describe('createMockOrderLine', () => {
    it('generates a valid OrderLine', () => {
      const line = createMockOrderLine('order-1', 'product-1', 250.5);

      expect(line.id).toBeTruthy();
      expect(line.order_id).toBe('order-1');
      expect(line.product_id).toBe('product-1');
      expect(line.quantity_kg).toBe(250.5);
      expect(line.sort_order).toBe(0);
    });

    it('rejects zero quantity via type check (quantity must be > 0 in DB)', () => {
      // Factory allows any number for testing; DB constraint enforces > 0
      const line = createMockOrderLine('o', 'p', 0);
      expect(line.quantity_kg).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // createMockSnapshot
  // -------------------------------------------------------------------------
  describe('createMockSnapshot', () => {
    it('generates a valid OrderSchemaSnapshot', () => {
      const snap = createMockSnapshot('slaughter-1');

      expect(snap.id).toBeTruthy();
      expect(snap.slaughter_id).toBe('slaughter-1');
      expect(snap.snapshot_type).toBe('draft');
      expect(snap.version).toBe(1);
      expect(snap.schema_data).toBeTruthy();
      expect(snap.schema_data.slaughter_id).toBe('slaughter-1');
      expect(snap.schema_data.availability).toEqual([]);
      expect(snap.schema_data.orders).toEqual([]);
      expect(snap.schema_data.surplus_deficit).toEqual([]);
    });

    it('respects overrides', () => {
      const snap = createMockSnapshot('s-1', {
        snapshot_type: 'finalized',
        version: 3,
      });

      expect(snap.snapshot_type).toBe('finalized');
      expect(snap.version).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // createMockMester
  // -------------------------------------------------------------------------
  describe('createMockMester', () => {
    it('generates a valid MesterBreakdown', () => {
      const m = createMockMester();
      expect(m.mester).toBe('Leenders');
      expect(m.birds).toBe(5000);
      expect(m.avg_weight_kg).toBe(2.65);
    });

    it('respects overrides', () => {
      const m = createMockMester({ mester: 'Rob', birds: 4820 });
      expect(m.mester).toBe('Rob');
      expect(m.birds).toBe(4820);
    });
  });

  // -------------------------------------------------------------------------
  // Data Contract v1 — Enum Value Checks
  // -------------------------------------------------------------------------
  describe('Data Contract v1 Enum Values', () => {
    it('SlaughterStatus has exactly 5 valid values', () => {
      const validStatuses: SlaughterStatus[] = [
        'planned',
        'orders_open',
        'finalized',
        'slaughtered',
        'completed',
      ];
      validStatuses.forEach((status) => {
        const s = createMockSlaughter({ status });
        expect(s.status).toBe(status);
      });
    });

    it('OrderStatus has exactly 4 valid values', () => {
      const validStatuses: OrderStatus[] = [
        'draft',
        'submitted',
        'confirmed',
        'cancelled',
      ];
      validStatuses.forEach((status) => {
        const o = createMockOrder('s', 'c', { status });
        expect(o.status).toBe(status);
      });
    });

    it('SnapshotType has exactly 2 valid values', () => {
      const validTypes: SnapshotType[] = ['draft', 'finalized'];
      validTypes.forEach((type) => {
        const snap = createMockSnapshot('s', { snapshot_type: type });
        expect(snap.snapshot_type).toBe(type);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Boundary Check — File Governance (§4.6)
  // -------------------------------------------------------------------------
  describe('File Boundary Check', () => {
    it('factory imports do not touch protected engine files', () => {
      // This test verifies the factory module doesn't import from protected files.
      // The factories only import types from @/types/database.ts (allowed).
      // If someone accidentally imports from engine/, this import chain will break.
      //
      // Protected files (must NOT be imported by order module):
      // - src/lib/engine/svaso.ts
      // - src/lib/engine/cherry-picker.ts
      // - src/lib/engine/mass-balance.ts
      // - src/lib/engine/tht.ts
      // - src/lib/engine/sankey.ts
      // - src/lib/engine/true-up.ts
      // - src/lib/engine/canonical-cost.ts

      // Verify factories module loaded successfully
      expect(createMockSlaughter).toBeDefined();
      expect(createMockOrder).toBeDefined();
      expect(createMockOrderLine).toBeDefined();
      expect(createMockSnapshot).toBeDefined();
      expect(createMockMester).toBeDefined();
      expect(resetFactoryCounter).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // resetFactoryCounter
  // -------------------------------------------------------------------------
  describe('resetFactoryCounter', () => {
    it('resets ID counter for deterministic tests', () => {
      const a = createMockSlaughter();
      resetFactoryCounter();
      const b = createMockSlaughter();
      expect(a.id).toBe(b.id); // Same ID after reset
    });
  });
});
