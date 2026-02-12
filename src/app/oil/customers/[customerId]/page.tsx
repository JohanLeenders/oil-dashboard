/**
 * Customer Detail / Profitability Page
 *
 * Sprint 1: Customer Profitability View
 *
 * REGRESSIE-CHECK:
 * - Read-only display
 * - SVASO-based margin calculation via engine
 * - Cherry-picker detection via engine (30% threshold)
 * - Balance score trend visualization
 * - No mutations
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCustomerProfitabilityDetail } from '@/lib/actions/customers';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  getProfitabilityColorClass,
  getTrendArrow,
  getTrendColorClass,
} from '@/lib/engine/customer-profitability';

interface PageProps {
  params: Promise<{ customerId: string }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { customerId } = await params;
  const customer = await getCustomerProfitabilityDetail(customerId);

  if (!customer) {
    notFound();
  }

  const { profitability, cherry_picker_analysis, combined } = customer;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/oil/customers" className="hover:text-gray-700">
          Klanten
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{customer.name}</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
          <p className="text-gray-600 mt-1">
            {customer.customer_code} &bull; {customer.segment || 'Geen segment'}
          </p>
        </div>
        <div className="flex gap-3">
          <PriorityBadge priority={combined.priority_rank} />
          {cherry_picker_analysis.is_cherry_picker && (
            <StatusBadge status="red" label="Cherry Picker" />
          )}
        </div>
      </div>

      {/* Alert Banner (if high priority) */}
      {combined.priority_rank === 'high' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-medium text-red-800">Actie Vereist</p>
          <p className="text-red-600 text-sm mt-1">{combined.action_recommendation}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="Totale Omzet"
          value={`\u20AC${profitability.total_revenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`}
          subtext={`${profitability.total_quantity_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg`}
        />
        <KpiCard
          label="Bruto Marge"
          value={`\u20AC${profitability.total_gross_margin.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`}
          subtext={`${profitability.margin_pct.toFixed(1)}%`}
          highlight={profitability.profitability_status !== 'healthy'}
          status={profitability.profitability_status}
        />
        <KpiCard
          label="Balance Score"
          value={`${cherry_picker_analysis.balance_score}/100`}
          subtext={cherry_picker_analysis.is_cherry_picker ? 'Cherry Picker' : 'Gebalanceerd'}
          highlight={cherry_picker_analysis.is_cherry_picker}
        />
        <KpiCard
          label="Health Score"
          value={`${combined.combined_health_score}/100`}
          subtext={`Prioriteit: ${combined.priority_rank}`}
          highlight={combined.combined_health_score < 50}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Profitability Details */}
        <div className="space-y-6">
          {/* Margin Trend */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Marge Trend</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-500">Huidige Periode (30d)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {profitability.recent_margin_pct.toFixed(1)}%
                </p>
              </div>
              <div className={`text-3xl ${getTrendColorClass(profitability.margin_trend)}`}>
                {getTrendArrow(profitability.margin_trend)}
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm text-gray-500">Vorige Periode</p>
                <p className="text-2xl font-bold text-gray-900">
                  {profitability.prior_margin_pct.toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Trend: <span className={getTrendColorClass(profitability.margin_trend)}>
                {profitability.margin_trend === 'improving' && 'Verbeterend'}
                {profitability.margin_trend === 'stable' && 'Stabiel'}
                {profitability.margin_trend === 'declining' && 'Dalend'}
                {profitability.margin_trend === 'insufficient_data' && 'Onvoldoende data'}
              </span>
            </p>
          </div>

          {/* Category Margins */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Marge per Categorie</h3>
            <div className="space-y-3">
              {profitability.category_margins.length === 0 ? (
                <p className="text-gray-500 text-sm">Geen verkoop data beschikbaar</p>
              ) : (
                profitability.category_margins.map((cm) => (
                  <CategoryMarginRow key={cm.category} margin={cm} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Mix Analysis */}
        <div className="space-y-6">
          {/* Product Mix vs Anatomical */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Productmix vs. Anatomisch</h3>
            <p className="text-sm text-gray-500 mb-4">
              Mix Deviation Score: <span className={
                profitability.mix_deviation_score >= 70 ? 'text-green-600' :
                profitability.mix_deviation_score >= 50 ? 'text-yellow-600' : 'text-red-600'
              }>
                {profitability.mix_deviation_score}/100
              </span>
            </p>
            <div className="space-y-2">
              {cherry_picker_analysis.category_breakdown.length === 0 ? (
                <p className="text-gray-500 text-sm">Geen data beschikbaar</p>
              ) : (
                cherry_picker_analysis.category_breakdown
                  .filter(cb => cb.quantity_kg > 0)
                  .slice(0, 8)
                  .map((cb) => (
                    <MixComparisonRow key={cb.category} breakdown={cb} />
                  ))
              )}
            </div>
          </div>

          {/* Warnings */}
          {profitability.warnings.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Waarschuwingen</h3>
              <div className="space-y-2">
                {profitability.warnings.map((warning, idx) => (
                  <WarningRow key={idx} warning={warning} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Aanbeveling</h3>
            <p className="text-blue-700 text-sm">{combined.action_recommendation}</p>
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recente Transacties</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Factuur
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Categorie
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Kg
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Omzet
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Kostprijs
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Marge
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {customer.recent_sales.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Geen transacties gevonden
                </td>
              </tr>
            ) : (
              customer.recent_sales.map((sale, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {sale.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(sale.invoice_date).toLocaleDateString('nl-NL')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                    {sale.category.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {sale.quantity_kg.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {'\u20AC'}{sale.revenue.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {sale.allocated_cost ? `\u20AC${sale.allocated_cost.toFixed(2)}` : '-'}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    sale.margin !== null && sale.margin >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {sale.margin !== null ? `\u20AC${sale.margin.toFixed(2)}` : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
        <p className="font-medium text-gray-800">Berekeningslogica</p>
        <ul className="mt-2 text-gray-600 space-y-1">
          <li>&bull; Marge berekend met SVASO (Sales Value at Split-off)</li>
          <li>&bull; Cherry Picker: filet afname &gt;30% (anatomisch ~24%)</li>
          <li>&bull; Health Score: 60% marge + 40% balance score</li>
          <li>&bull; Trend: vergelijking laatste 30 vs. 31-60 dagen</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function KpiCard({
  label,
  value,
  subtext,
  highlight = false,
  status,
}: {
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
  status?: 'healthy' | 'marginal' | 'unprofitable';
}) {
  const borderClass = highlight
    ? status === 'unprofitable' ? 'border-red-300' :
      status === 'marginal' ? 'border-yellow-300' : 'border-orange-300'
    : 'border-gray-200';

  const valueClass = status === 'unprofitable' ? 'text-red-600' :
    status === 'marginal' ? 'text-yellow-600' : 'text-gray-900';

  return (
    <div className={`bg-white rounded-lg border p-4 ${borderClass}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? valueClass : 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1">{subtext}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  };

  const labels = {
    high: 'Hoge Prioriteit',
    medium: 'Medium Prioriteit',
    low: 'Lage Prioriteit',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${colors[priority]}`}>
      {labels[priority]}
    </span>
  );
}

function CategoryMarginRow({
  margin,
}: {
  margin: {
    category: string;
    quantity_kg: number;
    revenue: number;
    gross_margin: number;
    margin_pct: number;
    volume_share_pct: number;
  };
}) {
  const marginColor = margin.margin_pct >= 20 ? 'text-green-600' :
    margin.margin_pct >= 10 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 capitalize">
          {margin.category.replace('_', ' ')}
        </p>
        <p className="text-xs text-gray-500">
          {margin.quantity_kg.toFixed(0)} kg ({margin.volume_share_pct.toFixed(1)}%)
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium ${marginColor}`}>
          {margin.margin_pct.toFixed(1)}%
        </p>
        <p className="text-xs text-gray-500">
          {'\u20AC'}{margin.gross_margin.toFixed(0)}
        </p>
      </div>
    </div>
  );
}

function MixComparisonRow({
  breakdown,
}: {
  breakdown: {
    category: string;
    percentage_of_total: number;
    anatomical_ratio: number;
    deviation: number;
    status: 'balanced' | 'over' | 'under';
  };
}) {
  const deviationColor = breakdown.status === 'over' ? 'text-red-600' :
    breakdown.status === 'under' ? 'text-blue-600' : 'text-green-600';

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-24 text-sm text-gray-700 capitalize">
        {breakdown.category.replace('_', ' ')}
      </div>
      <div className="flex-1">
        <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
          {/* Anatomical ratio marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-800 z-10"
            style={{ left: `${Math.min(breakdown.anatomical_ratio, 100)}%` }}
          />
          {/* Actual bar */}
          <div
            className={`absolute top-0 bottom-0 left-0 ${
              breakdown.status === 'over' ? 'bg-red-400' :
              breakdown.status === 'under' ? 'bg-blue-400' : 'bg-green-400'
            }`}
            style={{ width: `${Math.min(breakdown.percentage_of_total, 100)}%` }}
          />
        </div>
      </div>
      <div className="w-16 text-right">
        <span className={`text-sm font-medium ${deviationColor}`}>
          {breakdown.deviation > 0 ? '+' : ''}{breakdown.deviation.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function WarningRow({
  warning,
}: {
  warning: {
    severity: 'info' | 'warning' | 'critical';
    type: string;
    message: string;
  };
}) {
  const colors = {
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
  };

  const icons = {
    info: '\u24D8', // circled i
    warning: '\u26A0', // warning sign
    critical: '\u26A0', // warning sign
  };

  return (
    <div className={`flex items-start gap-2 p-2 rounded border ${colors[warning.severity]}`}>
      <span className="text-lg">{icons[warning.severity]}</span>
      <p className="text-sm">{warning.message}</p>
    </div>
  );
}
