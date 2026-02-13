'use client';

/**
 * Chain Results Display — Sprint 12.2
 *
 * Displays chain_layer results separately from canonical L0-L3 waterfall.
 * Shows cost_method badge and per-node/per-output costs.
 * All UI text from sandboxLabels (NL). Includes UX guard (processingCostNote).
 */

import type { ChainExecutionResult } from '@/lib/engine/chain';
import {
  CHAIN, RESULTS, partName,
  fmtEur, fmtKg, fmtPct, fmtEurKg,
} from '@/lib/ui/sandboxLabels';

interface ChainResultsDisplayProps {
  chainResult: ChainExecutionResult;
}

export function ChainResultsDisplay({ chainResult }: ChainResultsDisplayProps) {
  if (!chainResult.success) {
    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-red-900 mb-2">{CHAIN.chainExecutionFailed}</h4>
        <p className="text-sm text-red-800">{chainResult.error}</p>

        {chainResult.mass_balance_check && !chainResult.mass_balance_check.valid && (
          <div className="mt-3 p-3 bg-red-100 rounded">
            <p className="text-xs font-medium text-red-900 mb-1">{CHAIN.massBalanceError}:</p>
            <div className="text-xs text-red-800 space-y-1">
              <div>
                {CHAIN.totalInput}: {fmtKg(chainResult.mass_balance_check.total_input_kg)}
              </div>
              <div>
                {CHAIN.totalOutput}: {fmtKg(chainResult.mass_balance_check.total_output_kg)}
              </div>
              <div>
                {CHAIN.totalLoss}: {fmtKg(chainResult.mass_balance_check.total_loss_kg)}
              </div>
              <div>
                {CHAIN.relativeError}:{' '}
                {fmtPct(chainResult.mass_balance_check.relative_error * 100)}
              </div>
              <div>
                {RESULTS.tolerance}: {fmtPct(chainResult.mass_balance_check.tolerance * 100)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* UX Guard — chain costs are ADDITIVE to SVASO */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <p className="text-sm text-purple-800">{CHAIN.processingCostNote}</p>
      </div>

      {/* Header with cost_method badge */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-purple-900">
            {CHAIN.chainLayerTitle}
          </h4>
          <span className="px-3 py-1 bg-purple-600 text-white text-xs font-mono rounded">
            {chainResult.cost_method}
          </span>
        </div>
        <p className="text-xs text-purple-700 mt-2">
          {CHAIN.chainDescription}
        </p>
      </div>

      {/* Summary Totals */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h5 className="text-sm font-semibold text-gray-900 mb-3">{CHAIN.chainSummary}</h5>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-600">{CHAIN.totalChainCost}</p>
            <p className="text-lg font-semibold text-gray-900">
              {fmtEur(chainResult.total_chain_cost_eur)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">{CHAIN.variableCosts}</p>
            <p className="text-lg font-semibold text-gray-900">
              {fmtEur(chainResult.total_chain_variable_cost_eur)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">{CHAIN.fixedCosts}</p>
            <p className="text-lg font-semibold text-gray-900">
              {fmtEur(chainResult.total_chain_fixed_cost_eur)}
            </p>
          </div>
        </div>
      </div>

      {/* Per-Node Results */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h5 className="text-sm font-semibold text-gray-900 mb-3">{CHAIN.perNodeBreakdown}</h5>
        <div className="space-y-3">
          {chainResult.node_results.map((nodeResult) => (
            <div key={nodeResult.node_id} className="p-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">{nodeResult.node_label}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {fmtEur(nodeResult.total_cost_eur)}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs text-gray-700 mb-2">
                <div>
                  <span className="text-gray-500">{CHAIN.input}:</span>{' '}
                  {fmtKg(nodeResult.input_kg)}
                </div>
                <div>
                  <span className="text-gray-500">{CHAIN.output}:</span>{' '}
                  {fmtKg(nodeResult.output_kg)}
                </div>
                <div>
                  <span className="text-gray-500">{CHAIN.loss}:</span> {fmtPct(nodeResult.loss_pct)}
                </div>
                <div>
                  <span className="text-gray-500">{CHAIN.lossKg}:</span>{' '}
                  {fmtKg(nodeResult.loss_kg)}
                </div>
              </div>

              {/* Outputs */}
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-700 mb-1">{CHAIN.outputs}</p>
                <div className="space-y-1">
                  {nodeResult.outputs.map((output, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs text-gray-700"
                    >
                      <span>
                        {partName(output.part_code)} {output.is_by_product && `(${CHAIN.byProduct})`}
                      </span>
                      <span>
                        {fmtKg(output.weight_kg)} × {fmtEurKg(output.cost_per_kg)} = {fmtEur(output.allocated_cost_eur)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final Outputs */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h5 className="text-sm font-semibold text-gray-900 mb-3">{CHAIN.finalOutputCosts}</h5>
        <div className="space-y-2">
          {chainResult.final_outputs.map((output, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {partName(output.part_code)} {output.is_by_product && `(${CHAIN.byProduct})`}
                </p>
                <p className="text-xs text-gray-600">{fmtKg(output.weight_kg)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {fmtEurKg(output.cost_per_kg)}
                </p>
                <p className="text-xs text-gray-600">
                  {CHAIN.total}: {fmtEur(output.cumulative_cost_eur)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mass Balance Check */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-900">{RESULTS.massBalanceValid}</p>
            <p className="text-xs text-green-700">
              {CHAIN.error}: {fmtPct(chainResult.mass_balance_check.relative_error * 100)} ({RESULTS.tolerance}:{' '}
              {fmtPct(chainResult.mass_balance_check.tolerance * 100)})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
