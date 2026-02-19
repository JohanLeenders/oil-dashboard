/**
 * KostprijsProfileCard — Grouped display of calculations per batch profile.
 *
 * Shows a card with profile header + table of calculations.
 * Links navigate to /oil/kostprijs/[batch_id].
 */

import Link from 'next/link';
import type { BatchInputData } from '@/lib/data/batch-input-store';
import { computeDerivedValues } from '@/lib/data/batch-input-store';

interface Props {
  profile: string;
  label: string;
  description: string;
  colorClass: string;      // e.g. 'blue', 'purple', 'green', 'orange'
  calculations: BatchInputData[];
}

export function KostprijsProfileCard({ label, description, colorClass, calculations }: Props) {
  const headerBg = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  }[colorClass] ?? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';

  const countBadge = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  }[colorClass] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      {/* Profile header */}
      <div className={`px-6 py-4 border-b ${headerBg}`}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{label}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${countBadge}`}>
            {calculations.length} berekening{calculations.length !== 1 ? 'en' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      {calculations.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
          Geen berekeningen voor dit profiel.
        </div>
      ) : (
        <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-2.5 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Referentie</th>
              <th className="px-6 py-2.5 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Datum</th>
              <th className="px-6 py-2.5 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Griller (kg)</th>
              <th className="px-6 py-2.5 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Yield %</th>
              <th className="px-6 py-2.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Massabalans</th>
              <th className="px-6 py-2.5 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {calculations.map((calc) => {
              const derived = computeDerivedValues(calc);
              const statusColor = derived.mass_balance_status === 'green'
                ? 'text-green-600 dark:text-green-400'
                : derived.mass_balance_status === 'yellow'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400';
              const statusDot = derived.mass_balance_status === 'green'
                ? 'bg-green-500'
                : derived.mass_balance_status === 'yellow'
                  ? 'bg-yellow-500'
                  : 'bg-red-500';

              return (
                <tr key={calc.batch_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-3">
                    <Link
                      href={`/oil/kostprijs/${encodeURIComponent(calc.batch_id)}`}
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {calc.batch_ref}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{calc.date}</td>
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100 text-right tabular-nums">
                    {calc.griller_weight_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100 text-right tabular-nums font-medium">
                    {derived.griller_yield_pct.toFixed(1)}%
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${statusColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                      {derived.mass_balance_deviation_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/oil/kostprijs/${encodeURIComponent(calc.batch_id)}`}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Details &rarr;
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
