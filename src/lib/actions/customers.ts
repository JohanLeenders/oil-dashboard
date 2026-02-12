'use server';

/**
 * Server Actions voor Customer/Cherry-Picker Data (READ-ONLY)
 *
 * REGRESSIE-CHECK:
 * - ✅ Read-only queries
 * - ✅ Cherry-picker detectie via engine (30% threshold)
 * - ✅ SVASO-based profitability via engine
 * - ✅ Geen mutations
 *
 * Sprint 1: Added profitability analysis with SVASO costs
 */

import { createClient } from '@/lib/supabase/server';
import {
  analyzeCherryPicker,
  type CherryPickerAnalysis,
  type CustomerProductMix,
} from '@/lib/engine/cherry-picker';
import {
  calculateCustomerProfitability,
  combineCustomerAnalysis,
  type CustomerProfitability,
  type CustomerSalesLine,
  type CustomerProfitabilityComplete,
} from '@/lib/engine/customer-profitability';
import { logSupabaseError } from '@/lib/utils/errors';

// ============================================================================
// TYPE DEFINITIONS FOR SUPABASE QUERY RESPONSES
// ============================================================================

/**
 * Type for sales_transactions with product join
 * Matches Supabase query: .select('..., product:products(category)')
 *
 * Note: category is typed as ProductCategory to match engine expectations.
 * The database stores this as a string enum matching ProductCategory values.
 */
interface SalesWithProduct {
  customer_id: string | null;
  quantity_kg: number;
  line_total: number;
  product: {
    category: import('@/types/database').ProductCategory;
  } | null;
}

/**
 * Type for sales_transactions with product join for profitability analysis
 * Matches Supabase query with additional fields for cost allocation
 */
interface ProfitabilitySalesLine {
  customer_id: string | null;
  invoice_date: string;
  quantity_kg: number;
  line_total: number;
  allocated_cost: number | null;
  product: {
    category: import('@/types/database').ProductCategory;
  } | null;
}

/**
 * Type for customer detail sales with full product info
 * Used in getCustomerProfitabilityDetail
 */
interface DetailSalesLine {
  id: string;
  invoice_number: string;
  invoice_date: string;
  quantity_kg: number;
  unit_price: number;
  line_total: number;
  allocated_cost: number | null;
  gross_margin: number | null;
  product: {
    category: import('@/types/database').ProductCategory;
    description: string;
  } | null;
}

// ============================================================================
// CUSTOMER LIST WITH ANALYSIS
// ============================================================================

export interface CustomerWithAnalysis {
  id: string;
  customer_code: string;
  name: string;
  segment: string | null;
  is_active: boolean;
  total_revenue_ytd: number;
  analysis: CherryPickerAnalysis;
}

/**
 * Haal alle klanten op met cherry-picker analyse
 * Gesorteerd op slechtste balance score eerst
 */
export async function getCustomersWithAnalysis(): Promise<CustomerWithAnalysis[]> {
  const supabase = await createClient();

  // 1. Haal klanten op
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (custError) {
    throw new Error(`Failed to fetch customers: ${custError.message}`);
  }

  // 2. Haal sales data per klant
  const { data: salesData, error: salesError } = await supabase
    .from('sales_transactions')
    .select(`
      customer_id,
      quantity_kg,
      line_total,
      product:products(category)
    `)
    .eq('is_credit', false);

  if (salesError) {
    logSupabaseError(salesError, 'Error fetching sales');
  }

  // 3. Aggregeer per klant/categorie
  const customerMixMap = new Map<string, CustomerProductMix[]>();

  // Type assertion: salesData matches SalesWithProduct[] based on select query
  const typedSalesData = salesData as SalesWithProduct[] | null;

  for (const sale of typedSalesData || []) {
    if (!sale.customer_id || !sale.product) continue;

    const category = sale.product.category;
    if (!category) continue;

    const mix = customerMixMap.get(sale.customer_id) || [];
    const existing = mix.find(m => m.category === category);

    if (existing) {
      existing.quantity_kg += sale.quantity_kg;
      existing.revenue += sale.line_total;
    } else {
      mix.push({
        category,
        quantity_kg: sale.quantity_kg,
        revenue: sale.line_total,
      });
    }

    customerMixMap.set(sale.customer_id, mix);
  }

  // 4. Run analysis per klant
  const results: CustomerWithAnalysis[] = [];

  for (const customer of customers || []) {
    const productMix = customerMixMap.get(customer.id) || [];
    const analysis = analyzeCherryPicker(
      customer.id,
      customer.name,
      productMix
    );

    results.push({
      id: customer.id,
      customer_code: customer.customer_code,
      name: customer.name,
      segment: customer.segment,
      is_active: customer.is_active,
      total_revenue_ytd: customer.total_revenue_ytd,
      analysis,
    });
  }

  // 5. Sorteer op balance score (laagste eerst = slechtste)
  return results.sort((a, b) => {
    // Cherry pickers first
    if (a.analysis.is_cherry_picker && !b.analysis.is_cherry_picker) return -1;
    if (!a.analysis.is_cherry_picker && b.analysis.is_cherry_picker) return 1;
    // Then by balance score (lower = worse)
    return a.analysis.balance_score - b.analysis.balance_score;
  });
}

/**
 * Haal één klant op met volledige analyse
 */
export async function getCustomerDetail(customerId: string): Promise<CustomerWithAnalysis | null> {
  const supabase = await createClient();

  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch customer: ${error.message}`);
  }

  // Haal sales data
  const { data: salesData } = await supabase
    .from('sales_transactions')
    .select(`
      quantity_kg,
      line_total,
      product:products(category)
    `)
    .eq('customer_id', customerId)
    .eq('is_credit', false);

  // Aggregeer per categorie
  const productMix: CustomerProductMix[] = [];
  const categoryMap = new Map<string, CustomerProductMix>();

  // Type assertion: salesData matches SalesWithProduct[] based on select query
  const typedSalesData = salesData as SalesWithProduct[] | null;

  for (const sale of typedSalesData || []) {
    const category = sale.product?.category;
    if (!category) continue;

    const existing = categoryMap.get(category);
    if (existing) {
      existing.quantity_kg += sale.quantity_kg;
      existing.revenue += sale.line_total;
    } else {
      const newMix = {
        category,
        quantity_kg: sale.quantity_kg,
        revenue: sale.line_total,
      };
      categoryMap.set(category, newMix);
      productMix.push(newMix);
    }
  }

  const analysis = analyzeCherryPicker(customer.id, customer.name, productMix);

  return {
    id: customer.id,
    customer_code: customer.customer_code,
    name: customer.name,
    segment: customer.segment,
    is_active: customer.is_active,
    total_revenue_ytd: customer.total_revenue_ytd,
    analysis,
  };
}

// ============================================================================
// STATISTICS
// ============================================================================

export interface CustomerStats {
  total_customers: number;
  cherry_pickers: number;
  avg_balance_score: number;
  total_opportunity_cost: number;
}

export async function getCustomerStats(): Promise<CustomerStats> {
  const customers = await getCustomersWithAnalysis();

  if (customers.length === 0) {
    return {
      total_customers: 0,
      cherry_pickers: 0,
      avg_balance_score: 100,
      total_opportunity_cost: 0,
    };
  }

  const cherryPickers = customers.filter(c => c.analysis.is_cherry_picker);
  const avgScore = customers.reduce((sum, c) => sum + c.analysis.balance_score, 0) / customers.length;
  const totalOpportunityCost = customers.reduce((sum, c) => sum + c.analysis.opportunity_cost, 0);

  return {
    total_customers: customers.length,
    cherry_pickers: cherryPickers.length,
    avg_balance_score: Number(avgScore.toFixed(0)),
    total_opportunity_cost: Number(totalOpportunityCost.toFixed(2)),
  };
}

// ============================================================================
// CUSTOMER PROFITABILITY (Sprint 1)
// ============================================================================

export interface CustomerDetailWithProfitability {
  id: string;
  customer_code: string;
  name: string;
  segment: string | null;
  is_active: boolean;
  total_revenue_ytd: number;
  /** Cherry-picker analysis */
  cherry_picker_analysis: CherryPickerAnalysis;
  /** SVASO-based profitability */
  profitability: CustomerProfitability;
  /** Combined health assessment */
  combined: CustomerProfitabilityComplete;
  /** Recent sales transactions for detail view */
  recent_sales: Array<{
    invoice_number: string;
    invoice_date: string;
    category: string;
    quantity_kg: number;
    revenue: number;
    allocated_cost: number | null;
    margin: number | null;
  }>;
}

/**
 * Haal één klant op met volledige profitability analyse
 * Inclusief SVASO-based margin en cherry-picker status
 */
export async function getCustomerProfitabilityDetail(
  customerId: string
): Promise<CustomerDetailWithProfitability | null> {
  const supabase = await createClient();

  // 1. Fetch customer
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch customer: ${error.message}`);
  }

  // 2. Fetch sales transactions with product and allocated cost
  const { data: salesData } = await supabase
    .from('sales_transactions')
    .select(`
      id,
      invoice_number,
      invoice_date,
      quantity_kg,
      unit_price,
      line_total,
      allocated_cost,
      gross_margin,
      product:products(category, description)
    `)
    .eq('customer_id', customerId)
    .eq('is_credit', false)
    .order('invoice_date', { ascending: false });

  // 3. Build product mix for cherry-picker analysis
  const productMix: CustomerProductMix[] = [];
  const mixMap = new Map<string, CustomerProductMix>();

  // 4. Build sales lines for profitability analysis
  const salesLines: CustomerSalesLine[] = [];

  // Type assertion: salesData matches DetailSalesLine[] based on select query
  const typedSalesData = salesData as DetailSalesLine[] | null;

  for (const sale of typedSalesData || []) {
    const category = sale.product?.category;
    if (!category) continue;

    // Aggregate for cherry-picker
    const existing = mixMap.get(category);
    if (existing) {
      existing.quantity_kg += sale.quantity_kg;
      existing.revenue += sale.line_total;
    } else {
      const newMix = {
        category,
        quantity_kg: sale.quantity_kg,
        revenue: sale.line_total,
      };
      mixMap.set(category, newMix);
      productMix.push(newMix);
    }

    // Add to sales lines (use allocated_cost if available, otherwise estimate)
    salesLines.push({
      category,
      quantity_kg: sale.quantity_kg,
      revenue: sale.line_total,
      allocated_cost: sale.allocated_cost ?? sale.line_total * 0.7, // Fallback 30% margin estimate
      invoice_date: sale.invoice_date,
    });
  }

  // 5. Run analyses
  const cherryPickerAnalysis = analyzeCherryPicker(
    customer.id,
    customer.name,
    productMix
  );

  const profitability = calculateCustomerProfitability(
    customer.id,
    customer.name,
    salesLines
  );

  const combined = combineCustomerAnalysis(profitability, cherryPickerAnalysis);

  // 6. Format recent sales
  const recentSales = (typedSalesData || []).slice(0, 20).map(sale => {
    return {
      invoice_number: sale.invoice_number,
      invoice_date: sale.invoice_date,
      category: sale.product?.category || 'unknown',
      quantity_kg: sale.quantity_kg,
      revenue: sale.line_total,
      allocated_cost: sale.allocated_cost,
      margin: sale.gross_margin,
    };
  });

  return {
    id: customer.id,
    customer_code: customer.customer_code,
    name: customer.name,
    segment: customer.segment,
    is_active: customer.is_active,
    total_revenue_ytd: customer.total_revenue_ytd,
    cherry_picker_analysis: cherryPickerAnalysis,
    profitability,
    combined,
    recent_sales: recentSales,
  };
}

/**
 * Get all customers with profitability summary for dashboard
 */
export interface CustomerProfitabilitySummary {
  id: string;
  customer_code: string;
  name: string;
  segment: string | null;
  total_revenue: number;
  total_margin: number;
  margin_pct: number;
  balance_score: number;
  is_cherry_picker: boolean;
  profitability_status: 'healthy' | 'marginal' | 'unprofitable';
  priority_rank: 'high' | 'medium' | 'low';
  combined_health_score: number;
}

export async function getCustomerProfitabilitySummaries(): Promise<CustomerProfitabilitySummary[]> {
  const supabase = await createClient();

  // 1. Fetch customers
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (custError) {
    throw new Error(`Failed to fetch customers: ${custError.message}`);
  }

  // 2. Fetch all sales with costs
  const { data: salesData } = await supabase
    .from('sales_transactions')
    .select(`
      customer_id,
      invoice_date,
      quantity_kg,
      line_total,
      allocated_cost,
      product:products(category)
    `)
    .eq('is_credit', false);

  // 3. Build per-customer data structures
  const customerSalesMap = new Map<string, CustomerSalesLine[]>();
  const customerMixMap = new Map<string, CustomerProductMix[]>();

  // Type assertion: salesData matches ProfitabilitySalesLine[] based on select query
  const typedSalesData = salesData as ProfitabilitySalesLine[] | null;

  for (const sale of typedSalesData || []) {
    if (!sale.customer_id) continue;
    const category = sale.product?.category;
    if (!category) continue;

    // Sales lines
    const lines = customerSalesMap.get(sale.customer_id) || [];
    lines.push({
      category,
      quantity_kg: sale.quantity_kg,
      revenue: sale.line_total,
      allocated_cost: sale.allocated_cost ?? sale.line_total * 0.7,
      invoice_date: sale.invoice_date,
    });
    customerSalesMap.set(sale.customer_id, lines);

    // Product mix
    const mix = customerMixMap.get(sale.customer_id) || [];
    const existing = mix.find(m => m.category === category);
    if (existing) {
      existing.quantity_kg += sale.quantity_kg;
      existing.revenue += sale.line_total;
    } else {
      mix.push({ category, quantity_kg: sale.quantity_kg, revenue: sale.line_total });
    }
    customerMixMap.set(sale.customer_id, mix);
  }

  // 4. Analyze each customer
  const summaries: CustomerProfitabilitySummary[] = [];

  for (const customer of customers || []) {
    const salesLines = customerSalesMap.get(customer.id) || [];
    const productMix = customerMixMap.get(customer.id) || [];

    const cherryAnalysis = analyzeCherryPicker(customer.id, customer.name, productMix);
    const profitability = calculateCustomerProfitability(customer.id, customer.name, salesLines);
    const combined = combineCustomerAnalysis(profitability, cherryAnalysis);

    summaries.push({
      id: customer.id,
      customer_code: customer.customer_code,
      name: customer.name,
      segment: customer.segment,
      total_revenue: profitability.total_revenue,
      total_margin: profitability.total_gross_margin,
      margin_pct: profitability.margin_pct,
      balance_score: cherryAnalysis.balance_score,
      is_cherry_picker: cherryAnalysis.is_cherry_picker,
      profitability_status: profitability.profitability_status,
      priority_rank: combined.priority_rank,
      combined_health_score: combined.combined_health_score,
    });
  }

  // 5. Sort by priority (high first), then by health score (lowest first)
  return summaries.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const aPriority = priorityOrder[a.priority_rank];
    const bPriority = priorityOrder[b.priority_rank];
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.combined_health_score - b.combined_health_score;
  });
}
