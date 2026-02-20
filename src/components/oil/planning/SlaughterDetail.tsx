/**
 * SlaughterDetail — Detail weergave van een slachtdag
 * Sprint: Wave 2 — A1-S1 Planning UI
 *
 * REGRESSIE-CHECK:
 * - ✅ Read-only display component
 * - ✅ Geen mutations of forms
 * - ✅ Server Component (no 'use client')
 */

import type { SlaughterCalendar, SlaughterStatus } from '@/types/database';

interface SlaughterDetailProps {
  slaughter: SlaughterCalendar;
}

const statusConfig: Record<SlaughterStatus, { label: string; className: string }> = {
  planned: {
    label: 'Gepland',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  orders_open: {
    label: 'Orders open',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  finalized: {
    label: 'Afgerond',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  slaughtered: {
    label: 'Geslacht',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  },
  completed: {
    label: 'Voltooid',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SlaughterDetail({ slaughter }: SlaughterDetailProps) {
  const status = statusConfig[slaughter.status];
  const hasMesterBreakdown = slaughter.mester_breakdown && slaughter.mester_breakdown.length > 0;

  return (
    <div className="space-y-6">
      {/* Detail Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Slachtdatum</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(slaughter.slaughter_date)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Week / Jaar</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Wk {slaughter.week_number} / {slaughter.year}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${status.className}`}>
                {status.label}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Verwachte dieren</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {slaughter.expected_birds.toLocaleString('nl-NL')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Verwacht levend gewicht</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {slaughter.expected_live_weight_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Slachtlocatie</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {slaughter.slaughter_location ?? '-'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Order deadline</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {slaughter.order_deadline ? formatShortDate(slaughter.order_deadline) : '-'}
            </dd>
          </div>
          {slaughter.notes && (
            <div className="md:col-span-2 lg:col-span-3">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Opmerkingen</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {slaughter.notes}
              </dd>
            </div>
          )}
        </div>
      </div>

      {/* Mester Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Mester verdeling
          </h3>
        </div>
        {hasMesterBreakdown ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Mester
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dieren
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Gem. gewicht (kg)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {slaughter.mester_breakdown.map((entry) => (
                <tr key={entry.mester} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {entry.mester}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                    {entry.birds.toLocaleString('nl-NL')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                    {entry.avg_weight_kg.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Geen mester verdeling beschikbaar.
          </div>
        )}
      </div>
    </div>
  );
}
