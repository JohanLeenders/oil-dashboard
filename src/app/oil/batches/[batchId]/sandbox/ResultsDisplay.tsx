'use client';

/**
 * Results Display Component — Sprint 12.2
 *
 * Displays baseline vs scenario comparison with deltas.
 * All UI text from sandboxLabels (NL). NL number formatting.
 */

import type {
  WaterfallResult,
  DeltaResult,
  ScenarioMetadata,
} from '@/lib/engine/scenario-sandbox';
import { getDeltaColorClass } from '@/lib/engine/scenario-sandbox';
import {
  RESULTS, BASELINE, partName,
  fmtEur, fmtK, fmtDeltaEur, fmtDeltaPct, fmtDeltaPp, fmtKgPrecise, fmtPct,
} from '@/lib/ui/sandboxLabels';

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
      <div className="oil-card p-4">
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-main)' }}>{RESULTS.scenarioWaterfall}</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>{BASELINE.l0}</span>
            <span className="font-medium">
              {fmtEur(scenario.l0_landed_cost.landed_cost_eur)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>{BASELINE.l1}</span>
            <span className="font-medium">
              {fmtEur(scenario.l1_joint_cost_pool.joint_cost_pool_eur)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>{BASELINE.l2}</span>
            <span className="font-medium">
              {fmtEur(scenario.l2_net_joint_cost.net_joint_cost_eur)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>{BASELINE.l3}</span>
            <span className="font-medium">
              {fmtK(scenario.l3_svaso_allocation.k_factor)}
            </span>
          </div>
        </div>
      </div>

      {/* Uitleg blok */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
        <p className="text-xs text-blue-800">{RESULTS.explanation}</p>
      </div>

      {/* Deltas */}
      <div className="oil-card p-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-main)' }}>{RESULTS.deltaAnalysis}</h4>
        <div className="space-y-3">
          {/* L0 Delta */}
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{BASELINE.l0}</span>
              <div className="text-right">
                <span className={`text-sm font-medium ${getDeltaColorClass(deltas.l0_landed_cost_delta_eur)}`}>
                  {fmtDeltaEur(deltas.l0_landed_cost_delta_eur)}
                </span>
                <span className={`text-xs ml-2 ${getDeltaColorClass(deltas.l0_landed_cost_delta_pct)}`}>
                  ({fmtDeltaPct(deltas.l0_landed_cost_delta_pct)})
                </span>
              </div>
            </div>
          </div>

          {/* L1 Delta */}
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{BASELINE.l1}</span>
              <div className="text-right">
                <span className={`text-sm font-medium ${getDeltaColorClass(deltas.l1_joint_cost_pool_delta_eur)}`}>
                  {fmtDeltaEur(deltas.l1_joint_cost_pool_delta_eur)}
                </span>
                <span className={`text-xs ml-2 ${getDeltaColorClass(deltas.l1_joint_cost_pool_delta_pct)}`}>
                  ({fmtDeltaPct(deltas.l1_joint_cost_pool_delta_pct)})
                </span>
              </div>
            </div>
          </div>

          {/* L2 Delta */}
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{BASELINE.l2}</span>
              <div className="text-right">
                <span className={`text-sm font-medium ${getDeltaColorClass(deltas.l2_net_joint_cost_delta_eur)}`}>
                  {fmtDeltaEur(deltas.l2_net_joint_cost_delta_eur)}
                </span>
                <span className={`text-xs ml-2 ${getDeltaColorClass(deltas.l2_net_joint_cost_delta_pct)}`}>
                  ({fmtDeltaPct(deltas.l2_net_joint_cost_delta_pct)})
                </span>
              </div>
            </div>
          </div>

          {/* k-factor Delta */}
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{RESULTS.kFactorEfficiency}</span>
              <div className="text-right">
                <span className={`text-sm font-medium ${getDeltaColorClass(deltas.l3_k_factor_delta)}`}>
                  {fmtDeltaEur(deltas.l3_k_factor_delta)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* L3 Allocation Deltas */}
      {deltas.l3_allocations && deltas.l3_allocations.length > 0 && (
        <div className="oil-card p-4">
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-main)' }}>{RESULTS.svasoShifts}</h4>
          <div className="space-y-2">
            {deltas.l3_allocations.map((alloc) => (
              <div key={alloc.part_code} className="border-b pb-2 last:border-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>{partName(alloc.part_code)}</span>
                  <span className={`text-xs font-medium ${getDeltaColorClass(alloc.delta_pp)}`}>
                    {fmtDeltaPp(alloc.delta_pp)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span>{RESULTS.allocation}:</span>
                  <span>
                    {fmtPct(alloc.baseline_allocation_pct)} → {fmtPct(alloc.scenario_allocation_pct)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span>{RESULTS.costPerKg}:</span>
                  <div className="text-right">
                    <span>{fmtEur(alloc.baseline_cost_per_kg)} → {fmtEur(alloc.scenario_cost_per_kg)}</span>
                    <span className={`ml-2 ${getDeltaColorClass(alloc.delta_cost_per_kg)}`}>
                      ({fmtDeltaPct(alloc.delta_cost_per_kg_pct)})
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
              {meta.mass_balance_check.valid ? RESULTS.massBalanceValid : RESULTS.massBalanceViolated}
            </p>
            <p className={`text-xs ${meta.mass_balance_check.valid ? 'text-green-700' : 'text-red-700'}`}>
              {RESULTS.parts}: {fmtKgPrecise(meta.mass_balance_check.parts_total_kg)} |
              {RESULTS.griller}: {fmtKgPrecise(meta.mass_balance_check.griller_kg)} |
              {RESULTS.delta}: {fmtKgPrecise(meta.mass_balance_check.delta_kg)}
              ({RESULTS.tolerance}: ±{fmtKgPrecise(meta.mass_balance_check.tolerance_kg)})
            </p>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="oil-card p-3">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {RESULTS.computed}: {new Date(meta.computed_at).toLocaleString('nl-NL')} |
          {RESULTS.engine}: {meta.engine_version}
        </p>
      </div>
    </div>
  );
}
