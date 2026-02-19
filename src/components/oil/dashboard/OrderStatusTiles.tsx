/**
 * Order Status Tiles — Dashboard overview of order & slaughter status
 * Sprint: Wave 3 — A5-S3 Dashboard tiles
 *
 * REGRESSIE-CHECK:
 * - Server Component (no 'use client')
 * - Read-only via getOrderDashboardStats
 * - No mutations
 */

import Link from 'next/link';
import { getOrderDashboardStats } from '@/lib/actions/dashboard';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default async function OrderStatusTiles() {
  const stats = await getOrderDashboardStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Next slaughter date */}
      <Link
        href={
          stats.next_slaughter_id
            ? `/oil/orders/${stats.next_slaughter_id}`
            : '/oil/planning'
        }
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all"
      >
        <p className="text-xs text-gray-400 uppercase tracking-wider">
          Eerstvolgende slachtdag
        </p>
        <p className="text-2xl font-bold mt-1.5 text-gray-900 dark:text-gray-100">
          {stats.next_slaughter_date
            ? formatDate(stats.next_slaughter_date)
            : 'Geen gepland'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {stats.total_slaughter_dates} actieve datum
          {stats.total_slaughter_dates !== 1 ? 's' : ''}
        </p>
      </Link>

      {/* Draft orders */}
      <Link
        href="/oil/orders"
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all"
      >
        <p className="text-xs text-gray-400 uppercase tracking-wider">
          Orders concept
        </p>
        <p className="text-2xl font-bold mt-1.5 text-gray-900 dark:text-gray-100 tabular-nums">
          {stats.draft_count}
        </p>
        <p className="text-xs text-gray-400 mt-1">Nog niet ingediend</p>
      </Link>

      {/* Submitted orders */}
      <Link
        href="/oil/orders"
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all"
      >
        <p className="text-xs text-gray-400 uppercase tracking-wider">
          Orders ingediend
        </p>
        <p className="text-2xl font-bold mt-1.5 text-gray-900 dark:text-gray-100 tabular-nums">
          {stats.submitted_count}
        </p>
        <p className="text-xs text-gray-400 mt-1">Te verwerken</p>
      </Link>

      {/* Total ordered weight */}
      <Link
        href="/oil/orders"
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all"
      >
        <p className="text-xs text-gray-400 uppercase tracking-wider">
          Besteld gewicht
        </p>
        <p className="text-2xl font-bold mt-1.5 text-gray-900 dark:text-gray-100 tabular-nums">
          {stats.total_ordered_kg.toLocaleString('nl-NL', {
            maximumFractionDigits: 1,
          })}{' '}
          kg
        </p>
        <p className="text-xs text-gray-400 mt-1">Alle orders totaal</p>
      </Link>
    </div>
  );
}
