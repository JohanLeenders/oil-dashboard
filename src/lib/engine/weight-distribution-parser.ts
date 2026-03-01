/**
 * Weight Distribution Parser
 *
 * Parses weight distribution data from Storteboom quality reports.
 * Source: "Kwaliteitsverdeling van het koppel" PDF scans.
 *
 * Since these PDFs are scanned images (no text layer), this parser
 * works with structured input data (from manual entry or CSV import).
 * Automatic OCR is a future enhancement.
 *
 * Format: histogram of bird weights in 50g bins.
 */

import type {
  ParsedWeightDistribution,
  WeightDistributionBin,
} from '@/types/slaughter-reports';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse weight distribution from structured data.
 * Input: array of [lower_g, count] pairs, typically in 50g steps.
 */
export function parseWeightDistribution(
  input: {
    flock_number: number;
    flock_location?: string;
    rapport_number?: string;
    weigher_number: number;
    measured_at?: string;
    bins: { lower_g: number; count: number }[];
  }
): ParsedWeightDistribution {
  const totalCount = input.bins.reduce((sum, b) => sum + b.count, 0);

  const bins: WeightDistributionBin[] = input.bins.map(b => ({
    lower_g: b.lower_g,
    upper_g: b.lower_g + 49, // 50g bin width
    count: b.count,
    pct: totalCount > 0 ? Math.round((b.count / totalCount) * 1000) / 10 : 0,
  }));

  return {
    flock_number: input.flock_number,
    flock_location: input.flock_location ?? null,
    rapport_number: input.rapport_number ?? null,
    weigher_number: input.weigher_number,
    measured_at: input.measured_at ?? null,
    total_count: totalCount,
    bins,
  };
}

/**
 * Validate a weight distribution.
 */
export function validateWeightDistribution(
  dist: ParsedWeightDistribution
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (dist.flock_number <= 0) errors.push('Koppelnummer moet > 0 zijn');
  if (dist.weigher_number <= 0) errors.push('Wegernummer moet > 0 zijn');
  if (dist.total_count <= 0) errors.push('Totaal aantal = 0');

  // Check bins are in order
  for (let i = 1; i < dist.bins.length; i++) {
    if (dist.bins[i].lower_g <= dist.bins[i - 1].lower_g) {
      errors.push(`Bins niet in oplopende volgorde bij ${dist.bins[i].lower_g}g`);
      break;
    }
  }

  // Check total percentage ≈ 100%
  const totalPct = dist.bins.reduce((sum, b) => sum + b.pct, 0);
  if (dist.total_count > 0 && Math.abs(totalPct - 100) > 1) {
    warnings.push(`Totaal percentage ${totalPct.toFixed(1)}% (verwacht ~100%)`);
  }

  // Sanity check on weights
  const minWeight = dist.bins.find(b => b.count > 0)?.lower_g ?? 0;
  const maxBin = [...dist.bins].reverse().find(b => b.count > 0);
  const maxWeight = maxBin ? maxBin.upper_g : 0;

  if (minWeight > 0 && minWeight < 500) {
    warnings.push(`Minimaal gewicht ${minWeight}g lijkt laag`);
  }
  if (maxWeight > 4000) {
    warnings.push(`Maximaal gewicht ${maxWeight}g lijkt hoog`);
  }

  return { errors, warnings };
}

/**
 * Calculate summary statistics for a weight distribution.
 */
export function calculateDistributionStats(bins: WeightDistributionBin[]): {
  totalCount: number;
  meanWeight: number;
  medianWeight: number;
  stdDev: number;
  cv: number; // coefficient of variation (%)
  minWeight: number;
  maxWeight: number;
  p10Weight: number;
  p90Weight: number;
} {
  const totalCount = bins.reduce((sum, b) => sum + b.count, 0);
  if (totalCount === 0) {
    return {
      totalCount: 0,
      meanWeight: 0,
      medianWeight: 0,
      stdDev: 0,
      cv: 0,
      minWeight: 0,
      maxWeight: 0,
      p10Weight: 0,
      p90Weight: 0,
    };
  }

  // Midpoint of each bin
  const midpoints = bins.map(b => (b.lower_g + b.upper_g) / 2);

  // Mean
  const meanWeight = bins.reduce((sum, b, i) => sum + midpoints[i] * b.count, 0) / totalCount;

  // Standard deviation
  const variance = bins.reduce((sum, b, i) =>
    sum + b.count * Math.pow(midpoints[i] - meanWeight, 2), 0
  ) / totalCount;
  const stdDev = Math.sqrt(variance);

  // CV
  const cv = meanWeight > 0 ? (stdDev / meanWeight) * 100 : 0;

  // Min/Max (with data)
  const nonEmpty = bins.filter(b => b.count > 0);
  const minWeight = nonEmpty.length > 0 ? nonEmpty[0].lower_g : 0;
  const maxWeight = nonEmpty.length > 0 ? nonEmpty[nonEmpty.length - 1].upper_g : 0;

  // Percentiles (interpolated)
  const p10Weight = getPercentile(bins, midpoints, totalCount, 10);
  const p90Weight = getPercentile(bins, midpoints, totalCount, 90);

  // Median
  const medianWeight = getPercentile(bins, midpoints, totalCount, 50);

  return {
    totalCount,
    meanWeight: Math.round(meanWeight),
    medianWeight: Math.round(medianWeight),
    stdDev: Math.round(stdDev),
    cv: Math.round(cv * 10) / 10,
    minWeight,
    maxWeight,
    p10Weight: Math.round(p10Weight),
    p90Weight: Math.round(p90Weight),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPercentile(
  bins: WeightDistributionBin[],
  midpoints: number[],
  totalCount: number,
  percentile: number
): number {
  const target = (percentile / 100) * totalCount;
  let cumulative = 0;
  for (let i = 0; i < bins.length; i++) {
    cumulative += bins[i].count;
    if (cumulative >= target) {
      return midpoints[i];
    }
  }
  return midpoints[midpoints.length - 1] ?? 0;
}

// ---------------------------------------------------------------------------
// Pre-parsed data from existing PDF scans
// ---------------------------------------------------------------------------

/**
 * Pre-parsed weight distribution data from the PDF scans in Trends/.
 * These were visually extracted since the PDFs are scanned images.
 *
 * Source: Scan__260224_070321.pdf (23-2-2026)
 * Koppel 6: Groenstege 2, rapport 2605409, Weger 1
 */
export const SEED_DISTRIBUTIONS: {
  date: string;
  lot: string;
  distributions: Parameters<typeof parseWeightDistribution>[0][];
}[] = [
  {
    date: '2026-02-23',
    lot: 'P2605409,10',
    distributions: [
      {
        flock_number: 6,
        flock_location: 'Groenstege 2',
        rapport_number: '2605409',
        weigher_number: 1,
        measured_at: '2026-02-23T14:19:00',
        bins: [
          { lower_g: 850, count: 1 }, { lower_g: 900, count: 1 },
          { lower_g: 1050, count: 1 }, { lower_g: 1100, count: 2 },
          { lower_g: 1200, count: 1 }, { lower_g: 1250, count: 2 },
          { lower_g: 1300, count: 6 }, { lower_g: 1350, count: 6 },
          { lower_g: 1400, count: 6 }, { lower_g: 1450, count: 14 },
          { lower_g: 1500, count: 39 }, { lower_g: 1550, count: 63 },
          { lower_g: 1600, count: 103 }, { lower_g: 1650, count: 165 },
          { lower_g: 1700, count: 205 }, { lower_g: 1750, count: 219 },
          { lower_g: 1800, count: 217 }, { lower_g: 1850, count: 176 },
          { lower_g: 1900, count: 190 }, { lower_g: 1950, count: 179 },
          { lower_g: 2000, count: 188 }, { lower_g: 2050, count: 165 },
          { lower_g: 2100, count: 174 }, { lower_g: 2150, count: 174 },
          { lower_g: 2200, count: 162 }, { lower_g: 2250, count: 117 },
          { lower_g: 2300, count: 80 }, { lower_g: 2350, count: 50 },
        ],
      },
      {
        flock_number: 7,
        flock_location: 'Groenstege 3',
        rapport_number: '2605410',
        weigher_number: 2,
        measured_at: '2026-02-23T15:39:00',
        bins: [
          { lower_g: 550, count: 1 }, { lower_g: 600, count: 1 },
          { lower_g: 650, count: 1 }, { lower_g: 950, count: 2 },
          { lower_g: 1000, count: 1 }, { lower_g: 1200, count: 4 },
          { lower_g: 1250, count: 3 }, { lower_g: 1300, count: 9 },
          { lower_g: 1350, count: 9 }, { lower_g: 1400, count: 21 },
          { lower_g: 1450, count: 28 }, { lower_g: 1500, count: 56 },
          { lower_g: 1550, count: 124 }, { lower_g: 1600, count: 191 },
          { lower_g: 1650, count: 328 }, { lower_g: 1700, count: 373 },
          { lower_g: 1750, count: 427 }, { lower_g: 1800, count: 433 },
          { lower_g: 1850, count: 400 }, { lower_g: 1900, count: 403 },
          { lower_g: 1950, count: 411 }, { lower_g: 2000, count: 393 },
          { lower_g: 2050, count: 398 }, { lower_g: 2100, count: 369 },
          { lower_g: 2150, count: 364 }, { lower_g: 2200, count: 379 },
          { lower_g: 2250, count: 335 }, { lower_g: 2300, count: 275 },
          { lower_g: 2350, count: 228 }, { lower_g: 2400, count: 199 },
        ],
      },
    ],
  },
];
