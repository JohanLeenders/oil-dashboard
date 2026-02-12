/**
 * Customer Profitability Engine
 *
 * Kernlogica uit DOMAIN_MODEL.md:
 * - Margin calculation using SVASO allocation (market value, NOT weight)
 * - Customer profitability vs. cherry-picker behavior
 * - Balance score tracking over time
 *
 * Sprint 1 Requirements:
 * 1. Customer margin calculation (SVASO-based)
 * 2. Customer product mix vs. ideal mix
 * 3. Balance score trend over time
 * 4. Cherry-picker warning integration
 */

import type { ProductCategory, AnatomicalPart } from '@/types/database';
import {
  ANATOMICAL_NORMS,
  MINIMUM_REVENUE_THRESHOLD,
  analyzeCherryPicker as runCherryPickerAnalysis,
  type CherryPickerAnalysis,
  type CustomerProductMix,
} from './cherry-picker';
import Decimal from 'decimal.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for a single sales line with allocated cost
 */
export interface CustomerSalesLine {
  /** Product category */
  category: ProductCategory;
  /** Quantity sold in kg */
  quantity_kg: number;
  /** Revenue from this line */
  revenue: number;
  /** SVASO allocated cost (from batch SVASO calculation) */
  allocated_cost: number;
  /** Invoice date for time series */
  invoice_date: string;
  /** Batch ID for traceability */
  batch_id?: string;
}

/**
 * Aggregated margin per product category
 */
export interface CategoryMargin {
  category: ProductCategory;
  quantity_kg: number;
  revenue: number;
  allocated_cost: number;
  gross_margin: number;
  margin_pct: number;
  /** Percentage of customer's total volume */
  volume_share_pct: number;
  /** Anatomical ratio for this category */
  anatomical_ratio_pct: number;
  /** Deviation from anatomical ratio (positive = buying more than natural) */
  deviation_pct: number;
}

/**
 * Customer profitability summary
 */
export interface CustomerProfitability {
  customer_id: string;
  customer_name: string;

  // Revenue metrics
  total_revenue: number;
  total_quantity_kg: number;

  // Cost metrics (SVASO-based)
  total_allocated_cost: number;
  avg_cost_per_kg: number;

  // Margin metrics
  total_gross_margin: number;
  margin_pct: number;

  // Category breakdown
  category_margins: CategoryMargin[];

  // Mix analysis
  mix_deviation_score: number; // 0-100, how far from ideal mix
  worst_deviation_category: ProductCategory | null;
  best_margin_category: ProductCategory | null;

  // Time analysis
  margin_trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  recent_margin_pct: number; // Last 30 days
  prior_margin_pct: number;  // 30-60 days ago

  // Risk indicators
  is_profitable: boolean;
  profitability_status: 'healthy' | 'marginal' | 'unprofitable';
  warnings: ProfitabilityWarning[];

  // Metadata
  analysis_period_start: string;
  analysis_period_end: string;
  total_transactions: number;
}

export interface ProfitabilityWarning {
  severity: 'info' | 'warning' | 'critical';
  type: 'low_margin' | 'negative_margin' | 'mix_imbalance' | 'declining_trend' | 'cherry_picker';
  message: string;
  metric_value?: number;
  threshold_value?: number;
}

/**
 * Balance score history point
 */
export interface BalanceScorePoint {
  date: string;
  balance_score: number;
  is_cherry_picker: boolean;
  filet_share_pct: number;
  margin_pct: number;
}

/**
 * Customer profitability combined with cherry-picker analysis
 */
export interface CustomerProfitabilityComplete {
  profitability: CustomerProfitability;
  cherry_picker_analysis: CherryPickerAnalysis;
  combined_health_score: number; // 0-100, considering both margin and mix
  priority_rank: 'high' | 'medium' | 'low'; // Action priority
  action_recommendation: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Margin thresholds for profitability status */
export const MARGIN_THRESHOLDS = {
  /** Below this = unprofitable */
  UNPROFITABLE_PCT: 0,
  /** Below this = marginal */
  MARGINAL_PCT: 10,
  /** Above this = healthy */
  HEALTHY_PCT: 20,
} as const;

/** Minimum data points for trend analysis */
export const MIN_DATA_POINTS_FOR_TREND = 3;

/** Days to consider for "recent" vs "prior" analysis */
export const RECENT_DAYS = 30;
export const PRIOR_DAYS_START = 31;
export const PRIOR_DAYS_END = 60;

// ============================================================================
// CORE ENGINE
// ============================================================================

/**
 * Calculate customer profitability from sales lines with SVASO costs
 *
 * @param customerId - Customer identifier
 * @param customerName - Customer display name
 * @param salesLines - Array of sales lines with allocated costs
 * @param options - Calculation options
 * @returns Complete profitability analysis
 *
 * @example
 * ```ts
 * const profitability = calculateCustomerProfitability(
 *   'cust-001',
 *   'Restaurant De Gouden Kip',
 *   [
 *     { category: 'filet', quantity_kg: 50, revenue: 475, allocated_cost: 350, invoice_date: '2026-01-15' },
 *     { category: 'dij', quantity_kg: 30, revenue: 217.50, allocated_cost: 180, invoice_date: '2026-01-15' },
 *   ]
 * );
 * ```
 */
export function calculateCustomerProfitability(
  customerId: string,
  customerName: string,
  salesLines: CustomerSalesLine[],
  options: {
    /** Reference date for trend analysis (default: today) */
    referenceDate?: Date;
    /** Custom anatomical norms */
    customNorms?: typeof ANATOMICAL_NORMS;
  } = {}
): CustomerProfitability {
  const {
    referenceDate = new Date(),
    customNorms = ANATOMICAL_NORMS,
  } = options;

  const warnings: ProfitabilityWarning[] = [];

  // Handle empty input
  if (!salesLines || salesLines.length === 0) {
    return createEmptyProfitability(customerId, customerName);
  }

  // Aggregate by category
  const categoryMap = new Map<ProductCategory, {
    quantity_kg: number;
    revenue: number;
    allocated_cost: number;
  }>();

  let totalRevenue = new Decimal(0);
  let totalCost = new Decimal(0);
  let totalKg = new Decimal(0);

  for (const line of salesLines) {
    const existing = categoryMap.get(line.category);
    if (existing) {
      existing.quantity_kg += line.quantity_kg;
      existing.revenue += line.revenue;
      existing.allocated_cost += line.allocated_cost;
    } else {
      categoryMap.set(line.category, {
        quantity_kg: line.quantity_kg,
        revenue: line.revenue,
        allocated_cost: line.allocated_cost,
      });
    }

    totalRevenue = totalRevenue.add(line.revenue);
    totalCost = totalCost.add(line.allocated_cost);
    totalKg = totalKg.add(line.quantity_kg);
  }

  // Calculate total margin
  const totalGrossMargin = totalRevenue.sub(totalCost);
  const marginPct = totalRevenue.isZero()
    ? new Decimal(0)
    : totalGrossMargin.div(totalRevenue).mul(100);

  // Build category margins with mix analysis
  const categoryMargins: CategoryMargin[] = [];
  let worstDeviation = 0;
  let worstDeviationCategory: ProductCategory | null = null;
  let bestMargin = -Infinity;
  let bestMarginCategory: ProductCategory | null = null;

  for (const [category, data] of categoryMap.entries()) {
    const revenue = new Decimal(data.revenue);
    const cost = new Decimal(data.allocated_cost);
    const grossMargin = revenue.sub(cost);
    const catMarginPct = revenue.isZero()
      ? new Decimal(0)
      : grossMargin.div(revenue).mul(100);

    // Calculate volume share
    const volumeSharePct = totalKg.isZero()
      ? 0
      : new Decimal(data.quantity_kg).div(totalKg).mul(100).toNumber();

    // Get anatomical ratio for this category
    const norm = customNorms.find(n => n.category === category);
    const anatomicalRatio = norm?.ratio_pct || 0;
    const deviation = volumeSharePct - anatomicalRatio;

    const catMargin: CategoryMargin = {
      category,
      quantity_kg: data.quantity_kg,
      revenue: data.revenue,
      allocated_cost: data.allocated_cost,
      gross_margin: grossMargin.toDecimalPlaces(2).toNumber(),
      margin_pct: catMarginPct.toDecimalPlaces(2).toNumber(),
      volume_share_pct: Number(volumeSharePct.toFixed(2)),
      anatomical_ratio_pct: anatomicalRatio,
      deviation_pct: Number(deviation.toFixed(2)),
    };

    categoryMargins.push(catMargin);

    // Track worst deviation (absolute)
    if (Math.abs(deviation) > Math.abs(worstDeviation)) {
      worstDeviation = deviation;
      worstDeviationCategory = category;
    }

    // Track best margin category
    if (catMarginPct.toNumber() > bestMargin && data.quantity_kg > 0) {
      bestMargin = catMarginPct.toNumber();
      bestMarginCategory = category;
    }
  }

  // Sort by volume share descending
  categoryMargins.sort((a, b) => b.volume_share_pct - a.volume_share_pct);

  // Calculate mix deviation score (0-100, lower = more deviation)
  const totalDeviation = categoryMargins.reduce(
    (sum, cm) => sum + Math.abs(cm.deviation_pct),
    0
  );
  const mixDeviationScore = Math.max(0, Math.min(100, 100 - totalDeviation));

  // Calculate trend
  const { trend, recentMarginPct, priorMarginPct } = calculateMarginTrend(
    salesLines,
    referenceDate
  );

  // Determine profitability status
  const marginPctNum = marginPct.toNumber();
  const grossMarginNum = totalGrossMargin.toNumber();
  let profitabilityStatus: 'healthy' | 'marginal' | 'unprofitable';
  // Check both percentage and absolute margin - if either is negative, it's unprofitable
  if (marginPctNum < MARGIN_THRESHOLDS.UNPROFITABLE_PCT || grossMarginNum < 0) {
    profitabilityStatus = 'unprofitable';
  } else if (marginPctNum < MARGIN_THRESHOLDS.MARGINAL_PCT) {
    profitabilityStatus = 'marginal';
  } else {
    profitabilityStatus = 'healthy';
  }

  // Generate warnings
  if (profitabilityStatus === 'unprofitable') {
    warnings.push({
      severity: 'critical',
      type: 'negative_margin',
      message: `Klant is verliesgevend met ${marginPctNum.toFixed(1)}% marge`,
      metric_value: marginPctNum,
      threshold_value: MARGIN_THRESHOLDS.UNPROFITABLE_PCT,
    });
  } else if (profitabilityStatus === 'marginal') {
    warnings.push({
      severity: 'warning',
      type: 'low_margin',
      message: `Lage marge: ${marginPctNum.toFixed(1)}% (onder ${MARGIN_THRESHOLDS.MARGINAL_PCT}%)`,
      metric_value: marginPctNum,
      threshold_value: MARGIN_THRESHOLDS.MARGINAL_PCT,
    });
  }

  if (trend === 'declining') {
    warnings.push({
      severity: 'warning',
      type: 'declining_trend',
      message: `Dalende marge trend: ${recentMarginPct.toFixed(1)}% vs ${priorMarginPct.toFixed(1)}% vorige periode`,
      metric_value: recentMarginPct,
      threshold_value: priorMarginPct,
    });
  }

  if (mixDeviationScore < 50) {
    warnings.push({
      severity: 'info',
      type: 'mix_imbalance',
      message: `Ongebalanceerde productmix (score: ${mixDeviationScore}/100)`,
      metric_value: mixDeviationScore,
      threshold_value: 50,
    });
  }

  // Find date range
  const dates = salesLines.map(l => l.invoice_date).sort();

  return {
    customer_id: customerId,
    customer_name: customerName,
    total_revenue: totalRevenue.toDecimalPlaces(2).toNumber(),
    total_quantity_kg: totalKg.toDecimalPlaces(2).toNumber(),
    total_allocated_cost: totalCost.toDecimalPlaces(2).toNumber(),
    avg_cost_per_kg: totalKg.isZero()
      ? 0
      : totalCost.div(totalKg).toDecimalPlaces(2).toNumber(),
    total_gross_margin: totalGrossMargin.toDecimalPlaces(2).toNumber(),
    margin_pct: marginPct.toDecimalPlaces(2).toNumber(),
    category_margins: categoryMargins,
    mix_deviation_score: Math.round(mixDeviationScore),
    worst_deviation_category: worstDeviationCategory,
    best_margin_category: bestMarginCategory,
    margin_trend: trend,
    recent_margin_pct: Number(recentMarginPct.toFixed(2)),
    prior_margin_pct: Number(priorMarginPct.toFixed(2)),
    is_profitable: marginPctNum >= MARGIN_THRESHOLDS.UNPROFITABLE_PCT,
    profitability_status: profitabilityStatus,
    warnings,
    analysis_period_start: dates[0] || new Date().toISOString().split('T')[0],
    analysis_period_end: dates[dates.length - 1] || new Date().toISOString().split('T')[0],
    total_transactions: salesLines.length,
  };
}

/**
 * Calculate margin trend from sales lines
 */
function calculateMarginTrend(
  salesLines: CustomerSalesLine[],
  referenceDate: Date
): {
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  recentMarginPct: number;
  priorMarginPct: number;
} {
  const refDateMs = referenceDate.getTime();
  const recentCutoff = refDateMs - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const priorStart = refDateMs - PRIOR_DAYS_END * 24 * 60 * 60 * 1000;
  const priorEnd = refDateMs - PRIOR_DAYS_START * 24 * 60 * 60 * 1000;

  let recentRevenue = new Decimal(0);
  let recentCost = new Decimal(0);
  let priorRevenue = new Decimal(0);
  let priorCost = new Decimal(0);
  let recentCount = 0;
  let priorCount = 0;

  for (const line of salesLines) {
    const lineDate = new Date(line.invoice_date).getTime();

    if (lineDate >= recentCutoff) {
      recentRevenue = recentRevenue.add(line.revenue);
      recentCost = recentCost.add(line.allocated_cost);
      recentCount++;
    } else if (lineDate >= priorStart && lineDate < priorEnd) {
      priorRevenue = priorRevenue.add(line.revenue);
      priorCost = priorCost.add(line.allocated_cost);
      priorCount++;
    }
  }

  // Need minimum data points
  if (recentCount < MIN_DATA_POINTS_FOR_TREND || priorCount < MIN_DATA_POINTS_FOR_TREND) {
    const recentMargin = recentRevenue.isZero()
      ? 0
      : recentRevenue.sub(recentCost).div(recentRevenue).mul(100).toNumber();
    return {
      trend: 'insufficient_data',
      recentMarginPct: recentMargin,
      priorMarginPct: 0,
    };
  }

  const recentMarginPct = recentRevenue.sub(recentCost).div(recentRevenue).mul(100).toNumber();
  const priorMarginPct = priorRevenue.sub(priorCost).div(priorRevenue).mul(100).toNumber();

  const marginDelta = recentMarginPct - priorMarginPct;

  let trend: 'improving' | 'stable' | 'declining';
  if (marginDelta > 2) {
    trend = 'improving';
  } else if (marginDelta < -2) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return { trend, recentMarginPct, priorMarginPct };
}

/**
 * Create empty profitability result for customers with no data
 */
function createEmptyProfitability(
  customerId: string,
  customerName: string
): CustomerProfitability {
  const today = new Date().toISOString().split('T')[0];
  return {
    customer_id: customerId,
    customer_name: customerName,
    total_revenue: 0,
    total_quantity_kg: 0,
    total_allocated_cost: 0,
    avg_cost_per_kg: 0,
    total_gross_margin: 0,
    margin_pct: 0,
    category_margins: [],
    mix_deviation_score: 100,
    worst_deviation_category: null,
    best_margin_category: null,
    margin_trend: 'insufficient_data',
    recent_margin_pct: 0,
    prior_margin_pct: 0,
    is_profitable: true,
    profitability_status: 'healthy',
    warnings: [],
    analysis_period_start: today,
    analysis_period_end: today,
    total_transactions: 0,
  };
}

// ============================================================================
// COMBINED ANALYSIS
// ============================================================================

/**
 * Combine profitability analysis with cherry-picker detection
 * for a complete customer health assessment
 *
 * @param profitability - Customer profitability analysis
 * @param cherryPicker - Cherry-picker analysis
 * @returns Combined health assessment with action recommendations
 */
export function combineCustomerAnalysis(
  profitability: CustomerProfitability,
  cherryPicker: CherryPickerAnalysis
): CustomerProfitabilityComplete {
  // Calculate combined health score (weighted average)
  // Margin weight: 60%, Balance weight: 40%
  const marginScore = Math.max(0, Math.min(100, profitability.margin_pct * 3)); // Scale 0-33% to 0-100
  const balanceScore = cherryPicker.balance_score;
  const combinedHealthScore = Math.round(marginScore * 0.6 + balanceScore * 0.4);

  // Add cherry-picker warning if applicable
  if (cherryPicker.is_cherry_picker) {
    profitability.warnings.push({
      severity: 'critical',
      type: 'cherry_picker',
      message: cherryPicker.recommendation,
      metric_value: cherryPicker.balance_score,
      threshold_value: 30,
    });
  }

  // Determine priority rank
  let priorityRank: 'high' | 'medium' | 'low';
  if (
    profitability.profitability_status === 'unprofitable' ||
    cherryPicker.is_cherry_picker ||
    combinedHealthScore < 40
  ) {
    priorityRank = 'high';
  } else if (
    profitability.profitability_status === 'marginal' ||
    cherryPicker.balance_score < 60 ||
    combinedHealthScore < 60
  ) {
    priorityRank = 'medium';
  } else {
    priorityRank = 'low';
  }

  // Generate action recommendation
  const actionRecommendation = generateActionRecommendation(
    profitability,
    cherryPicker,
    priorityRank
  );

  return {
    profitability,
    cherry_picker_analysis: cherryPicker,
    combined_health_score: combinedHealthScore,
    priority_rank: priorityRank,
    action_recommendation: actionRecommendation,
  };
}

/**
 * Generate action recommendation based on combined analysis
 */
function generateActionRecommendation(
  profitability: CustomerProfitability,
  cherryPicker: CherryPickerAnalysis,
  priority: 'high' | 'medium' | 'low'
): string {
  const issues: string[] = [];

  if (profitability.profitability_status === 'unprofitable') {
    issues.push('verliesgevend');
  } else if (profitability.profitability_status === 'marginal') {
    issues.push('lage marge');
  }

  if (cherryPicker.is_cherry_picker) {
    issues.push('cherry picker');
  }

  if (profitability.margin_trend === 'declining') {
    issues.push('dalende marge');
  }

  if (profitability.mix_deviation_score < 50) {
    issues.push('scheve productmix');
  }

  if (issues.length === 0) {
    return 'Geen actie nodig. Klant is gezond en winstgevend.';
  }

  const issueList = issues.join(', ');

  if (priority === 'high') {
    return `ACTIE VEREIST: ${issueList}. Plan gesprek voor vierkantsverwaarding en pricing review.`;
  } else if (priority === 'medium') {
    return `MONITOR: ${issueList}. Overweeg package deals of productmix optimalisatie.`;
  } else {
    return `INFO: ${issueList}. Kleine aandachtspunten, verder gezond.`;
  }
}

// ============================================================================
// BALANCE SCORE HISTORY
// ============================================================================

/**
 * Calculate balance score history for trend visualization
 *
 * @param salesLinesByPeriod - Sales lines grouped by period (week/month)
 * @param customerId - Customer ID
 * @param customerName - Customer name
 * @returns Array of balance score points over time
 */
export function calculateBalanceScoreHistory(
  salesLinesByPeriod: Map<string, CustomerSalesLine[]>,
  customerId: string,
  customerName: string
): BalanceScorePoint[] {
  const history: BalanceScorePoint[] = [];

  for (const [periodKey, lines] of salesLinesByPeriod.entries()) {
    // Aggregate to product mix for cherry-picker analysis
    const mixMap = new Map<ProductCategory, { quantity_kg: number; revenue: number }>();

    for (const line of lines) {
      const existing = mixMap.get(line.category);
      if (existing) {
        existing.quantity_kg += line.quantity_kg;
        existing.revenue += line.revenue;
      } else {
        mixMap.set(line.category, {
          quantity_kg: line.quantity_kg,
          revenue: line.revenue,
        });
      }
    }

    const productMix: CustomerProductMix[] = Array.from(mixMap.entries()).map(
      ([category, data]) => ({
        category,
        quantity_kg: data.quantity_kg,
        revenue: data.revenue,
      })
    );

    const analysis = runCherryPickerAnalysis(customerId, customerName, productMix);

    // Calculate margin for this period
    const totalRevenue = lines.reduce((sum, l) => sum + l.revenue, 0);
    const totalCost = lines.reduce((sum, l) => sum + l.allocated_cost, 0);
    const marginPct = totalRevenue > 0
      ? ((totalRevenue - totalCost) / totalRevenue) * 100
      : 0;

    // Get filet share
    const filetData = analysis.category_breakdown.find(c => c.category === 'filet');
    const filetSharePct = filetData?.percentage_of_total || 0;

    history.push({
      date: periodKey,
      balance_score: analysis.balance_score,
      is_cherry_picker: analysis.is_cherry_picker,
      filet_share_pct: filetSharePct,
      margin_pct: Number(marginPct.toFixed(2)),
    });
  }

  // Sort by date
  return history.sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// BATCH ANALYSIS
// ============================================================================

/**
 * Analyze all customers and rank by profitability
 *
 * @param customers - Array of customers with their sales lines
 * @returns Ranked list of customer profitability (worst first)
 */
export function analyzeAllCustomerProfitability(
  customers: Array<{
    id: string;
    name: string;
    salesLines: CustomerSalesLine[];
  }>
): CustomerProfitability[] {
  return customers
    .map(c => calculateCustomerProfitability(c.id, c.name, c.salesLines))
    .sort((a, b) => {
      // Unprofitable first
      if (a.profitability_status === 'unprofitable' && b.profitability_status !== 'unprofitable') return -1;
      if (b.profitability_status === 'unprofitable' && a.profitability_status !== 'unprofitable') return 1;
      // Then by margin ascending (lowest margin = worst)
      return a.margin_pct - b.margin_pct;
    });
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get CSS color class for profitability status
 */
export function getProfitabilityColorClass(status: CustomerProfitability['profitability_status']): string {
  switch (status) {
    case 'healthy':
      return 'text-green-600 bg-green-100';
    case 'marginal':
      return 'text-yellow-600 bg-yellow-100';
    case 'unprofitable':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * Get hex color for profitability status
 */
export function getProfitabilityColor(status: CustomerProfitability['profitability_status']): string {
  switch (status) {
    case 'healthy':
      return '#22c55e'; // green-500
    case 'marginal':
      return '#eab308'; // yellow-500
    case 'unprofitable':
      return '#ef4444'; // red-500
    default:
      return '#6b7280'; // gray-500
  }
}

/**
 * Get CSS color class for margin trend
 */
export function getTrendColorClass(trend: CustomerProfitability['margin_trend']): string {
  switch (trend) {
    case 'improving':
      return 'text-green-600';
    case 'stable':
      return 'text-gray-600';
    case 'declining':
      return 'text-red-600';
    case 'insufficient_data':
      return 'text-gray-400';
    default:
      return 'text-gray-600';
  }
}

/**
 * Get trend arrow icon
 */
export function getTrendArrow(trend: CustomerProfitability['margin_trend']): string {
  switch (trend) {
    case 'improving':
      return '\u2191'; // ↑
    case 'stable':
      return '\u2192'; // →
    case 'declining':
      return '\u2193'; // ↓
    case 'insufficient_data':
      return '-';
    default:
      return '-';
  }
}
