/**
 * OIL Orders Detail Page — Orders for a specific slaughter date
 * Sprint: Wave 2 — A2-S1 Orders UI
 *
 * REGRESSIE-CHECK:
 * - Server Component shell with client interactive sections
 * - Reads slaughter_calendar, customer_orders, customers, products
 * - Writes via client components (OrderEntryForm, OrderLineEditor, SnapshotPanel)
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getSlaughterDetailForOrders,
  getOrdersForSlaughter,
  getCustomersForSelect,
  getProductsForSelect,
  getSnapshotsForSlaughter,
} from '@/lib/actions/orders';
import { getCascadedAvailabilityForSlaughter, getSimulatorYieldConfig } from '@/lib/actions/availability';
import { getDeliveryInfoForCustomers } from '@/lib/actions/delivery-info';
import SlaughterOrdersClient from './SlaughterOrdersClient';

interface PageProps {
  params: Promise<{ slaughterId: string }>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default async function SlaughterOrdersPage({ params }: PageProps) {
  const { slaughterId } = await params;

  const [slaughter, orders, customers, products, snapshots, availability, simulatorYieldConfig] = await Promise.all([
    getSlaughterDetailForOrders(slaughterId),
    getOrdersForSlaughter(slaughterId),
    getCustomersForSelect(),
    getProductsForSelect(),
    getSnapshotsForSlaughter(slaughterId),
    getCascadedAvailabilityForSlaughter(slaughterId),
    getSimulatorYieldConfig(slaughterId),
  ]);

  if (!slaughter) {
    notFound();
  }

  // Derive mester name from breakdown
  const mesterBreakdown = (slaughter.mester_breakdown ?? []) as Array<{ mester: string }>;
  const mester = mesterBreakdown.length > 0 ? mesterBreakdown[0].mester : undefined;

  // Fetch delivery info for customers with orders
  const customerIdsWithOrders = [...new Set(orders.map((o) => o.customer_id))];
  const deliveryInfo = await getDeliveryInfoForCustomers(customerIdsWithOrders);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/oil/orders"
          className="text-sm transition-colors"
          style={{ color: 'var(--color-oil-orange)' }}
        >
          &larr; Terug naar orders
        </Link>
        <h1 className="mt-2 text-2xl font-brand tracking-tight" style={{ color: 'var(--color-text-main)' }}>
          Orders — {formatDate(slaughter.slaughter_date)}
        </h1>
        <p className="mt-1 text-sm font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
          Week {slaughter.week_number} &middot;{' '}
          {slaughter.expected_birds.toLocaleString('nl-NL')} dieren verwacht
          {slaughter.slaughter_location && (
            <> &middot; {slaughter.slaughter_location}</>
          )}
        </p>
      </div>

      {/* Client-side interactive content */}
      <SlaughterOrdersClient
        slaughterId={slaughterId}
        initialOrders={orders}
        customers={customers}
        products={products}
        initialSnapshots={snapshots}
        slaughterDate={slaughter.slaughter_date}
        mester={mester}
        availability={availability}
        simulatorYieldConfig={simulatorYieldConfig}
        deliveryInfo={deliveryInfo}
      />
    </div>
  );
}
