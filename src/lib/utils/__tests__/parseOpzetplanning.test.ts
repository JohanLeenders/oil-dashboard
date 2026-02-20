import { describe, it, expect } from 'vitest';
import { parseOpzetplanning } from '../parseOpzetplanning';

/**
 * Test parseOpzetplanning with text that resembles PDF-extracted output.
 *
 * The Storteboom opzetplanning PDF produces lines like:
 *   Rondenummer: 25 (na 7 dagen leegstand)
 *   1 MA 20-4-2026 16.000 MA 15-6-2026 56 15.840 757 S ORHO MORR FORFA
 *   2 MA 20-4-2026 16.000 MA 15-6-2026 56 15.840 757 S ORHO MORR FORFA
 */

const PDF_EXTRACTED_TEXT = `Leenders V.O.F.
Wisentweg 41
8255 RC Swifterbant
Putten, 20-2-2026
Stal Dag Opzetdatum Opzetaantal Dag Uitlaaddatum (*) Lft Aantal Dag Leeglaaddatum (*) Lft Aantal Ras Concept Broederij Voerlev
Rondenummer: 25 (na 7 dagen leegstand)
1 MA 20-4-2026 16.000 MA 15-6-2026 56 15.840 757 S ORHO MORR FORFA
2 MA 20-4-2026 16.000 MA 15-6-2026 56 15.840 757 S ORHO MORR FORFA
Rondenummer: 26 (na 7 dagen leegstand)
1 MA 22-6-2026 16.000 MA 17-8-2026 56 15.840 757 S ORHO MORR FORFA
2 MA 22-6-2026 16.000 MA 17-8-2026 56 15.840 757 S ORHO MORR FORFA
Rondenummer: 27 (na 7 dagen leegstand)
1 MA 24-8-2026 16.000 MA 19-10-2026 56 15.840 757 S ORHO MORR FORFA
2 MA 24-8-2026 16.000 MA 19-10-2026 56 15.840 757 S ORHO MORR FORFA
Rondenummer: 28 (na 7 dagen leegstand)
1 MA 26-10-2026 16.000 MA 21-12-2026 56 15.840 757 S ORHO MORR FORFA
2 MA 26-10-2026 16.000 MA 21-12-2026 56 15.840 757 S ORHO MORR FORFA
(*) = vermoedelijke slachtdatum`;

describe('parseOpzetplanning', () => {
  it('parses PDF-extracted Storteboom opzetplanning text', () => {
    const result = parseOpzetplanning(PDF_EXTRACTED_TEXT, 'Leenders', 2.65);

    expect(result).toHaveLength(4); // 4 rondes
  });

  it('extracts correct slaughter dates from Dutch format', () => {
    const result = parseOpzetplanning(PDF_EXTRACTED_TEXT, 'Leenders', 2.65);

    expect(result[0].slaughter_date).toBe('2026-06-15'); // 15-6-2026
    expect(result[1].slaughter_date).toBe('2026-08-17'); // 17-8-2026
    expect(result[2].slaughter_date).toBe('2026-10-19'); // 19-10-2026
    expect(result[3].slaughter_date).toBe('2026-12-21'); // 21-12-2026
  });

  it('sums birds from both stallen per ronde', () => {
    const result = parseOpzetplanning(PDF_EXTRACTED_TEXT, 'Leenders', 2.65);

    // Each ronde has 2 stallen × 15.840 = 31.680 birds
    expect(result[0].expected_birds).toBe(31680);
    expect(result[1].expected_birds).toBe(31680);
  });

  it('calculates expected live weight correctly', () => {
    const result = parseOpzetplanning(PDF_EXTRACTED_TEXT, 'Leenders', 2.65);

    // 31680 birds × 2.65 kg = 83952 kg
    expect(result[0].expected_live_weight_kg).toBe(83952);
  });

  it('includes mester_breakdown with both stallen', () => {
    const result = parseOpzetplanning(PDF_EXTRACTED_TEXT, 'Leenders', 2.65);

    expect(result[0].mester_breakdown).toHaveLength(2);
    expect(result[0].mester_breakdown[0].mester).toBe('Leenders');
    expect(result[0].mester_breakdown[0].birds).toBe(15840);
    expect(result[0].mester_breakdown[1].birds).toBe(15840);
  });

  it('sets location name on all results', () => {
    const result = parseOpzetplanning(PDF_EXTRACTED_TEXT, 'Leenders', 2.65);

    result.forEach(day => {
      expect(day.slaughter_location).toBe('Leenders');
    });
  });

  it('includes ronde number in notes', () => {
    const result = parseOpzetplanning(PDF_EXTRACTED_TEXT, 'Leenders', 2.65);

    expect(result[0].notes).toContain('Ronde 25');
    expect(result[1].notes).toContain('Ronde 26');
    expect(result[2].notes).toContain('Ronde 27');
    expect(result[3].notes).toContain('Ronde 28');
  });

  it('includes ras and age in notes', () => {
    const result = parseOpzetplanning(PDF_EXTRACTED_TEXT, 'Leenders', 2.65);

    expect(result[0].notes).toContain('757 S');
    expect(result[0].notes).toContain('56 dagen');
  });

  it('handles different avg weight correctly', () => {
    const result = parseOpzetplanning(PDF_EXTRACTED_TEXT, 'Leenders', 2.80);

    // 31680 birds × 2.80 kg = 88704 kg
    expect(result[0].expected_live_weight_kg).toBe(88704);
  });

  it('returns empty array for text without Rondenummer', () => {
    const result = parseOpzetplanning('Some random text without rondes', 'Test', 2.65);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty text', () => {
    const result = parseOpzetplanning('', 'Test', 2.65);
    expect(result).toHaveLength(0);
  });

  // Test with text that has extra spaces (common in PDF extraction)
  it('handles extra whitespace in PDF text', () => {
    const textWithExtraSpaces = `Rondenummer: 25  (na 7 dagen leegstand)
1  MA  20-4-2026  16.000   MA  15-6-2026  56  15.840  757  S  ORHO  MORR  FORFA`;

    const result = parseOpzetplanning(textWithExtraSpaces, 'Test', 2.65);
    expect(result).toHaveLength(1);
    expect(result[0].slaughter_date).toBe('2026-06-15');
    expect(result[0].expected_birds).toBe(15840);
  });
});

/**
 * Tests for Format B: aaneengeplakte tekst (pdf-parse v1 output).
 *
 * pdf-parse v1 doesn't add spaces between PDF text columns, producing lines like:
 *   MA20-4-202616.000115-6-20265615.840MAORHO757 SMORRFORFA
 *
 * The parser should handle this as a fallback when Format A (with spaces) finds nothing.
 */
const PDF_PARSE_V1_TEXT = `Vleeskuikenhouder: Leenders V.O.F.
Leenders V.O.F.
Wisentweg 41
8255 RC
Putten, 20-2-2026
Swifterbant
Rondenummer: 25 (na 7 dagen leegstand)
MA20-4-202616.000115-6-20265615.840MAORHO757 SMORRFORFA
MA20-4-202616.000215-6-20265615.840MAORHO757 SMORRFORFA
Rondenummer: 26 (na 7 dagen leegstand)
MA22-6-202616.000117-8-20265615.840MAORHO757 SMORRFORFA
MA22-6-202616.000217-8-20265615.840MAORHO757 SMORRFORFA
Rondenummer: 27 (na 7 dagen leegstand)
MA24-8-202616.000119-10-20265615.840MAORHO757 SMORRFORFA
MA24-8-202616.000219-10-20265615.840MAORHO757 SMORRFORFA
Rondenummer: 28 (na 7 dagen leegstand)
MA26-10-202616.000121-12-20265615.840MAORHO757 SMORRFORFA
MA26-10-202616.000221-12-20265615.840MAORHO757 SMORRFORFA
(*) = vermoedelijke slachtdatum`;

describe('parseOpzetplanning — Format B (aaneengeplakt, pdf-parse v1)', () => {
  it('parses aaneengeplakte tekst into 4 rondes', () => {
    const result = parseOpzetplanning(PDF_PARSE_V1_TEXT, 'Leenders', 2.65);
    expect(result).toHaveLength(4);
  });

  it('extracts correct slaughter dates', () => {
    const result = parseOpzetplanning(PDF_PARSE_V1_TEXT, 'Leenders', 2.65);
    expect(result[0].slaughter_date).toBe('2026-06-15');
    expect(result[1].slaughter_date).toBe('2026-08-17');
    expect(result[2].slaughter_date).toBe('2026-10-19');
    expect(result[3].slaughter_date).toBe('2026-12-21');
  });

  it('sums birds from both stallen per ronde', () => {
    const result = parseOpzetplanning(PDF_PARSE_V1_TEXT, 'Leenders', 2.65);
    expect(result[0].expected_birds).toBe(31680);
    expect(result[1].expected_birds).toBe(31680);
  });

  it('calculates expected live weight correctly', () => {
    const result = parseOpzetplanning(PDF_PARSE_V1_TEXT, 'Leenders', 2.65);
    expect(result[0].expected_live_weight_kg).toBe(83952);
  });

  it('includes mester_breakdown with both stallen', () => {
    const result = parseOpzetplanning(PDF_PARSE_V1_TEXT, 'Leenders', 2.65);
    expect(result[0].mester_breakdown).toHaveLength(2);
    expect(result[0].mester_breakdown[0].birds).toBe(15840);
    expect(result[0].mester_breakdown[1].birds).toBe(15840);
  });

  it('includes ronde number in notes', () => {
    const result = parseOpzetplanning(PDF_PARSE_V1_TEXT, 'Leenders', 2.65);
    expect(result[0].notes).toContain('Ronde 25');
    expect(result[3].notes).toContain('Ronde 28');
  });

  // Test with Groenestege format (different bird counts, more stallen per ronde)
  it('parses Groenestege aaneengeplakt (different counts)', () => {
    const groenestege = `Rondenummer: 7 (na 8 dagen leegstand)
DI30-12-20259.180224-2-2026569.088DIORHO757 SPROMEFORFA
DI30-12-202515.240324-2-20265615.088DIORHO757 SPROMEFORFA`;

    const result = parseOpzetplanning(groenestege, 'Groenestege', 2.65);
    expect(result).toHaveLength(1);
    expect(result[0].slaughter_date).toBe('2026-02-24');
    expect(result[0].expected_birds).toBe(9088 + 15088); // 24176
    expect(result[0].mester_breakdown).toHaveLength(2);
  });

  // Klein Hurksveld with 4 stallen
  it('parses Klein Hurksveld aaneengeplakt (4 stallen per ronde)', () => {
    const kh = `Rondenummer: 18 (na 20 dagen leegstand)
MA29-12-20252.000123-2-2026561.980MAORHO757 SMORPUTFORFA
MA29-12-20253.600223-2-2026563.564MAORHO757 SMORPUTFORFA
MA29-12-20252.000323-2-2026561.980MAORHO757 SMORPUTFORFA
MA29-12-20258.600423-2-2026568.514MAORHO757 SMORPUTFORFA`;

    const result = parseOpzetplanning(kh, 'Klein Hurksveld', 2.65);
    expect(result).toHaveLength(1);
    expect(result[0].slaughter_date).toBe('2026-02-23');
    expect(result[0].expected_birds).toBe(1980 + 3564 + 1980 + 8514); // 16038
    expect(result[0].mester_breakdown).toHaveLength(4);
  });
});
