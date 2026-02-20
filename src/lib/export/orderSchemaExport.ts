/**
 * Storteboom Bestelschema Excel Export — Wave 8
 *
 * Generates a Storteboom-exact Excel bestelschema with:
 * - Sheet name = DD-MM-YYYY
 * - Left half (A–J): PUTTEN (Dag 0)
 * - Right half (M–T+): NIJKERK (Dag +1)
 * - 8 sections: Algemeen → Aanvoer → Rendement → Hele hoenen eruit →
 *   Inpak delen → Beschikbaarheid → Orders productlijst → Klant-orders
 * - NL number format (punt duizendtal, komma decimaal)
 * - Dynamic customer columns with REST + Totaal
 *
 * REGRESSIE-CHECK:
 * - Pure function, no DB access
 * - Returns Uint8Array buffer
 */
import * as XLSX from 'xlsx';

// ============================================================================
// Types
// ============================================================================

export interface StorteboomExportInput {
  // Algemeen
  slaughter_date: string;          // ISO date
  lot_number: string;              // e.g. "P2520310"
  mester: string;                  // e.g. "Leenders"
  ras: string;                     // e.g. "Oranjehoen"
  hok_count: number;               // e.g. 2

  // Aanvoer
  total_birds: number;
  total_live_weight_kg: number;
  avg_live_weight_kg: number;
  dead_on_arrival: number;
  dead_weight_kg: number;

  // Rendement
  griller_yield_pct: number;       // 0.0-1.0
  griller_kg: number;
  griller_count: number;
  avg_griller_weight_kg: number;
  rejected_count: number;
  rejected_weight_kg: number;

  // Hele hoenen eruit (uit simulator)
  whole_bird_pulls: {
    label: string;       // "1300-1600", "1700-1800", etc.
    count: number;
    total_kg: number;
  }[];
  remaining_birds_for_cutting: number;
  remaining_griller_kg: number;
  adjusted_avg_griller_weight: number;

  // Beschikbaarheid Putten
  putten_products: {
    product_id: string;
    description: string;
    article_number_vacuum: string | null;
    article_number_niet_vacuum: string | null;
    yield_pct: number | null;      // 0.0-1.0
    kg_from_slaughter: number;
    packaging_size: string | null;
  }[];

  // Beschikbaarheid Nijkerk
  nijkerk_products: {
    product_id: string;
    description: string;
    article_number_vacuum: string | null;
    article_number_niet_vacuum: string | null;
    yield_pct: number | null;
    kg_from_slaughter: number;
    source_product: string;        // which Putten product it cascades from
    packaging_size: string | null;
  }[];

  // Orders per klant
  customer_orders: {
    customer_id: string;
    customer_name: string;
    delivery_address: string | null;
    transport_by_koops: boolean | null;
    putten_delivery_day: string | null;
    nijkerk_delivery_day: string | null;
    putten_lines: { product_id: string; quantity_kg: number }[];
    nijkerk_lines: { product_id: string; quantity_kg: number }[];
  }[];
}

// ============================================================================
// NL Number Formatting
// ============================================================================

/**
 * Format a number in Dutch style: punt for thousands, comma for decimals.
 * formatNL(15820)     → "15.820"
 * formatNL(2.65)      → "2,65"
 * formatNL(41923.5)   → "41.924"   (rounded to int if > 10)
 */
export function formatNL(n: number, decimals?: number): string {
  if (n === 0) return '0';
  const dec = decimals ?? (Math.abs(n) >= 10 ? 0 : 2);
  const parts = n.toFixed(dec).split('.');
  // Add thousand separators
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (dec === 0) return parts[0];
  return parts[0] + ',' + parts[1];
}

/**
 * Format percentage: 0.71 → "71,0%"
 */
export function formatPct(n: number): string {
  const pct = n * 100;
  const fixed = pct.toFixed(pct % 1 === 0 ? 1 : 2);
  return fixed.replace('.', ',') + '%';
}

/**
 * Format ISO date to DD-MM-YYYY
 */
function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

// ============================================================================
// Grid Builder Helper
// ============================================================================

type CellValue = string | number | null | undefined;

class GridBuilder {
  private grid: CellValue[][] = [];

  /** Ensure grid has enough rows/cols */
  private ensure(row: number, col: number): void {
    while (this.grid.length <= row) this.grid.push([]);
    while (this.grid[row].length <= col) this.grid[row].push(null);
  }

  /** Set a single cell */
  set(row: number, col: number, value: CellValue): void {
    this.ensure(row, col);
    this.grid[row][col] = value;
  }

  /** Set a horizontal range of values starting at (row, col) */
  setRow(row: number, startCol: number, values: CellValue[]): void {
    for (let i = 0; i < values.length; i++) {
      this.set(row, startCol + i, values[i]);
    }
  }

  /** Get the raw grid */
  toAoa(): CellValue[][] {
    return this.grid;
  }

  /** Current number of rows */
  get rowCount(): number {
    return this.grid.length;
  }
}

// ============================================================================
// Column offsets
// ============================================================================

const P = 0;   // Putten start column (A)
const N = 12;  // Nijkerk start column (M)

// ============================================================================
// Main Export Function
// ============================================================================

export function exportStorteboomBestelschema(
  input: StorteboomExportInput
): Uint8Array {
  const g = new GridBuilder();
  const sheetName = formatDate(input.slaughter_date);
  let row = 0;

  // ── Headers ──
  g.set(row, P, 'PUTTEN');
  g.set(row, N, 'NIJKERK');
  row += 2;

  // ══════════════════════════════════════════════════════════════
  // SECTION 1: Algemeen (Putten side only)
  // ══════════════════════════════════════════════════════════════
  const algStart = row;
  g.set(row, P, 'Algemeen');
  g.set(row, P + 1, 'P');
  row++;
  g.setRow(row, P, ['Lotnummer', input.lot_number]);
  row++;
  g.setRow(row, P, ['Mester', input.mester]);
  row++;
  g.setRow(row, P, ['Ras', input.ras]);
  row++;
  g.setRow(row, P, ['Hok', input.hok_count]);
  row++;
  g.setRow(row, P, ['Slachtdatum', sheetName]);
  row += 2;

  // ══════════════════════════════════════════════════════════════
  // SECTION 2: Aanvoer
  // ══════════════════════════════════════════════════════════════
  g.setRow(row, P, ['Aanvoer', 'Aantal', 'Gewicht', 'Gem. gewicht']);
  row++;
  g.setRow(row, P, [
    'Levende Kuikens',
    formatNL(input.total_birds),
    formatNL(input.total_live_weight_kg),
    formatNL(input.avg_live_weight_kg, 2),
  ]);
  row++;
  g.setRow(row, P, [
    'Dood aangevoerd',
    formatNL(input.dead_on_arrival),
    formatNL(input.dead_weight_kg),
  ]);
  row++;
  g.setRow(row, P, [
    'Totaal',
    formatNL(input.total_birds + input.dead_on_arrival),
    formatNL(input.total_live_weight_kg + input.dead_weight_kg),
  ]);
  row += 2;

  // ══════════════════════════════════════════════════════════════
  // SECTION 3: Slachterij & Rendement
  // ══════════════════════════════════════════════════════════════
  g.setRow(row, P, ['Slachterij', 'Aantal', 'Gewicht', 'Gem. gewicht', 'Rendement']);
  row++;
  g.setRow(row, P, ['Afgekeurd', formatNL(input.rejected_count), formatNL(input.rejected_weight_kg)]);
  row += 2;
  g.setRow(row, P, [
    'Griller',
    formatNL(input.griller_count),
    formatNL(input.griller_kg),
    formatNL(input.avg_griller_weight_kg, 4),
    formatPct(input.griller_yield_pct),
  ]);
  row += 2;

  // ══════════════════════════════════════════════════════════════
  // SECTION 4: Hele kuikens eruit halen
  // ══════════════════════════════════════════════════════════════
  if (input.whole_bird_pulls.length > 0) {
    g.setRow(row, P + 7, ['Categorie', 'Totaal stuks', 'KG totaal']);
    row++;
    for (const pull of input.whole_bird_pulls) {
      g.setRow(row, P + 7, [pull.label, formatNL(pull.count), formatNL(pull.total_kg)]);
      row++;
    }
    const totalPullCount = input.whole_bird_pulls.reduce((s, p) => s + p.count, 0);
    const totalPullKg = input.whole_bird_pulls.reduce((s, p) => s + p.total_kg, 0);
    g.setRow(row, P + 7, ['Totaal', formatNL(totalPullCount), formatNL(totalPullKg)]);
    row += 2;
  }

  // ══════════════════════════════════════════════════════════════
  // SECTION 5: Inpak Delen
  // ══════════════════════════════════════════════════════════════
  g.setRow(row, P, ['Inpak Delen', 'Aantal', 'Gewicht', 'Gem. Griller gew.', 'Rendement']);
  row++;
  g.setRow(row, P, [
    'Gril kuikens',
    formatNL(input.griller_count),
    formatNL(input.griller_kg),
    formatNL(input.avg_griller_weight_kg, 4),
    formatPct(input.griller_yield_pct),
  ]);
  row++;
  g.setRow(row, P, [
    'Kuikens delen',
    formatNL(input.remaining_birds_for_cutting),
    formatNL(input.remaining_griller_kg),
    formatNL(input.adjusted_avg_griller_weight, 4),
  ]);
  row += 2;

  // ══════════════════════════════════════════════════════════════
  // SECTION 6: Beschikbaarheid (both sides)
  // ══════════════════════════════════════════════════════════════
  const beschikRow = row;

  // Putten beschikbaarheid
  g.setRow(row, P, ['Beschikbaarheid Putten', 'Kg beschikbaar', 'Orders', 'Over/Tekort']);
  row++;
  // Group Putten products by anatomical type for summary
  const puttenKappen = input.putten_products.filter(
    (p) => p.description.toLowerCase().includes('borstkap')
  );
  const puttenZadels = input.putten_products.filter(
    (p) => p.description.toLowerCase().includes('dij')
  );
  const puttenVleugels = input.putten_products.filter(
    (p) => p.description.toLowerCase().includes('vleugel')
  );

  function sumKg(products: typeof input.putten_products) {
    return products.reduce((s, p) => s + p.kg_from_slaughter, 0);
  }

  function sumOrdered(products: typeof input.putten_products, customerOrders: typeof input.customer_orders, location: 'putten' | 'nijkerk') {
    const productIds = new Set(products.map((p) => p.product_id));
    return customerOrders.reduce((total, co) => {
      const lines = location === 'putten' ? co.putten_lines : co.nijkerk_lines;
      return total + lines.filter((l) => productIds.has(l.product_id)).reduce((s, l) => s + l.quantity_kg, 0);
    }, 0);
  }

  if (puttenKappen.length > 0) {
    const kgAvail = sumKg(puttenKappen);
    const kgOrdered = sumOrdered(puttenKappen, input.customer_orders, 'putten');
    g.setRow(row, P, ['Beschikbare Kappen', formatNL(kgAvail), formatNL(kgOrdered), formatNL(kgAvail - kgOrdered)]);
    row++;
  }
  if (puttenZadels.length > 0) {
    const kgAvail = sumKg(puttenZadels);
    const kgOrdered = sumOrdered(puttenZadels, input.customer_orders, 'putten');
    g.setRow(row, P, ['Beschikbare Zadels', formatNL(kgAvail), formatNL(kgOrdered), formatNL(kgAvail - kgOrdered)]);
    row++;
  }
  if (puttenVleugels.length > 0) {
    const kgAvail = sumKg(puttenVleugels);
    const kgOrdered = sumOrdered(puttenVleugels, input.customer_orders, 'putten');
    g.setRow(row, P, ['Beschikbare Vleugels', formatNL(kgAvail), formatNL(kgOrdered), formatNL(kgAvail - kgOrdered)]);
    row++;
  }

  // Nijkerk beschikbaarheid (right side, same starting row)
  let nRow = beschikRow;
  g.setRow(nRow, N, ['Beschikbaarheid Nijkerk', 'Kg beschikbaar', 'Orders', 'Over/Tekort']);
  nRow++;
  for (const prod of input.nijkerk_products) {
    const ordered = input.customer_orders.reduce((total, co) => {
      return total + co.nijkerk_lines.filter((l) => l.product_id === prod.product_id).reduce((s, l) => s + l.quantity_kg, 0);
    }, 0);
    g.setRow(nRow, N, [
      `${prod.source_product} → ${prod.description}`,
      formatNL(prod.kg_from_slaughter),
      formatNL(ordered),
      formatNL(prod.kg_from_slaughter - ordered),
    ]);
    nRow++;
  }

  row = Math.max(row, nRow) + 2;

  // ══════════════════════════════════════════════════════════════
  // SECTION 7: Orders Productlijst (both sides)
  // ══════════════════════════════════════════════════════════════
  const prodListRow = row;

  // Putten productlijst
  g.setRow(row, P, ['Omschrijving', 'Art.Nr Vacuum', 'Art.Nr niet Vacuum', 'Rendement', 'Kg uit stal', 'Aantal KG besteld']);
  row++;
  for (const prod of input.putten_products) {
    const totalOrdered = input.customer_orders.reduce((total, co) => {
      return total + co.putten_lines.filter((l) => l.product_id === prod.product_id).reduce((s, l) => s + l.quantity_kg, 0);
    }, 0);
    g.setRow(row, P, [
      prod.description,
      prod.article_number_vacuum ?? '-',
      prod.article_number_niet_vacuum ?? '-',
      prod.yield_pct != null ? formatPct(prod.yield_pct) : '',
      prod.kg_from_slaughter > 0 ? formatNL(prod.kg_from_slaughter) : '',
      formatNL(totalOrdered),
    ]);
    row++;
  }

  // Nijkerk productlijst
  let nProdRow = prodListRow;
  g.setRow(nProdRow, N, ['Omschrijving', 'Art.Nr Vacuum', 'Art.Nr niet Vacuum', 'Griller %', 'Kg uit stal', 'Aantal kg']);
  nProdRow++;
  for (const prod of input.nijkerk_products) {
    const totalOrdered = input.customer_orders.reduce((total, co) => {
      return total + co.nijkerk_lines.filter((l) => l.product_id === prod.product_id).reduce((s, l) => s + l.quantity_kg, 0);
    }, 0);
    g.setRow(nProdRow, N, [
      prod.description,
      prod.article_number_vacuum ?? '-',
      prod.article_number_niet_vacuum ?? '-',
      prod.yield_pct != null ? formatPct(prod.yield_pct) : '',
      prod.kg_from_slaughter > 0 ? formatNL(prod.kg_from_slaughter) : '',
      formatNL(totalOrdered),
    ]);
    nProdRow++;
  }

  row = Math.max(row, nProdRow) + 2;

  // ══════════════════════════════════════════════════════════════
  // SECTION 8: Klant-orders (both sides)
  // ══════════════════════════════════════════════════════════════
  const customersWithPutten = input.customer_orders.filter((co) => co.putten_lines.length > 0);
  const customersWithNijkerk = input.customer_orders.filter((co) => co.nijkerk_lines.length > 0);

  // --- Putten klant-orders ---
  if (customersWithPutten.length > 0) {
    const orderStartRow = row;
    // Header: Product | Art.Nr | Customer1 | Customer2 | ... | REST | Totaal
    const puttenHeaderCols: CellValue[] = ['Product', 'Art.Nr'];
    for (const co of customersWithPutten) {
      puttenHeaderCols.push(co.customer_name);
    }
    puttenHeaderCols.push('REST');
    puttenHeaderCols.push('Totaal');
    g.setRow(row, P, puttenHeaderCols);
    row++;

    // Transport header rows
    const addrRow: CellValue[] = ['Afleveradres', ''];
    for (const co of customersWithPutten) {
      addrRow.push(co.delivery_address ?? '');
    }
    g.setRow(row, P, addrRow);
    row++;

    const koopsRow: CellValue[] = ['Transport Koops', ''];
    for (const co of customersWithPutten) {
      koopsRow.push(co.transport_by_koops ? 'Ja' : 'Nee');
    }
    g.setRow(row, P, koopsRow);
    row++;

    const dayRow: CellValue[] = ['Bezorgdag', ''];
    for (const co of customersWithPutten) {
      const day = co.putten_delivery_day ?? '';
      dayRow.push(day ? day.charAt(0).toUpperCase() + day.slice(1) : '');
    }
    g.setRow(row, P, dayRow);
    row++;

    // Product rows
    for (const prod of input.putten_products) {
      const prodRow: CellValue[] = [
        prod.description,
        prod.article_number_niet_vacuum ?? prod.article_number_vacuum ?? '',
      ];
      let totalKg = 0;
      for (const co of customersWithPutten) {
        const line = co.putten_lines.find((l) => l.product_id === prod.product_id);
        const kg = line?.quantity_kg ?? 0;
        prodRow.push(kg > 0 ? formatNL(kg) : '');
        totalKg += kg;
      }
      const rest = prod.kg_from_slaughter - totalKg;
      prodRow.push(formatNL(rest));
      prodRow.push(totalKg > 0 ? formatNL(totalKg) : '0');
      g.setRow(row, P, prodRow);
      row++;
    }
    row++;
  }

  // --- Nijkerk klant-orders ---
  if (customersWithNijkerk.length > 0) {
    const nOrderRow = row;
    // Header
    const nijkerkHeaderCols: CellValue[] = ['Product', 'Art.Nr VAC', 'Art.Nr niet VAC'];
    for (const co of customersWithNijkerk) {
      nijkerkHeaderCols.push(co.customer_name);
    }
    nijkerkHeaderCols.push('REST');
    nijkerkHeaderCols.push('Totaal');
    g.setRow(nOrderRow, N, nijkerkHeaderCols);
    let nr = nOrderRow + 1;

    // Transport header rows
    const nAddrRow: CellValue[] = ['Afleveradres', '', ''];
    for (const co of customersWithNijkerk) {
      nAddrRow.push(co.delivery_address ?? '');
    }
    g.setRow(nr, N, nAddrRow);
    nr++;

    const nKoopsRow: CellValue[] = ['Transport Koops', '', ''];
    for (const co of customersWithNijkerk) {
      nKoopsRow.push(co.transport_by_koops ? 'Ja' : 'Nee');
    }
    g.setRow(nr, N, nKoopsRow);
    nr++;

    const nDayRow: CellValue[] = ['Bezorgdag', '', ''];
    for (const co of customersWithNijkerk) {
      const day = co.nijkerk_delivery_day ?? '';
      nDayRow.push(day ? day.charAt(0).toUpperCase() + day.slice(1) : '');
    }
    g.setRow(nr, N, nDayRow);
    nr++;

    // Product rows
    for (const prod of input.nijkerk_products) {
      const prodRow: CellValue[] = [
        prod.description,
        prod.article_number_vacuum ?? '-',
        prod.article_number_niet_vacuum ?? '-',
      ];
      let totalKg = 0;
      for (const co of customersWithNijkerk) {
        const line = co.nijkerk_lines.find((l) => l.product_id === prod.product_id);
        const kg = line?.quantity_kg ?? 0;
        prodRow.push(kg > 0 ? formatNL(kg) : '');
        totalKg += kg;
      }
      const rest = prod.kg_from_slaughter - totalKg;
      prodRow.push(formatNL(rest));
      prodRow.push(totalKg > 0 ? formatNL(totalKg) : '0');
      g.setRow(nr, N, prodRow);
      nr++;
    }
    row = Math.max(row, nr);
  }

  // ══════════════════════════════════════════════════════════════
  // Build Workbook
  // ══════════════════════════════════════════════════════════════
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(g.toAoa());

  // Set column widths
  ws['!cols'] = [
    { wch: 28 }, // A - Product name
    { wch: 14 }, // B
    { wch: 14 }, // C
    { wch: 14 }, // D
    { wch: 14 }, // E
    { wch: 14 }, // F
    { wch: 12 }, // G
    { wch: 16 }, // H
    { wch: 12 }, // I
    { wch: 12 }, // J
    { wch: 3 },  // K - separator
    { wch: 3 },  // L - separator
    { wch: 28 }, // M - Nijkerk product name
    { wch: 14 }, // N
    { wch: 14 }, // O
    { wch: 14 }, // P
    { wch: 14 }, // Q
    { wch: 14 }, // R
    { wch: 12 }, // S
    { wch: 12 }, // T
  ];

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buf);
}

// ============================================================================
// BACKWARD COMPATIBILITY — Legacy export function for integration tests
// These wrap the old OrderSchemaData interface with a simple 2-sheet export.
// Used by: ExportList.tsx, integration tests. Will be removed in a future wave.
// ============================================================================

import type { OrderSchemaData } from '@/types/database';

/**
 * @deprecated Use exportStorteboomBestelschema() for new code
 */
export function exportOrderSchemaToExcel(
  schemaData: OrderSchemaData,
  slaughterDate: string
): Uint8Array {
  const wb = XLSX.utils.book_new();

  const rows = schemaData.surplus_deficit.map((sd) => ({
    'Product': sd.product_id,
    'Beschikbaar (kg)': sd.available_kg,
    'Besteld (kg)': sd.ordered_kg,
    'Surplus/Deficit (kg)': sd.delta_kg,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Bestelschema');

  const metaWs = XLSX.utils.json_to_sheet([
    { 'Veld': 'Slachtdatum', 'Waarde': slaughterDate },
    { 'Veld': 'Gegenereerd', 'Waarde': new Date().toISOString().split('T')[0] },
    { 'Veld': 'Aantal orders', 'Waarde': schemaData.orders.length },
  ]);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Info');

  const legacyBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(legacyBuf);
}
