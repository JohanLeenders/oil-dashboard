/**
 * Compute surplus/deficit per product: availability minus ordered
 *
 * REGRESSIE-CHECK:
 * - Pure function, no side effects
 * - No database access
 */

import type {
  OrderSchemaAvailability,
  OrderSchemaSurplusDeficit,
} from '@/types/database';

/**
 * For each product in availability or orders, compute delta_kg = available_kg - ordered_kg.
 * Wave 2 stub: if availability is empty, available_kg = 0 so delta_kg = -ordered_kg.
 */
export function computeSurplusDeficit(
  availability: OrderSchemaAvailability[],
  aggregatedOrders: Map<string, number> // product_id -> total_kg ordered
): OrderSchemaSurplusDeficit[] {
  const productIds = new Set<string>();

  // Collect all product IDs from availability
  const availabilityByProduct = new Map<string, number>();
  for (const a of availability) {
    availabilityByProduct.set(
      a.product_id,
      (availabilityByProduct.get(a.product_id) ?? 0) + a.expected_kg
    );
    productIds.add(a.product_id);
  }

  // Collect all product IDs from orders
  for (const productId of aggregatedOrders.keys()) {
    productIds.add(productId);
  }

  const result: OrderSchemaSurplusDeficit[] = [];

  for (const productId of productIds) {
    const available_kg = availabilityByProduct.get(productId) ?? 0;
    const ordered_kg = aggregatedOrders.get(productId) ?? 0;
    result.push({
      product_id: productId,
      available_kg,
      ordered_kg,
      delta_kg: available_kg - ordered_kg,
    });
  }

  return result;
}
