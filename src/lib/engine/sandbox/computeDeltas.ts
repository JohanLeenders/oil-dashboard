/**
 * Compute Deltas Module
 *
 * Calculates differences between baseline and scenario waterfalls.
 */

import type { WaterfallResult, DeltaResult } from './types';

/**
 * Computes deltas between baseline and scenario waterfalls.
 *
 * @param baseline - Original waterfall
 * @param scenario - Recomputed waterfall with overrides
 * @returns Delta values for key metrics
 */
export function computeDeltas(
  baseline: WaterfallResult,
  scenario: WaterfallResult
): DeltaResult {
  // L0 deltas
  const l0_delta_eur = scenario.l0_landed_cost.landed_cost_eur - baseline.l0_landed_cost.landed_cost_eur;
  const l0_delta_pct = baseline.l0_landed_cost.landed_cost_eur > 0
    ? (l0_delta_eur / baseline.l0_landed_cost.landed_cost_eur) * 100
    : 0;

  // L1 deltas
  const l1_delta_eur = scenario.l1_joint_cost_pool.joint_cost_pool_eur - baseline.l1_joint_cost_pool.joint_cost_pool_eur;
  const l1_delta_pct = baseline.l1_joint_cost_pool.joint_cost_pool_eur > 0
    ? (l1_delta_eur / baseline.l1_joint_cost_pool.joint_cost_pool_eur) * 100
    : 0;

  // L2 deltas
  const l2_bp_delta_eur = scenario.l2_net_joint_cost.by_product_credit_eur - baseline.l2_net_joint_cost.by_product_credit_eur;
  const l2_net_delta_eur = scenario.l2_net_joint_cost.net_joint_cost_eur - baseline.l2_net_joint_cost.net_joint_cost_eur;
  const l2_net_delta_pct = baseline.l2_net_joint_cost.net_joint_cost_eur > 0
    ? (l2_net_delta_eur / baseline.l2_net_joint_cost.net_joint_cost_eur) * 100
    : 0;

  // L3 deltas
  const l3_k_delta = scenario.l3_svaso_allocation.k_factor - baseline.l3_svaso_allocation.k_factor;

  const l3_allocations = baseline.l3_svaso_allocation.allocations.map(base_alloc => {
    const scen_alloc = scenario.l3_svaso_allocation.allocations.find(
      a => a.part_code === base_alloc.part_code
    );

    if (!scen_alloc) {
      return {
        part_code: base_alloc.part_code,
        baseline_allocation_pct: base_alloc.allocation_factor * 100,
        scenario_allocation_pct: 0,
        delta_pp: -base_alloc.allocation_factor * 100,
        baseline_cost_per_kg: base_alloc.allocated_cost_per_kg,
        scenario_cost_per_kg: 0,
        delta_cost_per_kg: -base_alloc.allocated_cost_per_kg,
        delta_cost_per_kg_pct: -100,
      };
    }

    const base_pct = base_alloc.allocation_factor * 100;
    const scen_pct = scen_alloc.allocation_factor * 100;
    const delta_pp = scen_pct - base_pct;

    const delta_cost = scen_alloc.allocated_cost_per_kg - base_alloc.allocated_cost_per_kg;
    const delta_cost_pct = base_alloc.allocated_cost_per_kg > 0
      ? (delta_cost / base_alloc.allocated_cost_per_kg) * 100
      : 0;

    return {
      part_code: base_alloc.part_code,
      baseline_allocation_pct: base_pct,
      scenario_allocation_pct: scen_pct,
      delta_pp,
      baseline_cost_per_kg: base_alloc.allocated_cost_per_kg,
      scenario_cost_per_kg: scen_alloc.allocated_cost_per_kg,
      delta_cost_per_kg: delta_cost,
      delta_cost_per_kg_pct: delta_cost_pct,
    };
  });

  return {
    l0_landed_cost_delta_eur: l0_delta_eur,
    l0_landed_cost_delta_pct: l0_delta_pct,
    l1_joint_cost_pool_delta_eur: l1_delta_eur,
    l1_joint_cost_pool_delta_pct: l1_delta_pct,
    l2_by_product_credit_delta_eur: l2_bp_delta_eur,
    l2_net_joint_cost_delta_eur: l2_net_delta_eur,
    l2_net_joint_cost_delta_pct: l2_net_delta_pct,
    l3_k_factor_delta: l3_k_delta,
    l3_allocations,
  };
}
