'use server';

import { createClient } from '@/lib/supabase/server';
import { computeCascadedAvailability } from '@/lib/engine/availability/cascading';
import type {
  CascadedAvailability,
  LocationYieldProfile,
  ProductYieldChain,
  OrderLine as CascadeOrderLine,
} from '@/lib/engine/availability/cascading';

export type { CascadedAvailability } from '@/lib/engine/availability/cascading';
export type { LocationYieldProfile, ProductYieldChain } from '@/lib/engine/availability/cascading';

/**
 * Extended availability result that includes whole-bird order deductions.
 * The engine's griller_kg reflects the *effective* griller pool after whole-bird
 * orders are subtracted (like Excel "Hele kuikens uit verdeling halen").
 */
export interface AvailabilityWithWholeChicken extends CascadedAvailability {
  /** Original total griller kg before whole-bird deductions */
  original_griller_kg: number;
  /** Kg reserved for whole-bird orders (hele kip, naakt karkas) */
  whole_chicken_order_kg: number;
  /**
   * Wave 12: Product categories that trigger Putten co-production when ordered.
   * Computed server-side from yield_chains × product metadata — no hardcoding needed.
   * Used client-side to flag orders that cause forced co-production (zadel opensnijden).
   */
  putten_cut_trigger_categories: string[];
}

/**
 * Yield config data needed by the PlanningSimulator client component.
 * Fetched server-side and passed as props.
 */
export interface SimulatorYieldConfig {
  yield_profiles: LocationYieldProfile[];
  yield_chains: ProductYieldChain[];
  expected_birds: number;
  expected_live_weight_kg: number;
}

/**
 * Fetch yield profiles + chains + slaughter data for the simulator.
 * Separate from getCascadedAvailabilityForSlaughter to avoid code duplication.
 */
export async function getSimulatorYieldConfig(
  slaughterId: string
): Promise<SimulatorYieldConfig> {
  const supabase = await createClient();

  // Fetch slaughter row
  const { data: slaughter, error: slaughterError } = await supabase
    .from('slaughter_calendar')
    .select('expected_birds, expected_live_weight_kg')
    .eq('id', slaughterId)
    .single();

  if (slaughterError) throw new Error(`Failed to fetch slaughter: ${slaughterError.message}`);

  // Fetch Putten location
  const { data: puttenLoc, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('code', 'putten')
    .single();

  if (locError) throw new Error(`Failed to fetch Putten location: ${locError.message}`);

  // Fetch yield profiles for Putten
  const { data: profileRows, error: profileError } = await supabase
    .from('location_yield_profiles')
    .select('product_id, yield_percentage, products(description)')
    .eq('location_id', puttenLoc.id)
    .eq('is_active', true);

  if (profileError) throw new Error(`Failed to fetch yield profiles: ${profileError.message}`);

  const yield_profiles: LocationYieldProfile[] = (profileRows || []).map((row: any) => ({
    product_id: row.product_id,
    product_description: row.products?.description ?? 'Unknown',
    yield_percentage: Number(row.yield_percentage),
  }));

  // Fetch yield chains (including location IDs for Putten→Putten vs Putten→Nijkerk routing)
  const { data: chainRows, error: chainError } = await supabase
    .from('product_yield_chains')
    .select('parent_product_id, child_product_id, yield_pct, source_location_id, target_location_id, products!product_yield_chains_child_product_id_fkey(description)')
    .order('sort_order', { ascending: true });

  if (chainError) throw new Error(`Failed to fetch yield chains: ${chainError.message}`);

  const yield_chains: ProductYieldChain[] = (chainRows || []).map((row: any) => ({
    parent_product_id: row.parent_product_id,
    child_product_id: row.child_product_id,
    child_product_description: row.products?.description ?? 'Unknown',
    yield_pct: Number(row.yield_pct),
    source_location_id: row.source_location_id ?? undefined,
    target_location_id: row.target_location_id ?? undefined,
  }));

  return {
    yield_profiles,
    yield_chains,
    expected_birds: slaughter.expected_birds,
    expected_live_weight_kg: slaughter.expected_live_weight_kg,
  };
}

export async function getCascadedAvailabilityForSlaughter(
  slaughterId: string
): Promise<AvailabilityWithWholeChicken> {
  const supabase = await createClient();

  // 1. Fetch slaughter row
  const { data: slaughter, error: slaughterError } = await supabase
    .from('slaughter_calendar')
    .select('expected_birds, expected_live_weight_kg')
    .eq('id', slaughterId)
    .single();

  if (slaughterError) throw new Error(`Failed to fetch slaughter: ${slaughterError.message}`);

  // 2. Compute griller kg
  const avgWeightKg = slaughter.expected_live_weight_kg / slaughter.expected_birds;
  const grillerKg = slaughter.expected_birds * avgWeightKg * 0.704;

  // 3. Fetch Putten location
  const { data: puttenLoc, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('code', 'putten')
    .single();

  if (locError) throw new Error(`Failed to fetch Putten location: ${locError.message}`);

  // 4. Fetch yield profiles for Putten
  const { data: profileRows, error: profileError } = await supabase
    .from('location_yield_profiles')
    .select('product_id, yield_percentage, products(description)')
    .eq('location_id', puttenLoc.id)
    .eq('is_active', true);

  if (profileError) throw new Error(`Failed to fetch yield profiles: ${profileError.message}`);

  const yieldProfiles: LocationYieldProfile[] = (profileRows || []).map((row: any) => ({
    product_id: row.product_id,
    product_description: row.products?.description ?? 'Unknown',
    yield_percentage: Number(row.yield_percentage),
  }));

  // 5. Fetch yield chains (including location IDs for Putten→Putten vs Putten→Nijkerk routing)
  const { data: chainRows, error: chainError } = await supabase
    .from('product_yield_chains')
    .select('parent_product_id, child_product_id, yield_pct, source_location_id, target_location_id, products!product_yield_chains_child_product_id_fkey(description)')
    .order('sort_order', { ascending: true });

  if (chainError) throw new Error(`Failed to fetch yield chains: ${chainError.message}`);

  const yieldChains: ProductYieldChain[] = (chainRows || []).map((row: any) => ({
    parent_product_id: row.parent_product_id,
    child_product_id: row.child_product_id,
    child_product_description: row.products?.description ?? 'Unknown',
    yield_pct: Number(row.yield_pct),
    source_location_id: row.source_location_id ?? undefined,
    target_location_id: row.target_location_id ?? undefined,
  }));

  // 6. Fetch all orders for this slaughter, then all order lines
  const { data: orders } = await supabase
    .from('customer_orders')
    .select('id')
    .eq('slaughter_id', slaughterId);

  const existingOrdersPrimary: CascadeOrderLine[] = [];
  const existingOrdersSecondary: CascadeOrderLine[] = [];

  // Track whole-bird (hele kip) orders — these reduce the griller pool
  // BEFORE the cascade split, exactly like the Excel "Hele kuikens uit verdeling halen".
  let wholeChickenOrderKg = 0;

  // Get all primary product IDs and child product IDs for classification
  const primaryProductIds = new Set(yieldProfiles.map(p => p.product_id));

  // Wave 12: Putten→Putten chain children (e.g. dij anatomisch, drumstick) are also
  // classified as "primary" orders because they trigger the Putten cut operation.
  // They are NOT in yield_profiles anymore (Zadel is the parent), but orders on them
  // must be passed to existing_orders_primary for the co-production engine to work.
  const puttenCutChildIds = new Set<string>();
  for (const chain of yieldChains) {
    if (chain.source_location_id && chain.target_location_id
        && chain.source_location_id === chain.target_location_id) {
      puttenCutChildIds.add(chain.child_product_id);
      primaryProductIds.add(chain.child_product_id);
    }
  }

  // Secondary = Nijkerk cascade children (different source/target location, or no location info)
  const secondaryProductIds = new Set(
    yieldChains
      .filter(c => !puttenCutChildIds.has(c.child_product_id))
      .map(c => c.child_product_id)
  );

  // Build anatomical_part → yield product_id mappings for variant resolution.
  // When a customer orders a packaging variant (e.g. "Dijvlees Bulk") that isn't
  // directly in yield_profiles/chains, we match it to the canonical yield product
  // via shared anatomical_part + category.
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, anatomical_part, category')
    .eq('is_active', true);

  const productLookup = new Map<string, { anatomical_part: string | null; category: string | null }>();
  for (const p of allProducts || []) {
    productLookup.set(p.id, { anatomical_part: p.anatomical_part, category: p.category });
  }

  // Categories that represent whole griller products — these reduce griller_kg directly
  const WHOLE_BIRD_CATEGORIES = new Set(['hele_kip', 'karkas']);

  // Map: anatomical_part → primary yield product_id
  const anatPartToPrimary = new Map<string, string>();
  for (const profile of yieldProfiles) {
    const info = productLookup.get(profile.product_id);
    if (info?.anatomical_part) {
      anatPartToPrimary.set(info.anatomical_part, profile.product_id);
    }
  }

  // Map: category → secondary yield product_id
  // Multiple secondary products may share an anatomical_part, so also use category
  const categoryToSecondary = new Map<string, string>();
  for (const chain of yieldChains) {
    const info = productLookup.get(chain.child_product_id);
    if (info?.category) {
      categoryToSecondary.set(info.category, chain.child_product_id);
    }
  }

  for (const order of orders || []) {
    const { data: lines } = await supabase
      .from('order_lines')
      .select('product_id, quantity_kg')
      .eq('order_id', order.id);

    for (const line of lines || []) {
      const info = productLookup.get(line.product_id);

      // Whole-bird orders (hele kip, naakt karkas) reduce griller pool directly
      if (info && WHOLE_BIRD_CATEGORIES.has(info.category ?? '')) {
        wholeChickenOrderKg += line.quantity_kg;
        continue;
      }

      // Direct match first
      if (primaryProductIds.has(line.product_id)) {
        existingOrdersPrimary.push({ product_id: line.product_id, quantity_kg: line.quantity_kg });
      } else if (secondaryProductIds.has(line.product_id)) {
        existingOrdersSecondary.push({ product_id: line.product_id, quantity_kg: line.quantity_kg });
      } else if (info) {
        // Variant resolution: match via category or anatomical_part
        const secMatch = info.category ? categoryToSecondary.get(info.category) : null;
        if (secMatch) {
          existingOrdersSecondary.push({ product_id: secMatch, quantity_kg: line.quantity_kg });
        } else if (info.anatomical_part) {
          const priMatch = anatPartToPrimary.get(info.anatomical_part);
          if (priMatch) {
            existingOrdersPrimary.push({ product_id: priMatch, quantity_kg: line.quantity_kg });
          }
        }
      }
    }
  }

  // 7. Subtract whole-bird orders from griller pool, then call pure engine.
  //    This mirrors the Excel logic: "Hele kuikens uit verdeling halen" —
  //    whole chickens are removed from the griller total before the cascade split.
  const effectiveGrillerKg = Math.max(0, grillerKg - wholeChickenOrderKg);

  const cascadeResult = computeCascadedAvailability({
    griller_kg: effectiveGrillerKg,
    yield_profiles: yieldProfiles,
    yield_chains: yieldChains,
    existing_orders_primary: existingOrdersPrimary,
    existing_orders_secondary: existingOrdersSecondary,
  });

  // Wave 12: Collect product categories that trigger Putten co-production.
  // A customer order with any of these categories causes forced zadel opensnijden.
  const puttenCutTriggerCategories: string[] = [];
  for (const childId of puttenCutChildIds) {
    const info = productLookup.get(childId);
    if (info?.category && !puttenCutTriggerCategories.includes(info.category)) {
      puttenCutTriggerCategories.push(info.category);
    }
  }

  return {
    ...cascadeResult,
    original_griller_kg: grillerKg,
    whole_chicken_order_kg: wholeChickenOrderKg,
    putten_cut_trigger_categories: puttenCutTriggerCategories,
  };
}
