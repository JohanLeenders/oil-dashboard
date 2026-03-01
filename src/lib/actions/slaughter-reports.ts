/**
 * Server Actions — Slaughter Reports
 *
 * Read-only actions for fetching slaughter report data.
 * Used by the Trends page for display and trending.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  SlaughterReport,
  SlaughterReportLine,
  SlaughterReportWithLines,
  WeightDistribution,
  MesterTrendPoint,
  MesterSummary,
  ReportType,
} from '@/types/slaughter-reports';

// ---------------------------------------------------------------------------
// List / Query
// ---------------------------------------------------------------------------

/** Get all slaughter reports, ordered by date descending */
export async function getSlaughterReports(
  reportType?: ReportType
): Promise<SlaughterReport[]> {
  const supabase = await createClient();

  let query = supabase
    .from('slaughter_reports')
    .select('*')
    .order('slaughter_date', { ascending: false });

  if (reportType) {
    query = query.eq('report_type', reportType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SlaughterReport[];
}

/** Get a single report with its yield lines and weight distributions */
export async function getSlaughterReportWithLines(
  reportId: string
): Promise<SlaughterReportWithLines | null> {
  const supabase = await createClient();

  const { data: report, error: reportError } = await supabase
    .from('slaughter_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (reportError) {
    if (reportError.code === 'PGRST116') return null; // Not found
    throw reportError;
  }

  const { data: lines, error: linesError } = await supabase
    .from('slaughter_report_lines')
    .select('*')
    .eq('report_id', reportId)
    .order('sort_order');

  if (linesError) throw linesError;

  return {
    ...(report as SlaughterReport),
    lines: (lines ?? []) as SlaughterReportLine[],
  };
}

/** Get weight distributions for a report */
export async function getWeightDistributions(
  reportId: string
): Promise<WeightDistribution[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('weight_distributions')
    .select('*')
    .eq('report_id', reportId)
    .order('flock_number')
    .order('weigher_number');

  if (error) throw error;
  return (data ?? []) as WeightDistribution[];
}

// ---------------------------------------------------------------------------
// Trend Aggregations
// ---------------------------------------------------------------------------

/** Get trend data points for all reports (for trend charts) */
export async function getMesterTrendData(
  reportType: ReportType = 'slacht_putten'
): Promise<MesterTrendPoint[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('slaughter_reports')
    .select('mester, slaughter_date, lot_number, live_count, avg_live_weight_kg, total_yield_pct, griller_yield_pct, cat2_pct, griller_avg_weight_kg')
    .eq('report_type', reportType)
    .order('slaughter_date', { ascending: true });

  if (error) throw error;

  return (data ?? []).map(row => ({
    mester: row.mester,
    slaughter_date: row.slaughter_date,
    lot_number: row.lot_number,
    live_count: row.live_count ?? 0,
    avg_live_weight_kg: row.avg_live_weight_kg ?? 0,
    total_yield_pct: row.total_yield_pct ?? 0,
    griller_yield_pct: row.griller_yield_pct ?? 0,
    cat2_pct: row.cat2_pct ?? 0,
    griller_avg_weight_kg: row.griller_avg_weight_kg ?? 0,
  }));
}

/** Get per-mester summary statistics */
export async function getMesterSummaries(
  reportType: ReportType = 'slacht_putten'
): Promise<MesterSummary[]> {
  const reports = await getSlaughterReports(reportType);

  // Group by mester
  const byMester = new Map<string, SlaughterReport[]>();
  for (const r of reports) {
    const existing = byMester.get(r.mester) || [];
    existing.push(r);
    byMester.set(r.mester, existing);
  }

  return Array.from(byMester.entries()).map(([mester, mesterReports]) => {
    const count = mesterReports.length;
    const totalBirds = mesterReports.reduce((s, r) => s + (r.live_count ?? 0), 0);
    const avgLive = mesterReports.reduce((s, r) => s + (r.avg_live_weight_kg ?? 0), 0) / count;
    const avgTotalYield = mesterReports.reduce((s, r) => s + (r.total_yield_pct ?? 0), 0) / count;
    const avgGrillerYield = mesterReports.reduce((s, r) => s + (r.griller_yield_pct ?? 0), 0) / count;
    const avgCat2 = mesterReports.reduce((s, r) => s + (r.cat2_pct ?? 0), 0) / count;
    const latest = mesterReports[0]?.slaughter_date ?? '';

    return {
      mester,
      report_count: count,
      total_birds: totalBirds,
      avg_live_weight_kg: Math.round(avgLive * 1000) / 1000,
      avg_total_yield_pct: Math.round(avgTotalYield * 100) / 100,
      avg_griller_yield_pct: Math.round(avgGrillerYield * 100) / 100,
      avg_cat2_pct: Math.round(avgCat2 * 100) / 100,
      latest_slaughter_date: latest,
    };
  });
}

/** Get all report lines for a given report type */
export async function getAllReportLines(
  reportType: ReportType = 'slacht_putten'
): Promise<SlaughterReportLine[]> {
  const supabase = await createClient();

  // Get report IDs for this type
  const { data: reports, error: reportsError } = await supabase
    .from('slaughter_reports')
    .select('id')
    .eq('report_type', reportType);

  if (reportsError) throw reportsError;

  const reportIds = (reports ?? []).map(r => r.id);
  if (reportIds.length === 0) return [];

  const { data: lines, error: linesError } = await supabase
    .from('slaughter_report_lines')
    .select('*')
    .in('report_id', reportIds)
    .order('sort_order');

  if (linesError) throw linesError;
  return (lines ?? []) as SlaughterReportLine[];
}

/** Delete a report and all its related data (cascade) */
export async function deleteSlaughterReport(reportId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('slaughter_reports')
    .delete()
    .eq('id', reportId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Corvoet (fileer_corvoet) helpers
// ---------------------------------------------------------------------------

/** Corvoet report with its massabalans lines */
export interface CorvoetReportRow {
  id: string;
  lot_number: string;
  slaughter_date: string;
  live_weight_kg: number | null; // total input kg
  griller_yield_pct: number | null; // filet rendement %
  source_file: string | null;
  notes: string | null;
  lines: SlaughterReportLine[];
}

// ---------------------------------------------------------------------------
// Weight Distribution Histograms
// ---------------------------------------------------------------------------

export interface WeightBin {
  lower_g: number;
  upper_g: number;
  bird_count: number;
  pct: number;
}

export interface HistogramDataRow {
  report_id: string;
  mester: string;
  slaughter_date: string;
  live_count: number | null;
  bins: WeightBin[];
}

/** Get weight distribution data for all slacht_putten reports that have histogram bins */
export async function getWeightHistograms(): Promise<HistogramDataRow[]> {
  const supabase = await createClient();

  // Get slacht_putten reports
  const { data: reports, error: reportsError } = await supabase
    .from('slaughter_reports')
    .select('id, mester, slaughter_date, live_count')
    .eq('report_type', 'slacht_putten')
    .order('slaughter_date', { ascending: true });

  if (reportsError) throw reportsError;
  if (!reports || reports.length === 0) return [];

  const reportIds = reports.map(r => r.id);

  // Get all bins for those reports
  const { data: bins, error: binsError } = await supabase
    .from('weight_distribution_bins')
    .select('report_id, lower_g, upper_g, bird_count, pct')
    .in('report_id', reportIds)
    .order('lower_g');

  if (binsError) throw binsError;

  // Group bins by report
  const binsByReport: Record<string, WeightBin[]> = {};
  for (const bin of (bins ?? [])) {
    if (!binsByReport[bin.report_id]) binsByReport[bin.report_id] = [];
    binsByReport[bin.report_id].push({
      lower_g: bin.lower_g,
      upper_g: bin.upper_g,
      bird_count: bin.bird_count,
      pct: Number(bin.pct),
    });
  }

  // Only return reports that have bins
  return reports
    .filter(r => binsByReport[r.id]?.length > 0)
    .map(r => ({
      report_id: r.id,
      mester: r.mester,
      slaughter_date: r.slaughter_date,
      live_count: r.live_count,
      bins: binsByReport[r.id],
    }));
}

/** Get all Corvoet fileer reports with their massabalans lines */
export async function getCorvoetReports(): Promise<CorvoetReportRow[]> {
  const supabase = await createClient();

  const { data: reports, error: reportsError } = await supabase
    .from('slaughter_reports')
    .select('id, lot_number, slaughter_date, live_weight_kg, griller_yield_pct, source_file, notes')
    .eq('report_type', 'fileer_corvoet')
    .order('slaughter_date', { ascending: false });

  if (reportsError) throw reportsError;
  if (!reports || reports.length === 0) return [];

  const reportIds = reports.map(r => r.id);

  const { data: lines, error: linesError } = await supabase
    .from('slaughter_report_lines')
    .select('*')
    .in('report_id', reportIds)
    .order('sort_order');

  if (linesError) throw linesError;

  const linesByReport: Record<string, SlaughterReportLine[]> = {};
  for (const line of (lines ?? []) as SlaughterReportLine[]) {
    if (!linesByReport[line.report_id]) linesByReport[line.report_id] = [];
    linesByReport[line.report_id].push(line);
  }

  return reports.map(r => ({
    ...r,
    lines: linesByReport[r.id] ?? [],
  }));
}
