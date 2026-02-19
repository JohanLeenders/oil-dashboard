/**
 * Export order schema to Excel (.xlsx)
 * Uses xlsx library (already installed)
 *
 * REGRESSIE-CHECK:
 * - Pure function, no DB access
 * - Returns Uint8Array buffer
 */
import * as XLSX from 'xlsx';
import type { OrderSchemaData } from '@/types/database';

export function exportOrderSchemaToExcel(
  schemaData: OrderSchemaData,
  slaughterDate: string
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Build data rows from surplus_deficit
  const rows = schemaData.surplus_deficit.map((sd) => ({
    'Product': sd.product_id,
    'Beschikbaar (kg)': sd.available_kg,
    'Besteld (kg)': sd.ordered_kg,
    'Surplus/Deficit (kg)': sd.delta_kg,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Bestelschema');

  // Add metadata sheet with slaughter date
  const metaWs = XLSX.utils.json_to_sheet([
    { 'Veld': 'Slachtdatum', 'Waarde': slaughterDate },
    { 'Veld': 'Gegenereerd', 'Waarde': new Date().toISOString().split('T')[0] },
    { 'Veld': 'Aantal orders', 'Waarde': schemaData.orders.length },
  ]);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Info');

  // Write to buffer
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buf);
}
