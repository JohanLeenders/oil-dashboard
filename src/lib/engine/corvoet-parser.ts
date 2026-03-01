/**
 * Corvoet Massabalans Parser — Excel → Structured Data
 *
 * Pure function: takes 2D array from xlsx, returns ParsedCorvoetReport.
 * No side effects, no database calls.
 *
 * Format: Corvoet weekly mass balance report
 *   Sections: In (inputs), Uit (outputs), Massabalans (yields)
 *   Key metric: filet rendement uit borstkappen (typically ~70%)
 *
 * Columns: B = Artikel/label, C = Afleveradres/netto kg, D = Netto kilo's/rendement %
 */

import type { ParsedCorvoetReport } from '@/types/slaughter-reports';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a Corvoet massabalans from a 2D string/number array (one sheet).
 * The filename is used to extract the week number (e.g., "Massabalans W09-26.xlsx").
 */
export function parseCorvoetReport(
  rows: (string | number | null)[][],
  sourceFile: string
): ParsedCorvoetReport {
  // Extract week/year from filename
  const { week, year } = parseWeekFromFilename(sourceFile);

  // Find section boundaries
  const sections = findSections(rows);

  // Parse "In" lines
  const inLines = parseInUitLines(rows, sections.inStart, sections.inEnd);

  // Parse "Uit" lines
  const uitLines = parseInUitLines(rows, sections.uitStart, sections.uitEnd);

  // Parse "Massabalans" section for rendement
  const massabalans = parseMassabalans(rows, sections.massabalansStart, rows.length);

  // Calculate totals
  const borstkappen_in_kg = massabalans.borstkappen_in_kg;
  const dijenvlees_in_kg = massabalans.dijenvlees_in_kg;
  const total_in_kg = inLines.reduce((sum, l) => sum + l.netto_kg, 0);
  const total_uit_kg = uitLines.reduce((sum, l) => sum + l.netto_kg, 0);

  return {
    week_number: week,
    year,
    processing_date: mondayOfWeek(week, year),
    source_file: sourceFile,
    borstkappen_in_kg,
    dijenvlees_in_kg,
    total_in_kg,
    total_uit_kg,
    filet_yield_pct: massabalans.filet_yield_pct,
    vellen_yield_pct: massabalans.vellen_yield_pct,
    dijenvlees_yield_pct: massabalans.dijenvlees_yield_pct,
    in_lines: inLines,
    uit_lines: uitLines,
  };
}

/**
 * Validate a parsed Corvoet report.
 */
export function validateCorvoetReport(
  report: ParsedCorvoetReport
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (report.week_number <= 0 || report.week_number > 53) {
    errors.push(`Ongeldig weeknummer: ${report.week_number}`);
  }
  if (report.year < 2020 || report.year > 2030) {
    errors.push(`Ongeldig jaar: ${report.year}`);
  }
  if (report.borstkappen_in_kg <= 0) {
    errors.push('Borstkappen in = 0 kg');
  }
  if (report.filet_yield_pct <= 0) {
    errors.push('Filet rendement ontbreekt');
  }

  // Warnings
  if (report.filet_yield_pct < 60 || report.filet_yield_pct > 80) {
    warnings.push(
      `Filet rendement ${report.filet_yield_pct}% buiten verwacht bereik (60-80%)`
    );
  }

  // Mass balance check: total out should be <= total in
  if (report.total_uit_kg > report.total_in_kg * 1.05) {
    warnings.push(
      `Massabalans: uit (${report.total_uit_kg.toFixed(1)} kg) > in (${report.total_in_kg.toFixed(1)} kg)`
    );
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Section detection
// ---------------------------------------------------------------------------

interface SectionBounds {
  inStart: number;
  inEnd: number;
  uitStart: number;
  uitEnd: number;
  massabalansStart: number;
}

function findSections(rows: (string | number | null)[][]): SectionBounds {
  let inStart = -1;
  let uitStart = -1;
  let massabalansStart = -1;

  for (let i = 0; i < rows.length; i++) {
    const firstCell = cellStr(rows[i]?.[0] ?? rows[i]?.[1]);

    if (firstCell === 'in' && inStart === -1) {
      inStart = i + 1; // Data starts after the header row
    } else if (firstCell === 'uit' && uitStart === -1) {
      uitStart = i + 1;
    } else if (firstCell === 'massabalans' && massabalansStart === -1) {
      massabalansStart = i + 1;
    }
  }

  // Fallback: if section headers aren't found, use heuristic
  if (inStart === -1) inStart = 0;
  if (uitStart === -1) uitStart = Math.floor(rows.length / 3);
  if (massabalansStart === -1) massabalansStart = Math.floor((rows.length * 2) / 3);

  return {
    inStart,
    inEnd: uitStart - 1, // "Uit" header row
    uitStart,
    uitEnd: massabalansStart - 1, // "Massabalans" header row
    massabalansStart,
  };
}

function cellStr(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Parse In/Uit lines
// ---------------------------------------------------------------------------

function parseInUitLines(
  rows: (string | number | null)[][],
  startIdx: number,
  endIdx: number
): { artikel: string; afleveradres: string; netto_kg: number }[] {
  const lines: { artikel: string; afleveradres: string; netto_kg: number }[] = [];

  // Skip the column header row (Artikel, Afleveradres, Netto kilo's)
  let dataStart = startIdx;
  for (let i = startIdx; i < Math.min(startIdx + 3, endIdx); i++) {
    const row = rows[i];
    if (!row) continue;
    const first = cellStr(row[0] ?? row[1]);
    if (first.includes('artikel') || first.includes('afleveradres')) {
      dataStart = i + 1;
      break;
    }
  }

  for (let i = dataStart; i < endIdx; i++) {
    const row = rows[i];
    if (!row) continue;

    // Find the columns — typically B(0 or 1), C, D
    const artikel = findArtikelInRow(row);
    const kg = findKgInRow(row);

    if (!artikel || kg === null || kg <= 0) continue;

    const afleveradres = findAfleveradresInRow(row);

    lines.push({
      artikel,
      afleveradres,
      netto_kg: kg,
    });
  }

  return lines;
}

function findArtikelInRow(row: (string | number | null)[]): string {
  // First non-null text cell that looks like a product name
  for (const cell of row) {
    if (cell === null || cell === undefined) continue;
    const s = String(cell).trim();
    if (s.length > 3 && isNaN(Number(s.replace(/[.,\s]/g, '')))) {
      return s;
    }
  }
  return '';
}

function findAfleveradresInRow(row: (string | number | null)[]): string {
  // Second text cell in the row
  let found = 0;
  for (const cell of row) {
    if (cell === null || cell === undefined) continue;
    const s = String(cell).trim();
    if (s.length > 2 && isNaN(Number(s.replace(/[.,\s%]/g, '')))) {
      found++;
      if (found === 2) return s;
    }
  }
  return '';
}

function findKgInRow(row: (string | number | null)[]): number | null {
  // Last numeric cell in the row (netto kilo's is typically the last column)
  let lastNum: number | null = null;
  for (const cell of row) {
    const n = parseNum(cell);
    if (n !== null && n > 0) lastNum = n;
  }
  return lastNum;
}

// ---------------------------------------------------------------------------
// Parse Massabalans section
// ---------------------------------------------------------------------------

interface MassabalansData {
  borstkappen_in_kg: number;
  dijenvlees_in_kg: number;
  filet_yield_pct: number;
  vellen_yield_pct: number;
  dijenvlees_yield_pct: number | null;
}

function parseMassabalans(
  rows: (string | number | null)[][],
  startIdx: number,
  endIdx: number
): MassabalansData {
  let borstkappen_in_kg = 0;
  let dijenvlees_in_kg = 0;
  let filet_yield_pct = 0;
  let vellen_yield_pct = 0;
  let dijenvlees_yield_pct: number | null = null;

  for (let i = startIdx; i < endIdx; i++) {
    const row = rows[i];
    if (!row) continue;

    const label = cellStr(row[0] ?? row[1]);

    if (label.includes('borstkappen') && label.includes('in')) {
      borstkappen_in_kg = parseNum(row[1] ?? row[2]) ?? parseNum(row[2]) ?? 0;
    } else if (label.includes('filet') || label.includes('haasjes')) {
      const nums = extractNums(row);
      if (nums.kg > 0) filet_yield_pct = nums.pct;
      if (filet_yield_pct === 0 && nums.pct > 0) filet_yield_pct = nums.pct;
    } else if (label.includes('vellen')) {
      const nums = extractNums(row);
      vellen_yield_pct = nums.pct;
    } else if (label.includes('dijenvlees') && label.includes('in')) {
      dijenvlees_in_kg = parseNum(row[1] ?? row[2]) ?? parseNum(row[2]) ?? 0;
    } else if (label.includes('dijenvlees') && label.includes('uit')) {
      const nums = extractNums(row);
      dijenvlees_yield_pct = nums.pct > 0 ? nums.pct : null;
    }
  }

  return {
    borstkappen_in_kg,
    dijenvlees_in_kg,
    filet_yield_pct,
    vellen_yield_pct,
    dijenvlees_yield_pct,
  };
}

function extractNums(row: (string | number | null)[]): { kg: number; pct: number } {
  let kg = 0;
  let pct = 0;

  for (const cell of row) {
    if (cell === null || cell === undefined) continue;
    const s = String(cell).trim();

    // Check if it's a percentage (has % sign or is in the range 0-110 with a decimal)
    if (s.includes('%')) {
      const n = parseNum(s);
      if (n !== null) pct = n;
    } else {
      const n = parseNum(cell);
      if (n !== null && n > 1) {
        // Larger number = kg, smaller with decimal likely pct
        if (n > 100 || kg === 0) kg = n;
      }
    }
  }

  // If we found a kg value but no explicit pct, check for a second number
  if (pct === 0) {
    const nums: number[] = [];
    for (const cell of row) {
      const n = parseNum(cell);
      if (n !== null && n > 0) nums.push(n);
    }
    // Last number might be rendement % if it's < 110
    if (nums.length >= 2) {
      const last = nums[nums.length - 1];
      if (last > 0 && last <= 110) {
        pct = last;
        kg = nums[nums.length - 2];
      }
    }
  }

  return { kg, pct };
}

// ---------------------------------------------------------------------------
// Week/date helpers
// ---------------------------------------------------------------------------

/**
 * Extract week number and year from filename.
 * Patterns: "Massabalans W09-26.xlsx", "W09-26", "W9-2026"
 */
export function parseWeekFromFilename(filename: string): { week: number; year: number } {
  // Match W followed by week number, then separator, then year
  const match = filename.match(/W(\d{1,2})[\s\-_](\d{2,4})/i);
  if (match) {
    const week = parseInt(match[1], 10);
    let year = parseInt(match[2], 10);
    if (year < 100) year += 2000;
    return { week, year };
  }

  // Fallback: current date
  const now = new Date();
  return { week: getISOWeek(now), year: now.getFullYear() };
}

/**
 * Get the Monday (ISO week start) for a given ISO week number and year.
 * Returns YYYY-MM-DD string. Uses UTC to avoid timezone issues.
 */
export function mondayOfWeek(week: number, year: number): string {
  // Jan 4th is always in ISO week 1 (use UTC to avoid timezone shifts)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Convert Sunday=0 to 7
  // Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  // Add (week - 1) * 7 days
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return targetMonday.toISOString().split('T')[0];
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ---------------------------------------------------------------------------
// Number parsing (shared with slaughter-report-parser pattern)
// ---------------------------------------------------------------------------

function parseNum(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;

  let str = String(value).trim();
  if (str.startsWith('#')) return null;
  str = str.replace(/%/g, '');

  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/,/g, '');
  } else if (str.includes(',')) {
    const parts = str.split(',');
    const isThousandSep =
      parts.length >= 2 && parts.slice(1).every((p) => p.length === 3 && /^\d{3}$/.test(p));
    if (isThousandSep) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  const num = Number(str);
  return isNaN(num) ? null : num;
}
