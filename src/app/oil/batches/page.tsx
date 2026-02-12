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
          <h2 className="text-2xl font-bold text-gray-900">Batches</h2>
          <p className="text-gray-600 mt-1">
            Overzicht slachtbatches met THT status en data kwaliteit
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {batches.length} batches
        </div>
      </div>

      {/* Filters/Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-600">THT OK (&lt;70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-gray-600">THT Aandacht (70-90%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-600">THT Urgent (&gt;90%)</span>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Batch
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Slachtdatum
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Levend (kg)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Griller (kg)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Yield %
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                THT
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actie
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="font-medium text-blue-800">Data Leesmodus</p>
        <p className="text-blue-600 mt-1">
          Deze pagina toont data uit v_batch_mass_balance (effective yields).
          THT berekening gebruikt Blueprint thresholds (70/90).
        </p>
      </div>
    </div>
  );
}

function BatchRow({ batch }: { batch: Awaited<ReturnType<typeof getBatchList>>[0] }) {
  const yieldColor = batch.griller_yield_pct
    ? batch.griller_yield_pct >= 70 ? 'text-green-600' :
      batch.griller_yield_pct >= 68 ? 'text-orange-600' : 'text-red-600'
    : 'text-gray-400';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <Link
          href={`/oil/batches/${batch.id}`}
          className="text-sm font-medium text-gray-900 hover:text-blue-600"
        >
          {batch.batch_ref}
        </Link>
        <p className="text-xs text-gray-500">{batch.status}</p>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(batch.slaughter_date)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
        {batch.live_weight_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
        {batch.griller_weight_kg
          ? batch.griller_weight_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
          : '-'}
      </td>
      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${yieldColor}`}>
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
          className="text-blue-600 hover:text-blue-800 text-sm"
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
