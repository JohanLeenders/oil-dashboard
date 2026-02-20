/**
 * OrderStatusBadge — Status badge for orders and slaughter days
 */

import { DataBadge } from './DataBadge';
import { ORDER_STATUS_CONFIG, SLAUGHTER_STATUS_CONFIG } from '@/lib/ui/orderStatusConfig';
import type { OrderStatus, SlaughterStatus } from '@/lib/ui/orderStatusConfig';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = ORDER_STATUS_CONFIG[status] ?? ORDER_STATUS_CONFIG.draft;
  return <DataBadge label={config.label} variant={config.color} icon={config.icon} />;
}

export function SlaughterStatusBadge({ status }: { status: SlaughterStatus }) {
  const config = SLAUGHTER_STATUS_CONFIG[status] ?? SLAUGHTER_STATUS_CONFIG.planned;
  return <DataBadge label={config.label} variant={config.color} icon={config.icon} />;
}
