/**
 * Parser voor Storteboom opzetplanning tekst → slachtdagen
 *
 * Pure client-side utility — geen 'use server' nodig.
 * Wordt gebruikt door ImportSlaughterDays component.
 */

import type { MesterBreakdown } from '@/types/database';

/**
 * Input type voor een enkele slachtdag import
 */
export interface SlaughterDayImport {
  slaughter_date: string;         // ISO date: "2026-02-23"
  expected_birds: number;
  expected_live_weight_kg: number;
  mester_breakdown: MesterBreakdown[];
  slaughter_location: string;
  notes?: string;
}

/**
 * Parse opzetplanning tekst (uit PDF) naar SlaughterDayImport[]
 *
 * Verwacht formaat per ronde:
 *   Rondenummer: N (na X dagen leegstand)
 *   stal  dag  opzetdatum  opzetaantal  ...  dag  leeglaaddatum  lft  aantal  ras  ...
 *
 * De "leeglaaddatum" = vermoedelijke slachtdatum (*)
 */
export function parseOpzetplanning(
  text: string,
  locationName: string,
  avgWeightKg: number = 2.65
): SlaughterDayImport[] {
  const results: SlaughterDayImport[] = [];

  // Split op rondenummers
  const rondeBlocks = text.split(/Rondenummer:\s*\d+/i).slice(1);
  const rondeHeaders = [...text.matchAll(/Rondenummer:\s*(\d+)\s*\(([^)]+)\)/gi)];

  for (let i = 0; i < rondeBlocks.length; i++) {
    const block = rondeBlocks[i];
    const rondeNum = rondeHeaders[i]?.[1] ?? `${i + 1}`;

    // Parse stalrijen — supports TWO formats:
    //
    // Format A (spatie-gescheiden, van pdfjs-dist):
    //   1 MA 20-4-2026 16.000 MA 15-6-2026 56 15.840 757 S ORHO MORR FORFA
    //
    // Format B (aaneengeplakt, van pdf-parse v1):
    //   MA20-4-202616.000115-6-20265615.840MAORHO757 SMORRFORFA
    //   Structuur: {dag2}{opzetdatum}{opzetaantal}{stalnr}{slachtdatum}{lft2}{slachtaantal}{dag2}{concept}{ras}...
    //
    // We try Format A first (more precise), then Format B as fallback.

    // Format A: spatie-gescheiden stalrijen
    const stalRegexA = /(\d+)\s+\w{2}\s+[\d-]+\s+[\d.]+\s+(?:\w{2}\s+)?([\d]+-[\d]+-[\d]+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+([A-Z]+)/g;

    // Format B: aaneengeplakt — {dag2}{opzetdatum}{opzetaantal met punt}{stalnr 1 digit}{slachtdatum}{lft 2 digits}{slachtaantal met punt}
    // Voorbeeld: MA20-4-202616.000115-6-20265615.840MAORHO757 SMORRFORFA
    //            ^^----------^^^^^^^^-^---------^^-----
    //            dag opzetdat  aantal st slachtdt lft slachtaantal
    const stalRegexB = /[A-Z]{2}(\d{1,2}-\d{1,2}-\d{4})(\d{1,2}\.\d{3})(\d)(\d{1,2}-\d{1,2}-\d{4})(\d{2})(\d{1,2}\.\d{3})/g;

    let slaughterDate: string | null = null;
    const stallen: { stal: number; birds: number; lft: number; ras: string }[] = [];

    // Try Format A first
    let match;
    while ((match = stalRegexA.exec(block)) !== null) {
      const stalNum = parseInt(match[1]);
      const dateStr = match[2]; // "23-2-2026" format
      const lft = parseInt(match[3]);
      const birds = Math.round(parseFloat(match[4].replace('.', ''))); // "1.980" → 1980
      const rasNum = match[5]; // "757"
      const rasType = match[6]; // "S"

      // Parse Dutch date "23-2-2026" → "2026-02-23"
      const dateParts = dateStr.split('-');
      if (dateParts.length === 3) {
        const day = dateParts[0].padStart(2, '0');
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2];
        slaughterDate = `${year}-${month}-${day}`;
      }

      stallen.push({ stal: stalNum, birds, lft, ras: `${rasNum} ${rasType}` });
    }

    // Fallback to Format B if Format A found nothing
    if (stallen.length === 0) {
      while ((match = stalRegexB.exec(block)) !== null) {
        // match[1]=opzetdatum, match[2]=opzetaantal, match[3]=stalnr, match[4]=slachtdatum, match[5]=lft, match[6]=slachtaantal
        const stalNum = parseInt(match[3]);
        const dateStr = match[4]; // "15-6-2026"
        const lft = parseInt(match[5]);
        const birds = Math.round(parseFloat(match[6].replace('.', ''))); // "15.840" → 15840

        const dateParts = dateStr.split('-');
        if (dateParts.length === 3) {
          const day = dateParts[0].padStart(2, '0');
          const month = dateParts[1].padStart(2, '0');
          const year = dateParts[2];
          slaughterDate = `${year}-${month}-${day}`;
        }

        stallen.push({ stal: stalNum, birds, lft, ras: '' });
      }
    }

    if (!slaughterDate || stallen.length === 0) continue;

    const totalBirds = stallen.reduce((sum, s) => sum + s.birds, 0);
    const totalWeight = totalBirds * avgWeightKg;

    const mesterBreakdown: MesterBreakdown[] = stallen.map(s => ({
      mester: locationName,
      stal: s.stal,
      birds: s.birds,
      avg_weight_kg: avgWeightKg,
    } as MesterBreakdown & { stal: number }));

    results.push({
      slaughter_date: slaughterDate,
      expected_birds: totalBirds,
      expected_live_weight_kg: Math.round(totalWeight * 100) / 100,
      mester_breakdown: mesterBreakdown,
      slaughter_location: locationName,
      notes: `Ronde ${rondeNum} ${locationName} — ${stallen[0]?.ras ?? ''}, ${stallen[0]?.lft ?? ''} dagen`,
    });
  }

  return results;
}

/** ISO week number berekening */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
