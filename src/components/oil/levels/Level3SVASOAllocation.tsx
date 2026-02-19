'use client';

import { useState } from 'react';
import type { SVASOAllocationResult, JointProductInput, JointProductCode } from '@/lib/engine/canonical-cost';
import type { ScenarioOverrides } from '../CostWaterfallShell';
import { formatEur, formatEurPerKg, formatKg, formatPct, formatDelta, getPartNameDutch } from '@/lib/data/demo-batch-v2';

interface Props {
  canonResult: SVASOAllocationResult;
  scenarioResult?: SVASOAllocationResult;
  isScenarioMode: boolean;
  grillerWeightKg: number;
  jointProducts: JointProductInput[];
  onOverrideChange: (key: string, value: number) => void;
  scenarioOverrides: ScenarioOverrides;
}

export function Level3SVASOAllocation({
  canonResult,
  scenarioResult,
  isScenarioMode,
  grillerWeightKg,
  jointProducts,
  onOverrideChange,
  scenarioOverrides,
}: Props) {
  const active = scenarioResult ?? canonResult;

  // Weight sum validation for scenario
  const scenarioWeightSum = isScenarioMode
    ? active.allocations.reduce((s, a) => s + a.weight_kg, 0)
    : 0;
  const weightExceedsGriller = isScenarioMode && scenarioWeightSum > grillerWeightKg;
  const hasNegativeWeight = isScenarioMode && active.allocations.some(a => a.weight_kg < 0);

  // Auto-normalize helper
  const [showNormalizeWarning, setShowNormalizeWarning] = useState(false);

  const handleNormalize = () => {
    const total = jointProducts.reduce((s, jp) => {
      const w = scenarioOverrides.jointProductWeights?.[jp.part_code] ?? jp.weight_kg;
      return s + w;
    }, 0);
    if (total <= 0) return;
    for (const jp of jointProducts) {
      const w = scenarioOverrides.jointProductWeights?.[jp.part_code] ?? jp.weight_kg;
      const normalized = (w / total) * grillerWeightKg;
      onOverrideChange(`joint.${jp.part_code}`, Math.round(normalized));
    }
    setShowNormalizeWarning(false);
  };

  return (
    <div>
      {/* SVASO table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
            <th className="pb-2 font-medium">Onderdeel</th>
            <th className="pb-2 text-right font-medium">Gewicht</th>
            <th className="pb-2 text-right font-medium">Schaduwprijs</th>
            <th className="pb-2 text-right font-medium">Marktwaarde</th>
            <th className="pb-2 text-right font-medium">Alloc. %</th>
            <th className="pb-2 text-right font-medium">Kost/kg</th>
            <th className="pb-2 text-right font-medium">Totaal Kost</th>
          </tr>
        </thead>
        <tbody>
          {active.allocations.map((alloc, i) => {
            const canonAlloc = canonResult.allocations[i];
            const costDiff = scenarioResult
              ? alloc.allocated_cost_per_kg - canonAlloc.allocated_cost_per_kg
              : 0;

            return (
              <tr key={alloc.part_code} className={`border-t border-gray-100 dark:border-gray-700 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/50'}`}>
                <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{getPartNameDutch(alloc.part_code)}</td>
                <td className="py-2 text-right">
                  {isScenarioMode ? (
                    <input
                      type="number"
                      min={0}
                      max={grillerWeightKg}
                      step={10}
                      value={scenarioOverrides.jointProductWeights?.[alloc.part_code as JointProductCode] ?? jointProducts.find(j => j.part_code === alloc.part_code)!.weight_kg}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0) {
                          onOverrideChange(`joint.${alloc.part_code}`, v);
                          setShowNormalizeWarning(true);
                        }
                      }}
                      className="border border-yellow-300 dark:border-yellow-600 rounded px-1 py-0.5 text-sm w-20 text-right"
                    />
                  ) : (
                    formatKg(alloc.weight_kg)
                  )}
                </td>
                {/* Shadow price: ALWAYS read-only (derived) */}
                <td className="py-2 text-right text-gray-500 dark:text-gray-400 italic">
                  {formatEurPerKg(alloc.shadow_price_per_kg)}
                  <span className="text-xs text-gray-400 ml-1">(afgeleid)</span>
                </td>
                <td className="py-2 text-right">{formatEur(alloc.market_value_eur)}</td>
                <td className="py-2 text-right">{formatPct(alloc.allocation_factor * 100)}</td>
                <td className="py-2 text-right font-medium">
                  {formatEurPerKg(alloc.allocated_cost_per_kg)}
                  {isScenarioMode && costDiff !== 0 && (
                    <span className={`ml-1 text-xs ${costDiff > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      ({costDiff > 0 ? '+' : ''}{costDiff.toFixed(2)})
                    </span>
                  )}
                </td>
                <td className="py-2 text-right font-medium">{formatEur(alloc.allocated_cost_total_eur)}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-purple-200 dark:border-purple-800 font-bold bg-purple-50/30 dark:bg-purple-900/20">
            <td className="py-2.5 text-gray-900 dark:text-gray-100">Totaal</td>
            <td className="py-2.5 text-right tabular-nums">{formatKg(active.allocations.reduce((s, a) => s + a.weight_kg, 0))}</td>
            <td className="py-2.5 text-right text-gray-300 dark:text-gray-600">—</td>
            <td className="py-2.5 text-right tabular-nums">{formatEur(active.total_market_value_eur)}</td>
            <td className="py-2.5 text-right tabular-nums">{formatPct(active.sum_allocation_factors * 100)}</td>
            <td className="py-2.5 text-right text-gray-300 dark:text-gray-600">—</td>
            <td className="py-2.5 text-right text-purple-700 dark:text-purple-400 text-base">{formatEur(active.sum_allocated_cost_eur)}</td>
          </tr>
        </tbody>
      </table>

      {/* Weight validation warnings (Scenario) */}
      {isScenarioMode && (weightExceedsGriller || hasNegativeWeight) && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm">
          {hasNegativeWeight && (
            <p className="text-red-800 dark:text-red-300 font-medium">Negatief gewicht is niet toegestaan.</p>
          )}
          {weightExceedsGriller && (
            <div className="flex items-center justify-between">
              <p className="text-red-800 dark:text-red-300">
                Som gewichten ({formatKg(scenarioWeightSum)}) &gt; griller ({formatKg(grillerWeightKg)}).
              </p>
              <button
                onClick={handleNormalize}
                className="px-3 py-1 bg-red-100 text-red-800 dark:text-red-300 rounded text-xs font-medium hover:bg-red-200"
              >
                Normaliseer gewichten
              </button>
            </div>
          )}
        </div>
      )}

      {isScenarioMode && showNormalizeWarning && !weightExceedsGriller && !hasNegativeWeight && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Som: {formatKg(scenarioWeightSum)} / Griller: {formatKg(grillerWeightKg)}
        </div>
      )}

      {/* Reconciliation */}
      <div className={`mt-4 rounded-xl p-3 flex items-center justify-between ${active.reconciliation_delta_eur < 0.01 ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'}`}>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Reconciliatie</span>
        <span className={`text-sm font-bold ${active.reconciliation_delta_eur < 0.01 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-300'}`}>
          {active.reconciliation_delta_eur < 0.01 ? 'Gesloten (< \u20AC0.01)' : `Delta: ${formatEur(active.reconciliation_delta_eur)}`}
        </span>
      </div>
    </div>
  );
}
