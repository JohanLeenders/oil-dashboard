/**
 * SendStatusBadge — Wave 10 Outreach
 * Delivery status derived from latest outreach_delivery_events row.
 */

import { DataBadge } from '@/components/oil/ui/DataBadge';
import type { OutreachEventType } from '@/types/outreach';

export type DeliveryStatus = OutreachEventType | 'pending';

const STATUS_CONFIG: Record<
  DeliveryStatus,
  { label: string; variant: 'green' | 'orange' | 'red' | 'gold' | 'muted'; icon: string }
> = {
  pending:    { label: 'In wachtrij', variant: 'muted',  icon: '○' },
  queued:     { label: 'Klaar',       variant: 'gold',   icon: '◷' },
  processing: { label: 'Verwerking',  variant: 'orange', icon: '◌' },
  sent:       { label: 'Verzonden',   variant: 'green',  icon: '✓' },
  failed:     { label: 'Mislukt',     variant: 'red',    icon: '✗' },
  bounced:    { label: 'Gebounced',   variant: 'red',    icon: '⚠' },
};

export function SendStatusBadge({ status }: { status: DeliveryStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return <DataBadge label={config.label} variant={config.variant} icon={config.icon} />;
}
