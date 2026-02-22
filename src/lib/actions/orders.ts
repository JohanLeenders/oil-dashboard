'use server';

/**
 * Server Actions voor Orders (READ + WRITE)
 * Sprint: Wave 2 — A2-S1 Orders UI + A2-S2 Orders Engine
 *
 * REGRESSIE-CHECK:
 * - Reads: slaughter_calendar, customer_orders, order_lines, customers, products
 * - Writes: customer_orders (INSERT), order_lines (INSERT/DELETE)
 * - order_schema_snapshots: APPEND-ONLY (INSERT only, never UPDATE/DELETE)
 */

import { createClient } from '@/lib/supabase/server';
import type {
  SlaughterCalendar,
  CustomerOrder,
  OrderLine,
  OrderSchemaSnapshot,
  OrderSchemaAvailability,
} from '@/types/database';
import { buildOrderSchema } from '@/lib/engine/orders';
import type { BuildOrderSchemaInput } from '@/lib/engine/orders';
import { ANATOMICAL_NORMS } from '@/lib/engine/cherry-picker';
import { DEFAULT_GRILLER_WEIGHT_KG } from '@/lib/engine/chicken-equivalent';
import {
  createCustomerOrderSchema,
  createOrderWithLinesSchema,
  addOrderLineSchema,
  removeOrderLineSchema,
  updateOrderLineSchema,
  deleteOrderSchema,
  createDraftSnapshotSchema,
  finalizeSnapshotSchema,
  getOrdersForSlaughterSchema,
  getOrderLinesSchema,
  getSnapshotsForSlaughterSchema,
  getSlaughterDetailSchema,
} from '@/lib/schemas/orders';

// ============================================================================
// READ ACTIONS
// ============================================================================

/**
 * Haal slachtdatums op die beschikbaar zijn voor orders
 */
export async function getSlaughterDatesForOrders(): Promise<SlaughterCalendar[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('slaughter_calendar')
    .select('*')
    .in('status', ['planned', 'orders_open'])
    .order('slaughter_date', { ascending: true });

  if (error) {
    console.error('Error fetching slaughter dates for orders:', error);
    throw new Error(`Failed to fetch slaughter dates: ${error.message}`);
  }

  return data || [];
}

/**
 * Haal orders op voor een specifieke slachtdatum.
 * Wave 10 D3: bevat ook line_summary (komma-gescheiden productregels).
 */
export async function getOrdersForSlaughter(
  slaughterId: string
): Promise<(CustomerOrder & { customer_name: string; line_summary: string; chicken_equivalent: number; line_categories: string[] })[]> {
  const parsed = getOrdersForSlaughterSchema.parse({ slaughterId });
  const supabase = await createClient();
  slaughterId = parsed.slaughterId;

  const { data, error } = await supabase
    .from('customer_orders')
    .select('*, customers(name), order_lines(product_id, quantity_kg, products(description, category))')
    .eq('slaughter_id', slaughterId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders for slaughter:', error);
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  // Build norm lookup: category → ratio_pct (from ANATOMICAL_NORMS)
  const normMap = new Map<string, number>(
    ANATOMICAL_NORMS
      .filter(n => n.category !== 'hele_kip')
      .map(n => [n.category, n.ratio_pct])
  );
  const grillerWeight = DEFAULT_GRILLER_WEIGHT_KG;

  return (data || []).map((row) => {
    const typed = row as Record<string, unknown> & {
      customers?: { name: string } | null;
      order_lines?: { product_id: string; quantity_kg: number; products?: { description: string; category: string | null } | null }[];
    };
    const customerName = typed.customers?.name ?? 'Onbekend';

    // Build line summary + calculate chicken equivalent
    const lines = typed.order_lines || [];
    let maxChickensNeeded = 0;

    const lineSummary = lines
      .map((l) => {
        const name = l.products?.description ?? '?';
        const kg = l.quantity_kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 });

        // Chicken equivalent per line
        const cat = l.products?.category;
        if (cat === 'hele_kip') {
          // Hele kip = 1 kip per griller gewicht
          maxChickensNeeded = Math.max(maxChickensNeeded, l.quantity_kg / grillerWeight);
        } else if (cat) {
          const normPct = normMap.get(cat);
          if (normPct && normPct > 0) {
            const yieldPerChicken = (normPct / 100) * grillerWeight;
            const chickensNeeded = l.quantity_kg / yieldPerChicken;
            maxChickensNeeded = Math.max(maxChickensNeeded, chickensNeeded);
          }
        }

        return `${name} ${kg}kg`;
      })
      .join(', ');

    // Unique categories across all order lines (for co-product trigger detection)
    const lineCategories = [...new Set(
      lines.map((l) => l.products?.category).filter((c): c is string => c != null)
    )];

    return {
      id: row.id,
      slaughter_id: row.slaughter_id,
      customer_id: row.customer_id,
      status: row.status,
      total_kg: row.total_kg,
      total_lines: row.total_lines,
      notes: row.notes,
      submitted_at: row.submitted_at,
      confirmed_at: row.confirmed_at,
      confirmed_by: row.confirmed_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      customer_name: customerName,
      line_summary: lineSummary,
      chicken_equivalent: Math.round(maxChickensNeeded),
      line_categories: lineCategories,
    } as CustomerOrder & { customer_name: string; line_summary: string; chicken_equivalent: number; line_categories: string[] };
  });
}

/**
 * Haal orderregels op voor een specifieke order
 */
export async function getOrderLines(
  orderId: string
): Promise<(OrderLine & { product_name: string })[]> {
  const parsed = getOrderLinesSchema.parse({ orderId });
  const supabase = await createClient();
  orderId = parsed.orderId;

  const { data, error } = await supabase
    .from('order_lines')
    .select('*, products(description)')
    .eq('order_id', orderId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching order lines:', error);
    throw new Error(`Failed to fetch order lines: ${error.message}`);
  }

  return (data || []).map((row) => {
    const typed = row as Record<string, unknown> & {
      products?: { description: string } | null;
    };
    const productName = typed.products?.description ?? 'Onbekend product';
    return {
      id: row.id,
      order_id: row.order_id,
      product_id: row.product_id,
      quantity_kg: row.quantity_kg,
      quantity_pieces: row.quantity_pieces,
      unit_price_eur: row.unit_price_eur,
      notes: row.notes,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
      product_name: productName,
    } as OrderLine & { product_name: string };
  });
}

/**
 * Haal klanten op voor selectie-dropdown
 */
export async function getCustomersForSelect(): Promise<
  { id: string; name: string }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching customers:', error);
    throw new Error(`Failed to fetch customers: ${error.message}`);
  }

  return data || [];
}

/**
 * Haal producten op voor selectie-dropdown
 * Formaat: "[PLU] Beschrijving" zodat producten duidelijk te onderscheiden zijn
 */
export async function getProductsForSelect(): Promise<
  { id: string; name: string; category: string | null }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('products')
    .select('id, description, storteboom_plu, category')
    .eq('is_active', true)
    .order('description', { ascending: true });

  if (error) {
    console.error('Error fetching products:', error);
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  // Format as "[PLU] Description" for clear identification
  return (data || []).map((p) => ({
    id: p.id,
    name: p.storteboom_plu ? `[${p.storteboom_plu}] ${p.description}` : p.description,
    category: p.category,
  }));
}

/**
 * Haal snapshots op voor een specifieke slachtdatum
 */
export async function getSnapshotsForSlaughter(
  slaughterId: string
): Promise<OrderSchemaSnapshot[]> {
  const parsed = getSnapshotsForSlaughterSchema.parse({ slaughterId });
  const supabase = await createClient();
  slaughterId = parsed.slaughterId;

  const { data, error } = await supabase
    .from('order_schema_snapshots')
    .select('*')
    .eq('slaughter_id', slaughterId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching snapshots:', error);
    throw new Error(`Failed to fetch snapshots: ${error.message}`);
  }

  return data || [];
}

/**
 * Haal slachtkalender detail op
 */
export async function getSlaughterDetailForOrders(
  id: string
): Promise<SlaughterCalendar | null> {
  const parsed = getSlaughterDetailSchema.parse({ id });
  const supabase = await createClient();
  id = parsed.id;

  const { data, error } = await supabase
    .from('slaughter_calendar')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching slaughter detail:', error);
    throw new Error(`Failed to fetch slaughter detail: ${error.message}`);
  }

  return data;
}

// ============================================================================
// WRITE ACTIONS
// ============================================================================

/**
 * Maak een nieuwe klantorder aan (status: draft)
 */
export async function createCustomerOrder(
  slaughterId: string,
  customerId: string,
  notes?: string
): Promise<CustomerOrder> {
  const parsed = createCustomerOrderSchema.parse({ slaughterId, customerId, notes });
  const supabase = await createClient();
  slaughterId = parsed.slaughterId;
  customerId = parsed.customerId;
  notes = parsed.notes;

  const { data, error } = await supabase
    .from('customer_orders')
    .insert({
      slaughter_id: slaughterId,
      customer_id: customerId,
      status: 'draft',
      total_kg: 0,
      total_lines: 0,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating customer order:', error);
    throw new Error(`Failed to create order: ${error.message}`);
  }

  return data;
}

/**
 * Maak een order aan met meerdere regels in één keer.
 * Wave 10 D3: direct producten invullen bij order aanmaken.
 */
export async function createOrderWithLines(
  slaughterId: string,
  customerId: string,
  lines: { productId: string; quantityKg: number }[],
  notes?: string
): Promise<CustomerOrder> {
  const parsed = createOrderWithLinesSchema.parse({ slaughterId, customerId, lines, notes });
  const supabase = await createClient();

  // Check if an active order already exists for this customer + slaughter.
  // If so, append the new lines to the existing order instead of creating a new one.
  const { data: existingOrder } = await supabase
    .from('customer_orders')
    .select('id')
    .eq('slaughter_id', parsed.slaughterId)
    .eq('customer_id', parsed.customerId)
    .neq('status', 'cancelled')
    .maybeSingle();

  const orderId = existingOrder?.id;

  let order: CustomerOrder;

  if (orderId) {
    // Append to existing order
    const { data, error } = await supabase
      .from('customer_orders')
      .select()
      .eq('id', orderId)
      .single();
    if (error) throw new Error(`Fout bij ophalen bestaande order: ${error.message}`);
    order = data;

    // Update notes if provided
    if (parsed.notes) {
      const currentNotes = order.notes || '';
      const combined = currentNotes ? `${currentNotes}; ${parsed.notes}` : parsed.notes;
      await supabase.from('customer_orders').update({ notes: combined }).eq('id', orderId);
    }
  } else {
    // Create new order
    const { data, error: orderError } = await supabase
      .from('customer_orders')
      .insert({
        slaughter_id: parsed.slaughterId,
        customer_id: parsed.customerId,
        status: 'draft',
        total_kg: 0,
        total_lines: 0,
        notes: parsed.notes || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order with lines:', orderError);
      throw new Error(`Failed to create order: ${orderError.message}`);
    }
    order = data;
  }

  // Get current max sort_order for the order
  const { data: existingLines } = await supabase
    .from('order_lines')
    .select('sort_order')
    .eq('order_id', order.id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const startSortOrder = (existingLines?.[0]?.sort_order ?? -1) + 1;

  // Insert all new lines
  const lineInserts = parsed.lines.map((line, index) => ({
    order_id: order.id,
    product_id: line.productId,
    quantity_kg: line.quantityKg,
    sort_order: startSortOrder + index,
  }));

  const { error: linesError } = await supabase
    .from('order_lines')
    .insert(lineInserts);

  if (linesError) {
    console.error('Error inserting order lines:', linesError);
    throw new Error(`Regels konden niet worden toegevoegd: ${linesError.message}`);
  }

  // Recalculate totals
  await recalculateOrderTotals(order.id);

  return order;
}

/**
 * Voeg een orderregel toe en herbereken totalen
 */
export async function addOrderLine(
  orderId: string,
  productId: string,
  quantityKg: number
): Promise<OrderLine> {
  const parsed = addOrderLineSchema.parse({ orderId, productId, quantityKg });
  const supabase = await createClient();
  orderId = parsed.orderId;
  productId = parsed.productId;
  quantityKg = parsed.quantityKg;

  // Get current max sort_order
  const { data: existingLines } = await supabase
    .from('order_lines')
    .select('sort_order')
    .eq('order_id', orderId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextSortOrder = existingLines && existingLines.length > 0
    ? (existingLines[0].sort_order + 1)
    : 0;

  // Insert the line
  const { data: line, error: lineError } = await supabase
    .from('order_lines')
    .insert({
      order_id: orderId,
      product_id: productId,
      quantity_kg: quantityKg,
      sort_order: nextSortOrder,
    })
    .select()
    .single();

  if (lineError) {
    console.error('Error adding order line:', lineError);
    throw new Error(`Failed to add order line: ${lineError.message}`);
  }

  // Recalculate totals on parent order
  await recalculateOrderTotals(orderId);

  return line;
}

/**
 * Verwijder een orderregel en herbereken totalen
 */
export async function removeOrderLine(lineId: string): Promise<void> {
  const parsed = removeOrderLineSchema.parse({ lineId });
  const supabase = await createClient();
  lineId = parsed.lineId;

  // Get the order_id first
  const { data: lineData, error: fetchError } = await supabase
    .from('order_lines')
    .select('order_id')
    .eq('id', lineId)
    .single();

  if (fetchError) {
    console.error('Error fetching order line:', fetchError);
    throw new Error(`Failed to fetch order line: ${fetchError.message}`);
  }

  const orderId = lineData.order_id;

  // Delete the line
  const { error: deleteError } = await supabase
    .from('order_lines')
    .delete()
    .eq('id', lineId);

  if (deleteError) {
    console.error('Error removing order line:', deleteError);
    throw new Error(`Failed to remove order line: ${deleteError.message}`);
  }

  // Recalculate totals
  await recalculateOrderTotals(orderId);
}

/**
 * Update quantity on an existing order line
 */
export async function updateOrderLine(
  lineId: string,
  quantityKg: number
): Promise<void> {
  const parsed = updateOrderLineSchema.parse({ lineId, quantityKg });
  const supabase = await createClient();

  // Get order_id for total recalculation
  const { data: lineData, error: fetchError } = await supabase
    .from('order_lines')
    .select('order_id')
    .eq('id', parsed.lineId)
    .single();

  if (fetchError) throw new Error(`Failed to fetch order line: ${fetchError.message}`);

  // Update the quantity
  const { error: updateError } = await supabase
    .from('order_lines')
    .update({ quantity_kg: parsed.quantityKg })
    .eq('id', parsed.lineId);

  if (updateError) throw new Error(`Failed to update order line: ${updateError.message}`);

  // Recalculate parent order totals
  await recalculateOrderTotals(lineData.order_id);
}

/**
 * Verwijder een hele order inclusief alle bijbehorende orderregels.
 * Verwijdert eerst de regels (FK constraint) en daarna de order zelf.
 */
export async function deleteOrder(orderId: string): Promise<void> {
  const parsed = deleteOrderSchema.parse({ orderId });
  const supabase = await createClient();

  // Delete all order lines first (FK constraint)
  const { error: linesError } = await supabase
    .from('order_lines')
    .delete()
    .eq('order_id', parsed.orderId);

  if (linesError) {
    console.error('Error deleting order lines:', linesError);
    throw new Error(`Orderregels konden niet worden verwijderd: ${linesError.message}`);
  }

  // Delete the order itself
  const { error: orderError } = await supabase
    .from('customer_orders')
    .delete()
    .eq('id', parsed.orderId);

  if (orderError) {
    console.error('Error deleting order:', orderError);
    throw new Error(`Order kon niet worden verwijderd: ${orderError.message}`);
  }
}

/**
 * Herbereken total_kg en total_lines op een customer_order
 */
async function recalculateOrderTotals(orderId: string): Promise<void> {
  const supabase = await createClient();

  const { data: lines, error: linesError } = await supabase
    .from('order_lines')
    .select('quantity_kg')
    .eq('order_id', orderId);

  if (linesError) {
    console.error('Error fetching lines for totals:', linesError);
    return;
  }

  const totalKg = (lines || []).reduce(
    (sum: number, l: { quantity_kg: number }) => sum + l.quantity_kg,
    0
  );
  const totalLines = (lines || []).length;

  const { error: updateError } = await supabase
    .from('customer_orders')
    .update({ total_kg: totalKg, total_lines: totalLines })
    .eq('id', orderId);

  if (updateError) {
    console.error('Error updating order totals:', updateError);
  }
}

// ============================================================================
// SNAPSHOT CREATION (APPEND-ONLY)
// ============================================================================

/**
 * Maak een concept (draft) snapshot aan — APPEND-ONLY op order_schema_snapshots
 * Haalt alle orders + lines op, bouwt schema via engine, en voegt toe.
 */
export async function createDraftSnapshot(
  slaughterId: string
): Promise<OrderSchemaSnapshot> {
  const parsed = createDraftSnapshotSchema.parse({ slaughterId });
  const supabase = await createClient();
  slaughterId = parsed.slaughterId;

  // Fetch all orders with customer names
  const { data: orders, error: ordersError } = await supabase
    .from('customer_orders')
    .select('*, customers(name)')
    .eq('slaughter_id', slaughterId);

  if (ordersError) {
    console.error('Error fetching orders for snapshot:', ordersError);
    throw new Error(`Failed to fetch orders for snapshot: ${ordersError.message}`);
  }

  // Fetch order lines with product names for each order
  const orderInputs: BuildOrderSchemaInput[] = [];

  for (const order of orders || []) {
    const { data: lines, error: linesError } = await supabase
      .from('order_lines')
      .select('product_id, quantity_kg')
      .eq('order_id', order.id);

    if (linesError) {
      console.error('Error fetching lines for snapshot:', linesError);
      throw new Error(`Failed to fetch lines for snapshot: ${linesError.message}`);
    }

    const customers = order.customers as { name: string } | null;

    orderInputs.push({
      customer_id: order.customer_id,
      customer_name: customers?.name ?? 'Onbekend',
      lines: (lines || []).map((l: { product_id: string; quantity_kg: number }) => ({
        product_id: l.product_id,
        quantity_kg: l.quantity_kg,
      })),
    });
  }

  // Availability data for schema (empty until connected to cascade engine)
  const availability: OrderSchemaAvailability[] = [];

  // Build schema via engine
  const schemaData = buildOrderSchema(slaughterId, orderInputs, availability);

  // Get next version number
  const { data: versionData } = await supabase
    .from('order_schema_snapshots')
    .select('version')
    .eq('slaughter_id', slaughterId)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion =
    versionData && versionData.length > 0 ? versionData[0].version + 1 : 1;

  // INSERT snapshot (APPEND-ONLY — never UPDATE or DELETE)
  const { data: snapshot, error: snapshotError } = await supabase
    .from('order_schema_snapshots')
    .insert({
      slaughter_id: slaughterId,
      snapshot_type: 'draft',
      schema_data: schemaData,
      version: nextVersion,
      snapshot_date: new Date().toISOString().split('T')[0],
      notes: null,
    })
    .select()
    .single();

  if (snapshotError) {
    console.error('Error creating snapshot:', snapshotError);
    throw new Error(`Failed to create snapshot: ${snapshotError.message}`);
  }

  return snapshot;
}

// ============================================================================
// SNAPSHOT FINALIZATION (APPEND-ONLY)
// ============================================================================

/**
 * Finalize snapshot — creates NEW row with snapshot_type='finalized'
 * APPEND-ONLY: Does NOT update existing draft row.
 * Copies schema_data from latest draft and creates finalized version.
 */
export async function finalizeSnapshot(
  slaughterId: string,
  draftSnapshotId: string
): Promise<OrderSchemaSnapshot> {
  const parsed = finalizeSnapshotSchema.parse({ slaughterId, draftSnapshotId });
  const supabase = await createClient();
  slaughterId = parsed.slaughterId;
  draftSnapshotId = parsed.draftSnapshotId;

  // Fetch the draft snapshot to copy its schema_data
  const { data: draft, error: draftError } = await supabase
    .from('order_schema_snapshots')
    .select('*')
    .eq('id', draftSnapshotId)
    .single();

  if (draftError) throw new Error(`Failed to fetch draft: ${draftError.message}`);
  if (draft.snapshot_type === 'finalized') throw new Error('Snapshot is already finalized');

  // Get next version
  const { data: versionData } = await supabase
    .from('order_schema_snapshots')
    .select('version')
    .eq('slaughter_id', slaughterId)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = versionData && versionData.length > 0 ? versionData[0].version + 1 : 1;

  // INSERT new finalized row (APPEND-ONLY — never update draft)
  const { data: finalized, error } = await supabase
    .from('order_schema_snapshots')
    .insert({
      slaughter_id: slaughterId,
      snapshot_type: 'finalized',
      schema_data: draft.schema_data,
      version: nextVersion,
      snapshot_date: new Date().toISOString().split('T')[0],
      notes: `Finalized from draft v${draft.version}`,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to finalize: ${error.message}`);
  return finalized;
}
