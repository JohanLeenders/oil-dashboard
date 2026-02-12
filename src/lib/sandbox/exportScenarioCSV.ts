/**
 * Scenario CSV Export — Sprint 11A.4
 *
 * Client-side CSV export for scenario results.
 * Includes waterfall levels, SVASO allocations, and delta analysis.
 */

import type { ScenarioResult } from '@/lib/engine/scenario-sandbox';

/**
 * Exports scenario result to CSV file.
 * Downloads automatically via browser.
 */
export function exportScenarioCSV(
  result: ScenarioResult,
  scenarioName: string,
  batchRef: string
): void {
  if (!result.success || !result.scenario || !result.deltas) {
    throw new Error('Cannot export failed scenario');
  }

  const rows: string[][] = [];

  // Header
  rows.push(['OIL Dashboard - Scenario Analysis Export']);
  rows.push(['Scenario:', scenarioName]);
  rows.push(['Batch:', batchRef]);
  rows.push(['Computed:', new Date(result.meta.computed_at).toLocaleString('nl-NL')]);
  rows.push(['Engine:', result.meta.engine_version]);
  rows.push([]);

  // Disclaimer
  rows.push(['DISCLAIMER:', result.meta.disclaimer]);
  rows.push([]);

  // Mass Balance Check
  rows.push(['Mass Balance Validation']);
  rows.push(['Status', result.meta.mass_balance_check.valid ? 'VALID' : 'VIOLATED']);
  rows.push(['Griller Weight (kg)', result.meta.mass_balance_check.griller_kg.toFixed(2)]);
  rows.push(['Parts Total (kg)', result.meta.mass_balance_check.parts_total_kg.toFixed(2)]);
  rows.push(['Delta (kg)', result.meta.mass_balance_check.delta_kg.toFixed(2)]);
  rows.push(['Tolerance (kg)', result.meta.mass_balance_check.tolerance_kg.toFixed(2)]);
  rows.push([]);

  // Cost Waterfall Comparison
  rows.push(['Cost Waterfall - Baseline vs Scenario']);
  rows.push(['Level', 'Baseline (€)', 'Scenario (€)', 'Delta (€)', 'Delta (%)']);

  rows.push([
    'L0: Landed Cost',
    result.baseline!.l0_landed_cost.landed_cost_eur.toFixed(2),
    result.scenario.l0_landed_cost.landed_cost_eur.toFixed(2),
    result.deltas.l0_landed_cost_delta_eur.toFixed(2),
    result.deltas.l0_landed_cost_delta_pct.toFixed(2),
  ]);

  rows.push([
    'L1: Joint Cost Pool',
    result.baseline!.l1_joint_cost_pool.joint_cost_pool_eur.toFixed(2),
    result.scenario.l1_joint_cost_pool.joint_cost_pool_eur.toFixed(2),
    result.deltas.l1_joint_cost_pool_delta_eur.toFixed(2),
    result.deltas.l1_joint_cost_pool_delta_pct.toFixed(2),
  ]);

  rows.push([
    'L2: Net Joint Cost',
    result.baseline!.l2_net_joint_cost.net_joint_cost_eur.toFixed(2),
    result.scenario.l2_net_joint_cost.net_joint_cost_eur.toFixed(2),
    result.deltas.l2_net_joint_cost_delta_eur.toFixed(2),
    result.deltas.l2_net_joint_cost_delta_pct.toFixed(2),
  ]);

  rows.push([
    'L2: By-Product Credit',
    result.baseline!.l2_net_joint_cost.by_product_credit_eur.toFixed(2),
    result.scenario.l2_net_joint_cost.by_product_credit_eur.toFixed(2),
    result.deltas.l2_by_product_credit_delta_eur.toFixed(2),
    '-',
  ]);

  rows.push([
    'L3: k-factor',
    result.baseline!.l3_svaso_allocation.k_factor.toFixed(4),
    result.scenario.l3_svaso_allocation.k_factor.toFixed(4),
    result.deltas.l3_k_factor_delta.toFixed(4),
    '-',
  ]);

  rows.push([]);

  // SVASO Allocation Shifts
  rows.push(['SVASO Allocation Shifts']);
  rows.push(['Part', 'Baseline Alloc (%)', 'Scenario Alloc (%)', 'Delta (pp)', 'Baseline Cost/kg (€)', 'Scenario Cost/kg (€)', 'Delta Cost/kg (€)', 'Delta Cost/kg (%)']);

  for (const alloc of result.deltas.l3_allocations) {
    rows.push([
      alloc.part_code,
      alloc.baseline_allocation_pct.toFixed(2),
      alloc.scenario_allocation_pct.toFixed(2),
      alloc.delta_pp.toFixed(2),
      alloc.baseline_cost_per_kg.toFixed(2),
      alloc.scenario_cost_per_kg.toFixed(2),
      alloc.delta_cost_per_kg.toFixed(2),
      alloc.delta_cost_per_kg_pct.toFixed(2),
    ]);
  }

  // Convert to CSV string
  const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `scenario-${sanitizeFilename(scenarioName)}-${batchRef}-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Sanitizes a string for use in filenames.
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
