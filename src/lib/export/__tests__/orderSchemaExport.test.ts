/**
 * Integration tests for Excel Export + Order Schema
 * Wave 3 — A2-S3: exportOrderSchemaToExcel
 *
 * REGRESSIE-CHECK:
 * - Pure function tests, no database
 * - Verifies xlsx binary output can be parsed back
 * - Verifies sheet names, data rows, metadata
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { exportOrderSchemaToExcel } from '@/lib/export/orderSchemaExport';
import type { OrderSchemaData } from '@/types/database';

// ============================================================================
// Helpers
// ============================================================================

function makeSchemaData(overrides?: Partial<OrderSchemaData>): OrderSchemaData {
  return {
    slaughter_id: 'slaughter-test-1',
    snapshot_date: '2026-02-19',
    availability: [],
    orders: [],
    surplus_deficit: [],
    ...overrides,
  };
}

// ============================================================================
// exportOrderSchemaToExcel
// ============================================================================

describe('exportOrderSchemaToExcel', () => {
  it('returns a Uint8Array', () => {
    const data = makeSchemaData();
    const result = exportOrderSchemaToExcel(data, '2026-02-20');

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('output is valid xlsx with sheet names Bestelschema and Info', () => {
    const data = makeSchemaData({
      surplus_deficit: [
        { product_id: 'filet', available_kg: 200, ordered_kg: 150, delta_kg: 50 },
      ],
    });

    const buf = exportOrderSchemaToExcel(data, '2026-02-20');
    const wb = XLSX.read(buf, { type: 'array' });

    expect(wb.SheetNames).toContain('Bestelschema');
    expect(wb.SheetNames).toContain('Info');
    expect(wb.SheetNames).toHaveLength(2);
  });

  it('Bestelschema data rows match surplus_deficit entries', () => {
    const surplus = [
      { product_id: 'filet', available_kg: 200, ordered_kg: 150, delta_kg: 50 },
      { product_id: 'bout', available_kg: 300, ordered_kg: 350, delta_kg: -50 },
      { product_id: 'vleugel', available_kg: 80, ordered_kg: 80, delta_kg: 0 },
    ];

    const data = makeSchemaData({ surplus_deficit: surplus });
    const buf = exportOrderSchemaToExcel(data, '2026-02-20');
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets['Bestelschema'];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    expect(rows).toHaveLength(3);

    // Verify each row maps to the correct surplus_deficit entry
    expect(rows[0]['Product']).toBe('filet');
    expect(rows[0]['Beschikbaar (kg)']).toBe(200);
    expect(rows[0]['Besteld (kg)']).toBe(150);
    expect(rows[0]['Surplus/Deficit (kg)']).toBe(50);

    expect(rows[1]['Product']).toBe('bout');
    expect(rows[1]['Beschikbaar (kg)']).toBe(300);
    expect(rows[1]['Besteld (kg)']).toBe(350);
    expect(rows[1]['Surplus/Deficit (kg)']).toBe(-50);

    expect(rows[2]['Product']).toBe('vleugel');
    expect(rows[2]['Beschikbaar (kg)']).toBe(80);
    expect(rows[2]['Besteld (kg)']).toBe(80);
    expect(rows[2]['Surplus/Deficit (kg)']).toBe(0);
  });

  it('handles empty surplus_deficit gracefully (no data rows)', () => {
    const data = makeSchemaData({ surplus_deficit: [] });
    const buf = exportOrderSchemaToExcel(data, '2026-02-20');
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets['Bestelschema'];
    const rows = XLSX.utils.sheet_to_json(ws);

    // With no data, json_to_sheet produces an empty sheet (header row only or empty)
    expect(rows).toHaveLength(0);
  });

  it('handles empty orders gracefully', () => {
    const data = makeSchemaData({
      orders: [],
      surplus_deficit: [
        { product_id: 'filet', available_kg: 100, ordered_kg: 0, delta_kg: 100 },
      ],
    });

    const buf = exportOrderSchemaToExcel(data, '2026-02-20');
    const wb = XLSX.read(buf, { type: 'array' });

    // Info sheet should show 0 orders
    const infoWs = wb.Sheets['Info'];
    const infoRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(infoWs);
    const orderCountRow = infoRows.find((r) => r['Veld'] === 'Aantal orders');
    expect(orderCountRow).toBeDefined();
    expect(orderCountRow!['Waarde']).toBe(0);
  });

  it('Info sheet contains slaughter date', () => {
    const data = makeSchemaData();
    const slaughterDate = '2026-03-05';
    const buf = exportOrderSchemaToExcel(data, slaughterDate);
    const wb = XLSX.read(buf, { type: 'array' });
    const infoWs = wb.Sheets['Info'];
    const infoRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(infoWs);

    const slaughterRow = infoRows.find((r) => r['Veld'] === 'Slachtdatum');
    expect(slaughterRow).toBeDefined();
    expect(slaughterRow!['Waarde']).toBe('2026-03-05');
  });

  it('Info sheet contains generation date (today)', () => {
    const data = makeSchemaData();
    const buf = exportOrderSchemaToExcel(data, '2026-02-20');
    const wb = XLSX.read(buf, { type: 'array' });
    const infoWs = wb.Sheets['Info'];
    const infoRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(infoWs);

    const generatedRow = infoRows.find((r) => r['Veld'] === 'Gegenereerd');
    expect(generatedRow).toBeDefined();
    // Should be today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    expect(generatedRow!['Waarde']).toBe(today);
  });

  it('Info sheet contains order count matching orders array length', () => {
    const data = makeSchemaData({
      orders: [
        {
          customer_id: 'cust-1',
          customer_name: 'Restaurant A',
          lines: [{ product_id: 'filet', quantity_kg: 50 }],
        },
        {
          customer_id: 'cust-2',
          customer_name: 'Slagerij B',
          lines: [{ product_id: 'bout', quantity_kg: 30 }],
        },
      ],
      surplus_deficit: [
        { product_id: 'filet', available_kg: 100, ordered_kg: 50, delta_kg: 50 },
        { product_id: 'bout', available_kg: 100, ordered_kg: 30, delta_kg: 70 },
      ],
    });

    const buf = exportOrderSchemaToExcel(data, '2026-02-20');
    const wb = XLSX.read(buf, { type: 'array' });
    const infoWs = wb.Sheets['Info'];
    const infoRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(infoWs);

    const orderCountRow = infoRows.find((r) => r['Veld'] === 'Aantal orders');
    expect(orderCountRow).toBeDefined();
    expect(orderCountRow!['Waarde']).toBe(2);
  });

  it('large dataset with many surplus_deficit entries produces correct row count', () => {
    const surplus = Array.from({ length: 50 }, (_, i) => ({
      product_id: `product-${i}`,
      available_kg: 100 + i,
      ordered_kg: 50 + i,
      delta_kg: 50,
    }));

    const data = makeSchemaData({ surplus_deficit: surplus });
    const buf = exportOrderSchemaToExcel(data, '2026-02-20');
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets['Bestelschema'];
    const rows = XLSX.utils.sheet_to_json(ws);

    expect(rows).toHaveLength(50);
  });
});
