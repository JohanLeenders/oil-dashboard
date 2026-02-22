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
      <nav className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
        <Link href="/oil/customers" className="transition-colors hover:opacity-80" style={{ color: 'var(--color-text-muted)' }}>
          Klanten
        </Link>
        <span className="mx-2">/</span>
        <span style={{ color: 'var(--color-text-main)' }}>{customer.name}</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-main)' }}>{customer.name}</h2>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
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
        <div className="rounded-lg p-4" style={{ background: 'rgba(225, 29, 72, 0.08)', border: '1px solid rgba(225, 29, 72, 0.2)' }}>
          <p className="font-medium" style={{ color: 'var(--color-data-red)' }}>Actie Vereist</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-data-red)', opacity: 0.8 }}>{combined.action_recommendation}</p>
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
          <div className="oil-card p-4">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-main)' }}>Marge Trend</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Huidige Periode (30d)</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-text-main)' }}>
                  {profitability.recent_margin_pct.toFixed(1)}%
                </p>
              </div>
              <div className={`text-3xl ${getTrendColorClass(profitability.margin_trend)}`}>
                {getTrendArrow(profitability.margin_trend)}
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Vorige Periode</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-text-main)' }}>
                  {profitability.prior_margin_pct.toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
              Trend: <span className={getTrendColorClass(profitability.margin_trend)}>
                {profitability.margin_trend === 'improving' && 'Verbeterend'}
                {profitability.margin_trend === 'stable' && 'Stabiel'}
                {profitability.margin_trend === 'declining' && 'Dalend'}
                {profitability.margin_trend === 'insufficient_data' && 'Onvoldoende data'}
              </span>
            </p>
          </div>

          {/* Category Margins */}
          <div className="oil-card p-4">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-main)' }}>Marge per Categorie</h3>
            <div className="space-y-3">
              {profitability.category_margins.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Geen verkoop data beschikbaar</p>
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
          <div className="oil-card p-4">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-main)' }}>Productmix vs. Anatomisch</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Mix Deviation Score: <span style={{ color: profitability.mix_deviation_score >= 70 ? 'var(--color-data-green)' : profitability.mix_deviation_score >= 50 ? 'var(--color-data-gold)' : 'var(--color-data-red)' }}>
                {profitability.mix_deviation_score}/100
              </span>
            </p>
            <div className="space-y-2">
              {cherry_picker_analysis.category_breakdown.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Geen data beschikbaar</p>
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
            <div className="oil-card p-4">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-main)' }}>Waarschuwingen</h3>
              <div className="space-y-2">
                {profitability.warnings.map((warning, idx) => (
                  <WarningRow key={idx} warning={warning} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="oil-card p-4" style={{ borderLeft: '3px solid var(--color-oil-orange)' }}>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-oil-orange)' }}>Aanbeveling</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{combined.action_recommendation}</p>
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="oil-card overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-main)' }}>Recente Transacties</h3>
        </div>
        <table className="min-w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Factuur
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Datum
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Categorie
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Kg
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Omzet
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Kostprijs
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Marge
              </th>
            </tr>
          </thead>
          <tbody>
            {customer.recent_sales.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  Geen transacties gevonden
                </td>
              </tr>
            ) : (
              customer.recent_sales.map((sale, idx) => (
                <tr key={idx} className="transition-colors hover:bg-[var(--color-bg-elevated)]" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-main)' }}>
                    {sale.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(sale.invoice_date).toLocaleDateString('nl-NL')}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize" style={{ color: 'var(--color-text-main)' }}>
                    {sale.category.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                    {sale.quantity_kg.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                    {'\u20AC'}{sale.revenue.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    {sale.allocated_cost ? `\u20AC${sale.allocated_cost.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium tabular-nums" style={{ color: sale.margin !== null && sale.margin >= 0 ? 'var(--color-data-green)' : 'var(--color-data-red)' }}>
                    {sale.margin !== null ? `\u20AC${sale.margin.toFixed(2)}` : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="oil-card p-4 text-sm" style={{ borderLeft: '3px solid var(--color-oil-orange)' }}>
        <p className="font-medium" style={{ color: 'var(--color-text-main)' }}>Berekeningslogica</p>
        <ul className="mt-2 space-y-1" style={{ color: 'var(--color-text-muted)' }}>
          <li>&bull; Marge berekend met SVASO (Sales Value at Split-off)</li>
          <li>&bull; Cherry Picker: filet afname &gt;28% (anatomisch 23.5%)</li>
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
  const borderColor = highlight
    ? status === 'unprofitable' ? 'var(--color-data-red)' :
      status === 'marginal' ? 'var(--color-data-gold)' : 'var(--color-oil-orange)'
    : 'var(--color-border-subtle)';

  const valueColor = highlight
    ? status === 'unprofitable' ? 'var(--color-data-red)' :
      status === 'marginal' ? 'var(--color-data-gold)' : 'var(--color-text-main)'
    : 'var(--color-text-main)';

  return (
    <div className="oil-card p-4" style={{ borderColor }}>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: valueColor }}>
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>{subtext}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const colorMap = {
    high: { bg: 'rgba(225, 29, 72, 0.12)', text: 'var(--color-data-red)', border: 'rgba(225, 29, 72, 0.25)' },
    medium: { bg: 'rgba(234, 179, 8, 0.12)', text: 'var(--color-data-gold)', border: 'rgba(234, 179, 8, 0.25)' },
    low: { bg: 'rgba(34, 197, 94, 0.12)', text: 'var(--color-data-green)', border: 'rgba(34, 197, 94, 0.25)' },
  };

  const labels = {
    high: 'Hoge Prioriteit',
    medium: 'Medium Prioriteit',
    low: 'Lage Prioriteit',
  };

  const c = colorMap[priority];

  return (
    <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
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
  const marginColor = margin.margin_pct >= 20 ? 'var(--color-data-green)' :
    margin.margin_pct >= 10 ? 'var(--color-data-gold)' : 'var(--color-data-red)';

  return (
    <div className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div className="flex-1">
        <p className="text-sm font-medium capitalize" style={{ color: 'var(--color-text-main)' }}>
          {margin.category.replace('_', ' ')}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {margin.quantity_kg.toFixed(0)} kg ({margin.volume_share_pct.toFixed(1)}%)
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium" style={{ color: marginColor }}>
          {margin.margin_pct.toFixed(1)}%
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
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
  const deviationColor = breakdown.status === 'over' ? 'var(--color-data-red)' :
    breakdown.status === 'under' ? 'var(--color-data-blue, #60a5fa)' : 'var(--color-data-green)';

  const barColor = breakdown.status === 'over' ? 'rgba(225, 29, 72, 0.6)' :
    breakdown.status === 'under' ? 'rgba(96, 165, 250, 0.6)' : 'rgba(34, 197, 94, 0.6)';

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-24 text-sm capitalize" style={{ color: 'var(--color-text-muted)' }}>
        {breakdown.category.replace('_', ' ')}
      </div>
      <div className="flex-1">
        <div className="relative h-4 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {/* Anatomical ratio marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 z-10"
            style={{ left: `${Math.min(breakdown.anatomical_ratio, 100)}%`, background: 'var(--color-text-muted)' }}
          />
          {/* Actual bar */}
          <div
            className="absolute top-0 bottom-0 left-0"
            style={{ width: `${Math.min(breakdown.percentage_of_total, 100)}%`, background: barColor }}
          />
        </div>
      </div>
      <div className="w-16 text-right">
        <span className="text-sm font-medium" style={{ color: deviationColor }}>
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
  const colorMap = {
    info: { bg: 'rgba(96, 165, 250, 0.08)', text: 'var(--color-data-blue, #60a5fa)', border: 'rgba(96, 165, 250, 0.2)' },
    warning: { bg: 'rgba(234, 179, 8, 0.08)', text: 'var(--color-data-gold)', border: 'rgba(234, 179, 8, 0.2)' },
    critical: { bg: 'rgba(225, 29, 72, 0.08)', text: 'var(--color-data-red)', border: 'rgba(225, 29, 72, 0.2)' },
  };

  const icons = {
    info: '\u24D8', // circled i
    warning: '\u26A0', // warning sign
    critical: '\u26A0', // warning sign
  };

  const c = colorMap[warning.severity];

  return (
    <div className="flex items-start gap-2 p-2 rounded" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <span className="text-lg">{icons[warning.severity]}</span>
      <p className="text-sm">{warning.message}</p>
    </div>
  );
}
