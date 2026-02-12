/**
 * Process Chain Layer Integration — Sprint 11B.1
 *
 * Integrates process chain execution with scenario sandbox.
 * Preserves baseline canonical L0-L3 waterfall and adds separate L4+ chain layer.
 *
 * CRITICAL CONSTRAINTS:
 * - Does NOT modify canonical L0-L3 calculations
 * - Chain layer has cost_method='chain_yield_proportional' (NOT 'svaso')
 * - Baseline waterfall remains canonical
 */

import type { BaselineBatchData, ScenarioInput, ScenarioResult } from '@/lib/engine/scenario-sandbox';
import type { ProcessChain, ChainExecutionResult } from '@/lib/engine/chain';
import { executeProcessChain } from '@/lib/engine/chain';

/**
 * Extended ScenarioInput with optional process_chain field.
 */
export interface ScenarioInputWithChain extends ScenarioInput {
  process_chain?: ProcessChain;
}

/**
 * Extended ScenarioResult with optional chain_layer field.
 */
export interface ScenarioResultWithChain extends ScenarioResult {
  chain_layer?: ChainLayerResult;
}

/**
 * Chain layer result structure (separate from canonical L0-L3).
 */
export interface ChainLayerResult {
  cost_method: 'chain_yield_proportional'; // DISCRIMINANT
  chain_execution: ChainExecutionResult;
}

/**
 * Applies process chain layer to scenario result if chain is provided.
 *
 * @param baseline - Baseline batch data with canonical L0-L3 waterfall
 * @param input - Scenario input (may include process_chain)
 * @param scenarioResult - Scenario result from runScenarioSandbox (L0-L3 computed)
 * @returns Extended scenario result with chain_layer if applicable
 */
export function applyProcessChainLayer(
  baseline: BaselineBatchData,
  input: ScenarioInputWithChain,
  scenarioResult: ScenarioResult
): ScenarioResultWithChain {
  // If no process_chain provided, return scenario result as-is (backward compatible)
  if (!input.process_chain) {
    return scenarioResult;
  }

  // Execute process chain
  const chainExecution = executeProcessChain(
    input.process_chain,
    baseline.griller_weight_kg
  );

  if (!chainExecution.success) {
    // Chain execution failed - return scenario result with error in chain_layer
    return {
      ...scenarioResult,
      success: false,
      error: `Chain execution failed: ${chainExecution.error}`,
      chain_layer: {
        cost_method: 'chain_yield_proportional',
        chain_execution: chainExecution,
      },
    };
  }

  // Success: add chain_layer to scenario result
  return {
    ...scenarioResult,
    chain_layer: {
      cost_method: 'chain_yield_proportional',
      chain_execution: chainExecution,
    },
  };
}
