/**
 * Slaughter Report Parser — Excel → Structured Data
 *
 * Pure function: takes xlsx buffer (or 2D array), returns ParsedSlaughterReport.
 * No side effects, no database calls.
 *
 * Supports the Storteboom/Oranjehoen slaughter report format:
 *   Sections: Algemeen, Aanvoer, Slachterij, Rendementen, Inpak Delen, Verwerking
 *
 * Heuristic: searches for known labels (not fixed cell positions)
 * so it tolerates minor format variations between mesters.
 */

import type {
  ParsedSlaughterReport,
  ParsedYieldLine,
  ReportType,
} from '@/types/slaughter-reports';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a slaughter report from a 2D string/number array (one sheet).
 * Typically produced by XLSX.utils.sheet_to_json or sheet_to_csv.
 */
export function parseSlaughterReport(
  rows: (string | number | null)[][],
  sourceFile: string,
  reportType: ReportType = 'slacht_putten'
): ParsedSlaughterReport {
  const ctx = new ParseContext(rows);

  // 1. Algemeen
  const lotNumber = ctx.findValue('Lotnummer') ?? '';
  const mester = ctx.findValue('Mester') ?? '';
  const breed = ctx.findValue('Ras') ?? null;
  const barn = ctx.findValue('Hok') ?? null;
  const rawDate = ctx.findValue('Slachtdatum') ?? '';
  const slaughterDate = parseExcelDate(rawDate);

  // 2. Aanvoer
  const liveRow = ctx.findRow('Levende Kuikens');
  const liveCount = parseNum(liveRow?.[2]) ?? 0;
  const liveWeight = parseNum(liveRow?.[3]) ?? 0;
  const avgLiveWeight = parseNum(liveRow?.[4]) ?? (liveCount > 0 ? round(liveWeight / liveCount, 3) : 0);

  const doaRow = ctx.findRow('Dood aangevoerd');
  const doaCount = parseNum(doaRow?.[2]) ?? 0;
  const doaWeight = parseNum(doaRow?.[3]) ?? 0;

  // 3. Slachterij
  const rejectedRow = ctx.findRow('Afgekeurd');
  const rejectedCount = parseNum(rejectedRow?.[2]) ?? 0;
  const rejectedWeight = parseNum(rejectedRow?.[3]) ?? 0;

  const cat2Row = ctx.findRow('Totaal Cat2');
  const cat2Pct = parsePercent(cat2Row?.[5]) ?? (liveWeight > 0 ? round((rejectedWeight / liveWeight) * 100, 2) : 0);

  // Cat3
  const cat3Row = ctx.findRow('Totaal Cat3');
  const cat3Pct = parsePercent(cat3Row?.[5]) ?? 0;

  // Total yield
  const totalYieldRow = ctx.findRow('Totaal rendment') ?? ctx.findRow('Totaal rendement');
  const totalYieldPct = parsePercent(totalYieldRow?.[5]) ?? 0;

  // 4. Inpak Delen
  const grillerRow = ctx.findRow('Gril kuikens');
  const grillerCount = parseNum(grillerRow?.[2]) ?? 0;
  const grillerWeight = parseNum(grillerRow?.[3]) ?? 0;
  const grillerAvgWeight = parseNum(grillerRow?.[4]) ?? (grillerCount > 0 ? round(grillerWeight / grillerCount, 3) : 0);
  const grillerYieldPct = parsePercent(grillerRow?.[5]) ?? (liveWeight > 0 ? round((grillerWeight / liveWeight) * 100, 1) : 0);

  const sawRow = ctx.findRow('Zaag kuikens');
  const sawCount = parseNum(sawRow?.[2]) ?? 0;

  const packRow = ctx.findRow('Kuikens inpakken');
  const packCount = parseNum(packRow?.[2]) ?? 0;

  const cutupRow = ctx.findRow('Kuikens delen');
  const cutupCount = parseNum(cutupRow?.[2]) ?? 0;

  // 5. Yield Lines
  const lines: ParsedYieldLine[] = [];
  let sortOrder = 0;

  // Cat3 lines
  for (const [code, label] of CAT3_PRODUCTS) {
    const row = ctx.findRow(label);
    const pct = parsePercent(row?.[5]);
    if (pct !== null && pct > 0) {
      lines.push({
        section: 'cat3',
        product_code: code,
        product_label: label.replace(' (Cat3)', ''),
        item_count: null,
        weight_kg: null,
        avg_weight_kg: null,
        yield_pct: pct,
        sort_order: sortOrder++,
      });
    }
  }

  // Orgaan lines
  for (const [code, label] of ORGAAN_PRODUCTS) {
    const row = ctx.findRow(label);
    const pct = parsePercent(row?.[5]);
    if (pct !== null && pct > 0) {
      lines.push({
        section: 'organen',
        product_code: code,
        product_label: label,
        item_count: null,
        weight_kg: null,
        avg_weight_kg: null,
        yield_pct: pct,
        sort_order: sortOrder++,
      });
    }
  }

  // Verwerking lines
  for (const [code, label] of VERWERKING_PRODUCTS) {
    const row = ctx.findRowInSection(label, 'Verwerking');
    if (!row) continue;

    const count = parseNum(row[2]);
    const weight = parseNum(row[3]);
    const avg = parseNum(row[4]);
    const pct = parsePercent(row[5]);

    if (weight !== null || pct !== null) {
      lines.push({
        section: 'verwerking',
        product_code: code,
        product_label: label,
        item_count: count,
        weight_kg: weight,
        avg_weight_kg: avg,
        yield_pct: pct,
        sort_order: sortOrder++,
      });
    }
  }

  return {
    lot_number: lotNumber,
    report_type: reportType,
    mester,
    breed,
    barn,
    slaughter_date: slaughterDate,
    live_count: liveCount,
    live_weight_kg: liveWeight,
    avg_live_weight_kg: avgLiveWeight,
    doa_count: doaCount,
    doa_weight_kg: doaWeight,
    rejected_count: rejectedCount,
    rejected_weight_kg: rejectedWeight,
    cat2_pct: cat2Pct,
    cat3_pct: cat3Pct,
    total_yield_pct: totalYieldPct,
    griller_count: grillerCount,
    griller_weight_kg: grillerWeight,
    griller_avg_weight_kg: grillerAvgWeight,
    griller_yield_pct: grillerYieldPct,
    saw_count: sawCount,
    pack_count: packCount,
    cutup_count: cutupCount,
    lines,
    source_file: sourceFile,
  };
}

/**
 * Validate a parsed report. Returns errors (hard fail) and warnings (soft).
 */
export function validateSlaughterReport(
  report: ParsedSlaughterReport
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Hard fails
  if (!report.lot_number) errors.push('Lotnummer ontbreekt');
  if (!report.mester) errors.push('Mester ontbreekt');
  if (!report.slaughter_date) errors.push('Slachtdatum ontbreekt');
  if (report.live_count <= 0) errors.push('Levende kuikens = 0');

  if (report.total_yield_pct > 100) errors.push(`Totaal rendement > 100% (${report.total_yield_pct}%)`);
  if (report.total_yield_pct < 0) errors.push(`Totaal rendement < 0% (${report.total_yield_pct}%)`);
  if (report.griller_yield_pct > 100) errors.push(`Griller yield > 100% (${report.griller_yield_pct}%)`);
  if (report.cat2_pct > 100) errors.push(`Cat2 afkeur > 100% (${report.cat2_pct}%)`);

  // Soft warnings
  if (report.griller_yield_pct < 65 || report.griller_yield_pct > 80) {
    warnings.push(`Griller yield ${report.griller_yield_pct}% buiten verwacht bereik (65-80%)`);
  }
  if (report.total_yield_pct < 85 || report.total_yield_pct > 100) {
    warnings.push(`Totaal rendement ${report.total_yield_pct}% buiten verwacht bereik (85-100%)`);
  }
  if (report.cat2_pct > 3) {
    warnings.push(`Cat2 afkeur ${report.cat2_pct}% — hoog (> 3%)`);
  }

  // Verwerking total check
  const verwerkingLines = report.lines.filter(l => l.section === 'verwerking');
  if (verwerkingLines.length > 0) {
    const totalVerwerkingPct = verwerkingLines.reduce((sum, l) => sum + (l.yield_pct ?? 0), 0);
    if (totalVerwerkingPct > 0 && Math.abs(totalVerwerkingPct - 100) > 1) {
      warnings.push(`Verwerking totaal ${totalVerwerkingPct.toFixed(2)}% (verwacht ~100%)`);
    }
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Product code mappings
// ---------------------------------------------------------------------------

const CAT3_PRODUCTS: [string, string][] = [
  ['bloed', 'Bloed (Cat3)'],
  ['veren', 'Veren (Cat3)'],
  ['hoofden', 'Hoofden (Cat3)'],
  ['poten', 'Poten (Cat3)'],
  ['ingewanden', 'Ingewanden (Cat3)'],
];

const ORGAAN_PRODUCTS: [string, string][] = [
  ['nekken', 'Nekken'],
  ['levers', 'Levers'],
  ['magen', 'Magen'],
  ['harten', 'Harten'],
];

const VERWERKING_PRODUCTS: [string, string][] = [
  ['bouten', 'Bouten'],
  ['vleugels', 'Vleugels'],
  ['b_vleugels', 'B vleugels'],
  ['c_vleugels', 'C Vleugels'],
  ['vleugeltippen', 'Vleugeltippen'],
  ['borsten', 'Borsten'],
  ['dijen', 'Dijen'],
  ['drum', 'Drum'],
  ['achterrug', 'Achterrug'],
  ['staarten', 'Staarten'],
  ['voorrug', 'Voorrug'],
];

// ---------------------------------------------------------------------------
// Parse context — heuristic row finder
// ---------------------------------------------------------------------------

class ParseContext {
  private rows: (string | number | null)[][];

  constructor(rows: (string | number | null)[][]) {
    this.rows = rows;
  }

  /**
   * Find the first row where a cell in columns 0-5 starts with the given label.
   * Restricted to first 6 columns to avoid false matches from summary tables
   * on the right side of the spreadsheet.
   */
  findRow(label: string): (string | number | null)[] | null {
    const lowerLabel = label.toLowerCase();
    const MAX_LABEL_COL = 6;
    for (const row of this.rows) {
      for (let i = 0; i < Math.min(row.length, MAX_LABEL_COL); i++) {
        const cell = row[i];
        if (cell !== null && String(cell).toLowerCase().startsWith(lowerLabel)) {
          return row;
        }
      }
    }
    return null;
  }

  /**
   * Find a row with the given label, but only AFTER a row containing sectionHeader.
   * This prevents matching "Vleugels" in Cat3 section vs Verwerking section.
   *
   * IMPORTANT: Only searches columns 0-5 for the label to avoid false matches
   * from "Samenvatting rendement Griller" summary columns on the right side.
   * E.g. the "B vleugels" row has "Borsten" in column 9 (summary), which
   * would incorrectly match before the real "Borsten" row in column 1.
   */
  findRowInSection(label: string, sectionHeader: string): (string | number | null)[] | null {
    const lowerLabel = label.toLowerCase();
    const lowerSection = sectionHeader.toLowerCase();
    let inSection = false;
    const MAX_LABEL_COL = 6; // Only search columns 0-5 for labels

    for (const row of this.rows) {
      // Check if we've entered the target section (also only in first columns)
      for (let i = 0; i < Math.min(row.length, MAX_LABEL_COL); i++) {
        const cell = row[i];
        if (cell !== null && String(cell).toLowerCase().includes(lowerSection)) {
          inSection = true;
          break;
        }
      }

      if (!inSection) continue;

      // Look for the label in this section — only in label columns
      for (let i = 0; i < Math.min(row.length, MAX_LABEL_COL); i++) {
        const cell = row[i];
        if (cell !== null && String(cell).toLowerCase().startsWith(lowerLabel)) {
          return row;
        }
      }
    }
    return null;
  }

  /** Find a value in column C (index 2) for a row where column B matches label */
  findValue(label: string): string | null {
    const row = this.findRow(label);
    if (!row) return null;
    // Value is typically in the next column after the label
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== null && String(row[i]).toLowerCase().startsWith(label.toLowerCase())) {
        const val = row[i + 1];
        if (val !== null && val !== undefined) return String(val);
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Number parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a number from Excel CSV output.
 *
 * The xlsx library outputs numbers in US format:
 *   - Comma = thousand separator: 23,866 = 23866
 *   - Dot = decimal separator: 2.762 = 2.762
 *   - Both: 47,060.0 = 47060.0
 *
 * Heuristic:
 *   - Both comma and dot → comma is thousand sep, dot is decimal
 *   - Only comma + exactly 3 digits after → thousand separator (23,866 = 23866)
 *   - Only comma + 1-2 digits after → decimal (1,5 = 1.5)
 *   - Only dot → decimal (2.762 = 2.762)
 */
function parseNum(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;

  // Remove whitespace
  let str = String(value).trim();

  // Handle #DIV/0! and similar Excel errors
  if (str.startsWith('#')) return null;

  // Remove % sign
  str = str.replace(/%/g, '');

  // Both comma and dot: comma = thousand sep, dot = decimal
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/,/g, '');
    // dot remains as decimal
  }
  // Only comma: check if thousand separator (3 digits after each comma)
  else if (str.includes(',')) {
    // Split on commas and check pattern
    const parts = str.split(',');
    const isThousandSep = parts.length >= 2 &&
      parts.slice(1).every(p => p.length === 3 && /^\d{3}$/.test(p));
    if (isThousandSep) {
      // Comma is thousand separator: 23,866 → 23866
      str = str.replace(/,/g, '');
    } else {
      // Comma is decimal separator: 1,5 → 1.5
      str = str.replace(',', '.');
    }
  }
  // Only dots: keep as decimal (2.762 stays 2.762)
  // Edge case: 47.060 with exactly 3 digits could be ambiguous,
  // but xlsx library uses comma for thousands, so dots are always decimal

  const num = Number(str);
  return isNaN(num) ? null : num;
}

/**
 * Parse a percentage value.
 *
 * If the string contains '%', the value IS already a percentage (0.63% = 0.63).
 * If the value is a raw number < 1 (e.g., 0.718 from Excel), multiply by 100.
 */
function parsePercent(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    // Raw number from Excel: if < 1, it's a fraction → convert to %
    if (value > 0 && value < 1) return round(value * 100, 2);
    return value;
  }

  const str = String(value).trim();
  if (str === '0.0%' || str === '0,0%' || str === '0%') return 0;

  const hasPercentSign = str.includes('%');
  const num = parseNum(str); // parseNum already strips %
  if (num === null) return null;

  // If the original string had %, the number is already a percentage
  if (hasPercentSign) return num;

  // Raw decimal (0.718) → convert to percentage
  if (num > 0 && num < 1) return round(num * 100, 2);
  return num;
}

/** Parse various date formats from Excel */
function parseExcelDate(value: string): string {
  if (!value) return '';

  // Try M/D/YY format (Excel default US: 2/23/26)
  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0');
    const day = usMatch[2].padStart(2, '0');
    let year = usMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // Try D-M-YYYY format (Dutch: 23-2-2026)
  const nlMatch = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (nlMatch) {
    const day = nlMatch[1].padStart(2, '0');
    const month = nlMatch[2].padStart(2, '0');
    const year = nlMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try ISO format (2026-02-23)
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return value;

  // Excel serial number
  const serial = Number(value);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const date = new Date((serial - 25569) * 86400000);
    return date.toISOString().split('T')[0];
  }

  return value; // Return as-is if unparseable
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
