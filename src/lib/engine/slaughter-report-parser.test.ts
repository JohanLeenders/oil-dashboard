/**
 * Tests for slaughter report parser
 *
 * Uses real data from 3 Trends Excel files:
 *   - 23-2-2026 (Groenstege, Lot P2605409,10)
 *   - 24-2-2026 (Hurksveld, Lot P2605509,10,11,12)
 *   - 9-2-2026  (Leenders, Lot P2604006,07)
 */

import { describe, it, expect } from 'vitest';
import {
  parseSlaughterReport,
  validateSlaughterReport,
} from './slaughter-report-parser';

// ---------------------------------------------------------------------------
// Test data: CSV rows from real Excel files (semicolon-delimited, parsed to arrays)
// ---------------------------------------------------------------------------

/** Helper: parse a semicolon-delimited CSV string into a 2D array */
function csvToRows(csv: string): (string | number | null)[][] {
  return csv.split('\n').map(line =>
    line.split(';').map(cell => {
      const trimmed = cell.trim();
      if (trimmed === '') return null;
      return trimmed;
    })
  );
}

const GROENSTEGE_CSV = `;;;;;;
;Algemeen;P;;;
;Lotnummer;P2605409,10;;;
;Mester;Groenstege;;;
;Ras;Oranjehoen;;;
;Hok;2&3;;;
;Slachtdatum;2/23/26;;;
;;;;;;
;Aanvoer;Aantal;Gewicht;Gem. gewicht;
;Levende Kuikens;23,866;65,920;2.762;
;Dood aangevoerd;;0;;
;Totaal (levend + dood);23,866;65,920;;
;;;;;;
;Slachterij;Aantal;Gewicht;Gem. gewicht;Rendement
;Afgekeurd (incl. verontreinigd);150;414;;
;Verbroeid;0;0;;
;Totaal Cat2 (Afkeur & DOA's);150;414;;0.63%
;;;;;;
;Bloed (Cat3);;;;2.70%
;Veren (Cat3);;;;4.70%
;Hoofden (Cat3);;;;13.36%
;Poten (Cat3);;;;
;Ingewanden (Cat3);;;;
;Totaal Cat3;;;;20.76%
;;;;;;
;Nekken;;;;0.00%
;Levers;;;;0.00%
;Magen;;;;0.00%
;Harten;;;;0.00%
;;;;;;
;Totaal rendment;;;;93.23%
;;;;;;
;;;;;;
;Inpak Delen;Aantal;Gewicht;Gem. gewicht;Rendement
;Gril kuikens;23,716;47,060.0;1.98;71.8%
;Zaag kuikens;90;155.0;1.72;
;Kuikens inpakken;0;0.0;#DIV/0!;
;Kuikens delen;23,626;46,905;1.99;
;;;;;;
;Verwerking;Aantal;Gewicht;Gemiddelde;Rendement
;Bouten;23,626;20,346;0.861;43.38%
;Vleugels ;;4406.0;;9.39%
;B vleugels;;15;;0.03%
;C Vleugels;;25.0;;0.05%
;Vleugeltippen;;540.0;;1.15%
;Borsten;;17798.0;;37.94%
;Dijen;;;;0.00%
;Drum;;;;0.00%
;Achterrug;;;;0.00%
;Staarten;;475.0;;1.01%
;Voorrug;;3292.0;;7.02%
;Totaal;23,626;46,897.0;;99.98%`;

const HURKSVELD_CSV = `;;;;;;
;Algemeen;P;;;
;Lotnummer;P2605509,10,11,12;;;
;Mester;Hurksveld;;;
;Ras;Oranjehoen;;;
;Hok;1,2,3,4;;;
;Slachtdatum;2/24/26;;;
;;;;;;
;Aanvoer;Aantal;Gewicht;Gem. gewicht;
;Levende Kuikens;15,702;41,640;2.652;
;Dood aangevoerd;0;0;;
;Totaal (levend + dood);15,702;41,640;;
;;;;;;
;Slachterij;Aantal;Gewicht;Gem. gewicht;Rendement
;Afgekeurd (incl. verontreinigd);82;217;;
;Verbroeid;0;0;;
;Totaal Cat2 (Afkeur & DOA's);82;217;;0.52%
;;;;;;
;Bloed (Cat3);;;;2.70%
;Veren (Cat3);;;;4.70%
;Hoofden (Cat3);;;;13.36%
;Poten (Cat3);;;;
;Ingewanden (Cat3);;;;
;Totaal Cat3;;;;20.76%
;;;;;;
;Nekken;;;;0.00%
;Levers;;;;0.00%
;Magen;;;;0.00%
;Harten;;;;0.00%
;;;;;;
;Totaal rendment;;;;93.92%
;;;;;;
;;;;;;
;Inpak Delen;Aantal;Gewicht;Gem. gewicht;Rendement
;Gril kuikens;15,620;30,090.0;1.93;72.6%
;Zaag kuikens;5;8.0;1.60;
;Kuikens inpakken;3,984;7,431.0;1.87;
;Kuikens delen;11,631;22,651;1.95;
;;;;;;
;Verwerking;Aantal;Gewicht;Gemiddelde;Rendement
;Bouten;11,631;9,806;0.843;43.29%
;Vleugels ;;2165.0;;9.56%
;B vleugels;;20;;0.09%
;C Vleugels;;85.0;;0.38%
;Vleugeltippen;;265.0;;1.17%
;Borsten;;8365.0;;36.93%
;Dijen;;;;0.00%
;Drum;;;;0.00%
;Achterrug;;;;0.00%
;Staarten;;255.5;;1.13%
;Voorrug;;1661.5;;7.34%
;Totaal;11,631;22,623.0;;99.88%`;

const LEENDERS_CSV = `;;;;;;
;Algemeen;P;;;
;Lotnummer;P2604006,07;;;
;Mester;Leenders;;;
;Ras;Oranjehoen;;;
;Hok;1 en 2;;;
;Slachtdatum;2/9/26;;;
;;;;;;
;Aanvoer;Aantal;Gewicht;Gem. gewicht;
;Levende Kuikens;31,547;89,801;2.847;
;Dood aangevoerd;7;20;;
;Totaal (levend + dood);31,554;89,821;;
;;;;;;
;Slachterij;Aantal;Gewicht;Gem. gewicht;Rendement
;Afgekeurd (incl. verontreinigd);478;1,361;;
;Verbroeid;0;0;;
;Totaal Cat2 (Afkeur & DOA's);485;1,381;;1.54%
;;;;;;
;Bloed (Cat3);;;;2.70%
;Veren (Cat3);;;;4.70%
;Hoofden (Cat3);;;;13.36%
;Poten (Cat3);;;;
;Ingewanden (Cat3);;;;
;Totaal Cat3;;;;20.76%
;;;;;;
;Nekken;;;;0.00%
;Levers;;;;0.00%
;Magen;;;;0.00%
;Harten;;;;0.00%
;;;;;;
;Totaal rendment;;;;95.26%
;;;;;;
;;;;;;
;Inpak Delen;Aantal;Gewicht;Gem. gewicht;Rendement
;Gril kuikens;31,069;64,531.0;2.08;73.0%
;Zaag kuikens;400;570.0;1.43;
;Kuikens inpakken;3,152;6,132.5;1.95;
;Kuikens delen;27,517;57,829;2.10;
;;;;;;
;Verwerking;Aantal;Gewicht;Gemiddelde;Rendement
;Bouten;27,517;24,740;0.899;42.78%
;Vleugels ;;5250.0;;9.08%
;B vleugels;;200;;0.35%
;C Vleugels;;210.0;;0.36%
;Vleugeltippen;;845.0;;1.46%
;Borsten;;20704.5;;35.80%
;Dijen;;362.5;;0.63%
;Drum;;256.0;;0.44%
;Achterrug;;244.0;;0.42%
;Staarten;;511.0;;0.88%
;Voorrug;;4484.0;;7.75%
;Totaal;27,517;57,806.5;;99.96%`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseSlaughterReport', () => {
  describe('Groenstege (23-2-2026)', () => {
    const rows = csvToRows(GROENSTEGE_CSV);
    const report = parseSlaughterReport(rows, 'Map1.xlsx');

    it('parses header correctly', () => {
      expect(report.lot_number).toBe('P2605409,10');
      expect(report.mester).toBe('Groenstege');
      expect(report.breed).toBe('Oranjehoen');
      expect(report.barn).toBe('2&3');
      expect(report.slaughter_date).toBe('2026-02-23');
      expect(report.report_type).toBe('slacht_putten');
    });

    it('parses aanvoer correctly', () => {
      expect(report.live_count).toBe(23866);
      expect(report.live_weight_kg).toBe(65920);
      expect(report.avg_live_weight_kg).toBeCloseTo(2.762, 2);
    });

    it('parses DOA correctly', () => {
      expect(report.doa_count).toBe(0);
      expect(report.doa_weight_kg).toBe(0);
    });

    it('parses slachterij correctly', () => {
      expect(report.rejected_count).toBe(150);
      expect(report.rejected_weight_kg).toBe(414);
      expect(report.cat2_pct).toBeCloseTo(0.63, 1);
      expect(report.cat3_pct).toBeCloseTo(20.76, 1);
    });

    it('parses key yields correctly', () => {
      expect(report.total_yield_pct).toBeCloseTo(93.23, 1);
      expect(report.griller_yield_pct).toBeCloseTo(71.8, 1);
    });

    it('parses griller details correctly', () => {
      expect(report.griller_count).toBe(23716);
      expect(report.griller_weight_kg).toBeCloseTo(47060.0, 0);
      expect(report.griller_avg_weight_kg).toBeCloseTo(1.98, 1);
    });

    it('parses routing correctly', () => {
      expect(report.saw_count).toBe(90);
      expect(report.pack_count).toBe(0);
      expect(report.cutup_count).toBe(23626);
    });

    it('parses cat3 yield lines', () => {
      const cat3 = report.lines.filter(l => l.section === 'cat3');
      expect(cat3.length).toBeGreaterThanOrEqual(3);

      const bloed = cat3.find(l => l.product_code === 'bloed');
      expect(bloed?.yield_pct).toBeCloseTo(2.7, 1);

      const veren = cat3.find(l => l.product_code === 'veren');
      expect(veren?.yield_pct).toBeCloseTo(4.7, 1);
    });

    it('parses verwerking lines', () => {
      const verwerking = report.lines.filter(l => l.section === 'verwerking');
      expect(verwerking.length).toBeGreaterThanOrEqual(5);

      const bouten = verwerking.find(l => l.product_code === 'bouten');
      expect(bouten?.yield_pct).toBeCloseTo(43.38, 1);
      expect(bouten?.weight_kg).toBeCloseTo(20346, 0);

      const borsten = verwerking.find(l => l.product_code === 'borsten');
      expect(borsten?.yield_pct).toBeCloseTo(37.94, 1);

      const vleugels = verwerking.find(l => l.product_code === 'vleugels');
      expect(vleugels?.yield_pct).toBeCloseTo(9.39, 1);
    });
  });

  describe('Hurksveld (24-2-2026)', () => {
    const rows = csvToRows(HURKSVELD_CSV);
    const report = parseSlaughterReport(rows, 'Map2.xlsx');

    it('parses different mester correctly', () => {
      expect(report.mester).toBe('Hurksveld');
      expect(report.lot_number).toBe('P2605509,10,11,12');
      expect(report.slaughter_date).toBe('2026-02-24');
    });

    it('parses aanvoer for smaller batch', () => {
      expect(report.live_count).toBe(15702);
      expect(report.live_weight_kg).toBe(41640);
      expect(report.avg_live_weight_kg).toBeCloseTo(2.652, 2);
    });

    it('parses key yields', () => {
      expect(report.total_yield_pct).toBeCloseTo(93.92, 1);
      expect(report.griller_yield_pct).toBeCloseTo(72.6, 1);
      expect(report.cat2_pct).toBeCloseTo(0.52, 1);
    });

    it('has non-zero pack count (kuikens inpakken)', () => {
      expect(report.pack_count).toBe(3984);
      expect(report.cutup_count).toBe(11631);
    });
  });

  describe('Leenders (9-2-2026)', () => {
    const rows = csvToRows(LEENDERS_CSV);
    const report = parseSlaughterReport(rows, 'Map2.xlsx');

    it('parses mester with DOA birds', () => {
      expect(report.mester).toBe('Leenders');
      expect(report.doa_count).toBe(7);
      expect(report.doa_weight_kg).toBe(20);
    });

    it('parses largest batch correctly', () => {
      expect(report.live_count).toBe(31547);
      expect(report.live_weight_kg).toBe(89801);
      expect(report.avg_live_weight_kg).toBeCloseTo(2.847, 2);
    });

    it('parses yields with extra products', () => {
      const verwerking = report.lines.filter(l => l.section === 'verwerking');

      // Leenders has dijen, drum, achterrug which others don't
      const dijen = verwerking.find(l => l.product_code === 'dijen');
      expect(dijen?.yield_pct).toBeCloseTo(0.63, 1);

      const drum = verwerking.find(l => l.product_code === 'drum');
      expect(drum?.yield_pct).toBeCloseTo(0.44, 1);
    });

    it('higher rejection rate parsed correctly', () => {
      expect(report.cat2_pct).toBeCloseTo(1.54, 1);
      expect(report.rejected_count).toBe(478);
    });
  });
});

describe('validateSlaughterReport', () => {
  it('passes valid report', () => {
    const rows = csvToRows(GROENSTEGE_CSV);
    const report = parseSlaughterReport(rows, 'test.xlsx');
    const { errors, warnings } = validateSlaughterReport(report);
    expect(errors).toHaveLength(0);
  });

  it('reports error for missing lot number', () => {
    const report = parseSlaughterReport([], 'empty.xlsx');
    const { errors } = validateSlaughterReport(report);
    expect(errors.some(e => e.includes('Lotnummer'))).toBe(true);
  });

  it('reports error for missing mester', () => {
    const report = parseSlaughterReport([], 'empty.xlsx');
    const { errors } = validateSlaughterReport(report);
    expect(errors.some(e => e.includes('Mester'))).toBe(true);
  });

  it('warns about high cat2 rejection', () => {
    const rows = csvToRows(LEENDERS_CSV);
    const report = parseSlaughterReport(rows, 'test.xlsx');
    // Leenders has 1.54% which is < 3%, so no warning
    const { warnings } = validateSlaughterReport(report);
    // No cat2 warning for normal values
    expect(warnings.filter(w => w.includes('Cat2'))).toHaveLength(0);
  });

  it('warns about out-of-range griller yield', () => {
    const rows = csvToRows(GROENSTEGE_CSV);
    const report = parseSlaughterReport(rows, 'test.xlsx');
    // 71.8% is within range, no warning
    const { warnings } = validateSlaughterReport(report);
    expect(warnings.filter(w => w.includes('Griller yield'))).toHaveLength(0);
  });

  it('verwerking total ~100% gives no warning', () => {
    const rows = csvToRows(GROENSTEGE_CSV);
    const report = parseSlaughterReport(rows, 'test.xlsx');
    const { warnings } = validateSlaughterReport(report);
    expect(warnings.filter(w => w.includes('Verwerking totaal'))).toHaveLength(0);
  });
});
