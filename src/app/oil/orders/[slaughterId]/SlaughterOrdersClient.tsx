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

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerOrder, OrderSchemaSnapshot, CustomerDeliveryInfo } from '@/types/database';
import { getOrderLines } from '@/lib/actions/orders';
import type { OrderLine } from '@/types/database';
import type { CascadedAvailability } from '@/lib/engine/availability/cascading';
import type { SimulatorYieldConfig, AvailabilityWithWholeChicken } from '@/lib/actions/availability';
import OrderList from '@/components/oil/orders/OrderList';
import OrderEntryForm from '@/components/oil/orders/OrderEntryForm';
import OrderLineEditor from '@/components/oil/orders/OrderLineEditor';
import SnapshotPanel from '@/components/oil/orders/SnapshotPanel';
import ExportButton from '@/components/oil/orders/ExportButton';
import AvailabilityPanel from '@/components/oil/orders/AvailabilityPanel';
import FullAvailabilityButton from '@/components/oil/orders/FullAvailabilityButton';
import PlanningSimulator from '@/components/oil/orders/PlanningSimulator';
import DeliveryInfoEditor from '@/components/oil/orders/DeliveryInfoEditor';
import IntelligencePanel from '@/components/oil/orders/IntelligencePanel';
import CoProductInsight from '@/components/oil/orders/CoProductInsight';

interface OrderWithCustomer extends CustomerOrder {
  customer_name: string;
  line_summary: string;
  chicken_equivalent: number;
  line_categories: string[];
}

interface OrderLineWithProduct extends OrderLine {
  product_name: string;
}

type RightPanelTab = 'availability' | 'simulator';

interface SlaughterOrdersClientProps {
  slaughterId: string;
  initialOrders: OrderWithCustomer[];
  customers: { id: string; name: string }[];
  products: { id: string; name: string; category: string | null }[];
  initialSnapshots: OrderSchemaSnapshot[];
  slaughterDate?: string;
  mester?: string;
  availability: AvailabilityWithWholeChicken;
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

  // Editable avg bird weight (client-side override, does NOT modify DB)
  const defaultAvgWeight = simulatorYieldConfig.expected_birds > 0
    ? simulatorYieldConfig.expected_live_weight_kg / simulatorYieldConfig.expected_birds
    : 2.5;
  const [avgBirdWeightKg, setAvgBirdWeightKg] = useState(defaultAvgWeight);

  // Wave 12: Identify orders that trigger Putten co-production (zadel opensnijden).
  // An order triggers co-production when any of its line categories matches
  // a Putten-cut child category (computed server-side in availability).
  const coProductOrderIds = useMemo(() => {
    const triggerCats = new Set(availability.putten_cut_trigger_categories);
    if (triggerCats.size === 0) return new Set<string>();
    return new Set(
      initialOrders
        .filter((o) => o.line_categories.some((cat) => triggerCats.has(cat)))
        .map((o) => o.id)
    );
  }, [initialOrders, availability.putten_cut_trigger_categories]);

  const selectedOrderHasCoProduct = selectedOrderId != null && coProductOrderIds.has(selectedOrderId);

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
      {/* Editable avg bird weight bar */}
      <div className="oil-card p-3 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-text-dim)' }}>Gem. levend gewicht:</span>
          <input
            type="number"
            step="0.01"
            min="0.5"
            max="5.0"
            value={avgBirdWeightKg.toFixed(2)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) setAvgBirdWeightKg(v);
            }}
            className="w-20 rounded px-2 py-1 text-sm font-mono tabular-nums text-right focus:ring-1 focus:ring-orange-500"
            style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-main)' }}
          />
          <span style={{ color: 'var(--color-text-dim)' }}>kg/dier</span>
        </div>
        <div style={{ color: 'var(--color-text-dim)' }}>
          Griller: <span className="font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            {(simulatorYieldConfig.expected_birds * avgBirdWeightKg * 0.704).toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg
          </span>
          <span className="ml-1">(70,4% yield)</span>
        </div>
      </div>

      {/* Intelligence Panel — slaughter day overview with cascade flow */}
      <IntelligencePanel availability={availability} orders={initialOrders} />

      {/* Split-view: Orders left, Availability/Simulator right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Orders (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Order List */}
          <section data-section="order-list">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-main)' }}>
                Klantorders
              </h2>
              {!showNewOrderForm && (
                <button
                  type="button"
                  onClick={() => setShowNewOrderForm(true)}
                  className="px-3 py-1.5 text-sm font-medium text-white rounded-md transition-colors"
                  style={{ background: 'var(--color-oil-orange)' }}
                >
                  Nieuwe order
                </button>
              )}
            </div>

            <OrderList
              orders={initialOrders}
              onSelectOrder={handleSelectOrder}
              selectedOrderId={selectedOrderId}
              coProductOrderIds={coProductOrderIds}
              onOrderDeleted={() => {
                setSelectedOrderId(null);
                setOrderLines([]);
                refreshPage();
              }}
            />
          </section>

          {/* Section 2: New Order Form (conditional) */}
          {showNewOrderForm && (
            <section>
              <OrderEntryForm
                slaughterId={slaughterId}
                customers={customers}
                products={products}
                onOrderCreated={handleOrderCreated}
                onCancel={() => setShowNewOrderForm(false)}
                avgBirdWeightKg={avgBirdWeightKg}
                yieldProfiles={simulatorYieldConfig.yield_profiles}
                yieldChains={simulatorYieldConfig.yield_chains}
              />
            </section>
          )}

          {/* Section 3: Order Lines (expandable, when an order is selected) */}
          {selectedOrderId && selectedOrder && (
            <section className="oil-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                  Orderregels — {selectedOrder.customer_name}
                </h3>
                <FullAvailabilityButton
                  orderId={selectedOrderId}
                  availability={availability}
                  onDone={handleLinesChanged}
                />
              </div>

              {loadingLines ? (
                <div className="py-4 text-center text-sm animate-pulse" style={{ color: 'var(--color-text-muted)' }}>
                  Laden...
                </div>
              ) : (
                <OrderLineEditor
                  orderId={selectedOrderId}
                  lines={orderLines}
                  products={products}
                  onLinesChanged={handleLinesChanged}
                  avgBirdWeightKg={avgBirdWeightKg}
                  yieldProfiles={simulatorYieldConfig.yield_profiles}
                  yieldChains={simulatorYieldConfig.yield_chains}
                />
              )}

              {/* Co-product inzicht — direct onder de orderregels van déze klant */}
              {selectedOrderHasCoProduct && (
                <CoProductInsight availability={availability} />
              )}
            </section>
          )}
        </div>

        {/* Right: Tabbed panel (1/3 width on desktop) */}
        <div className="lg:col-span-1">
          <section className="oil-card sticky top-4" style={{ overflow: 'hidden' }}>
            {/* Tab bar */}
            <div className="flex" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('availability')}
                className="flex-1 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: activeTab === 'availability' ? 'var(--color-oil-orange)' : 'var(--color-text-muted)',
                  borderBottom: activeTab === 'availability' ? '2px solid var(--color-oil-orange)' : '2px solid transparent',
                  background: activeTab === 'availability' ? 'rgba(246, 126, 32, 0.05)' : undefined,
                }}
              >
                Beschikbaarheid
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('simulator')}
                className="flex-1 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: activeTab === 'simulator' ? 'var(--color-oil-orange)' : 'var(--color-text-muted)',
                  borderBottom: activeTab === 'simulator' ? '2px solid var(--color-oil-orange)' : '2px solid transparent',
                  background: activeTab === 'simulator' ? 'rgba(246, 126, 32, 0.05)' : undefined,
                }}
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
                  avgBirdWeightKg={avgBirdWeightKg}
                />
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Section 4: Delivery Info (collapsible) */}
      {customerIdsWithOrders.length > 0 && (
        <div data-section="delivery-info">
          <DeliveryInfoEditor
            customerIds={customerIdsWithOrders}
            customerNames={customerNameMap}
            initialData={deliveryInfo}
            slaughterDate={slaughterDate}
          />
        </div>
      )}

      {/* Section 5: Snapshots */}
      <section className="oil-card p-4">
        <SnapshotPanel
          slaughterId={slaughterId}
          snapshots={initialSnapshots}
          onSnapshotCreated={refreshPage}
        />
      </section>

      {/* Section 6: Excel Export — Launch Sequence (UX-4) */}
      <section className="flex justify-end">
        <ExportButton
          slaughterId={slaughterId}
          slaughterDate={slaughterDate ?? ''}
          mester={mester}
          orderStatuses={initialOrders.map((o) => o.status)}
          deliveryInfoComplete={
            customerIdsWithOrders.length > 0
              ? customerIdsWithOrders.every((cid) =>
                  deliveryInfo.some((d) => d.customer_id === cid && d.delivery_address)
                )
              : true
          }
        />
      </section>
    </div>
  );
}
