/**
 * Build an OrderSchemaData structure from orders and availability.
 *
 * REGRESSIE-CHECK:
 * - Pure function, no side effects
 * - No database access
 * - Wave 2: availability can be empty array (stub)
 */

import type {
  OrderSchemaData,
  OrderSchemaAvailability,
  OrderSchemaCustomerOrder,
} from '@/types/database';
import { computeSurplusDeficit } from './computeSurplusDeficit';

export interface BuildOrderSchemaInput {
  customer_id: string;
  customer_name: string;
  lines: Array<{ product_id: string; quantity_kg: number }>;
}

/**
 * Aggregate order lines per product across all customers and build the
 * full OrderSchemaData structure including surplus/deficit.
 */
export function buildOrderSchema(
  slaughterId: string,
  orders: BuildOrderSchemaInput[],
  availability: OrderSchemaAvailability[]
): OrderSchemaData {
  const snapshotDate = new Date().toISOString().split('T')[0];

  // Build customer order entries
  const schemaOrders: OrderSchemaCustomerOrder[] = orders.map((o) => ({
    customer_id: o.customer_id,
    customer_name: o.customer_name,
    lines: o.lines.map((l) => ({
      product_id: l.product_id,
      quantity_kg: l.quantity_kg,
    })),
  }));

  // Aggregate orders per product
  const aggregatedOrders = new Map<string, number>();
  for (const order of orders) {
    for (const line of order.lines) {
      aggregatedOrders.set(
        line.product_id,
        (aggregatedOrders.get(line.product_id) ?? 0) + line.quantity_kg
      );
    }
  }

  // Compute surplus/deficit
  const surplusDeficit = computeSurplusDeficit(availability, aggregatedOrders);

  return {
    slaughter_id: slaughterId,
    snapshot_date: snapshotDate,
    availability,
    orders: schemaOrders,
    surplus_deficit: surplusDeficit,
  };
}
