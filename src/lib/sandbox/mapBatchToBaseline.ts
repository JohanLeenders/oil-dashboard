/**
 * Batch to Baseline Mapper — Sprint 11A.4
 *
 * Maps getBatchDetail() output to BaselineBatchData format
 * required by the scenario sandbox engine.
 *
 * CRITICAL: This mapper ensures the sandbox baseline matches
 * the actual batch data displayed on batch detail pages.
 */

import type { BaselineBatchData } from '@/lib/engine/scenario-sandbox';
import type { BatchDetail } from '@/lib/actions/batches';
import type { JointProductInput, ByProductPhysical } from '@/lib/engine/canonical-cost';
import {
  calculateLandedCost,
  calculateJointCostPool,
  calculateByProductCredit,
  calculateSVASOAllocation,
} from '@/lib/engine/canonical-cost';

/**
 * Maps BatchDetail from getBatchDetail() to BaselineBatchData
 * for use in the scenario sandbox engine.
 */
export function mapBatchToBaseline(detail: BatchDetail): BaselineBatchData {
  const { batch, yields, costs } = detail;

  // Extract live bird cost
  const liveBirdCost = costs?.find(c => c.cost_type === 'live_bird_purchase');
  const live_price_per_kg = liveBirdCost
    ? liveBirdCost.amount / batch.live_weight_kg
    : 2.60; // Fallback default

  // Extract other costs
  const transportCost = costs?.find(c => c.cost_type === 'transport');
  const catchingCost = costs?.find(c => c.cost_type === 'catching');

  // Map yields to joint products and by-products
  const joint_products: JointProductInput[] = [];
  const by_products: ByProductPhysical[] = [];

  // Map yields data
  if (yields) {
    for (const yieldData of yields) {
      const part = yieldData.anatomical_part;
      const weight_kg = yieldData.actual_weight_kg;

      // Joint products (breast_cap, legs, wings)
      // NOTE: Database uses "leg_quarter" but canonical engine uses "legs"
      if (part === 'breast_cap' || part === 'leg_quarter' || part === 'wings') {
        const canonicalPartCode = part === 'leg_quarter' ? 'legs' : part;
        joint_products.push({
          part_code: canonicalPartCode as any,
          weight_kg,
          shadow_price_per_kg: getShadowPrice(canonicalPartCode), // Default shadow prices
        });
      }
      // By-products (back_carcass, offal)
      else if (part === 'back_carcass') {
        by_products.push({
          id: 'back',
          type: 'back_carcass',
          weight_kg,
        });
      }
      else if (part === 'offal') {
        by_products.push({
          id: 'offal',
          type: 'offal',
          weight_kg,
        });
      }
    }
  }

  // Add default by-products if not in yields (blood, feathers from slaughter)
  // These are removed during slaughter, not cut-up
  const bloodWeight = batch.live_weight_kg * 0.027; // ~2.7% of live weight
  const feathersWeight = batch.live_weight_kg * 0.047; // ~4.7% of live weight

  by_products.push(
    { id: 'blood', type: 'blood', weight_kg: bloodWeight },
    { id: 'feathers', type: 'feathers', weight_kg: feathersWeight }
  );

  // Prepare landed cost input
  const landedCostInput = {
    batch_id: batch.id,
    input_live_kg: batch.live_weight_kg,
    input_count: batch.bird_count,
    live_price_per_kg,
    transport_cost_eur: transportCost?.amount ?? 91.68, // Fallback
    catching_fee_eur: catchingCost?.amount ?? 50.00, // Fallback
    slaughter_fee_per_head: 0.276, // Default from canon
    doa_count: 0, // TODO: Get from batch data if available
    doa_threshold_pct: 0.02,
  };

  // Compute baseline waterfall using canonical engine
  const l0 = calculateLandedCost(landedCostInput);
  const slaughter_fee_eur = batch.bird_count * landedCostInput.slaughter_fee_per_head;
  const l1 = calculateJointCostPool(
    batch.id,
    l0,
    slaughter_fee_eur,
    batch.griller_weight_kg || 0
  );
  const l2 = calculateByProductCredit(batch.id, l1, by_products);
  const l3 = calculateSVASOAllocation(batch.id, l2, joint_products);

  // Construct BaselineBatchData
  const baseline: BaselineBatchData = {
    batch_id: batch.id,
    batch_ref: batch.batch_ref,
    live_weight_kg: batch.live_weight_kg,
    bird_count: batch.bird_count,
    griller_weight_kg: batch.griller_weight_kg || 0,
    griller_yield_pct: batch.griller_yield_pct || 0,
    live_price_per_kg,
    transport_cost_eur: landedCostInput.transport_cost_eur,
    catching_fee_eur: landedCostInput.catching_fee_eur,
    slaughter_fee_per_head: landedCostInput.slaughter_fee_per_head,
    doa_count: landedCostInput.doa_count,
    doa_threshold_pct: landedCostInput.doa_threshold_pct,
    joint_products,
    by_products,
    waterfall: {
      l0_landed_cost: l0,
      l1_joint_cost_pool: l1,
      l2_net_joint_cost: l2,
      l3_svaso_allocation: l3,
    },
  };

  return baseline;
}

/**
 * Get default shadow price for a part.
 * These are the canonical shadow prices from Sprint 8.
 */
function getShadowPrice(part: string): number {
  const shadowPrices: Record<string, number> = {
    breast_cap: 9.50,
    legs: 5.50, // Canonical code
    leg_quarter: 5.50, // Database alias
    wings: 4.50,
    back_carcass: 0.50,
  };
  return shadowPrices[part] ?? 5.00;
}
