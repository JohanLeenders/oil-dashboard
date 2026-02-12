/**
 * Node Cost Allocation — Sprint 11B.1
 *
 * Allocates variable + fixed costs to node outputs using yield-proportional method.
 *
 * CRITICAL CONSTRAINTS:
 * - Uses Decimal.js for ALL arithmetic (no float drift)
 * - Allocates by output share of TOTAL_OUTPUT_YIELD (not /100)
 * - Enforces reconciliation invariant: Σ(allocated) == total within 0.01 EUR
 * - loss_pct is DERIVED: 100 - Σ(output.yield_pct)
 */

import Decimal from 'decimal.js';
import type { ProcessNode, NodeExecutionResult, NodeOutputAllocation } from './types';
import { ALLOCATION_RECONCILIATION_TOLERANCE_EUR } from './types';

/**
 * Computes node costs and allocates to outputs.
 *
 * @param node - The process node definition
 * @param input_kg - Input weight in kg
 * @returns Node execution result with allocated costs
 */
export function allocateNodeCosts(node: ProcessNode, input_kg: number): NodeExecutionResult {
  // Use Decimal.js for precision
  const inputKg = new Decimal(input_kg);

  // Compute total output yield (loss is derived as residual)
  const totalOutputYieldPct = node.outputs.reduce((sum, o) => sum + o.yield_pct, 0);
  const total_output_yield_pct_decimal = new Decimal(totalOutputYieldPct);
  const loss_pct = 100 - totalOutputYieldPct;

  // Compute output weight
  const output_kg_decimal = inputKg.times(total_output_yield_pct_decimal).dividedBy(100);
  const loss_kg_decimal = inputKg.times(loss_pct).dividedBy(100);

  // Apply costs
  const variable_cost_eur_decimal = output_kg_decimal.times(node.variable_cost_per_kg);
  const fixed_cost_eur_decimal = new Decimal(node.fixed_cost_per_execution);
  const total_node_cost_eur_decimal = variable_cost_eur_decimal.plus(fixed_cost_eur_decimal);

  // Allocate to outputs based on their share of TOTAL_OUTPUT_YIELD (not /100)
  // This ensures costs are allocated by actual output kg, not input kg
  const output_allocations: NodeOutputAllocation[] = [];
  let cumulative_allocated = new Decimal(0);

  for (let i = 0; i < node.outputs.length; i++) {
    const output = node.outputs[i];
    const output_yield_pct_decimal = new Decimal(output.yield_pct);

    // Output share = output.yield_pct / total_output_yield_pct
    const output_share = output_yield_pct_decimal.dividedBy(total_output_yield_pct_decimal);

    // Output weight
    const output_weight_kg_decimal = inputKg.times(output_yield_pct_decimal).dividedBy(100);

    // Allocated cost (use residual for last output to avoid rounding accumulation)
    let allocated_cost_eur_decimal: Decimal;
    if (i === node.outputs.length - 1) {
      // Last output gets residual to ensure exact reconciliation
      allocated_cost_eur_decimal = total_node_cost_eur_decimal.minus(cumulative_allocated);
    } else {
      allocated_cost_eur_decimal = total_node_cost_eur_decimal.times(output_share);
      cumulative_allocated = cumulative_allocated.plus(allocated_cost_eur_decimal);
    }

    // Cost per kg
    const cost_per_kg_decimal = output_weight_kg_decimal.greaterThan(0)
      ? allocated_cost_eur_decimal.dividedBy(output_weight_kg_decimal)
      : new Decimal(0);

    output_allocations.push({
      part_code: output.part_code,
      weight_kg: output_weight_kg_decimal.toNumber(),
      allocated_cost_eur: allocated_cost_eur_decimal.toNumber(),
      cost_per_kg: cost_per_kg_decimal.toNumber(),
      is_by_product: output.is_by_product,
      processable_byproduct: output.processable_byproduct ?? false,
    });
  }

  // RECONCILIATION INVARIANT: Σ(allocated_cost_eur) MUST equal total_node_cost_eur
  const total_allocated_decimal = output_allocations.reduce(
    (sum, o) => sum.plus(o.allocated_cost_eur),
    new Decimal(0)
  );
  const allocation_error = total_allocated_decimal
    .minus(total_node_cost_eur_decimal)
    .abs()
    .toNumber();

  if (allocation_error > ALLOCATION_RECONCILIATION_TOLERANCE_EUR) {
    throw new Error(
      `Cost allocation reconciliation failed for node ${node.id} (${node.label}): ` +
        `allocated ${total_allocated_decimal.toFixed(2)} vs expected ${total_node_cost_eur_decimal.toFixed(2)} ` +
        `(error: €${allocation_error.toFixed(4)})`
    );
  }

  return {
    node_id: node.id,
    node_label: node.label,
    input_kg: inputKg.toNumber(),
    output_kg: output_kg_decimal.toNumber(),
    loss_kg: loss_kg_decimal.toNumber(),
    loss_pct,
    variable_cost_eur: variable_cost_eur_decimal.toNumber(),
    fixed_cost_eur: fixed_cost_eur_decimal.toNumber(),
    total_cost_eur: total_node_cost_eur_decimal.toNumber(),
    outputs: output_allocations,
  };
}
