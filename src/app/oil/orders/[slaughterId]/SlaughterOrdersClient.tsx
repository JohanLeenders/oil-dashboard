'use client';

/**
 * SlaughterOrdersClient — Interactive client shell for order management
 *
 * REGRESSIE-CHECK:
 * - Orchestrates OrderList, OrderEntryForm, OrderLineEditor, SnapshotPanel, ExportButton
 * - Wave 7: AvailabilityPanel, FullAvailabilityButton, AutoDistributeModal
 * - Wave 8: PlanningSimulator, DeliveryInfoEditor, Storteboom Export
 * - Split-view layout: orders left, availability/simulator right (responsive: stack on mobile)
 * - Refreshes data via router.refresh() after mutations
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerOrder, OrderSchemaSnapshot, CustomerDeliveryInfo } from '@/types/database';
import { getOrderLines } from '@/lib/actions/orders';
import type { OrderLine } from '@/types/database';
import type { CascadedAvailability } from '@/lib/engine/availability/cascading';
import type { SimulatorYieldConfig } from '@/lib/actions/availability';
import OrderList from '@/components/oil/orders/OrderList';
import OrderEntryForm from '@/components/oil/orders/OrderEntryForm';
import OrderLineEditor from '@/components/oil/orders/OrderLineEditor';
import SnapshotPanel from '@/components/oil/orders/SnapshotPanel';
import ExportButton from '@/components/oil/orders/ExportButton';
import AvailabilityPanel from '@/components/oil/orders/AvailabilityPanel';
import FullAvailabilityButton from '@/components/oil/orders/FullAvailabilityButton';
import PlanningSimulator from '@/components/oil/orders/PlanningSimulator';
import DeliveryInfoEditor from '@/components/oil/orders/DeliveryInfoEditor';

interface OrderWithCustomer extends CustomerOrder {
  customer_name: string;
}

interface OrderLineWithProduct extends OrderLine {
  product_name: string;
}

type RightPanelTab = 'availability' | 'simulator';

interface SlaughterOrdersClientProps {
  slaughterId: string;
  initialOrders: OrderWithCustomer[];
  customers: { id: string; name: string }[];
  products: { id: string; name: string }[];
  initialSnapshots: OrderSchemaSnapshot[];
  slaughterDate?: string;
  mester?: string;
  availability: CascadedAvailability;
  simulatorYieldConfig: SimulatorYieldConfig;
  deliveryInfo: (CustomerDeliveryInfo & { customer_name: string })[];
}

export default function SlaughterOrdersClient({
  slaughterId,
  initialOrders,
  customers,
  products,
  initialSnapshots,
  slaughterDate,
  mester,
  availability,
  simulatorYieldConfig,
  deliveryInfo,
}: SlaughterOrdersClientProps) {
  const router = useRouter();
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderLines, setOrderLines] = useState<OrderLineWithProduct[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('availability');

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

  // Customer IDs and names for delivery info editor
  const customerIdsWithOrders = [...new Set(initialOrders.map((o) => o.customer_id))];
  const customerNameMap: Record<string, string> = {};
  for (const o of initialOrders) {
    customerNameMap[o.customer_id] = o.customer_name;
  }

  return (
    <div className="space-y-6">
      {/* Split-view: Orders left, Availability/Simulator right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Orders (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-6">
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Orderregels — {selectedOrder.customer_name}
                </h3>
                <FullAvailabilityButton
                  orderId={selectedOrderId}
                  availability={availability}
                  onDone={handleLinesChanged}
                />
              </div>

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
        </div>

        {/* Right: Tabbed panel (1/3 width on desktop) */}
        <div className="lg:col-span-1">
          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 sticky top-4">
            {/* Tab bar */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setActiveTab('availability')}
                className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'availability'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Beschikbaarheid
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('simulator')}
                className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'simulator'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Simulator
              </button>
            </div>

            {/* Tab content */}
            <div className="p-4">
              {activeTab === 'availability' && (
                <AvailabilityPanel availability={availability} />
              )}
              {activeTab === 'simulator' && (
                <PlanningSimulator
                  slaughterId={slaughterId}
                  yieldConfig={simulatorYieldConfig}
                />
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Section 4: Delivery Info (collapsible) */}
      {customerIdsWithOrders.length > 0 && (
        <DeliveryInfoEditor
          customerIds={customerIdsWithOrders}
          customerNames={customerNameMap}
          initialData={deliveryInfo}
        />
      )}

      {/* Section 5: Snapshots */}
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <SnapshotPanel
          slaughterId={slaughterId}
          snapshots={initialSnapshots}
          onSnapshotCreated={refreshPage}
        />
      </section>

      {/* Section 6: Excel Export */}
      <section className="flex justify-end">
        <ExportButton
          slaughterId={slaughterId}
          slaughterDate={slaughterDate ?? ''}
          mester={mester}
        />
      </section>
    </div>
  );
}
