/**
 * Cascaded Availability Engine
 *
 * Pure function — no database access, no async, no side effects.
 *
 * Computes a two-tier availability model:
 *   1. Primary products are derived from griller weight via location yield profiles.
 *   2. Unsold primary kg are "forwarded" and cascaded into secondary (child) products
 *      via product yield chains.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderLine {
  product_id: string;
  quantity_kg: number;
}

export interface LocationYieldProfile {
  product_id: string;
  product_description: string;
  yield_percentage: number; // 0.0 - 1.0
}

export interface ProductYieldChain {
  parent_product_id: string;
  child_product_id: string;
  child_product_description: string;
  yield_pct: number; // 0.0 - 1.0
}

export interface CascadedProduct {
  product_id: string;
  product_description: string;
  primary_available_kg: number;
  sold_primary_kg: number;
  oversubscribed_kg: number;
  forwarded_kg: number;
  cascaded_children: CascadedChild[];
  processing_loss_kg: number;
}

export interface CascadedChild {
  product_id: string;
  product_description: string;
  available_kg: number;
  sold_kg: number;
  net_available_kg: number;
}

export interface CascadedAvailability {
  griller_kg: number;
  primary_products: CascadedProduct[];
  secondary_products: CascadedChild[];
  total_sold_primary_kg: number;
  total_forwarded_kg: number;
  total_cascaded_kg: number;
  total_loss_kg: number;
  mass_balance_check: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sum order quantities for a given product id. */
function sumOrdersForProduct(orders: OrderLine[], productId: string): number {
  return orders
    .filter((o) => o.product_id === productId)
    .reduce((sum, o) => sum + o.quantity_kg, 0);
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export function computeCascadedAvailability(input: {
  griller_kg: number;
  yield_profiles: LocationYieldProfile[];
  yield_chains: ProductYieldChain[];
  existing_orders_primary: OrderLine[];
  existing_orders_secondary: OrderLine[];
}): CascadedAvailability {
  const {
    griller_kg: rawGrillerKg,
    yield_profiles,
    yield_chains,
    existing_orders_primary,
    existing_orders_secondary,
  } = input;

  // 1. Guard: treat <= 0 as 0
  const griller_kg = rawGrillerKg > 0 ? rawGrillerKg : 0;

  if (griller_kg === 0) {
    return {
      griller_kg: 0,
      primary_products: [],
      secondary_products: [],
      total_sold_primary_kg: 0,
      total_forwarded_kg: 0,
      total_cascaded_kg: 0,
      total_loss_kg: 0,
      mass_balance_check: true,
    };
  }

  // 2-5. Process each primary product
  const primaryProducts: CascadedProduct[] = yield_profiles.map((profile) => {
    // 2. Primary availability
    const primary_available_kg = griller_kg * profile.yield_percentage;

    // 3. Subtract primary orders
    const raw_sold = sumOrdersForProduct(
      existing_orders_primary,
      profile.product_id,
    );
    const oversubscribed_kg = Math.max(0, raw_sold - primary_available_kg);
    const sold_primary_kg = Math.min(raw_sold, primary_available_kg);

    // 4. Forwarded
    const forwarded_kg = primary_available_kg - sold_primary_kg;

    // 5. Cascade chains
    let cascaded_children: CascadedChild[] = [];
    let processing_loss_kg = 0;

    if (forwarded_kg > 0) {
      const chains = yield_chains.filter(
        (c) => c.parent_product_id === profile.product_id,
      );

      if (chains.length > 0) {
        const rawYieldSum = chains.reduce((s, c) => s + c.yield_pct, 0);

        // Determine whether to normalize
        const needsNormalization = rawYieldSum > 1.0;
        const normalizationFactor = needsNormalization ? rawYieldSum : 1.0;

        cascaded_children = chains.map((chain) => {
          const effectiveYield = chain.yield_pct / normalizationFactor;
          const available_kg = forwarded_kg * effectiveYield;
          return {
            product_id: chain.child_product_id,
            product_description: chain.child_product_description,
            available_kg,
            sold_kg: 0,
            net_available_kg: available_kg,
          };
        });

        // Loss: if normalized, loss = 0; otherwise loss = forwarded * (1 - sum)
        if (needsNormalization) {
          processing_loss_kg = 0;
        } else {
          processing_loss_kg = forwarded_kg * (1 - rawYieldSum);
        }
      }
    }

    return {
      product_id: profile.product_id,
      product_description: profile.product_description,
      primary_available_kg,
      sold_primary_kg,
      oversubscribed_kg,
      forwarded_kg,
      cascaded_children,
      processing_loss_kg,
    };
  });

  // 6. Subtract secondary orders
  // Build a flat list, then apply secondary orders
  const allChildren: CascadedChild[] = [];

  for (const parent of primaryProducts) {
    for (const child of parent.cascaded_children) {
      // Check if we already have an entry in allChildren for this product
      // (multiple parents could cascade into the same child product)
      const existing = allChildren.find(
        (c) => c.product_id === child.product_id,
      );
      if (existing) {
        existing.available_kg += child.available_kg;
        existing.net_available_kg += child.net_available_kg;
      } else {
        allChildren.push({
          product_id: child.product_id,
          product_description: child.product_description,
          available_kg: child.available_kg,
          sold_kg: 0,
          net_available_kg: child.available_kg,
        });
      }
    }
  }

  // Apply secondary orders to the flattened list
  for (const child of allChildren) {
    const soldSecondary = sumOrdersForProduct(
      existing_orders_secondary,
      child.product_id,
    );
    child.sold_kg = Math.min(soldSecondary, child.available_kg);
    child.net_available_kg = Math.max(0, child.available_kg - soldSecondary);
  }

  // Also update the per-parent cascaded_children with secondary order subtraction
  for (const parent of primaryProducts) {
    for (const child of parent.cascaded_children) {
      const flatChild = allChildren.find(
        (c) => c.product_id === child.product_id,
      );
      if (flatChild) {
        // Proportionally distribute sold_kg back to per-parent child
        // based on contribution ratio
        if (flatChild.available_kg > 0) {
          const ratio = child.available_kg / flatChild.available_kg;
          child.sold_kg = flatChild.sold_kg * ratio;
          child.net_available_kg = Math.max(
            0,
            child.available_kg - child.sold_kg,
          );
        }
      }
    }
  }

  // 7. Totals & mass balance
  const total_sold_primary_kg = primaryProducts.reduce(
    (s, p) => s + p.sold_primary_kg,
    0,
  );
  const total_forwarded_kg = primaryProducts.reduce(
    (s, p) => s + p.forwarded_kg,
    0,
  );
  const total_cascaded_kg = allChildren.reduce(
    (s, c) => s + c.available_kg,
    0,
  );
  const total_loss_kg = primaryProducts.reduce(
    (s, p) => s + p.processing_loss_kg,
    0,
  );

  const EPSILON = 0.01; // 1 gram tolerance
  const mass_balance_check =
    total_sold_primary_kg + total_cascaded_kg + total_loss_kg <=
    griller_kg + EPSILON;

  return {
    griller_kg,
    primary_products: primaryProducts,
    secondary_products: allChildren,
    total_sold_primary_kg,
    total_forwarded_kg,
    total_cascaded_kg,
    total_loss_kg,
    mass_balance_check,
  };
}
