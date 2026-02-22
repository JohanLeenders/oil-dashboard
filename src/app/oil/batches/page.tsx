/**
 * Batches List Page
 *
 * REGRESSIE-CHECK:
 * - ✅ Read-only display
 * - ✅ THT via engine (70/90 Blueprint)
 * - ✅ Data status via v_batch_mass_balance
 * - ✅ Geen mutations of forms
 */

import Link from 'next/link';
import { getBatchList } from '@/lib/actions/batches';
import { ThtBadge, DataStatusBadge } from '@/components/ui/StatusBadge';

export default async function BatchesPage() {
  const batches = await getBatchList();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-brand tracking-tight" style={{ color: 'var(--color-text-main)' }}>Batches</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Overzicht slachtbatches met THT status en data kwaliteit
          </p>
        </div>
        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {batches.length} batches
        </div>
      </div>

      {/* Filters/Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: 'var(--color-data-green)' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>THT OK (&lt;70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: 'var(--color-oil-orange)' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>THT Aandacht (70-90%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: 'var(--color-data-red)' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>THT Urgent (&gt;90%)</span>
        </div>
      </div>

      {/* Batches Table */}
      <div className="oil-card overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Batch
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Slachtdatum
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Levend (kg)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Griller (kg)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Yield %
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                THT
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Data Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Actie
              </th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  Geen batches gevonden. Run migraties en seed data.
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <BatchRow key={batch.id} batch={batch} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="oil-card p-4 text-sm" style={{ borderLeft: '3px solid var(--color-oil-orange)' }}>
        <p className="font-medium" style={{ color: 'var(--color-text-main)' }}>Data Leesmodus</p>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Deze pagina toont data uit v_batch_mass_balance (effective yields).
          THT berekening gebruikt Blueprint thresholds (70/90).
        </p>
      </div>
    </div>
  );
}

function BatchRow({ batch }: { batch: Awaited<ReturnType<typeof getBatchList>>[0] }) {
  const yieldColor = batch.griller_yield_pct
    ? batch.griller_yield_pct >= 70 ? 'var(--color-data-green)' :
      batch.griller_yield_pct >= 68 ? 'var(--color-oil-orange)' : 'var(--color-data-red)'
    : 'var(--color-text-dim)';

  return (
    <tr
      className="transition-colors hover:bg-[var(--color-bg-elevated)]"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <Link
          href={`/oil/batches/${batch.id}`}
          className="text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--color-text-main)' }}
        >
          {batch.batch_ref}
        </Link>
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{batch.status}</p>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {formatDate(batch.slaughter_date)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right tabular-nums" style={{ color: 'var(--color-text-main)' }}>
        {batch.live_weight_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right tabular-nums" style={{ color: 'var(--color-text-main)' }}>
        {batch.griller_weight_kg
          ? batch.griller_weight_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
          : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium tabular-nums" style={{ color: yieldColor }}>
        {batch.griller_yield_pct
          ? `${batch.griller_yield_pct.toFixed(1)}%`
          : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <ThtBadge
          status={batch.tht_status}
          daysRemaining={batch.tht_days_remaining}
          size="sm"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <DataStatusBadge status={batch.data_status} size="sm" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <Link
          href={`/oil/batches/${batch.id}`}
          className="text-sm transition-colors"
          style={{ color: 'var(--color-oil-orange)' }}
        >
          Details →
        </Link>
      </td>
    </tr>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
