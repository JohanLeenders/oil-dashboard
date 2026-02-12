'use client';

import type { MiniSVASOResult, JointProductAllocation, SubJointCutInput } from '@/lib/engine/canonical-cost';
import type { ScenarioOverrides } from '../CostWaterfallShell';
import { formatEur, formatEurPerKg, formatKg, formatPct, getPartNameDutch } from '@/lib/data/demo-batch-v2';

interface Props {
  canonLevel4: Record<string, MiniSVASOResult>;
  scenarioLevel4?: Record<string, MiniSVASOResult>;
  level3Allocations: JointProductAllocation[];
  isScenarioMode: boolean;
  subCuts: Record<string, SubJointCutInput[]>;
  onOverrideChange: (key: string, value: number) => void;
  scenarioOverrides: ScenarioOverrides;
}

export function Level4MiniSVASO({
  canonLevel4,
  scenarioLevel4,
  level3Allocations,
  isScenarioMode,
  subCuts,
  onOverrideChange,
  scenarioOverrides,
}: Props) {
  return (
    <div className="space-y-6">
      {level3Allocations.map(parentAlloc => {
        const canonMini = canonLevel4[parentAlloc.part_code];
        const scenarioMini = scenarioLevel4?.[parentAlloc.part_code];
        const activeMini = scenarioMini ?? canonMini;
        if (!activeMini) return null;

        const parentSubCuts = subCuts[parentAlloc.part_code] ?? [];
        const subCutWeightSum = activeMini.sub_allocations.reduce((s, sa) => s + sa.weight_kg, 0);
        const restWeight = parentAlloc.weight_kg - subCutWeightSum;

        return (
          <div key={parentAlloc.part_code} className="border border-indigo-100 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-3">
              {getPartNameDutch(parentAlloc.part_code)} — Mini-SVASO
              <span className="text-xs text-gray-500 ml-2">
                (parent: {formatKg(parentAlloc.weight_kg)} @ {formatEur(parentAlloc.allocated_cost_total_eur)})
              </span>
            </h4>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2">Sub-cut</th>
                  <th className="pb-2 text-right">Gewicht</th>
                  <th className="pb-2 text-right">% v. parent</th>
                  <th className="pb-2 text-right">Schaduwprijs</th>
                  <th className="pb-2 text-right">Kost/kg</th>
                  <th className="pb-2 text-right">Totaal Kost</th>
                </tr>
              </thead>
              <tbody>
                {activeMini.sub_allocations.map((sa, i) => {
                  const baseSubCut = parentSubCuts[i];
                  const yieldPct = (sa.weight_kg / parentAlloc.weight_kg) * 100;
                  return (
                    <tr key={sa.sub_cut_code} className="border-t border-gray-100">
                      <td className="py-1.5 font-medium">{getPartNameDutch(sa.sub_cut_code)}</td>
                      <td className="py-1.5 text-right">
                        {isScenarioMode && baseSubCut ? (
                          <input
                            type="number"
                            min={0}
                            max={parentAlloc.weight_kg}
                            step={10}
                            value={scenarioOverrides.subCutWeights?.[sa.sub_cut_code] ?? baseSubCut.weight_kg}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v >= 0) {
                                onOverrideChange(`subcut.${sa.sub_cut_code}`, v);
                              }
                            }}
                            className="border border-yellow-300 rounded px-1 py-0.5 text-sm w-20 text-right"
                          />
                        ) : (
                          formatKg(sa.weight_kg)
                        )}
                      </td>
                      <td className="py-1.5 text-right">{formatPct(yieldPct)}</td>
                      <td className="py-1.5 text-right text-gray-500 italic">
                        {formatEurPerKg(sa.shadow_price_per_kg)}
                      </td>
                      <td className="py-1.5 text-right font-medium">{formatEurPerKg(sa.allocated_cost_per_kg)}</td>
                      <td className="py-1.5 text-right">{formatEur(sa.allocated_cost_total_eur)}</td>
                    </tr>
                  );
                })}

                {/* Rest/trim row — always show when sum < parent */}
                {restWeight > 0.5 && (
                  <tr className="border-t border-dashed border-gray-300 text-gray-400 italic">
                    <td className="py-1.5">Rest/trim (onbenoemd)</td>
                    <td className="py-1.5 text-right">{formatKg(restWeight)}</td>
                    <td className="py-1.5 text-right">{formatPct((restWeight / parentAlloc.weight_kg) * 100)}</td>
                    <td className="py-1.5 text-right">—</td>
                    <td className="py-1.5 text-right">—</td>
                    <td className="py-1.5 text-right text-xs">
                      kosten geabsorbeerd door benoemde sub-cuts
                    </td>
                  </tr>
                )}

                <tr className="border-t-2 border-indigo-200 font-bold">
                  <td className="py-2">Totaal</td>
                  <td className="py-2 text-right">{formatKg(subCutWeightSum + Math.max(0, restWeight))}</td>
                  <td className="py-2 text-right">100%</td>
                  <td className="py-2 text-right">—</td>
                  <td className="py-2 text-right">—</td>
                  <td className="py-2 text-right text-indigo-800">{formatEur(activeMini.sum_sub_allocated_cost_eur)}</td>
                </tr>
              </tbody>
            </table>

            {/* Reconciliation */}
            <div className="mt-2 text-xs text-gray-500">
              Parent kost: {formatEur(activeMini.parent_allocated_cost_eur)} |
              Sub-allocatie: {formatEur(activeMini.sum_sub_allocated_cost_eur)}
              {activeMini.rounding_residual_eur !== 0 && (
                <span> | Afrondingsresidu: {formatEur(activeMini.rounding_residual_eur)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
