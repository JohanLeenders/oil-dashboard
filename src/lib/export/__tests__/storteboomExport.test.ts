/**
 * Tests for Storteboom Bestelschema Excel Export — Wave 8
 *
 * REGRESSIE-CHECK:
 * - Pure function tests, no database
 * - Verifies xlsx binary output can be parsed back
 * - Verifies exact layout, NL number format, dynamic columns
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  exportStorteboomBestelschema,
  formatNL,
  formatPct,
  type StorteboomExportInput,
} from '@/lib/export/orderSchemaExport';

// ============================================================================
// Helper: build a valid StorteboomExportInput
// ============================================================================

function makeInput(overrides?: Partial<StorteboomExportInput>): StorteboomExportInput {
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
      {
        product_id: 'p-vleugel',
        description: 'Vleugels z tip',
        article_number_vacuum: null,
        article_number_niet_vacuum: '382750',
        yield_pct: 0.0957,
        kg_from_slaughter: 2848,
        packaging_size: '10kg',
      },
    ],

    nijkerk_products: [
      {
        product_id: 'n-filet',
        description: 'OH flt half, zonder vel zonder haas',
        article_number_vacuum: '540457',
        article_number_niet_vacuum: '540327',
        yield_pct: 0.2442,
        kg_from_slaughter: 7268,
        source_product: 'Borstkappen',
        packaging_size: '15kg',
      },
      {
        product_id: 'n-dijfilet',
        description: 'Dijfilet 15 kg vacuum',
        article_number_vacuum: '392940',
        article_number_niet_vacuum: '392841',
        yield_pct: 0.0925,
        kg_from_slaughter: 2753,
        source_product: 'Zadels',
        packaging_size: '15kg',
      },
    ],

    customer_orders: [],
    ...overrides,
  };
}

function parseExcel(buffer: Uint8Array) {
  return XLSX.read(buffer, { type: 'array' });
}

function getSheetCells(wb: XLSX.WorkBook, sheetIndex = 0): Record<string, XLSX.CellObject> {
  const sheetName = wb.SheetNames[sheetIndex];
  return wb.Sheets[sheetName] as unknown as Record<string, XLSX.CellObject>;
}

function getCellValue(ws: Record<string, any>, cell: string): any {
  return ws[cell]?.v;
}

function findCellWithValue(ws: Record<string, any>, searchValue: string): string | null {
  for (const key of Object.keys(ws)) {
    if (key.startsWith('!')) continue;
    if (ws[key]?.v === searchValue) return key;
  }
  return null;
}

// ============================================================================
// Tests
// ============================================================================

describe('exportStorteboomBestelschema', () => {
  it('1. generates valid Excel buffer (Uint8Array with length > 0)', () => {
    const buf = exportStorteboomBestelschema(makeInput());
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(100);
  });

  it('2. sheet name matches DD-MM-YYYY format', () => {
    const buf = exportStorteboomBestelschema(makeInput());
    const wb = parseExcel(buf);
    expect(wb.SheetNames[0]).toBe('24-11-2025');
  });

  it('3. Algemeen section has correct lot number and mester', () => {
    const buf = exportStorteboomBestelschema(makeInput());
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    // Find "Lotnummer" cell and check the value next to it
    const lotCell = findCellWithValue(ws, 'Lotnummer');
    expect(lotCell).not.toBeNull();
    // Value in the next column
    const lotRow = lotCell!.match(/\d+/)![0];
    expect(getCellValue(ws, `B${lotRow}`)).toBe('P2520310');

    const mesterCell = findCellWithValue(ws, 'Mester');
    expect(mesterCell).not.toBeNull();
    const mesterRow = mesterCell!.match(/\d+/)![0];
    expect(getCellValue(ws, `B${mesterRow}`)).toBe('Leenders');
  });

  it('4. Aanvoer section has correct bird count and weight', () => {
    const buf = exportStorteboomBestelschema(makeInput());
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    const aanvoerCell = findCellWithValue(ws, 'Levende Kuikens');
    expect(aanvoerCell).not.toBeNull();
    const row = aanvoerCell!.match(/\d+/)![0];
    // Bird count in NL format
    expect(getCellValue(ws, `B${row}`)).toBe('15.820');
    // Weight in NL format
    expect(getCellValue(ws, `C${row}`)).toBe('41.923');
  });

  it('5. griller yield displays as percentage (not decimal)', () => {
    const buf = exportStorteboomBestelschema(makeInput());
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    // Find the griller yield percentage
    const grillerCell = findCellWithValue(ws, '71,0%');
    expect(grillerCell).not.toBeNull();
  });

  it('6. hele hoenen pulls are included when present', () => {
    const input = makeInput({
      whole_bird_pulls: [
        { label: '1500', count: 100, total_kg: 150 },
        { label: '1600', count: 200, total_kg: 320 },
      ],
    });
    const buf = exportStorteboomBestelschema(input);
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    // Should find pull category labels
    const pull1 = findCellWithValue(ws, '1500');
    expect(pull1).not.toBeNull();
    const pull2 = findCellWithValue(ws, '1600');
    expect(pull2).not.toBeNull();
  });

  it('7. hele hoenen pulls omitted when empty', () => {
    const input = makeInput({ whole_bird_pulls: [] });
    const buf = exportStorteboomBestelschema(input);
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    // Should NOT find "Categorie" header for pulls section (used as H-column header)
    const catCell = findCellWithValue(ws, 'Categorie');
    expect(catCell).toBeNull();
  });

  it('8. Putten products listed with article numbers', () => {
    const buf = exportStorteboomBestelschema(makeInput());
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    // Find "Borstkappen met vel" in the grid
    const borstkap = findCellWithValue(ws, 'Borstkappen met vel');
    expect(borstkap).not.toBeNull();
    // Art.nr should be nearby
    const artNr = findCellWithValue(ws, '325016');
    expect(artNr).not.toBeNull();
  });

  it('9. Nijkerk products listed with article numbers', () => {
    const buf = exportStorteboomBestelschema(makeInput());
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    const filet = findCellWithValue(ws, 'OH flt half, zonder vel zonder haas');
    expect(filet).not.toBeNull();
    const vacArt = findCellWithValue(ws, '540457');
    expect(vacArt).not.toBeNull();
    const nietVacArt = findCellWithValue(ws, '540327');
    expect(nietVacArt).not.toBeNull();
  });

  it('10. customer orders create correct number of columns', () => {
    const input = makeInput({
      customer_orders: [
        {
          customer_id: 'c1', customer_name: 'Grutto',
          delivery_address: 'Addr1', transport_by_koops: true,
          putten_delivery_day: 'dinsdag', nijkerk_delivery_day: 'woensdag',
          putten_lines: [{ product_id: 'p-borst', quantity_kg: 100 }],
          nijkerk_lines: [],
        },
        {
          customer_id: 'c2', customer_name: 'Crisp',
          delivery_address: 'Addr2', transport_by_koops: false,
          putten_delivery_day: 'dinsdag', nijkerk_delivery_day: null,
          putten_lines: [{ product_id: 'p-borst', quantity_kg: 200 }],
          nijkerk_lines: [],
        },
      ],
    });
    const buf = exportStorteboomBestelschema(input);
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    // Both customer names should appear
    expect(findCellWithValue(ws, 'Grutto')).not.toBeNull();
    expect(findCellWithValue(ws, 'Crisp')).not.toBeNull();
  });

  it('11. REST column = beschikbaar − totaal besteld', () => {
    const input = makeInput({
      customer_orders: [
        {
          customer_id: 'c1', customer_name: 'Grutto',
          delivery_address: null, transport_by_koops: false,
          putten_delivery_day: null, nijkerk_delivery_day: null,
          putten_lines: [{ product_id: 'p-borst', quantity_kg: 3000 }],
          nijkerk_lines: [],
        },
      ],
    });
    const buf = exportStorteboomBestelschema(input);
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    // REST for borstkappen: 10938 - 3000 = 7938
    const restCell = findCellWithValue(ws, '7.938');
    expect(restCell).not.toBeNull();
  });

  it('12. Totaal column = SOM(alle klant-orders)', () => {
    const input = makeInput({
      customer_orders: [
        {
          customer_id: 'c1', customer_name: 'Grutto',
          delivery_address: null, transport_by_koops: false,
          putten_delivery_day: null, nijkerk_delivery_day: null,
          putten_lines: [{ product_id: 'p-borst', quantity_kg: 1000 }],
          nijkerk_lines: [],
        },
        {
          customer_id: 'c2', customer_name: 'Crisp',
          delivery_address: null, transport_by_koops: false,
          putten_delivery_day: null, nijkerk_delivery_day: null,
          putten_lines: [{ product_id: 'p-borst', quantity_kg: 2000 }],
          nijkerk_lines: [],
        },
      ],
    });
    const buf = exportStorteboomBestelschema(input);
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    // Totaal for borstkappen: 1000 + 2000 = 3000
    const totaalCell = findCellWithValue(ws, '3.000');
    expect(totaalCell).not.toBeNull();
  });

  it('13. transport info included per klant', () => {
    const input = makeInput({
      customer_orders: [
        {
          customer_id: 'c1', customer_name: 'Driessen',
          delivery_address: 'Tennesseedreef 24',
          transport_by_koops: false,
          putten_delivery_day: 'woensdag', nijkerk_delivery_day: null,
          putten_lines: [{ product_id: 'p-borst', quantity_kg: 100 }],
          nijkerk_lines: [],
        },
      ],
    });
    const buf = exportStorteboomBestelschema(input);
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    expect(findCellWithValue(ws, 'Tennesseedreef 24')).not.toBeNull();
    expect(findCellWithValue(ws, 'Nee')).not.toBeNull();
    expect(findCellWithValue(ws, 'Woensdag')).not.toBeNull();
  });

  it('14. NL number format (punt duizendtal)', () => {
    // Verify the formatNL helper
    expect(formatNL(15820)).toBe('15.820');
    expect(formatNL(41923)).toBe('41.923');
    expect(formatNL(2.65)).toBe('2,65');
    expect(formatNL(0)).toBe('0');
    expect(formatNL(1000000)).toBe('1.000.000');

    // Verify in actual Excel
    const buf = exportStorteboomBestelschema(makeInput());
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    expect(findCellWithValue(ws, '15.820')).not.toBeNull();
  });

  it('15. empty orders → no klant-kolommen, only product list with full REST', () => {
    const input = makeInput({ customer_orders: [] });
    const buf = exportStorteboomBestelschema(input);
    const wb = parseExcel(buf);
    const ws = getSheetCells(wb);

    // No customer headers, but product list should still exist
    expect(findCellWithValue(ws, 'Borstkappen met vel')).not.toBeNull();
    // No "Afleveradres" header (only appears with customer orders)
    expect(findCellWithValue(ws, 'Afleveradres')).toBeNull();
  });
});

describe('formatNL', () => {
  it('formats integers with thousand separators', () => {
    expect(formatNL(15820)).toBe('15.820');
    expect(formatNL(1000)).toBe('1.000');
    expect(formatNL(999)).toBe('999');
    expect(formatNL(0)).toBe('0');
  });

  it('formats decimals with comma', () => {
    expect(formatNL(2.65)).toBe('2,65');
    expect(formatNL(1.8815, 4)).toBe('1,8815');
  });
});

describe('formatPct', () => {
  it('converts 0.0-1.0 to percentage string', () => {
    expect(formatPct(0.71)).toBe('71,0%');
    expect(formatPct(0.3675)).toBe('36,75%');
    expect(formatPct(0.0957)).toBe('9,57%');
    expect(formatPct(0.0019)).toBe('0,19%');
  });
});
