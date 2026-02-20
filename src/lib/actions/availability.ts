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

  // Fetch yield chains
  const { data: chainRows, error: chainError } = await supabase
    .from('product_yield_chains')
    .select('parent_product_id, child_product_id, yield_pct, products!product_yield_chains_child_product_id_fkey(description)')
    .order('sort_order', { ascending: true });

  if (chainError) throw new Error(`Failed to fetch yield chains: ${chainError.message}`);

  const yield_chains: ProductYieldChain[] = (chainRows || []).map((row: any) => ({
    parent_product_id: row.parent_product_id,
    child_product_id: row.child_product_id,
    child_product_description: row.products?.description ?? 'Unknown',
    yield_pct: Number(row.yield_pct),
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
): Promise<CascadedAvailability> {
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

  // 5. Fetch yield chains
  const { data: chainRows, error: chainError } = await supabase
    .from('product_yield_chains')
    .select('parent_product_id, child_product_id, yield_pct, products!product_yield_chains_child_product_id_fkey(description)')
    .order('sort_order', { ascending: true });

  if (chainError) throw new Error(`Failed to fetch yield chains: ${chainError.message}`);

  const yieldChains: ProductYieldChain[] = (chainRows || []).map((row: any) => ({
    parent_product_id: row.parent_product_id,
    child_product_id: row.child_product_id,
    child_product_description: row.products?.description ?? 'Unknown',
    yield_pct: Number(row.yield_pct),
  }));

  // 6. Fetch all orders for this slaughter, then all order lines
  const { data: orders } = await supabase
    .from('customer_orders')
    .select('id')
    .eq('slaughter_id', slaughterId);

  const existingOrdersPrimary: CascadeOrderLine[] = [];
  const existingOrdersSecondary: CascadeOrderLine[] = [];

  // Get all primary product IDs and child product IDs for classification
  const primaryProductIds = new Set(yieldProfiles.map(p => p.product_id));
  const secondaryProductIds = new Set(yieldChains.map(c => c.child_product_id));

  for (const order of orders || []) {
    const { data: lines } = await supabase
      .from('order_lines')
      .select('product_id, quantity_kg')
      .eq('order_id', order.id);

    for (const line of lines || []) {
      const orderLine: CascadeOrderLine = {
        product_id: line.product_id,
        quantity_kg: line.quantity_kg,
      };
      if (primaryProductIds.has(line.product_id)) {
        existingOrdersPrimary.push(orderLine);
      } else if (secondaryProductIds.has(line.product_id)) {
        existingOrdersSecondary.push(orderLine);
      }
      // Orders for unknown products are ignored
    }
  }

  // 7. Call pure engine
  return computeCascadedAvailability({
    griller_kg: grillerKg,
    yield_profiles: yieldProfiles,
    yield_chains: yieldChains,
    existing_orders_primary: existingOrdersPrimary,
    existing_orders_secondary: existingOrdersSecondary,
  });
}
