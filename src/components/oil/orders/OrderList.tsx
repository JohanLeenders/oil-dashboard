'use client';

/**
 * OrderList — Table of customer orders with status badges
 *
 * REGRESSIE-CHECK:
 * - Read-only display component
 * - No mutations, only presentation
 * - Wave 9: Uses OrderStatusBadge + OIL design tokens
 */

import type { CustomerOrder } from '@/types/database';
import { OrderStatusBadge } from '@/components/oil/ui/OrderStatusBadge';
import type { OrderStatus } from '@/lib/ui/orderStatusConfig';

interface OrderWithCustomer extends CustomerOrder {
  customer_name: string;
}

interface OrderListProps {
  orders: OrderWithCustomer[];
  onSelectOrder: (orderId: string) => void;
  selectedOrderId: string | null;
}

export default function OrderList({
  orders,
  onSelectOrder,
  selectedOrderId,
}: OrderListProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Nog geen orders voor deze slachtdatum.
      </div>
    );
  }

  return (
    <div className="oil-card overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Klant
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Regels
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Totaal (kg)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Aangemaakt
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              className="cursor-pointer transition-colors"
              style={{
                borderBottom: '1px solid var(--color-border-subtle)',
                background: selectedOrderId === order.id ? 'rgba(246, 126, 32, 0.08)' : undefined,
              }}
              onMouseEnter={(e) => {
                if (selectedOrderId !== order.id) e.currentTarget.style.background = 'var(--color-bg-elevated)';
              }}
              onMouseLeave={(e) => {
                if (selectedOrderId !== order.id) e.currentTarget.style.background = '';
              }}
            >
              <td className="px-4 py-3 text-sm font-medium text-white">
                {order.customer_name}
              </td>
              <td className="px-4 py-3 text-center">
                <OrderStatusBadge status={order.status as OrderStatus} />
              </td>
              <td className="px-4 py-3 text-sm text-right font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                {order.total_lines}
              </td>
              <td className="px-4 py-3 text-sm text-right font-mono tabular-nums font-medium text-white">
                {order.total_kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}
              </td>
              <td className="px-4 py-3 text-sm text-right" style={{ color: 'var(--color-text-muted)' }}>
                {new Date(order.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
