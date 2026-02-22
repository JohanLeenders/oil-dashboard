/**
 * Customers / Cherry-Picker Analysis Page
 *
 * REGRESSIE-CHECK:
 * - Read-only display
 * - Cherry-picker detectie via engine (28% filet threshold)
 * - Balance score via engine
 * - Geen mutations
 * - Geen aannames over thresholds (in engine)
 *
 * Sprint 1: Added links to customer detail pages
 */

import Link from 'next/link';
import { getCustomersWithAnalysis, getCustomerStats } from '@/lib/actions/customers';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default async function CustomersPage() {
  const [customers, stats] = await Promise.all([
    getCustomersWithAnalysis(),
    getCustomerStats(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-brand tracking-tight" style={{ color: 'var(--color-text-main)' }}>Cherry-Picker Analyse</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Identificeer klanten met ongebalanceerde afname (filet &gt;28%)
          </p>
        </div>
        <Link
          href="/oil/customers/import"
          className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          style={{ background: 'var(--color-oil-orange)' }}
        >
          <span>📥</span>
          Import Klantprofiel
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Actieve Klanten"
          value={stats.total_customers.toString()}
        />
        <StatCard
          label="Cherry Pickers"
          value={stats.cherry_pickers.toString()}
          highlight={stats.cherry_pickers > 0}
        />
        <StatCard
          label="Gem. Balance Score"
          value={`${stats.avg_balance_score}/100`}
          highlight={stats.avg_balance_score < 70}
        />
        <StatCard
          label="Opportunity Cost"
          value={`€${stats.total_opportunity_cost.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`}
          highlight={stats.total_opportunity_cost > 1000}
        />
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: 'var(--color-data-red)' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>Cherry Picker (filet &gt;28%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: 'var(--color-data-gold)' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>Score &lt;70</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: 'var(--color-data-green)' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>Gebalanceerd</span>
        </div>
      </div>

      {/* Customer Table */}
      <div className="oil-card overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Klant
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Omzet YTD
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Balance Score
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Filet %
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Opportunity Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Aanbeveling
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  Geen klanten gevonden. Run migraties en seed data.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <CustomerRow key={customer.id} customer={customer} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="oil-card p-4 text-sm" style={{ borderLeft: '3px solid var(--color-oil-orange)' }}>
        <p className="font-medium" style={{ color: 'var(--color-text-main)' }}>Detectie Logica</p>
        <ul className="mt-2 space-y-1" style={{ color: 'var(--color-text-muted)' }}>
          <li>• Cherry Picker: Klant neemt &gt;28% filet af (anatomisch 23.5% beschikbaar)</li>
          <li>• Minimum omzet voor analyse: €10.000 YTD</li>
          <li>• Balance Score: 100 = perfect gebalanceerd, 0 = extreme cherry picker</li>
          <li>• Opportunity Cost: Geschatte impact op vierkantsverwaarding</li>
        </ul>
      </div>
    </div>
  );
}

function CustomerRow({
  customer,
}: {
  customer: Awaited<ReturnType<typeof getCustomersWithAnalysis>>[0];
}) {
  const { analysis } = customer;

  const filetBreakdown = analysis.category_breakdown.find(c => c.category === 'filet');
  const filetPct = filetBreakdown?.percentage_of_total || 0;

  const scoreColor = analysis.balance_score >= 80
    ? 'var(--color-data-green)'
    : analysis.balance_score >= 50
      ? 'var(--color-data-gold)'
      : 'var(--color-data-red)';

  const scoreBg = analysis.balance_score >= 80
    ? 'rgba(34, 197, 94, 0.12)'
    : analysis.balance_score >= 50
      ? 'rgba(234, 179, 8, 0.12)'
      : 'rgba(225, 29, 72, 0.12)';

  const filetColor = filetPct > 28 ? 'var(--color-data-red)' : filetPct > 23.5 ? 'var(--color-data-gold)' : 'var(--color-text-main)';

  return (
    <tr
      className={`transition-colors ${analysis.is_cherry_picker ? '' : 'hover:bg-[var(--color-bg-elevated)]'}`}
      style={{
        borderBottom: '1px solid var(--color-border-subtle)',
        background: analysis.is_cherry_picker ? 'rgba(225, 29, 72, 0.04)' : undefined,
      }}
    >
      <td className="px-6 py-4">
        <Link href={`/oil/customers/${customer.id}`} className="block group">
          <p className="text-sm font-medium transition-colors group-hover:opacity-80" style={{ color: 'var(--color-text-main)' }}>
            {customer.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{customer.customer_code}</p>
        </Link>
      </td>
      <td className="px-6 py-4 text-sm text-right tabular-nums" style={{ color: 'var(--color-text-main)' }}>
        €{customer.total_revenue_ytd.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
      </td>
      <td className="px-6 py-4 text-center">
        <span className="inline-flex items-center justify-center w-12 h-8 rounded-full text-sm font-bold" style={{ background: scoreBg, color: scoreColor }}>
          {analysis.balance_score}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        {analysis.is_cherry_picker ? (
          <StatusBadge status="red" label="Cherry Picker" size="sm" />
        ) : analysis.balance_score < 70 ? (
          <StatusBadge status="orange" label="Aandacht" size="sm" />
        ) : (
          <StatusBadge status="green" label="OK" size="sm" />
        )}
      </td>
      <td className="px-6 py-4 text-sm text-right font-medium tabular-nums" style={{ color: filetColor }}>
        {filetPct.toFixed(1)}%
        {filetPct > 28 && <span className="text-xs ml-1" style={{ color: 'var(--color-data-red)', opacity: 0.7 }}>(max 28%)</span>}
      </td>
      <td className="px-6 py-4 text-sm text-right tabular-nums" style={{ color: analysis.opportunity_cost > 0 ? 'var(--color-oil-orange)' : 'var(--color-text-dim)' }}>
        {analysis.opportunity_cost > 0
          ? `€${analysis.opportunity_cost.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`
          : '-'}
      </td>
      <td className="px-6 py-4 text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
        <p className="truncate" title={analysis.recommendation}>
          {analysis.recommendation}
        </p>
      </td>
    </tr>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="oil-card p-4" style={{ borderColor: highlight ? 'var(--color-oil-orange)' : undefined }}>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: highlight ? 'var(--color-oil-orange)' : 'var(--color-text-main)' }}>
        {value}
      </p>
    </div>
  );
}
