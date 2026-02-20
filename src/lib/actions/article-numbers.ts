'use server';

import { createClient } from '@/lib/supabase/server';
import type { ProductArticleNumber } from '@/types/database';

/**
 * Get article numbers for a list of product IDs
 */
export async function getArticleNumbersForProducts(
  productIds: string[]
): Promise<ProductArticleNumber[]> {
  if (productIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('product_article_numbers')
    .select('*')
    .in('product_id', productIds);

  if (error) throw new Error(`Failed to fetch article numbers: ${error.message}`);
  return (data ?? []) as ProductArticleNumber[];
}

/**
 * Get article numbers by location, joined with product description
 */
export async function getArticleNumbersByLocation(
  location: 'putten' | 'nijkerk'
): Promise<(ProductArticleNumber & { product_description: string })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('product_article_numbers')
    .select('*, products(description)')
    .eq('location', location);

  if (error) throw new Error(`Failed to fetch article numbers by location: ${error.message}`);

  return ((data ?? []) as Array<ProductArticleNumber & { products: { description: string } }>).map(
    (row) => ({
      ...row,
      product_description: row.products?.description ?? '',
      products: undefined as never,
    })
  );
}
