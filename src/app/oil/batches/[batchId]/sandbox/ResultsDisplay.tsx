'use client';

/**
 * Results Display Component — Sprint 11A.3
 *
 * Displays baseline vs scenario comparison with deltas.
 * Color-coded indicators for increases/decreases.
 */

import type {
  WaterfallResult,
  DeltaResult,
  ScenarioMetadata,
} from '@/lib/engine/scenario-sandbox';
import { formatDelta, formatDeltaPct, getDeltaColorClass } from '@/lib/engine/scenario-sandbox';

interface ResultsDisplayProps {
  baseline: WaterfallResult | null;
  scenario: WaterfallResult | null;
  deltas: DeltaResult | null;
  meta: ScenarioMetadata;
}

export function ResultsDisplay({
  baseline,
  scenario,
  deltas,
  meta,
}: ResultsDisplayProps) {
  if (!scenario || !deltas) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Scenario Waterfall */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Scenario Waterfall</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">L0 Landed Cost:</span>
            <span className="font-medium">
              €{scenario.l0_landed_cost.landed_cost_eur.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">L1 Joint Cost Pool:</span>
            <span className="font-medium">
              €{scenario.l1_joint_cost_pool.joint_cost_pool_eur.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">L2 Net Joint Cost:</span>
            <span className="font-medium">
              €{scenario.l2_net_joint_cost.net_joint_cost_eur.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">L3 k-factor:</span>
            <span className="font-medium">
              {scenario.l3_svaso_allocation.k_factor.toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      {/* Deltas */}
      <div className="bg-white border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Delta Analysis</h4>
        <div className="space-y-3">
          {/* L0 Delta */}
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">L0 Landed Cost:</span>
              <div className="text-right">
                <span className={`text-sm font-medium ${getDeltaColorClass(deltas.l0_landed_cost_delta_eur)}`}>
                  {formatDelta(deltas.l0_landed_cost_delta_eur)} €
                </span>
                <span className={`text-xs ml-2 ${getDeltaColorClass(deltas.l0_landed_cost_delta_pct)}`}>
                  ({formatDeltaPct(deltas.l0_landed_cost_delta_pct)})
                </span>
              </div>
            </div>
          </div>

          {/* L1 Delta */}
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">L1 Joint Cost Pool:</span>
              <div className="text-right">
                <span className={`text-sm font-medium ${getDeltaColorClass(deltas.l1_joint_cost_pool_delta_eur)}`}>
                  {formatDelta(deltas.l1_joint_cost_pool_delta_eur)} €
                </span>
                <span className={`text-xs ml-2 ${getDeltaColorClass(deltas.l1_joint_cost_pool_delta_pct)}`}>
                  ({formatDeltaPct(deltas.l1_joint_cost_pool_delta_pct)})
                </span>
              </div>
            </div>
          </div>

          {/* L2 Delta */}
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">L2 Net Joint Cost:</span>
              <div className="text-right">
                <span className={`text-sm font-medium ${getDeltaColorClass(deltas.l2_net_joint_cost_delta_eur)}`}>
                  {formatDelta(deltas.l2_net_joint_cost_delta_eur)} €
                </span>
                <span className={`text-xs ml-2 ${getDeltaColorClass(deltas.l2_net_joint_cost_delta_pct)}`}>
                  ({formatDeltaPct(deltas.l2_net_joint_cost_delta_pct)})
                </span>
              </div>
            </div>
          </div>

          {/* k-factor Delta */}
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">k-factor (efficiency):</span>
              <div className="text-right">
                <span className={`text-sm font-medium ${getDeltaColorClass(deltas.l3_k_factor_delta)}`}>
                  {formatDelta(deltas.l3_k_factor_delta, 4)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* L3 Allocation Deltas */}
      {deltas.l3_allocations && deltas.l3_allocations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">SVASO Allocation Shifts</h4>
          <div className="space-y-2">
            {deltas.l3_allocations.map((alloc) => (
              <div key={alloc.part_code} className="border-b border-gray-100 pb-2 last:border-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium text-gray-700">{alloc.part_code}</span>
                  <span className={`text-xs font-medium ${getDeltaColorClass(alloc.delta_pp)}`}>
                    {formatDelta(alloc.delta_pp, 1)} pp
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-600">
                  <span>Allocation:</span>
                  <span>
                    {alloc.baseline_allocation_pct.toFixed(1)}% → {alloc.scenario_allocation_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-600">
                  <span>Cost/kg:</span>
                  <div className="text-right">
                    <span>€{alloc.baseline_cost_per_kg.toFixed(2)} → €{alloc.scenario_cost_per_kg.toFixed(2)}</span>
                    <span className={`ml-2 ${getDeltaColorClass(alloc.delta_cost_per_kg)}`}>
                      ({formatDeltaPct(alloc.delta_cost_per_kg_pct)})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mass Balance Check */}
      <div className={`border rounded-lg p-3 ${meta.mass_balance_check.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-2">
          {meta.mass_balance_check.valid ? (
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${meta.mass_balance_check.valid ? 'text-green-900' : 'text-red-900'}`}>
              {meta.mass_balance_check.valid ? 'Mass Balance Valid' : 'Mass Balance Violated'}
            </p>
            <p className={`text-xs ${meta.mass_balance_check.valid ? 'text-green-700' : 'text-red-700'}`}>
              Parts: {meta.mass_balance_check.parts_total_kg.toFixed(2)} kg |
              Griller: {meta.mass_balance_check.griller_kg.toFixed(2)} kg |
              Delta: {meta.mass_balance_check.delta_kg.toFixed(2)} kg
              (Tolerance: ±{meta.mass_balance_check.tolerance_kg.toFixed(2)} kg)
            </p>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-600">
          Computed: {new Date(meta.computed_at).toLocaleString('nl-NL')} |
          Engine: {meta.engine_version}
        </p>
      </div>
    </div>
  );
}
