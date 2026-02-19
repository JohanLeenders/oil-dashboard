'use server';
/**
 * Server Actions voor Dashboard Data (READ-ONLY)
 * Sprint: Wave 3 — A5-S3 Dashboard tiles
 *
 * REGRESSIE-CHECK:
 * - Reads slaughter_calendar + customer_orders
 * - No writes
 */
import { createClient } from '@/lib/supabase/server';

export interface OrderDashboardStats {
  next_slaughter_date: string | null;
  next_slaughter_id: string | null;
  draft_count: number;
  submitted_count: number;
  total_ordered_kg: number;
  total_slaughter_dates: number;
}

export async function getOrderDashboardStats(): Promise<OrderDashboardStats> {
  const supabase = await createClient();

  // Next upcoming slaughter date
  const today = new Date().toISOString().split('T')[0];
  const { data: nextSlaughter } = await supabase
    .from('slaughter_calendar')
    .select('id, slaughter_date')
    .gte('slaughter_date', today)
    .order('slaughter_date', { ascending: true })
    .limit(1);

  // Order counts by status
  const { data: orders } = await supabase
    .from('customer_orders')
    .select('status, total_kg');

  let draft_count = 0;
  let submitted_count = 0;
  let total_ordered_kg = 0;
  for (const o of orders || []) {
    if (o.status === 'draft') draft_count++;
    if (o.status === 'submitted') submitted_count++;
    total_ordered_kg += o.total_kg || 0;
  }

  // Total active slaughter dates
  const { count } = await supabase
    .from('slaughter_calendar')
    .select('*', { count: 'exact', head: true })
    .in('status', ['planned', 'orders_open']);

  return {
    next_slaughter_date: nextSlaughter?.[0]?.slaughter_date ?? null,
    next_slaughter_id: nextSlaughter?.[0]?.id ?? null,
    draft_count,
    submitted_count,
    total_ordered_kg,
    total_slaughter_dates: count ?? 0,
  };
}
