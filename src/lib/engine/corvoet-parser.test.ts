import { describe, expect, it } from 'vitest';
import {
  parseCorvoetReport,
  validateCorvoetReport,
  parseWeekFromFilename,
  mondayOfWeek,
} from './corvoet-parser';

// ---------------------------------------------------------------------------
// Test data — matches "Massabalans W09-26.xlsx" exactly
// ---------------------------------------------------------------------------

/**
 * Simulated sheet_to_json output (header:1, raw:false) from the real file.
 * Column B → index 0, Column C → index 1, Column D → index 2.
 * The file range is B2:D28 so sheet_to_json starts at row B2.
 */
const W09_26_ROWS: (string | number | null)[][] = [
  // Section: In
  ['In', null, null],
  ['Artikel', 'Afleveradres', "Netto kilo's"],
  ['Oranjehoen borstkappen', 'Cor Voet', 8343.5],
  ['Oranjehoen dijenvlees', 'Cor Voet', 513],
  // Empty rows
  [null, null, null],
  [null, null, null],
  // Section: Uit
  ['Uit', null, null],
  ['Artikel', 'Afleveradres', "Netto kilo's"],
  ['Oranjehoen filet 220-240g onverpakt', 'Moormann', 398.5],
  ['Oranjehoen kipfilet 2x5kg vac <195g', 'Groenvries', 1841],
  ['Oranjehoen kipfilet per 200g vac', 'Groenvries', 1281],
  ['Oranjehoen filet per 2st vac', 'Groenvries', 476],
  ['Oranjehoen kipfilet 2x5kg vac >240g', 'Groenvries', 578],
  ['Oranjehoen haasjes 2x5kg vac', 'Groenvries', 1260],
  ['Oranjehoen B-kwaliteit', 'Groenvries', 8.42],
  ['Oranjehoen kipvellen', 'Groenvries', 865],
  ['Oranjehoen dij reepjes per 200g vac', 'Groenvries', 523],
  // Empty rows
  [null, null, null],
  [null, null, null],
  // Section: Massabalans
  ['Massabalans', null, null],
  [null, "Netto kilo's", 'Rendement %'],
  ['Borstkappen in', 8343.5, null],
  ['Filet / haasjes uit', 5842.92, '70.0%'],
  ['Vellen uit', 865, '10.4%'],
  [null, null, null],
  ['Dijenvlees in', 513, null],
  ['Dijenvlees uit', 523, '101.9%'],
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseWeekFromFilename', () => {
  it('parses "Massabalans W09-26.xlsx"', () => {
    const { week, year } = parseWeekFromFilename('Massabalans W09-26.xlsx');
    expect(week).toBe(9);
    expect(year).toBe(2026);
  });

  it('parses "W1-26.xlsx"', () => {
    const { week, year } = parseWeekFromFilename('W1-26.xlsx');
    expect(week).toBe(1);
    expect(year).toBe(2026);
  });

  it('parses "Massabalans W52-2025.xlsx"', () => {
    const { week, year } = parseWeekFromFilename('Massabalans W52-2025.xlsx');
    expect(week).toBe(52);
    expect(year).toBe(2025);
  });

  it('parses "W10_26.xlsx" with underscore', () => {
    const { week, year } = parseWeekFromFilename('W10_26.xlsx');
    expect(week).toBe(10);
    expect(year).toBe(2026);
  });
});

describe('mondayOfWeek', () => {
  it('week 9, 2026 → 2026-02-23', () => {
    expect(mondayOfWeek(9, 2026)).toBe('2026-02-23');
  });

  it('week 1, 2026 → 2025-12-29', () => {
    // ISO week 1 of 2026 starts on Monday Dec 29, 2025
    expect(mondayOfWeek(1, 2026)).toBe('2025-12-29');
  });

  it('week 52, 2025 → 2025-12-22', () => {
    expect(mondayOfWeek(52, 2025)).toBe('2025-12-22');
  });
});

describe('parseCorvoetReport', () => {
  const report = parseCorvoetReport(W09_26_ROWS, 'Massabalans W09-26.xlsx');

  it('extracts week and year from filename', () => {
    expect(report.week_number).toBe(9);
    expect(report.year).toBe(2026);
    expect(report.processing_date).toBe('2026-02-23');
  });

  it('parses borstkappen input', () => {
    expect(report.borstkappen_in_kg).toBe(8343.5);
  });

  it('parses dijenvlees input', () => {
    expect(report.dijenvlees_in_kg).toBe(513);
  });

  it('calculates total input', () => {
    expect(report.total_in_kg).toBeCloseTo(8856.5, 1);
  });

  it('parses filet rendement', () => {
    expect(report.filet_yield_pct).toBe(70.0);
  });

  it('parses vellen rendement', () => {
    expect(report.vellen_yield_pct).toBe(10.4);
  });

  it('parses dijenvlees rendement', () => {
    expect(report.dijenvlees_yield_pct).toBe(101.9);
  });

  it('parses in_lines', () => {
    expect(report.in_lines.length).toBe(2);
    expect(report.in_lines[0].artikel).toContain('borstkappen');
    expect(report.in_lines[0].netto_kg).toBe(8343.5);
    expect(report.in_lines[1].artikel).toContain('dijenvlees');
    expect(report.in_lines[1].netto_kg).toBe(513);
  });

  it('parses uit_lines', () => {
    expect(report.uit_lines.length).toBe(9);
    expect(report.uit_lines[0].netto_kg).toBe(398.5); // filet 220-240g
    expect(report.uit_lines[7].netto_kg).toBe(865); // kipvellen
  });

  it('calculates total output', () => {
    const expectedTotal = 398.5 + 1841 + 1281 + 476 + 578 + 1260 + 8.42 + 865 + 523;
    expect(report.total_uit_kg).toBeCloseTo(expectedTotal, 1);
  });

  it('stores source file', () => {
    expect(report.source_file).toBe('Massabalans W09-26.xlsx');
  });
});

describe('validateCorvoetReport', () => {
  it('passes validation for W09-26 data', () => {
    const report = parseCorvoetReport(W09_26_ROWS, 'Massabalans W09-26.xlsx');
    const { errors, warnings } = validateCorvoetReport(report);
    expect(errors).toEqual([]);
    // May have a warning about dijenvlees > 100% but no errors
  });

  it('errors on zero borstkappen', () => {
    const emptyRows: (string | number | null)[][] = [
      ['In', null, null],
      ['Artikel', 'Afleveradres', "Netto kilo's"],
      [null, null, null],
      ['Uit', null, null],
      [null, null, null],
      ['Massabalans', null, null],
      ['Borstkappen in', 0, null],
      ['Filet / haasjes uit', 0, '0%'],
    ];
    const report = parseCorvoetReport(emptyRows, 'Massabalans W01-26.xlsx');
    const { errors } = validateCorvoetReport(report);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('Borstkappen'))).toBe(true);
  });

  it('warns on unusual filet yield', () => {
    const report = parseCorvoetReport(W09_26_ROWS, 'Massabalans W09-26.xlsx');
    // Override yield to something unusual
    const modified = { ...report, filet_yield_pct: 55 };
    const { warnings } = validateCorvoetReport(modified);
    expect(warnings.some(w => w.includes('bereik'))).toBe(true);
  });
});
