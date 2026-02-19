/**
 * Sprint 6: Historical Trends Page
 *
 * Shows historical trends per part and per customer.
 * DESCRIPTIVE ONLY - no forecasting, no predictions.
 *
 * Per Sprint 6 contract:
 * - Tijdlijn per onderdeel
 * - Tijdlijn per klant
 * - Annotaties (bijzondere batches / seizoenen)
 */

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import {
  summarizeAllPartTrends,
  summarizeAllCustomerTrends,
  getTrendArrow,
  getTrendLabel,
  getTrendColorClass,
  formatPeriodLabel,
  formatChange,
  TREND_DISCLAIMER,
  type PartTrendPoint,
  type CustomerTrendPoint,
} from '@/lib/engine/historical-trends';

// Types for database results
interface PartTrendRow {
  part_code: 'breast_cap' | 'leg_quarter' | 'wings' | 'back_carcass' | 'offal';
  period_start: string;
  period_type: 'week' | 'month';
  period_number: number;
  period_year: number;
  avg_yield_pct: number | null;
  yield_stddev: number | null;
  batch_count: number | null;
  produced_kg: number | null;
  total_sold_kg: number | null;
  total_revenue_eur: number | null;
  total_cost_eur: number | null;
  total_margin_eur: number | null;
  avg_margin_pct: number | null;
  transaction_count: number | null;
  avg_inventory_kg: number | null;
  avg_dsi: number | null;
  data_status: 'COMPLETE' | 'PARTIAL' | 'NO_DATA';
}

interface CustomerTrendRow {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  period_start: string;
  period_type: 'week' | 'month';
  period_number: number;
  period_year: number;
  total_kg: number;
  total_revenue_eur: number;
  total_cost_eur: number;
  total_margin_eur: number;
  margin_pct: number | null;
  transaction_count: number;
  alignment_score: number | null;
  avg_abs_deviation: number | null;
  parts_purchased: number | null;
  prev_period_kg: number | null;
  prev_period_margin_pct: number | null;
  prev_period_alignment: number | null;
  volume_change_pct: number | null;
  margin_change_pct: number | null;
  alignment_change: number | null;
  data_status: 'COMPLETE' | 'PARTIAL' | 'NO_DATA';
}

interface BatchHistoryRow {
  id: string;
  batch_ref: string;
  slaughter_date: string;
  season: string;
  griller_yield_pct: number | null;
  total_margin_pct: number | null;
  bird_count: number | null;
  data_completeness: 'COMPLETE' | 'PARTIAL' | 'ESTIMATED';
}

// UI Helpers
function getPartNameDutch(partCode: string): string {
  const names: Record<string, string> = {
    breast_cap: 'Filet',
    leg_quarter: 'Poot',
    wings: 'Vleugels',
    back_carcass: 'Rug/karkas',
    offal: 'Organen',
  };
  return names[partCode] || partCode;
}

function getSeasonLabel(season: string): string {
  const labels: Record<string, string> = {
    Q1: 'Q1 (Jan-Mrt)',
    Q2: 'Q2 (Apr-Jun)',
    Q3: 'Q3 (Jul-Sep)',
    Q4: 'Q4 (Okt-Dec)',
  };
  return labels[season] || season;
}

function formatNumber(value: number | null): string {
  if (value === null) return '-';
  return value.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}

function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return `${value.toFixed(1)}%`;
}

function formatMoney(amount: number | null): string {
  if (amount === null) return '-';
  return amount.toLocaleString('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default async function TrendsPage() {
  const supabase = await createClient();

  // Fetch part trend data (monthly only for cleaner view)
  const { data: partTrendData, error: partTrendError } = await supabase
    .from('v_part_trend_over_time')
    .select('*')
    .eq('period_type', 'month')
    .order('period_year', { ascending: false })
    .order('period_number', { ascending: false });

  // Fetch customer trend data
  const { data: customerTrendData, error: customerTrendError } = await supabase
    .from('v_customer_trend_over_time')
    .select('*')
    .order('customer_name')
    .order('period_year', { ascending: false })
    .order('period_number', { ascending: false });

  // Fetch batch history for annotations
  const { data: batchHistoryData, error: batchHistoryError } = await supabase
    .from('batch_history')
    .select('id, batch_ref, slaughter_date, season, griller_yield_pct, total_margin_pct, bird_count, data_completeness')
    .order('slaughter_date', { ascending: false })
    .limit(20);

  // Convert to engine types and calculate summaries
  const partTrends = (partTrendData as PartTrendRow[] | null) || [];
  const customerTrends = (customerTrendData as CustomerTrendRow[] | null) || [];
  const batchHistory = (batchHistoryData as BatchHistoryRow[] | null) || [];

  // Transform for engine
  const partTrendPoints: PartTrendPoint[] = partTrends.map(row => ({
    part_code: row.part_code,
    period_start: row.period_start,
    period_type: row.period_type,
    period_number: row.period_number,
    period_year: row.period_year,
    avg_yield_pct: row.avg_yield_pct,
    yield_stddev: row.yield_stddev,
    batch_count: row.batch_count,
    produced_kg: row.produced_kg,
    total_sold_kg: row.total_sold_kg,
    total_revenue_eur: row.total_revenue_eur,
    total_margin_eur: row.total_margin_eur,
    avg_margin_pct: row.avg_margin_pct,
    avg_dsi: row.avg_dsi,
    data_status: row.data_status,
  }));

  const customerTrendPoints: CustomerTrendPoint[] = customerTrends.map(row => ({
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    customer_code: row.customer_code,
    period_start: row.period_start,
    period_type: row.period_type,
    period_number: row.period_number,
    period_year: row.period_year,
    total_kg: row.total_kg,
    total_revenue_eur: row.total_revenue_eur,
    total_margin_eur: row.total_margin_eur,
    margin_pct: row.margin_pct,
    alignment_score: row.alignment_score,
    volume_change_pct: row.volume_change_pct,
    margin_change_pct: row.margin_change_pct,
    alignment_change: row.alignment_change,
    data_status: row.data_status,
  }));

  // Calculate summaries
  const partSummaries = summarizeAllPartTrends(partTrendPoints);
  const customerSummaries = summarizeAllCustomerTrends(customerTrendPoints);

  // Group part trends by part for timeline display
  const partTrendsByPart = new Map<string, PartTrendRow[]>();
  for (const row of partTrends) {
    const existing = partTrendsByPart.get(row.part_code) || [];
    existing.push(row);
    partTrendsByPart.set(row.part_code, existing);
  }

  // Group customer trends by customer for timeline display
  const customerTrendsByCustomer = new Map<string, CustomerTrendRow[]>();
  for (const row of customerTrends) {
    const existing = customerTrendsByCustomer.get(row.customer_id) || [];
    existing.push(row);
    customerTrendsByCustomer.set(row.customer_id, existing);
  }

  // Group batches by season for annotations
  const batchesBySeason = new Map<string, BatchHistoryRow[]>();
  for (const batch of batchHistory) {
    const existing = batchesBySeason.get(batch.season) || [];
    existing.push(batch);
    batchesBySeason.set(batch.season, existing);
  }

  // Calculate summary stats
  const totalParts = partSummaries.length;
  const partsWithUpTrend = partSummaries.filter(p => p.margin_trend === 'UP').length;
  const partsWithDownTrend = partSummaries.filter(p => p.margin_trend === 'DOWN').length;
  const totalCustomers = customerSummaries.length;
  const customersWithUpTrend = customerSummaries.filter(c => c.margin_trend === 'UP').length;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500 mb-2">
          <Link href="/oil" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Trends</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Historische Trends & Verwaarding
        </h1>
        <p className="text-gray-600 dark:text-gray-600 mt-2">
          Structurele patronen over tijd in verwaarding, afname en marges.
        </p>
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Let op:</strong> {TREND_DISCLAIMER}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-500 mb-1">Onderdelen geanalyseerd</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalParts}</div>
          <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">Laatste 12 maanden</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-500 mb-1">Marge stijgend</div>
          <div className="text-3xl font-bold text-green-600">{partsWithUpTrend}</div>
          <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">onderdelen</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-500 mb-1">Marge dalend</div>
          <div className="text-3xl font-bold text-red-600">{partsWithDownTrend}</div>
          <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">onderdelen</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-500 mb-1">Klanten geanalyseerd</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalCustomers}</div>
          <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">{customersWithUpTrend} met stijgende marge</div>
        </div>
      </div>

      {/* Error handling */}
      {(partTrendError || customerTrendError || batchHistoryError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="text-red-800">
            Fout bij laden: {partTrendError?.message || customerTrendError?.message || batchHistoryError?.message}
          </p>
        </div>
      )}

      {/* Part Trends Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tijdlijn per Onderdeel</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Historische trends per anatomisch onderdeel (maandelijks)
          </p>
        </div>

        {partSummaries.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-500">
            Geen trenddata beschikbaar. Controleer of er historische data is.
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Part Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {partSummaries.map((summary) => (
                <div key={summary.part_code} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {getPartNameDutch(summary.part_code)}
                  </div>

                  {/* Yield Trend */}
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-500">Rendement</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTrendColorClass(summary.yield_trend)}`}>
                      {getTrendArrow(summary.yield_trend)} {getTrendLabel(summary.yield_trend)}
                    </span>
                  </div>

                  {/* Margin Trend */}
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-500">Marge</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTrendColorClass(summary.margin_trend)}`}>
                      {getTrendArrow(summary.margin_trend)} {getTrendLabel(summary.margin_trend)}
                    </span>
                  </div>

                  {/* Volume Trend */}
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-500">Volume</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTrendColorClass(summary.volume_trend)}`}>
                      {getTrendArrow(summary.volume_trend)} {getTrendLabel(summary.volume_trend)}
                    </span>
                  </div>

                  {/* Averages */}
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Recent marge: {formatPercent(summary.avg_margin_recent)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Vorig: {formatPercent(summary.avg_margin_prior)}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {summary.periods_analyzed} periodes
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Part Timeline Table */}
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Detailweergave per Periode</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Onderdeel</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Periode</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Rendement</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Marge %</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Volume (kg)</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Omzet</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">DSI</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Array.from(partTrendsByPart.entries()).flatMap(([partCode, rows]) =>
                      rows.slice(0, 6).map((row, idx) => (
                        <tr key={`${partCode}-${row.period_start}`} className={idx === 0 ? 'bg-blue-50' : 'hover:bg-gray-50 dark:bg-gray-900'}>
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                            {idx === 0 ? getPartNameDutch(partCode) : ''}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-600">
                            {formatPeriodLabel(row.period_type, row.period_number, row.period_year)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                            {formatPercent(row.avg_yield_pct)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={row.avg_margin_pct !== null && row.avg_margin_pct < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}>
                              {formatPercent(row.avg_margin_pct)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-600">
                            {formatNumber(row.total_sold_kg)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-600">
                            {formatMoney(row.total_revenue_eur)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-600">
                            {row.avg_dsi !== null ? `${row.avg_dsi.toFixed(1)}d` : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                              row.data_status === 'COMPLETE' ? 'bg-green-100 text-green-800' :
                              row.data_status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-600'
                            }`}>
                              {row.data_status === 'COMPLETE' ? 'Volledig' :
                               row.data_status === 'PARTIAL' ? 'Deels' : 'Geen data'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customer Trends Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tijdlijn per Klant</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Historische trends per klant (maandelijks)
          </p>
        </div>

        {customerSummaries.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-500">
            Geen klanttrenddata beschikbaar. Controleer of er verkoopdata is.
          </div>
        ) : (
          <div className="p-6">
            {/* Customer Summary Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Klant</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Volume</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Marge</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Karkasbalans</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Recent Marge</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Vorige Marge</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Periodes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customerSummaries.map((summary) => (
                    <tr key={summary.customer_id} className="hover:bg-gray-50 dark:bg-gray-900">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{summary.customer_name}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTrendColorClass(summary.volume_trend)}`}>
                          {getTrendArrow(summary.volume_trend)} {getTrendLabel(summary.volume_trend)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTrendColorClass(summary.margin_trend)}`}>
                          {getTrendArrow(summary.margin_trend)} {getTrendLabel(summary.margin_trend)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTrendColorClass(summary.alignment_trend)}`}>
                          {getTrendArrow(summary.alignment_trend)} {getTrendLabel(summary.alignment_trend)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                        {formatPercent(summary.avg_margin_recent)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-600">
                        {formatPercent(summary.avg_margin_prior)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-500">
                        {summary.periods_analyzed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Customer Detail Timeline */}
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Detailweergave per Klant</h3>
              <div className="space-y-4">
                {Array.from(customerTrendsByCustomer.entries()).slice(0, 5).map(([customerId, rows]) => {
                  const firstRow = rows[0];
                  if (!firstRow) return null;

                  return (
                    <div key={customerId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{firstRow.customer_name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-500">{firstRow.customer_code}</div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-500">Periode</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500">Volume (kg)</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500">Omzet</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500">Marge</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500">Alignment</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500">Volume wijz.</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-500">Marge wijz.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {rows.slice(0, 6).map((row, idx) => (
                              <tr key={row.period_start} className={idx === 0 ? 'bg-blue-50' : ''}>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-600">
                                  {formatPeriodLabel(row.period_type, row.period_number, row.period_year)}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                                  {formatNumber(row.total_kg)}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-600">
                                  {formatMoney(row.total_revenue_eur)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className={row.margin_pct !== null && row.margin_pct < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}>
                                    {formatPercent(row.margin_pct)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-600">
                                  {row.alignment_score !== null ? row.alignment_score.toFixed(1) : '-'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className={
                                    row.volume_change_pct !== null && row.volume_change_pct > 0 ? 'text-green-600' :
                                    row.volume_change_pct !== null && row.volume_change_pct < 0 ? 'text-red-600' :
                                    'text-gray-500 dark:text-gray-500'
                                  }>
                                    {formatChange(row.volume_change_pct)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className={
                                    row.margin_change_pct !== null && row.margin_change_pct > 0 ? 'text-green-600' :
                                    row.margin_change_pct !== null && row.margin_change_pct < 0 ? 'text-red-600' :
                                    'text-gray-500 dark:text-gray-500'
                                  }>
                                    {formatChange(row.margin_change_pct)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Batch Annotations Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Annotaties</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Bijzondere batches en seizoenspatronen
          </p>
        </div>

        {batchHistory.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-500">
            Geen batch-annotaties beschikbaar. Controleer of batch_history data bevat.
          </div>
        ) : (
          <div className="p-6">
            {/* Season Summary */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Seizoensoverzicht</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from(batchesBySeason.entries()).map(([season, batches]) => {
                  const avgYield = batches.reduce((sum, b) => sum + (b.griller_yield_pct || 0), 0) / batches.length;
                  const avgMargin = batches.reduce((sum, b) => sum + (b.total_margin_pct || 0), 0) / batches.length;

                  return (
                    <div key={season} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">{getSeasonLabel(season)}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-500">{batches.length} batches</div>
                      <div className="mt-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-500">Gem. rendement:</span>
                          <span className="text-gray-900 dark:text-gray-100">{avgYield > 0 ? `${avgYield.toFixed(1)}%` : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-500">Gem. marge:</span>
                          <span className={avgMargin < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}>
                            {avgMargin !== 0 ? `${avgMargin.toFixed(1)}%` : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Batches */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Recente Batches</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Slachtdatum</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Seizoen</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Vogels</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Rendement</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Marge</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Volledigheid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {batchHistory.map((batch) => (
                      <tr key={batch.id} className="hover:bg-gray-50 dark:bg-gray-900">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{batch.batch_ref}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-600">
                          {new Date(batch.slaughter_date).toLocaleDateString('nl-NL')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {batch.season}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-600">
                          {batch.bird_count?.toLocaleString('nl-NL') || '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                          {formatPercent(batch.griller_yield_pct)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={batch.total_margin_pct !== null && batch.total_margin_pct < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}>
                            {formatPercent(batch.total_margin_pct)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                            batch.data_completeness === 'COMPLETE' ? 'bg-green-100 text-green-800' :
                            batch.data_completeness === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {batch.data_completeness === 'COMPLETE' ? 'Volledig' :
                             batch.data_completeness === 'PARTIAL' ? 'Deels' : 'Geschat'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reference Info */}
      <div className="mt-8 text-sm text-gray-500 dark:text-gray-500">
        <h3 className="font-medium text-gray-700 dark:text-gray-600 mb-2">Referentie</h3>
        <ul className="space-y-1">
          <li>• Analyseperiode: Laatste 365 dagen</li>
          <li>• Trend detectie: wijziging &gt; 5% = significante trend</li>
          <li>• Minimale periodes: 3 maanden voor trendberekening</li>
          <li>• Data bronnen: v_part_trend_over_time, v_customer_trend_over_time, batch_history</li>
          <li>• <strong>Let op: Alle trends zijn BESCHRIJVEND, niet voorspellend.</strong></li>
        </ul>
      </div>
    </div>
  );
}
