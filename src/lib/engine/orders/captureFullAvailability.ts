import type { CascadedAvailability } from '@/lib/engine/availability/cascading';

export interface AvailabilitySuggestion {
  product_id: string;
  product_description: string;
  quantity_kg: number;
}

/**
 * Capture all remaining (unsold) availability as order line suggestions.
 *
 * IMPORTANT: remaining_primary = primary_available_kg - sold_primary_kg
 * This is NOT forwarded_kg (which is a cascade calculation).
 *
 * Pure function — no DB access.
 */
export function captureFullAvailability(
  availability: CascadedAvailability
): AvailabilitySuggestion[] {
  const suggestions: AvailabilitySuggestion[] = [];

  // Primary products: remaining = available - sold (not forwarded)
  for (const product of availability.primary_products) {
    const remaining = product.primary_available_kg - product.sold_primary_kg;
    if (remaining > 0) {
      suggestions.push({
        product_id: product.product_id,
        product_description: product.product_description,
        quantity_kg: Math.round(remaining * 100) / 100,
      });
    }
  }

  // Secondary products: net_available_kg
  for (const child of availability.secondary_products) {
    if (child.net_available_kg > 0) {
      suggestions.push({
        product_id: child.product_id,
        product_description: child.product_description,
        quantity_kg: Math.round(child.net_available_kg * 100) / 100,
      });
    }
  }

  return suggestions;
}
