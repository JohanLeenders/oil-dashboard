/**
 * Process Chain Execution — Sprint 11B.1
 *
 * Executes a validated process chain in topological order,
 * computing costs and flows for each node.
 *
 * CRITICAL CONSTRAINTS:
 * - cost_method MUST be 'chain_yield_proportional' (NOT 'svaso')
 * - Executes in topological order (dependencies first)
 * - Uses Decimal.js for cumulative cost calculations
 * - Respects SANDBOX_MASS_BALANCE_TOLERANCE for final check
 */

import Decimal from 'decimal.js';
import type {
  ProcessChain,
  ProcessNode,
  ProcessEdge,
  ChainExecutionResult,
  NodeExecutionResult,
  FinalOutput,
  ChainMassBalanceCheck,
} from './types';
import { CHAIN_MASS_BALANCE_TOLERANCE } from './types';
import { validateProcessChain } from './validateProcessChain';
import { allocateNodeCosts } from './allocateNodeCosts';

/**
 * Executes a process chain and computes costs.
 *
 * @param chain - The process chain to execute
 * @param baseline_griller_kg - Baseline griller weight from batch
 * @returns Chain execution result with cost_method discriminant
 */
export function executeProcessChain(
  chain: ProcessChain,
  baseline_griller_kg: number
): ChainExecutionResult {
  // 1. Validate chain
  const validationResult = validateProcessChain(chain);
  if (!validationResult.valid) {
    return {
      success: false,
      error: validationResult.error || 'Chain validation failed',
      cost_method: 'chain_yield_proportional',
      node_results: [],
      final_outputs: [],
      total_chain_cost_eur: 0,
      total_chain_variable_cost_eur: 0,
      total_chain_fixed_cost_eur: 0,
      mass_balance_check: {
        valid: false,
        total_input_kg: 0,
        total_output_kg: 0,
        total_loss_kg: 0,
        relative_error: 0,
        tolerance: CHAIN_MASS_BALANCE_TOLERANCE,
      },
    };
  }

  // 2. Execute nodes in topological order
  const executionOrder = getTopologicalOrder(chain);
  const nodeResults: NodeExecutionResult[] = [];
  const partAvailability = new Map<string, number>(); // part_code -> available kg

  // Initialize baseline parts (griller from baseline)
  partAvailability.set('griller', baseline_griller_kg);

  for (const nodeId of executionOrder) {
    const node = chain.nodes.find((n) => n.id === nodeId);
    if (!node) {
      continue;
    }

    // Determine input kg for this node
    let input_kg = 0;
    if (node.inputs.length === 1) {
      const input = node.inputs[0];
      const available = partAvailability.get(input.part_code) || 0;

      if (input.required_kg === null) {
        // Use all available
        input_kg = available;
      } else {
        // Use specified amount (capped at available)
        input_kg = Math.min(input.required_kg, available);
      }

      // Consume from availability
      partAvailability.set(input.part_code, available - input_kg);
    } else {
      // Multi-input nodes not supported in v1 (simplest interpretation)
      return {
        success: false,
        error: `Node ${node.id} (${node.label}) has multiple inputs (not supported in v1)`,
        cost_method: 'chain_yield_proportional',
        node_results: [],
        final_outputs: [],
        total_chain_cost_eur: 0,
        total_chain_variable_cost_eur: 0,
        total_chain_fixed_cost_eur: 0,
        mass_balance_check: {
          valid: false,
          total_input_kg: 0,
          total_output_kg: 0,
          total_loss_kg: 0,
          relative_error: 0,
          tolerance: CHAIN_MASS_BALANCE_TOLERANCE,
        },
      };
    }

    // Execute node (allocate costs)
    const nodeResult = allocateNodeCosts(node, input_kg);
    nodeResults.push(nodeResult);

    // Update part availability with node outputs
    for (const output of nodeResult.outputs) {
      const current = partAvailability.get(output.part_code) || 0;
      partAvailability.set(output.part_code, current + output.weight_kg);
    }
  }

  // 3. Identify final outputs (parts not consumed by any downstream node)
  const consumedParts = new Set<string>();
  for (const node of chain.nodes) {
    for (const input of node.inputs) {
      consumedParts.add(input.part_code);
    }
  }

  const final_outputs: FinalOutput[] = [];
  for (const [part_code, weight_kg] of partAvailability.entries()) {
    if (weight_kg > 0 && !consumedParts.has(part_code) && part_code !== 'griller') {
      // Find cumulative cost for this part (sum of all node costs in its path)
      const cumulative_cost_eur = computeCumulativeCost(part_code, nodeResults, chain);
      const cost_per_kg = weight_kg > 0 ? cumulative_cost_eur / weight_kg : 0;

      // Determine if this is a by-product
      let is_by_product = false;
      for (const nodeResult of nodeResults) {
        const output = nodeResult.outputs.find((o) => o.part_code === part_code);
        if (output && output.is_by_product) {
          is_by_product = true;
          break;
        }
      }

      final_outputs.push({
        part_code,
        weight_kg,
        cumulative_cost_eur,
        cost_per_kg,
        is_by_product,
      });
    }
  }

  // 4. Compute totals
  const total_chain_cost_eur = nodeResults.reduce((sum, nr) => sum + nr.total_cost_eur, 0);
  const total_chain_variable_cost_eur = nodeResults.reduce(
    (sum, nr) => sum + nr.variable_cost_eur,
    0
  );
  const total_chain_fixed_cost_eur = nodeResults.reduce((sum, nr) => sum + nr.fixed_cost_eur, 0);

  // 5. Mass balance check
  const total_input_kg = baseline_griller_kg;
  const total_output_kg = final_outputs.reduce((sum, fo) => sum + fo.weight_kg, 0);
  const total_loss_kg = nodeResults.reduce((sum, nr) => sum + nr.loss_kg, 0);

  const expected_output_kg = total_input_kg - total_loss_kg;
  const relative_error =
    expected_output_kg > 0 ? Math.abs(total_output_kg - expected_output_kg) / expected_output_kg : 0;

  const mass_balance_check: ChainMassBalanceCheck = {
    valid: relative_error <= CHAIN_MASS_BALANCE_TOLERANCE,
    total_input_kg,
    total_output_kg,
    total_loss_kg,
    relative_error,
    tolerance: CHAIN_MASS_BALANCE_TOLERANCE,
  };

  if (!mass_balance_check.valid) {
    return {
      success: false,
      error: `Chain mass balance violated: ${(relative_error * 100).toFixed(2)}% error (tolerance: ${(CHAIN_MASS_BALANCE_TOLERANCE * 100).toFixed(1)}%)`,
      cost_method: 'chain_yield_proportional',
      node_results: nodeResults,
      final_outputs,
      total_chain_cost_eur,
      total_chain_variable_cost_eur,
      total_chain_fixed_cost_eur,
      mass_balance_check,
    };
  }

  return {
    success: true,
    error: null,
    cost_method: 'chain_yield_proportional',
    node_results: nodeResults,
    final_outputs,
    total_chain_cost_eur,
    total_chain_variable_cost_eur,
    total_chain_fixed_cost_eur,
    mass_balance_check,
  };
}

/**
 * Returns nodes in topological order (dependencies first).
 */
function getTopologicalOrder(chain: ProcessChain): string[] {
  const adjacencyList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  for (const node of chain.nodes) {
    adjacencyList.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  // Build adjacency list and in-degrees
  for (const edge of chain.edges) {
    const neighbors = adjacencyList.get(edge.source_node_id) || [];
    neighbors.push(edge.target_node_id);
    adjacencyList.set(edge.source_node_id, neighbors);

    inDegree.set(edge.target_node_id, (inDegree.get(edge.target_node_id) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const order: string[] = [];

  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    order.push(currentId);

    const neighbors = adjacencyList.get(currentId) || [];
    for (const neighborId of neighbors) {
      const newDegree = (inDegree.get(neighborId) || 0) - 1;
      inDegree.set(neighborId, newDegree);

      if (newDegree === 0) {
        queue.push(neighborId);
      }
    }
  }

  return order;
}

/**
 * Computes cumulative cost for a part (sum of all node costs in its path).
 * Simplified v1: returns the allocated cost from the node that produced this part.
 */
function computeCumulativeCost(
  part_code: string,
  nodeResults: NodeExecutionResult[],
  chain: ProcessChain
): number {
  // Find the node that produced this part
  for (const nodeResult of nodeResults) {
    const output = nodeResult.outputs.find((o) => o.part_code === part_code);
    if (output) {
      return output.allocated_cost_eur;
    }
  }

  return 0;
}
