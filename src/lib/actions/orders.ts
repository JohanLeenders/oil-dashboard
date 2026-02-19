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
} from '@/types/database';
import { buildOrderSchema } from '@/lib/engine/orders';
import type { BuildOrderSchemaInput } from '@/lib/engine/orders';
import {
  createCustomerOrderSchema,
  addOrderLineSchema,
  removeOrderLineSchema,
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
 * Haal orders op voor een specifieke slachtdatum
 */
export async function getOrdersForSlaughter(
  slaughterId: string
): Promise<(CustomerOrder & { customer_name: string })[]> {
  const parsed = getOrdersForSlaughterSchema.parse({ slaughterId });
  const supabase = await createClient();
  slaughterId = parsed.slaughterId;

  const { data, error } = await supabase
    .from('customer_orders')
    .select('*, customers(name)')
    .eq('slaughter_id', slaughterId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders for slaughter:', error);
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return (data || []).map((row) => {
    const typed = row as Record<string, unknown> & {
      customers?: { name: string } | null;
    };
    const customerName = typed.customers?.name ?? 'Onbekend';
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
    } as CustomerOrder & { customer_name: string };
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
    .select('*, products(name)')
    .eq('order_id', orderId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching order lines:', error);
    throw new Error(`Failed to fetch order lines: ${error.message}`);
  }

  return (data || []).map((row) => {
    const typed = row as Record<string, unknown> & {
      products?: { name: string } | null;
    };
    const productName = typed.products?.name ?? 'Onbekend product';
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
 */
export async function getProductsForSelect(): Promise<
  { id: string; name: string }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('products')
    .select('id, name:description')
    .eq('is_active', true)
    .order('description', { ascending: true });

  if (error) {
    console.error('Error fetching products:', error);
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return data || [];
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

  // Wave 2 stub: availability is empty
  const availability: never[] = [];

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
