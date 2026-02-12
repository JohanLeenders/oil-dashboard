/**
 * Merge Overrides Module
 *
 * Applies scenario overrides (live price, yields, shadow prices) onto baseline data.
 */

import type {
  BaselineBatchData,
  ScenarioInput,
  MergedInput,
} from './types';

/**
 * Merges scenario overrides onto baseline data.
 *
 * Creates a deep copy of baseline inputs, then applies:
 * - live_price_per_kg override (if provided)
 * - yield_overrides (if provided)
 * - price_overrides (if provided)
 *
 * @param baseline - Original batch data
 * @param input - Scenario overrides
 * @returns Merged input ready for canonical engine
 */
export function mergeOverrides(
  baseline: BaselineBatchData,
  input: ScenarioInput
): MergedInput {
  // Deep clone to avoid mutation
  const merged: MergedInput = {
    batch_id: baseline.batch_id,
    landedCostInput: {
      batch_id: baseline.batch_id,
      input_live_kg: baseline.live_weight_kg,
      input_count: baseline.bird_count,
      live_price_per_kg: baseline.live_price_per_kg, // Will be overridden if input has it
      transport_cost_eur: baseline.transport_cost_eur,
      catching_fee_eur: baseline.catching_fee_eur,
      slaughter_fee_per_head: baseline.slaughter_fee_per_head,
      doa_count: baseline.doa_count,
      doa_threshold_pct: baseline.doa_threshold_pct,
    },
    slaughter_fee_eur: baseline.bird_count * baseline.slaughter_fee_per_head,
    griller_weight_kg: baseline.griller_weight_kg,
    by_products: [...baseline.by_products],
    joint_products: baseline.joint_products.map(jp => ({ ...jp })),
    sub_cuts: baseline.sub_cuts
      ? Object.fromEntries(
          Object.entries(baseline.sub_cuts).map(([key, subs]) => [
            key,
            subs.map(s => ({ ...s })),
          ])
        )
      : undefined,
    skus: baseline.skus?.map(sku => ({ ...sku })),
    nrv_inputs: baseline.nrv_inputs?.map(nrv => ({ ...nrv })),
    all_parts: [],
  };

  // Override 1: Live price
  if (input.live_price_per_kg !== undefined && input.live_price_per_kg !== null) {
    merged.landedCostInput.live_price_per_kg = input.live_price_per_kg;
  }

  // Override 2: Yields
  if (input.yield_overrides?.length) {
    for (const yo of input.yield_overrides) {
      // Check joint products
      const jp = merged.joint_products.find(p => p.part_code === yo.part_code);
      if (jp) {
        jp.weight_kg = yo.weight_kg;
        continue;
      }

      // Check by-products
      const bp = merged.by_products.find(p => p.id === yo.part_code || p.type === yo.part_code);
      if (bp) {
        bp.weight_kg = yo.weight_kg;
        continue;
      }

      // Check sub-cuts
      if (merged.sub_cuts) {
        for (const subs of Object.values(merged.sub_cuts)) {
          const sub = subs.find(s => s.sub_cut_code === yo.part_code);
          if (sub) {
            sub.weight_kg = yo.weight_kg;
            break;
          }
        }
      }
    }
  }

  // Override 3: Shadow prices
  if (input.price_overrides?.length) {
    for (const po of input.price_overrides) {
      // Check joint products
      const jp = merged.joint_products.find(p => p.part_code === po.part_code);
      if (jp) {
        jp.shadow_price_per_kg = po.price_per_kg;
        continue;
      }

      // Check sub-cuts
      if (merged.sub_cuts) {
        for (const subs of Object.values(merged.sub_cuts)) {
          const sub = subs.find(s => s.sub_cut_code === po.part_code);
          if (sub) {
            sub.shadow_price_per_kg = po.price_per_kg;
            break;
          }
        }
      }

      // Check NRV inputs (selling price override)
      if (merged.nrv_inputs) {
        const nrv = merged.nrv_inputs.find(n => n.product_code === po.part_code);
        if (nrv) {
          nrv.selling_price_per_kg = po.price_per_kg;
        }
      }
    }
  }

  // Build all_parts for mass balance validation
  // Only include parts that come FROM the griller (cut-up parts)
  // Do NOT include slaughter by-products (blood, feathers) - those were removed BEFORE griller
  // DO include back_carcass - that comes from cutting up the griller
  merged.all_parts = [
    ...merged.joint_products.map(jp => ({ part_code: jp.part_code, weight_kg: jp.weight_kg })),
    ...merged.by_products
      .filter(bp => bp.type === 'back_carcass' || bp.type === 'offal')
      .map(bp => ({ part_code: bp.id, weight_kg: bp.weight_kg })),
  ];

  return merged;
}
