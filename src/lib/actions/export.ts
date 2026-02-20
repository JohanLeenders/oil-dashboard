'use server';

import { createClient } from '@/lib/supabase/server';
import { getCascadedAvailabilityForSlaughter } from '@/lib/actions/availability';
import { getArticleNumbersForProducts } from '@/lib/actions/article-numbers';
import { getDeliveryInfoForCustomers } from '@/lib/actions/delivery-info';
import type { StorteboomExportInput } from '@/lib/export/orderSchemaExport';
import type { SimulatedAvailability } from '@/lib/engine/availability/simulator';

const DEFAULT_GRILLER_YIELD = 0.704;

/**
 * Aggregator: build StorteboomExportInput from a slaughter ID.
 * Fetches all data from the database and assembles the export input.
 */
export async function buildStorteboomExportData(
  slaughterId: string,
  simulatorInput?: SimulatedAvailability
): Promise<StorteboomExportInput> {
  const supabase = await createClient();

  // 1. Fetch slaughter calendar
  const { data: slaughter, error: slaughterErr } = await supabase
    .from('slaughter_calendar')
    .select('*')
    .eq('id', slaughterId)
    .single();

  if (slaughterErr) throw new Error(`Slachtdag niet gevonden: ${slaughterErr.message}`);

  const totalBirds = slaughter.expected_birds ?? 0;
  const totalWeight = slaughter.expected_live_weight_kg ?? 0;
  const avgWeight = totalBirds > 0 ? totalWeight / totalBirds : 0;
  const mesterBreakdown = (slaughter.mester_breakdown ?? []) as Array<{ mester: string; birds: number; avg_weight_kg: number }>;
  const mester = mesterBreakdown.length > 0 ? mesterBreakdown[0].mester : 'Onbekend';

  // 2. Fetch cascaded availability
  const availability = await getCascadedAvailabilityForSlaughter(slaughterId);

  // 3. Collect all product IDs
  const allProductIds = [
    ...availability.primary_products.map((p) => p.product_id),
    ...availability.secondary_products.map((p) => p.product_id),
  ];

  // 4. Fetch article numbers for all products
  const articleNumbers = await getArticleNumbersForProducts(allProductIds);

  // Build article number lookup: product_id → { vacuum?, niet_vacuum?, packaging_size? }
  type ArticleLookup = Record<string, { vacuum?: string; niet_vacuum?: string; packaging_size?: string | null }>;
  const artLookup: ArticleLookup = {};
  for (const an of articleNumbers) {
    if (!artLookup[an.product_id]) artLookup[an.product_id] = {};
    if (an.article_type === 'vacuum') {
      artLookup[an.product_id].vacuum = an.article_number;
    } else {
      artLookup[an.product_id].niet_vacuum = an.article_number;
    }
    if (an.packaging_size) {
      artLookup[an.product_id].packaging_size = an.packaging_size;
    }
  }

  // 5. Fetch customer orders + order lines
  const { data: orders, error: ordersErr } = await supabase
    .from('customer_orders')
    .select('*, customers(name)')
    .eq('slaughter_id', slaughterId);

  if (ordersErr) throw new Error(`Orders ophalen mislukt: ${ordersErr.message}`);

  // Map of product_id → location (primary or secondary)
  const primaryIds = new Set(availability.primary_products.map((p) => p.product_id));
  const secondaryIds = new Set(availability.secondary_products.map((p) => p.product_id));

  const customerOrders: StorteboomExportInput['customer_orders'] = [];
  const customerIds: string[] = [];

  for (const order of orders ?? []) {
    const customersData = order.customers as { name: string } | null;
    const customerName = customersData?.name ?? 'Onbekend';
    customerIds.push(order.customer_id);

    // Fetch lines for this order
    const { data: lines } = await supabase
      .from('order_lines')
      .select('product_id, quantity_kg')
      .eq('order_id', order.id);

    const puttenLines: { product_id: string; quantity_kg: number }[] = [];
    const nijkerkLines: { product_id: string; quantity_kg: number }[] = [];

    for (const line of lines ?? []) {
      if (primaryIds.has(line.product_id)) {
        puttenLines.push({ product_id: line.product_id, quantity_kg: line.quantity_kg });
      } else if (secondaryIds.has(line.product_id)) {
        nijkerkLines.push({ product_id: line.product_id, quantity_kg: line.quantity_kg });
      } else {
        // Default to Putten if unknown
        puttenLines.push({ product_id: line.product_id, quantity_kg: line.quantity_kg });
      }
    }

    customerOrders.push({
      customer_id: order.customer_id,
      customer_name: customerName,
      delivery_address: null,
      transport_by_koops: null,
      putten_delivery_day: null,
      nijkerk_delivery_day: null,
      putten_lines: puttenLines,
      nijkerk_lines: nijkerkLines,
    });
  }

  // 6. Fetch delivery info
  const uniqueCustomerIds = [...new Set(customerIds)];
  if (uniqueCustomerIds.length > 0) {
    const deliveryInfos = await getDeliveryInfoForCustomers(uniqueCustomerIds);
    for (const co of customerOrders) {
      const info = deliveryInfos.find((d) => d.customer_id === co.customer_id);
      if (info) {
        co.delivery_address = info.delivery_address;
        co.transport_by_koops = info.transport_by_koops;
        co.putten_delivery_day = info.putten_delivery_day;
        co.nijkerk_delivery_day = info.nijkerk_delivery_day;
      }
    }
  }

  // 7. Determine values (with or without simulator)
  const grillerYield = simulatorInput?.griller_yield_pct ?? DEFAULT_GRILLER_YIELD;
  const grillerKg = simulatorInput?.original_griller_kg ?? (totalWeight * grillerYield);
  const grillerCount = simulatorInput?.input_birds ?? totalBirds;
  const avgGrillerWeight = grillerCount > 0 ? grillerKg / grillerCount : 0;

  const wholeBirdPulls = simulatorInput?.whole_bird_pulls?.map((p) => ({
    label: p.label,
    count: p.count,
    total_kg: p.total_kg,
  })) ?? [];

  const remainingBirds = simulatorInput?.remaining_birds ?? grillerCount;
  const remainingGrillerKg = simulatorInput?.remaining_griller_kg ?? grillerKg;
  const adjustedAvg = simulatorInput?.adjusted_avg_griller_weight_kg ?? avgGrillerWeight;

  // 8. Build product lists
  const puttenProducts: StorteboomExportInput['putten_products'] = availability.primary_products.map((pp) => {
    const art = artLookup[pp.product_id];
    return {
      product_id: pp.product_id,
      description: pp.product_description,
      article_number_vacuum: art?.vacuum ?? null,
      article_number_niet_vacuum: art?.niet_vacuum ?? null,
      yield_pct: null, // Will be filled from yield profiles if available
      kg_from_slaughter: pp.primary_available_kg,
      packaging_size: art?.packaging_size ?? null,
    };
  });

  const nijkerkProducts: StorteboomExportInput['nijkerk_products'] = availability.secondary_products.map((sp) => {
    const art = artLookup[sp.product_id];
    // Find parent product description
    const parent = availability.primary_products.find((pp) =>
      pp.cascaded_children.some((c) => c.product_id === sp.product_id)
    );
    return {
      product_id: sp.product_id,
      description: sp.product_description,
      article_number_vacuum: art?.vacuum ?? null,
      article_number_niet_vacuum: art?.niet_vacuum ?? null,
      yield_pct: null,
      kg_from_slaughter: sp.available_kg,
      source_product: parent?.product_description ?? 'Onbekend',
      packaging_size: art?.packaging_size ?? null,
    };
  });

  // Build lot number from slaughter date + mester initial
  const dateParts = slaughter.slaughter_date.split('-');
  const lotNumber = `P${dateParts[0].slice(2)}${dateParts[1]}${dateParts[2]}`;

  return {
    slaughter_date: slaughter.slaughter_date,
    lot_number: lotNumber,
    mester: mester,
    ras: 'Oranjehoen',
    hok_count: mesterBreakdown.length > 0 ? mesterBreakdown.length : 1,

    total_birds: totalBirds,
    total_live_weight_kg: totalWeight,
    avg_live_weight_kg: avgWeight,
    dead_on_arrival: 0,
    dead_weight_kg: 0,

    griller_yield_pct: grillerYield,
    griller_kg: grillerKg,
    griller_count: grillerCount,
    avg_griller_weight_kg: avgGrillerWeight,
    rejected_count: 0,
    rejected_weight_kg: 0,

    whole_bird_pulls: wholeBirdPulls,
    remaining_birds_for_cutting: remainingBirds,
    remaining_griller_kg: remainingGrillerKg,
    adjusted_avg_griller_weight: adjustedAvg,

    putten_products: puttenProducts,
    nijkerk_products: nijkerkProducts,
    customer_orders: customerOrders,
  };
}
