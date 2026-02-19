/**
 * OIL Orders Page — Slaughter dates overview with order counts
 * Sprint: Wave 2 — A2-S1 Orders UI
 *
 * REGRESSIE-CHECK:
 * - Reads slaughter_calendar + customer_orders aggregation
 * - Server Component (no 'use client')
 * - Links to /oil/orders/[slaughterId]
 */

import Link from 'next/link';
import { getSlaughterDatesForOrders } from '@/lib/actions/orders';
import { createClient } from '@/lib/supabase/server';

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    planned: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    orders_open:
      'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    finalized:
      'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    slaughtered:
      'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    completed:
      'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  };
  const labels: Record<string, string> = {
    planned: 'Gepland',
    orders_open: 'Orders open',
    finalized: 'Definitief',
    slaughtered: 'Geslacht',
    completed: 'Afgerond',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        styles[status] || styles.planned
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface OrderAggregation {
  slaughter_id: string;
  order_count: number;
  total_kg: number;
}

export default async function OrdersPage() {
  const slaughterDates = await getSlaughterDatesForOrders();

  // Aggregate order counts per slaughter date
  const supabase = await createClient();
  let aggregations: OrderAggregation[] = [];

  if (slaughterDates.length > 0) {
    const slaughterIds = slaughterDates.map((s) => s.id);
    const { data } = await supabase
      .from('customer_orders')
      .select('slaughter_id, total_kg')
      .in('slaughter_id', slaughterIds);

    if (data) {
      const map = new Map<string, { count: number; kg: number }>();
      for (const row of data) {
        const existing = map.get(row.slaughter_id) || { count: 0, kg: 0 };
        existing.count += 1;
        existing.kg += row.total_kg || 0;
        map.set(row.slaughter_id, existing);
      }
      aggregations = Array.from(map.entries()).map(([slaughter_id, val]) => ({
        slaughter_id,
        order_count: val.count,
        total_kg: val.kg,
      }));
    }
  }

  const aggMap = new Map(aggregations.map((a) => [a.slaughter_id, a]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Orders
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Bestelschema en orderverwerking
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {slaughterDates.length} slachtdatum{slaughterDates.length !== 1 ? 's' : ''}
        </div>
      </div>

      {slaughterDates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-12">
          <div className="text-center">
            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
              Geen slachtdatums beschikbaar
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Er zijn momenteel geen geplande of open slachtdatums. Voeg
              slachtdatums toe via Planning.
            </p>
            <div className="mt-4">
              <Link
                href="/oil/planning"
                className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                Naar Planning
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Datum
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Week
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Totaal (kg)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actie
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {slaughterDates.map((sd) => {
                const agg = aggMap.get(sd.id);
                return (
                  <tr
                    key={sd.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/oil/orders/${sd.id}`}
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600"
                      >
                        {formatDate(sd.slaughter_date)}
                      </Link>
                      {sd.slaughter_location && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {sd.slaughter_location}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                      W{sd.week_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {statusBadge(sd.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                      {agg?.order_count ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                      {(agg?.total_kg ?? 0).toLocaleString('nl-NL', {
                        maximumFractionDigits: 1,
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/oil/orders/${sd.id}`}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                      >
                        Bekijk
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
