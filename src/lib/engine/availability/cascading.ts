/**
 * Cascaded Availability Engine
 *
 * Pure function — no database access, no async, no side effects.
 *
 * Computes a three-tier availability model:
 *   1. Primary products (parent pools) are derived from griller weight via location yield profiles.
 *   2. Parent pools with Putten→Putten chains get forced co-production routing:
 *      orders on Putten-children determine how much parent is cut (producing ALL children).
 *   3. Remaining (uncut) parent kg are forwarded and cascaded into secondary (Nijkerk) products
 *      via Putten→Nijkerk yield chains.
 *
 * Wave 12: Zadel model — parent-pool routing with forced co-production.
 *   - Putten→Putten chains: coupled cut-children (dij anatomisch + drumstick + loss)
 *   - required_cut_kg = max(order_i / child_yield_i) — one cut produces all children
 *   - co_product_free_kg = produced - sold per child
 *   - forwarded_to_nijkerk = remaining - required_cut_kg
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
  /** Optional: source location code. 'LOC_PUTTEN' → 'LOC_PUTTEN' = Putten cut chain */
  source_location_id?: string;
  /** Optional: target location code. 'LOC_PUTTEN' → 'LOC_NIJKERK' = Nijkerk cascade chain */
  target_location_id?: string;
}

/** A Putten→Putten co-product child (forced co-production) */
export interface CoProductChild {
  product_id: string;
  product_description: string;
  /** Total kg produced by cutting parent (= required_cut_kg × child_yield) */
  produced_kg: number;
  /** Kg sold from Putten orders */
  sold_kg: number;
  /** Unsold co-product = produced - sold (free stock) */
  co_product_free_kg: number;
  /** Kg that could not be fulfilled (order > produced) */
  unfulfilled_kg: number;
  /** The yield of this child from the parent (0.0–1.0) */
  yield_pct: number;
  /** Whether this is a loss product (category = 'verlies') */
  is_loss: boolean;
}

/** Putten cut insight for a parent pool */
export interface PuttenCutInsight {
  /** How much parent kg must be cut to fulfill Putten orders */
  required_cut_kg: number;
  /** Co-product children produced by the cut */
  children: CoProductChild[];
  /** Total kg lost during Putten cutting */
  cut_loss_kg: number;
  /** Kg forwarded to Nijkerk (remaining after cut) */
  forwarded_to_nijkerk_kg: number;
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
  /** Wave 12: Putten cut insight (only present for parent pools with Putten→Putten chains) */
  putten_cut?: PuttenCutInsight;
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

/**
 * Check if a chain is a Putten→Putten chain (same source & target location).
 * Falls back to false if location info is not provided (backward compat).
 */
function isPuttenCutChain(chain: ProductYieldChain): boolean {
  if (!chain.source_location_id || !chain.target_location_id) return false;
  return chain.source_location_id === chain.target_location_id;
}

/**
 * Check if a chain is a Putten→Nijkerk cascade chain (different locations).
 * Falls back to true if location info is not provided (backward compat:
 * all chains without location info are treated as Nijkerk cascade chains).
 */
function isNijkerkCascadeChain(chain: ProductYieldChain): boolean {
  if (!chain.source_location_id || !chain.target_location_id) return true;
  return chain.source_location_id !== chain.target_location_id;
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

  // 2-5. Process each primary product (parent pool)
  const primaryProducts: CascadedProduct[] = yield_profiles.map((profile) => {
    // 2. Primary availability
    const primary_available_kg = griller_kg * profile.yield_percentage;

    // 3. Subtract primary orders (direct sales of the parent itself, if sellable)
    const raw_sold = sumOrdersForProduct(
      existing_orders_primary,
      profile.product_id,
    );
    const oversubscribed_kg = Math.max(0, raw_sold - primary_available_kg);
    const sold_primary_kg = Math.min(raw_sold, primary_available_kg);

    // 4. Remaining after direct parent sales
    const remaining = primary_available_kg - sold_primary_kg;

    // 5. Check for Putten→Putten chains (co-production routing)
    const allChainsForParent = yield_chains.filter(
      (c) => c.parent_product_id === profile.product_id,
    );
    const puttenCutChains = allChainsForParent.filter(isPuttenCutChain);
    const nijkerkCascadeChains = allChainsForParent.filter(isNijkerkCascadeChain);

    let putten_cut: PuttenCutInsight | undefined;
    let forwarded_kg: number;
    let cascaded_children: CascadedChild[] = [];
    let processing_loss_kg = 0;

    if (puttenCutChains.length > 0 && remaining > 0) {
      // ═══════════════════════════════════════════════════════════════════
      // PARENT-POOL ROUTING: Forced co-production at Putten
      // ═══════════════════════════════════════════════════════════════════

      // Filter out loss children from the demand calculation
      // (loss children have no orders — they are produced as waste)
      const demandChains = puttenCutChains.filter(
        (c) => !isLossProduct(c.child_product_description),
      );

      // a. Compute required_cut_kg = max(order_i / child_yield_i)
      //    One cut produces ALL children; max() ensures enough for largest demand
      let required_cut_kg = 0;
      for (const chain of demandChains) {
        const order_kg = sumOrdersForProduct(
          existing_orders_primary,
          chain.child_product_id,
        );
        if (order_kg > 0 && chain.yield_pct > 0) {
          const required_for_child = order_kg / chain.yield_pct;
          required_cut_kg = Math.max(required_cut_kg, required_for_child);
        }
      }

      // b. Cap: can't cut more than remaining parent kg
      required_cut_kg = Math.min(required_cut_kg, remaining);

      // c. Compute produced_kg per child, sold, co_product_free, unfulfilled
      const puttenChildren: CoProductChild[] = puttenCutChains.map((chain) => {
        const produced_kg = required_cut_kg * chain.yield_pct;
        const is_loss = isLossProduct(chain.child_product_description);
        const order_kg = is_loss
          ? 0
          : sumOrdersForProduct(existing_orders_primary, chain.child_product_id);
        const sold_kg = Math.min(order_kg, produced_kg);
        const co_product_free_kg = Math.max(0, produced_kg - sold_kg);
        const unfulfilled_kg = Math.max(0, order_kg - sold_kg);

        return {
          product_id: chain.child_product_id,
          product_description: chain.child_product_description,
          produced_kg,
          sold_kg,
          co_product_free_kg,
          unfulfilled_kg,
          yield_pct: chain.yield_pct,
          is_loss,
        };
      });

      // d. Cut loss = produced loss children kg
      const cut_loss_kg = puttenChildren
        .filter((c) => c.is_loss)
        .reduce((s, c) => s + c.produced_kg, 0);

      // e. Forwarded to Nijkerk = remaining - required_cut_kg
      const forwarded_to_nijkerk_kg = remaining - required_cut_kg;

      putten_cut = {
        required_cut_kg,
        children: puttenChildren,
        cut_loss_kg,
        forwarded_to_nijkerk_kg,
      };

      // forwarded_kg for the CascadedProduct = what goes to Nijkerk
      forwarded_kg = forwarded_to_nijkerk_kg;

      // f. Cascade Nijkerk chains on forwarded_to_nijkerk ONLY
      if (forwarded_to_nijkerk_kg > 0 && nijkerkCascadeChains.length > 0) {
        const rawYieldSum = nijkerkCascadeChains.reduce(
          (s, c) => s + c.yield_pct,
          0,
        );
        const needsNormalization = rawYieldSum > 1.0;
        const normalizationFactor = needsNormalization ? rawYieldSum : 1.0;

        cascaded_children = nijkerkCascadeChains.map((chain) => {
          const effectiveYield = chain.yield_pct / normalizationFactor;
          const available_kg = forwarded_to_nijkerk_kg * effectiveYield;
          return {
            product_id: chain.child_product_id,
            product_description: chain.child_product_description,
            available_kg,
            sold_kg: 0,
            net_available_kg: available_kg,
          };
        });

        if (needsNormalization) {
          processing_loss_kg = 0;
        } else {
          processing_loss_kg = forwarded_to_nijkerk_kg * (1 - rawYieldSum);
        }
      }

      // Add Putten cut loss to processing_loss_kg
      processing_loss_kg += cut_loss_kg;
    } else if (remaining > 0) {
      // ═══════════════════════════════════════════════════════════════════
      // NO PUTTEN CUT CHAINS — standard cascade (backward compatible)
      // ═══════════════════════════════════════════════════════════════════
      forwarded_kg = remaining;

      if (nijkerkCascadeChains.length > 0) {
        const rawYieldSum = nijkerkCascadeChains.reduce(
          (s, c) => s + c.yield_pct,
          0,
        );
        const needsNormalization = rawYieldSum > 1.0;
        const normalizationFactor = needsNormalization ? rawYieldSum : 1.0;

        cascaded_children = nijkerkCascadeChains.map((chain) => {
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

        if (needsNormalization) {
          processing_loss_kg = 0;
        } else {
          processing_loss_kg = forwarded_kg * (1 - rawYieldSum);
        }
      }
    } else {
      // Nothing remaining — no forwarding, no cascade
      forwarded_kg = 0;
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
      putten_cut,
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
  //    sold_primary includes both direct parent sales AND Putten-cut child sales
  let total_sold_primary_kg = 0;
  for (const p of primaryProducts) {
    total_sold_primary_kg += p.sold_primary_kg;
    if (p.putten_cut) {
      total_sold_primary_kg += p.putten_cut.children
        .filter((c) => !c.is_loss)
        .reduce((s, c) => s + c.sold_kg, 0);
    }
  }

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

// ---------------------------------------------------------------------------
// Helpers (private)
// ---------------------------------------------------------------------------

/**
 * Heuristic to identify loss products by description.
 * Products with 'verlies' or 'loss' in description are treated as loss.
 */
function isLossProduct(description: string): boolean {
  const lower = description.toLowerCase();
  return lower.includes('verlies') || lower.includes('loss');
}
