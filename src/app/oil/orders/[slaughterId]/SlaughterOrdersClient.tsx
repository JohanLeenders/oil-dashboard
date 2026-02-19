'use client';

/**
 * SlaughterOrdersClient — Interactive client shell for order management
 *
 * REGRESSIE-CHECK:
 * - Orchestrates OrderList, OrderEntryForm, OrderLineEditor, SnapshotPanel, ExportButton
 * - Refreshes data via router.refresh() after mutations
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerOrder, OrderSchemaSnapshot } from '@/types/database';
import { getOrderLines } from '@/lib/actions/orders';
import type { OrderLine } from '@/types/database';
import OrderList from '@/components/oil/orders/OrderList';
import OrderEntryForm from '@/components/oil/orders/OrderEntryForm';
import OrderLineEditor from '@/components/oil/orders/OrderLineEditor';
import SnapshotPanel from '@/components/oil/orders/SnapshotPanel';
import ExportButton from '@/components/oil/orders/ExportButton';

interface OrderWithCustomer extends CustomerOrder {
  customer_name: string;
}

interface OrderLineWithProduct extends OrderLine {
  product_name: string;
}

interface SlaughterOrdersClientProps {
  slaughterId: string;
  initialOrders: OrderWithCustomer[];
  customers: { id: string; name: string }[];
  products: { id: string; name: string }[];
  initialSnapshots: OrderSchemaSnapshot[];
  slaughterDate?: string;
}

export default function SlaughterOrdersClient({
  slaughterId,
  initialOrders,
  customers,
  products,
  initialSnapshots,
  slaughterDate,
}: SlaughterOrdersClientProps) {
  const router = useRouter();
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderLines, setOrderLines] = useState<OrderLineWithProduct[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  const refreshPage = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleSelectOrder = useCallback(
    async (orderId: string) => {
      if (selectedOrderId === orderId) {
        setSelectedOrderId(null);
        setOrderLines([]);
        return;
      }
      setSelectedOrderId(orderId);
      setLoadingLines(true);
      try {
        const lines = await getOrderLines(orderId);
        setOrderLines(lines);
      } catch {
        setOrderLines([]);
      } finally {
        setLoadingLines(false);
      }
    },
    [selectedOrderId]
  );

  const handleLinesChanged = useCallback(async () => {
    if (selectedOrderId) {
      try {
        const lines = await getOrderLines(selectedOrderId);
        setOrderLines(lines);
      } catch {
        // keep existing lines on error
      }
    }
    refreshPage();
  }, [selectedOrderId, refreshPage]);

  const handleOrderCreated = useCallback(() => {
    setShowNewOrderForm(false);
    refreshPage();
  }, [refreshPage]);

  const selectedOrder = initialOrders.find((o) => o.id === selectedOrderId);

  // Find latest snapshot for export
  const latestSnapshot = initialSnapshots.length > 0 ? initialSnapshots[0] : null;

  return (
    <div className="space-y-6">
      {/* Section 1: Order List */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Klantorders
          </h2>
          {!showNewOrderForm && (
            <button
              type="button"
              onClick={() => setShowNewOrderForm(true)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Nieuwe order
            </button>
          )}
        </div>

        <OrderList
          orders={initialOrders}
          onSelectOrder={handleSelectOrder}
          selectedOrderId={selectedOrderId}
        />
      </section>

      {/* Section 2: New Order Form (conditional) */}
      {showNewOrderForm && (
        <section>
          <OrderEntryForm
            slaughterId={slaughterId}
            customers={customers}
            onOrderCreated={handleOrderCreated}
            onCancel={() => setShowNewOrderForm(false)}
          />
        </section>
      )}

      {/* Section 3: Order Lines (expandable, when an order is selected) */}
      {selectedOrderId && selectedOrder && (
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Orderregels — {selectedOrder.customer_name}
          </h3>

          {loadingLines ? (
            <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400 animate-pulse">
              Laden...
            </div>
          ) : (
            <OrderLineEditor
              orderId={selectedOrderId}
              lines={orderLines}
              products={products}
              onLinesChanged={handleLinesChanged}
            />
          )}
        </section>
      )}

      {/* Section 4: Snapshots */}
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <SnapshotPanel
          slaughterId={slaughterId}
          snapshots={initialSnapshots}
          onSnapshotCreated={refreshPage}
        />
      </section>

      {/* Section 5: Excel Export */}
      {latestSnapshot && (
        <section className="flex justify-end">
          <ExportButton
            schemaData={latestSnapshot.schema_data}
            slaughterDate={slaughterDate ?? latestSnapshot.snapshot_date}
          />
        </section>
      )}
    </div>
  );
}
