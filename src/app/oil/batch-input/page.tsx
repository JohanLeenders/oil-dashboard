/**
 * Batch Input List — Overview of all batch input entries
 *
 * Shows both in-memory batch inputs and links to detail.
 * NO modifications to existing /oil/batches pages.
 */

import Link from 'next/link';
import { getAllBatches } from '@/lib/data/batch-input-store';
import { computeDerivedValues } from '@/lib/data/batch-input-store';

export default function BatchInputListPage() {
  const batches = getAllBatches();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Batch Input (v1)</h2>
          <p className="text-gray-600 mt-1">
            Handmatige invoer van batchgewichten. Rendementen worden automatisch berekend.
          </p>
        </div>
        <Link
          href="/oil/batch-input/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nieuwe batch
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kippen</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Levend (kg)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Griller (kg)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Yield %</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Massabalans</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actie</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  Geen batches ingevoerd. Klik &quot;+ Nieuwe batch&quot; om te beginnen.
                </td>
              </tr>
            ) : (
              batches.map((batch) => {
                const derived = computeDerivedValues(batch);
                const statusEmoji = derived.mass_balance_status === 'green' ? '\uD83D\uDFE2'
                  : derived.mass_balance_status === 'yellow' ? '\uD83D\uDFE1' : '\u26D4';

                return (
                  <tr key={batch.batch_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/oil/batch-input/${batch.batch_id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {batch.batch_ref}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{batch.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {batch.bird_count.toLocaleString('nl-NL')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {batch.live_weight_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {batch.griller_weight_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                      {derived.griller_yield_pct.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span title={`${derived.mass_balance_deviation_pct.toFixed(2)}% afwijking`}>
                        {statusEmoji} {derived.mass_balance_deviation_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/oil/batch-input/${batch.batch_id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="font-medium text-blue-800">Batch Input v1 — Route 1 (Handmatige invoer)</p>
        <p className="text-blue-600 mt-1">
          Voer gewichten in (kg/stuks). Rendementen en massabalans worden automatisch berekend.
          Bij &quot;Opslaan &amp; herbereken&quot; wordt de volledige kostprijswaterval doorgerekend.
        </p>
      </div>
    </div>
  );
}
