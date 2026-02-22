'use client';

/**
 * OrderList — Table of customer orders with status badges and line summaries
 *
 * Wave 10 D3: Shows product line summary under each order.
 * Wave 9: Uses OrderStatusBadge + OIL design tokens
 */

import { useState, useTransition } from 'react';
import type { CustomerOrder } from '@/types/database';
import { OrderStatusBadge } from '@/components/oil/ui/OrderStatusBadge';
import type { OrderStatus } from '@/lib/ui/orderStatusConfig';
import { deleteOrder } from '@/lib/actions/orders';

interface OrderWithCustomer extends CustomerOrder {
  customer_name: string;
  line_summary: string;
  chicken_equivalent: number;
}

interface OrderListProps {
  orders: OrderWithCustomer[];
  onSelectOrder: (orderId: string) => void;
  selectedOrderId: string | null;
  /** Order IDs that trigger Putten co-production (zadel opensnijden) */
  coProductOrderIds?: Set<string>;
  onOrderDeleted: () => void;
}

export default function OrderList({
  orders,
  onSelectOrder,
  selectedOrderId,
  coProductOrderIds,
  onOrderDeleted,
}: OrderListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(orderId: string) {
    setConfirmDeleteId(null);
    startTransition(async () => {
      try {
        await deleteOrder(orderId);
        onOrderDeleted();
      } catch (err) {
        console.error('Delete order failed:', err);
      }
    });
  }

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
              Kip eq.
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Aangemaakt
            </th>
            <th className="px-4 py-3 w-10" />
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
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-white flex items-center gap-1.5">
                  {order.customer_name}
                  {coProductOrderIds?.has(order.id) && (
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: 'var(--color-data-gold)' }}
                      title="Deze order triggert co-productie (Putten snij)"
                    />
                  )}
                </div>
                {order.line_summary && (
                  <div
                    className="text-[11px] mt-0.5 truncate max-w-xs"
                    style={{ color: 'var(--color-text-dim)' }}
                    title={order.line_summary}
                  >
                    {order.line_summary}
                  </div>
                )}
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
              <td className="px-4 py-3 text-sm text-right font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                {order.chicken_equivalent > 0
                  ? order.chicken_equivalent.toLocaleString('nl-NL')
                  : '\u2013'}
              </td>
              <td className="px-4 py-3 text-sm text-right" style={{ color: 'var(--color-text-muted)' }}>
                {new Date(order.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(order.id);
                  }}
                  disabled={isPending}
                  className="text-xs px-1.5 py-0.5 rounded transition-colors opacity-40 hover:opacity-100 disabled:opacity-20"
                  style={{ color: 'var(--color-data-red)' }}
                  title="Order verwijderen"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Delete confirmation */}
      {confirmDeleteId && (() => {
        const order = orders.find((o) => o.id === confirmDeleteId);
        if (!order) return null;
        return (
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(225, 29, 72, 0.08)', borderTop: '1px solid rgba(225, 29, 72, 0.2)' }}>
            <span className="text-sm" style={{ color: 'var(--color-data-red)' }}>
              Order van {order.customer_name} verwijderen? ({order.total_kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg, {order.total_lines} regels)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-2 py-1 text-xs rounded transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isPending}
                className="px-2 py-1 text-xs text-white rounded disabled:opacity-50"
                style={{ background: 'var(--color-data-red)' }}
              >
                {isPending ? 'Bezig...' : 'Verwijderen'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
