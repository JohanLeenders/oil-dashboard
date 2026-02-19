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

  const [slaughter, orders, customers, products, snapshots] = await Promise.all([
    getSlaughterDetailForOrders(slaughterId),
    getOrdersForSlaughter(slaughterId),
    getCustomersForSelect(),
    getProductsForSelect(),
    getSnapshotsForSlaughter(slaughterId),
  ]);

  if (!slaughter) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/oil/orders"
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          &larr; Terug naar orders
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          Orders — {formatDate(slaughter.slaughter_date)}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
      />
    </div>
  );
}
