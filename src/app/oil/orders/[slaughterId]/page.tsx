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

  // Wave 12: Enrich product labels with location (Putten / Nijkerk)
  // We already have yield data — use it to classify products by location.
  const puttenParentIds = new Set(simulatorYieldConfig.yield_profiles.map(p => p.product_id));
  const puttenCutChildIds = new Set<string>();
  const nijkerkChildIds = new Set<string>();
  for (const chain of simulatorYieldConfig.yield_chains) {
    if (chain.source_location_id && chain.target_location_id
        && chain.source_location_id === chain.target_location_id) {
      puttenCutChildIds.add(chain.child_product_id);
    } else {
      nijkerkChildIds.add(chain.child_product_id);
    }
  }

  const enrichedProducts = products
    .map(p => {
      let loc = '';
      let sortOrder = 2; // default: no location = last
      if (puttenParentIds.has(p.id) || puttenCutChildIds.has(p.id)) {
        loc = 'Putten';
        sortOrder = 0;
      } else if (nijkerkChildIds.has(p.id)) {
        loc = 'Nijkerk';
        sortOrder = 1;
      }
      return {
        ...p,
        name: loc ? `${loc} › ${p.name}` : p.name,
        _sortOrder: sortOrder,
      };
    })
    .sort((a, b) => a._sortOrder - b._sortOrder || a.name.localeCompare(b.name, 'nl'))
    .map(({ _sortOrder, ...rest }) => rest);

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
        products={enrichedProducts}
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
