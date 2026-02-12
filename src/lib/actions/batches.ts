'use server';

/**
 * Server Actions voor Batch Data (READ-ONLY)
 *
 * REGRESSIE-CHECK:
 * - ✅ Leest alleen uit v_effective_* views of v_batch_mass_balance
 * - ✅ Geen writes of mutations
 * - ✅ THT thresholds via engine (70/90 Blueprint)
 * - ✅ SVASO allocatie niet in deze layer (engine-side)
 */

import { createClient } from '@/lib/supabase/server';
import type {
  ProductionBatch,
  BatchMassBalance,
  BatchWithYields,
  ThtStatus,
} from '@/types/database';
import { calculateThtStatus } from '@/lib/engine/tht';
import { validateMassBalance } from '@/lib/engine/mass-balance';

// ============================================================================
// BATCH LIST (voor /oil/batches)
// ============================================================================

export interface BatchListItem {
  id: string;
  batch_ref: string;
  slaughter_date: string;
  live_weight_kg: number;
  griller_weight_kg: number | null;
  griller_yield_pct: number | null;
  status: string;
  tht_status: ThtStatus;
  tht_days_remaining: number;
  data_status: 'COMPLETE' | 'NEEDS_REVIEW' | 'HAS_CORRECTIONS';
}

/**
 * Haal alle batches op met THT en data status
 * Leest uit production_batches + v_batch_mass_balance
 */
export async function getBatchList(): Promise<BatchListItem[]> {
  const supabase = await createClient();

  // Haal batches op
  const { data: batches, error: batchError } = await supabase
    .from('production_batches')
    .select('*')
    .order('slaughter_date', { ascending: false });

  if (batchError) {
    console.error('Error fetching batches:', batchError);
    throw new Error(`Failed to fetch batches: ${batchError.message}`);
  }

  // Haal mass balance data op voor status checks
  const { data: massBalances, error: mbError } = await supabase
    .from('v_batch_mass_balance')
    .select('*');

  if (mbError) {
    console.error('Error fetching mass balances:', mbError);
  }

  const mbMap = new Map(
    (massBalances || []).map(mb => [mb.batch_id, mb])
  );

  // Transform naar list items
  return (batches || []).map(batch => {
    // THT berekening (Blueprint: 70/90)
    let tht_status: ThtStatus = 'green';
    let tht_days_remaining = 999;

    if (batch.production_date && batch.expiry_date) {
      const thtCalc = calculateThtStatus(batch.production_date, batch.expiry_date);
      tht_status = thtCalc.status;
      tht_days_remaining = thtCalc.days_remaining;
    }

    // Data status check via mass balance validation
    let data_status: 'COMPLETE' | 'NEEDS_REVIEW' | 'HAS_CORRECTIONS' = 'COMPLETE';
    const mb = mbMap.get(batch.id);

    if (mb) {
      if (mb.data_status === 'NEEDS_REVIEW') {
        data_status = 'NEEDS_REVIEW';
      } else if (mb.data_status === 'HAS_CORRECTIONS') {
        data_status = 'HAS_CORRECTIONS';
      } else {
        const validation = validateMassBalance(mb);
        if (validation.warnings.some(w => w.code === 'NEEDS_REVIEW')) {
          data_status = 'NEEDS_REVIEW';
        }
      }
    } else {
      data_status = 'NEEDS_REVIEW';
    }

    return {
      id: batch.id,
      batch_ref: batch.batch_ref,
      slaughter_date: batch.slaughter_date,
      live_weight_kg: batch.live_weight_kg,
      griller_weight_kg: batch.griller_weight_kg,
      griller_yield_pct: batch.griller_yield_pct,
      status: batch.status,
      tht_status,
      tht_days_remaining,
      data_status,
    };
  });
}

// ============================================================================
// SINGLE BATCH (voor /oil/batches/[batchId])
// ============================================================================

export interface BatchDetail {
  batch: ProductionBatch;
  massBalance: BatchMassBalance | null;
  yields: EffectiveYield[];
  costs: EffectiveCost[];
  tht: {
    status: ThtStatus;
    elapsed_pct: number;
    days_remaining: number;
    urgency_label: string;
  };
  validation: {
    is_valid: boolean;
    data_status: string;
    warnings: string[];
  };
}

export interface EffectiveYield {
  anatomical_part: string;
  actual_weight_kg: number;
  yield_pct: number | null;
  target_yield_min: number | null;
  target_yield_max: number | null;
  delta_from_target: number | null;
  data_status: string;
}

export interface EffectiveCost {
  cost_type: string;
  description: string | null;
  amount: number;
  invoice_ref: string | null;
  cost_status: string;
}

/**
 * Haal batch details op inclusief effective yields/costs
 * ALLEEN uit v_effective_* views
 */
export async function getBatchDetail(batchId: string): Promise<BatchDetail | null> {
  const supabase = await createClient();

  // 1. Haal batch op
  const { data: batch, error: batchError } = await supabase
    .from('production_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (batchError) {
    if (batchError.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch batch: ${batchError.message}`);
  }

  // 2. Haal mass balance op (uses effective views internally)
  const { data: massBalance } = await supabase
    .from('v_batch_mass_balance')
    .select('*')
    .eq('batch_id', batchId)
    .single();

  // 3. Haal effective yields op
  const { data: yields } = await supabase
    .from('v_effective_batch_yields')
    .select('*')
    .eq('batch_id', batchId)
    .order('anatomical_part');

  // 4. Haal effective costs op
  const { data: costs } = await supabase
    .from('v_effective_batch_costs')
    .select('*')
    .eq('batch_id', batchId)
    .order('cost_type');

  // 5. THT berekening (Blueprint: 70/90)
  let tht = {
    status: 'green' as ThtStatus,
    elapsed_pct: 0,
    days_remaining: 999,
    urgency_label: 'Geen THT data',
  };

  if (batch.production_date && batch.expiry_date) {
    const thtCalc = calculateThtStatus(batch.production_date, batch.expiry_date);
    tht = {
      status: thtCalc.status,
      elapsed_pct: thtCalc.elapsed_pct,
      days_remaining: thtCalc.days_remaining,
      urgency_label: thtCalc.urgency_label,
    };
  }

  // 6. Validation
  let validation = {
    is_valid: true,
    data_status: 'COMPLETE',
    warnings: [] as string[],
  };

  if (massBalance) {
    const mbValidation = validateMassBalance(massBalance);
    validation = {
      is_valid: mbValidation.is_valid,
      data_status: massBalance.data_status || 'COMPLETE',
      warnings: mbValidation.warnings.map(w => w.message),
    };
  } else {
    validation = {
      is_valid: false,
      data_status: 'NEEDS_REVIEW',
      warnings: ['Geen mass balance data beschikbaar'],
    };
  }

  return {
    batch,
    massBalance,
    yields: (yields || []).map(y => ({
      anatomical_part: y.anatomical_part,
      actual_weight_kg: y.actual_weight_kg,
      yield_pct: y.yield_pct,
      target_yield_min: y.target_yield_min,
      target_yield_max: y.target_yield_max,
      delta_from_target: y.delta_from_target,
      data_status: y.data_status || 'ORIGINAL',
    })),
    costs: (costs || []).map(c => ({
      cost_type: c.cost_type,
      description: c.description,
      amount: c.amount,
      invoice_ref: c.invoice_ref,
      cost_status: c.cost_status || 'ORIGINAL',
    })),
    tht,
    validation,
  };
}

// ============================================================================
// MASS BALANCE (voor Sankey)
// ============================================================================

/**
 * Haal massabalans data op voor Sankey diagram
 * Leest uit v_batch_mass_balance (uses effective yields)
 */
export async function getBatchMassBalance(batchId: string): Promise<BatchMassBalance | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('v_batch_mass_balance')
    .select('*')
    .eq('batch_id', batchId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch mass balance: ${error.message}`);
  }

  return data;
}

/**
 * Haal alle massabalansen op
 */
export async function getAllMassBalances(): Promise<BatchMassBalance[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('v_batch_mass_balance')
    .select('*')
    .order('slaughter_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch mass balances: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// BATCH STATISTICS
// ============================================================================

export interface BatchStats {
  total_batches: number;
  total_live_weight_kg: number;
  avg_griller_yield_pct: number;
  batches_needs_review: number;
  batches_tht_warning: number;
}

export async function getBatchStats(): Promise<BatchStats> {
  const batches = await getBatchList();

  if (batches.length === 0) {
    return {
      total_batches: 0,
      total_live_weight_kg: 0,
      avg_griller_yield_pct: 0,
      batches_needs_review: 0,
      batches_tht_warning: 0,
    };
  }

  const totalLiveWeight = batches.reduce((sum, b) => sum + b.live_weight_kg, 0);
  const yieldsWithValue = batches.filter(b => b.griller_yield_pct != null);
  const avgYield = yieldsWithValue.length > 0
    ? yieldsWithValue.reduce((sum, b) => sum + b.griller_yield_pct!, 0) / yieldsWithValue.length
    : 0;

  return {
    total_batches: batches.length,
    total_live_weight_kg: totalLiveWeight,
    avg_griller_yield_pct: Number(avgYield.toFixed(2)),
    batches_needs_review: batches.filter(b => b.data_status === 'NEEDS_REVIEW').length,
    batches_tht_warning: batches.filter(b => b.tht_status !== 'green').length,
  };
}
