/**
 * Sprint 6: Historical Trends Engine
 *
 * Analyzes trends over time for parts and customers.
 * DESCRIPTIVE ONLY - no forecasting, no predictions.
 *
 * Key concepts:
 * - Trends are patterns observed in historical data
 * - All trends are labeled as HISTORICAL, not predictive
 * - Supports learning, not optimization
 */

import type { AnatomicalPart } from '@/types/database';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Period type for aggregation
 */
export type PeriodType = 'week' | 'month' | 'quarter';

/**
 * Trend direction (DESCRIPTIVE only)
 */
export type TrendDirection = 'UP' | 'DOWN' | 'STABLE' | 'INSUFFICIENT_DATA';

/**
 * Part trend data point
 */
export interface PartTrendPoint {
  part_code: AnatomicalPart;
  period_start: string;
  period_type: PeriodType;
  period_number: number;
  period_year: number;
  avg_yield_pct: number | null;
  yield_stddev: number | null;
  batch_count: number | null;
  produced_kg: number | null;
  total_sold_kg: number | null;
  total_revenue_eur: number | null;
  total_margin_eur: number | null;
  avg_margin_pct: number | null;
  avg_dsi: number | null;
  data_status: 'COMPLETE' | 'PARTIAL' | 'NO_DATA';
}

/**
 * Customer trend data point
 */
export interface CustomerTrendPoint {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  period_start: string;
  period_type: PeriodType;
  period_number: number;
  period_year: number;
  total_kg: number;
  total_revenue_eur: number;
  total_margin_eur: number;
  margin_pct: number | null;
  alignment_score: number | null;
  volume_change_pct: number | null;
  margin_change_pct: number | null;
  alignment_change: number | null;
  data_status: 'COMPLETE' | 'PARTIAL' | 'NO_DATA';
}

/**
 * Trend summary for a part
 */
export interface PartTrendSummary {
  part_code: AnatomicalPart;
  yield_trend: TrendDirection;
  margin_trend: TrendDirection;
  volume_trend: TrendDirection;
  avg_yield_recent: number | null;
  avg_yield_prior: number | null;
  avg_margin_recent: number | null;
  avg_margin_prior: number | null;
  periods_analyzed: number;
  explanation: string;
}

/**
 * Trend summary for a customer
 */
export interface CustomerTrendSummary {
  customer_id: string;
  customer_name: string;
  volume_trend: TrendDirection;
  margin_trend: TrendDirection;
  alignment_trend: TrendDirection;
  avg_margin_recent: number | null;
  avg_margin_prior: number | null;
  avg_alignment_recent: number | null;
  avg_alignment_prior: number | null;
  periods_analyzed: number;
  explanation: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Thresholds for trend detection
 * DESCRIPTIVE only - not targets
 */
export const TREND_THRESHOLDS = {
  significant_change_pct: 5,      // Change > 5% = trend detected
  minimum_periods: 3,             // Need at least 3 periods for trend
  recent_periods: 3,              // Compare last 3 periods
  prior_periods: 3,               // vs prior 3 periods
};

/**
 * Disclaimer for all trend data
 */
export const TREND_DISCLAIMER =
  'Dit is een beschrijvende trend gebaseerd op historische data. Dit is GEEN voorspelling of aanbeveling.';

export const TREND_DISCLAIMER_EN =
  'This is a descriptive trend based on historical data. This is NOT a prediction or recommendation.';

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calculate trend direction from values
 * DESCRIPTIVE only
 */
export function calculateTrendDirection(
  recentAvg: number | null,
  priorAvg: number | null,
  threshold: number = TREND_THRESHOLDS.significant_change_pct
): TrendDirection {
  if (recentAvg === null || priorAvg === null) {
    return 'INSUFFICIENT_DATA';
  }

  if (priorAvg === 0) {
    if (recentAvg > 0) return 'UP';
    if (recentAvg < 0) return 'DOWN';
    return 'STABLE';
  }

  const changePct = ((recentAvg - priorAvg) / Math.abs(priorAvg)) * 100;

  if (changePct > threshold) return 'UP';
  if (changePct < -threshold) return 'DOWN';
  return 'STABLE';
}

/**
 * Calculate average of values, handling nulls
 */
export function calculateAverage(values: (number | null)[]): number | null {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
}

/**
 * Generate part trend summary from data points
 */
export function summarizePartTrend(
  data: PartTrendPoint[],
  part_code: AnatomicalPart
): PartTrendSummary {
  const partData = data
    .filter(d => d.part_code === part_code)
    .sort((a, b) => {
      if (a.period_year !== b.period_year) return b.period_year - a.period_year;
      return b.period_number - a.period_number;
    });

  if (partData.length < TREND_THRESHOLDS.minimum_periods) {
    return {
      part_code,
      yield_trend: 'INSUFFICIENT_DATA',
      margin_trend: 'INSUFFICIENT_DATA',
      volume_trend: 'INSUFFICIENT_DATA',
      avg_yield_recent: null,
      avg_yield_prior: null,
      avg_margin_recent: null,
      avg_margin_prior: null,
      periods_analyzed: partData.length,
      explanation: 'Onvoldoende data voor trendanalyse.',
    };
  }

  // Split into recent and prior periods
  const recentData = partData.slice(0, TREND_THRESHOLDS.recent_periods);
  const priorData = partData.slice(
    TREND_THRESHOLDS.recent_periods,
    TREND_THRESHOLDS.recent_periods + TREND_THRESHOLDS.prior_periods
  );

  // Calculate averages
  const avg_yield_recent = calculateAverage(recentData.map(d => d.avg_yield_pct));
  const avg_yield_prior = calculateAverage(priorData.map(d => d.avg_yield_pct));
  const avg_margin_recent = calculateAverage(recentData.map(d => d.avg_margin_pct));
  const avg_margin_prior = calculateAverage(priorData.map(d => d.avg_margin_pct));
  const avg_volume_recent = calculateAverage(recentData.map(d => d.total_sold_kg));
  const avg_volume_prior = calculateAverage(priorData.map(d => d.total_sold_kg));

  // Determine trends
  const yield_trend = calculateTrendDirection(avg_yield_recent, avg_yield_prior);
  const margin_trend = calculateTrendDirection(avg_margin_recent, avg_margin_prior);
  const volume_trend = calculateTrendDirection(avg_volume_recent, avg_volume_prior);

  // Generate explanation
  const explanation = generatePartTrendExplanation(
    part_code,
    yield_trend,
    margin_trend,
    volume_trend
  );

  return {
    part_code,
    yield_trend,
    margin_trend,
    volume_trend,
    avg_yield_recent: avg_yield_recent !== null ? Math.round(avg_yield_recent * 100) / 100 : null,
    avg_yield_prior: avg_yield_prior !== null ? Math.round(avg_yield_prior * 100) / 100 : null,
    avg_margin_recent: avg_margin_recent !== null ? Math.round(avg_margin_recent * 100) / 100 : null,
    avg_margin_prior: avg_margin_prior !== null ? Math.round(avg_margin_prior * 100) / 100 : null,
    periods_analyzed: partData.length,
    explanation,
  };
}

/**
 * Generate customer trend summary from data points
 */
export function summarizeCustomerTrend(
  data: CustomerTrendPoint[],
  customer_id: string
): CustomerTrendSummary {
  const customerData = data
    .filter(d => d.customer_id === customer_id)
    .sort((a, b) => {
      if (a.period_year !== b.period_year) return b.period_year - a.period_year;
      return b.period_number - a.period_number;
    });

  const customer_name = customerData[0]?.customer_name || 'Onbekend';

  if (customerData.length < TREND_THRESHOLDS.minimum_periods) {
    return {
      customer_id,
      customer_name,
      volume_trend: 'INSUFFICIENT_DATA',
      margin_trend: 'INSUFFICIENT_DATA',
      alignment_trend: 'INSUFFICIENT_DATA',
      avg_margin_recent: null,
      avg_margin_prior: null,
      avg_alignment_recent: null,
      avg_alignment_prior: null,
      periods_analyzed: customerData.length,
      explanation: 'Onvoldoende data voor trendanalyse.',
    };
  }

  // Split into recent and prior periods
  const recentData = customerData.slice(0, TREND_THRESHOLDS.recent_periods);
  const priorData = customerData.slice(
    TREND_THRESHOLDS.recent_periods,
    TREND_THRESHOLDS.recent_periods + TREND_THRESHOLDS.prior_periods
  );

  // Calculate averages
  const avg_margin_recent = calculateAverage(recentData.map(d => d.margin_pct));
  const avg_margin_prior = calculateAverage(priorData.map(d => d.margin_pct));
  const avg_alignment_recent = calculateAverage(recentData.map(d => d.alignment_score));
  const avg_alignment_prior = calculateAverage(priorData.map(d => d.alignment_score));
  const avg_volume_recent = calculateAverage(recentData.map(d => d.total_kg));
  const avg_volume_prior = calculateAverage(priorData.map(d => d.total_kg));

  // Determine trends
  const volume_trend = calculateTrendDirection(avg_volume_recent, avg_volume_prior);
  const margin_trend = calculateTrendDirection(avg_margin_recent, avg_margin_prior);
  const alignment_trend = calculateTrendDirection(avg_alignment_recent, avg_alignment_prior);

  // Generate explanation
  const explanation = generateCustomerTrendExplanation(
    customer_name,
    volume_trend,
    margin_trend,
    alignment_trend
  );

  return {
    customer_id,
    customer_name,
    volume_trend,
    margin_trend,
    alignment_trend,
    avg_margin_recent: avg_margin_recent !== null ? Math.round(avg_margin_recent * 100) / 100 : null,
    avg_margin_prior: avg_margin_prior !== null ? Math.round(avg_margin_prior * 100) / 100 : null,
    avg_alignment_recent: avg_alignment_recent !== null ? Math.round(avg_alignment_recent * 10) / 10 : null,
    avg_alignment_prior: avg_alignment_prior !== null ? Math.round(avg_alignment_prior * 10) / 10 : null,
    periods_analyzed: customerData.length,
    explanation,
  };
}

/**
 * Summarize all part trends
 */
export function summarizeAllPartTrends(data: PartTrendPoint[]): PartTrendSummary[] {
  const partCodes = [...new Set(data.map(d => d.part_code))];
  return partCodes.map(pc => summarizePartTrend(data, pc));
}

/**
 * Summarize all customer trends
 */
export function summarizeAllCustomerTrends(data: CustomerTrendPoint[]): CustomerTrendSummary[] {
  const customerIds = [...new Set(data.map(d => d.customer_id))];
  return customerIds.map(id => summarizeCustomerTrend(data, id));
}

// ============================================================================
// EXPLANATION GENERATION (Dutch per contract)
// ============================================================================

/**
 * Get Dutch part name
 */
function getPartNameDutch(part_code: AnatomicalPart): string {
  const names: Record<AnatomicalPart, string> = {
    breast_cap: 'Filet',
    leg_quarter: 'Poot',
    wings: 'Vleugels',
    back_carcass: 'Rug/karkas',
    offal: 'Organen',
  };
  return names[part_code] || part_code;
}

/**
 * Get Dutch trend label
 */
export function getTrendLabel(trend: TrendDirection): string {
  switch (trend) {
    case 'UP':
      return 'stijgend';
    case 'DOWN':
      return 'dalend';
    case 'STABLE':
      return 'stabiel';
    case 'INSUFFICIENT_DATA':
    default:
      return 'onvoldoende data';
  }
}

/**
 * Generate Dutch explanation for part trend
 * DESCRIPTIVE only - no advice
 */
export function generatePartTrendExplanation(
  part_code: AnatomicalPart,
  yield_trend: TrendDirection,
  margin_trend: TrendDirection,
  volume_trend: TrendDirection
): string {
  const partName = getPartNameDutch(part_code);
  const parts: string[] = [];

  if (yield_trend !== 'INSUFFICIENT_DATA') {
    parts.push(`Rendement ${getTrendLabel(yield_trend)}`);
  }
  if (margin_trend !== 'INSUFFICIENT_DATA') {
    parts.push(`marge ${getTrendLabel(margin_trend)}`);
  }
  if (volume_trend !== 'INSUFFICIENT_DATA') {
    parts.push(`volume ${getTrendLabel(volume_trend)}`);
  }

  if (parts.length === 0) {
    return `${partName}: onvoldoende data voor trendanalyse.`;
  }

  return `${partName}: ${parts.join(', ')}.`;
}

/**
 * Generate Dutch explanation for customer trend
 * DESCRIPTIVE only - no advice
 */
export function generateCustomerTrendExplanation(
  customer_name: string,
  volume_trend: TrendDirection,
  margin_trend: TrendDirection,
  alignment_trend: TrendDirection
): string {
  const parts: string[] = [];

  if (volume_trend !== 'INSUFFICIENT_DATA') {
    parts.push(`volume ${getTrendLabel(volume_trend)}`);
  }
  if (margin_trend !== 'INSUFFICIENT_DATA') {
    parts.push(`marge ${getTrendLabel(margin_trend)}`);
  }
  if (alignment_trend !== 'INSUFFICIENT_DATA') {
    parts.push(`karkasbalans ${getTrendLabel(alignment_trend)}`);
  }

  if (parts.length === 0) {
    return `${customer_name}: onvoldoende data voor trendanalyse.`;
  }

  return `${customer_name}: ${parts.join(', ')}.`;
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get color class for trend direction
 */
export function getTrendColorClass(trend: TrendDirection): string {
  switch (trend) {
    case 'UP':
      return 'text-green-600 bg-green-50';
    case 'DOWN':
      return 'text-red-600 bg-red-50';
    case 'STABLE':
      return 'text-gray-600 bg-gray-50';
    case 'INSUFFICIENT_DATA':
    default:
      return 'text-gray-400 bg-gray-50';
  }
}

/**
 * Get arrow for trend direction
 */
export function getTrendArrow(trend: TrendDirection): string {
  switch (trend) {
    case 'UP':
      return '↗';
    case 'DOWN':
      return '↘';
    case 'STABLE':
      return '→';
    case 'INSUFFICIENT_DATA':
    default:
      return '-';
  }
}

/**
 * Format period label
 */
export function formatPeriodLabel(
  period_type: PeriodType,
  period_number: number,
  period_year: number
): string {
  switch (period_type) {
    case 'week':
      return `W${period_number} ${period_year}`;
    case 'month':
      const months = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
      return `${months[period_number - 1]} ${period_year}`;
    case 'quarter':
      return `Q${period_number} ${period_year}`;
    default:
      return `${period_number}/${period_year}`;
  }
}

/**
 * Format change with sign
 */
export function formatChange(value: number | null): string {
  if (value === null) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}
