'use client';

/**
 * OrderList — Table of customer orders with status badges
 *
 * REGRESSIE-CHECK:
 * - Read-only display component
 * - No mutations, only presentation
 */

import type { CustomerOrder } from '@/types/database';

interface OrderWithCustomer extends CustomerOrder {
  customer_name: string;
}

interface OrderListProps {
  orders: OrderWithCustomer[];
  onSelectOrder: (orderId: string) => void;
  selectedOrderId: string | null;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    confirmed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };
  const labels: Record<string, string> = {
    draft: 'Concept',
    submitted: 'Ingediend',
    confirmed: 'Bevestigd',
    cancelled: 'Geannuleerd',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        styles[status] || styles.draft
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

export default function OrderList({
  orders,
  onSelectOrder,
  selectedOrderId,
}: OrderListProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
        Nog geen orders voor deze slachtdatum.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Klant
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Regels
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Totaal (kg)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Aangemaakt
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {orders.map((order) => (
            <tr
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              className={`cursor-pointer transition-colors ${
                selectedOrderId === order.id
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                {order.customer_name}
              </td>
              <td className="px-4 py-3 text-center">
                {statusBadge(order.status)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-right">
                {order.total_lines}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                {order.total_kg.toLocaleString('nl-NL', {
                  maximumFractionDigits: 1,
                })}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-right">
                {new Date(order.created_at).toLocaleDateString('nl-NL', {
                  day: '2-digit',
                  month: 'short',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
