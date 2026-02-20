'use server';

import { createClient } from '@/lib/supabase/server';
import type { CustomerDeliveryInfo } from '@/types/database';

/**
 * Get delivery info for a list of customer IDs, joined with customer name
 */
export async function getDeliveryInfoForCustomers(
  customerIds: string[]
): Promise<(CustomerDeliveryInfo & { customer_name: string })[]> {
  if (customerIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customer_delivery_info')
    .select('*, customers(name)')
    .in('customer_id', customerIds);

  if (error) throw new Error(`Failed to fetch delivery info: ${error.message}`);

  return ((data ?? []) as Array<CustomerDeliveryInfo & { customers: { name: string } }>).map(
    (row) => ({
      ...row,
      customer_name: row.customers?.name ?? '',
      customers: undefined as never,
    })
  );
}

/**
 * Upsert delivery info for a customer (create or update)
 */
export async function upsertDeliveryInfo(
  customerId: string,
  data: Partial<Omit<CustomerDeliveryInfo, 'id' | 'customer_id' | 'created_at' | 'updated_at'>>
): Promise<CustomerDeliveryInfo> {
  const supabase = await createClient();
  const { data: result, error } = await supabase
    .from('customer_delivery_info')
    .upsert(
      { customer_id: customerId, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'customer_id' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert delivery info: ${error.message}`);
  return result as CustomerDeliveryInfo;
}
