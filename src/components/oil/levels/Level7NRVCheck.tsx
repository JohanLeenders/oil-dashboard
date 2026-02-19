'use client';

import type { NRVAssessment, NRVInput } from '@/lib/engine/canonical-cost';
import type { ScenarioOverrides } from '../CostWaterfallShell';
import { formatEurPerKg, formatDelta } from '@/lib/data/demo-batch-v2';

interface Props {
  canonResult: Readonly<NRVAssessment>;
  scenarioResult?: Readonly<NRVAssessment>;
  isScenarioMode: boolean;
  isBlocked: boolean;
  nrvInput: NRVInput;
  onOverrideChange: (key: string, value: number) => void;
  scenarioOverrides: ScenarioOverrides;
}

export function Level7NRVCheck({
  canonResult,
  scenarioResult,
  isScenarioMode,
  isBlocked,
  nrvInput,
  onOverrideChange,
  scenarioOverrides,
}: Props) {
  const active = scenarioResult ?? canonResult;
  const nrvDiff = scenarioResult ? scenarioResult.nrv_per_kg - canonResult.nrv_per_kg : null;
  const costDiff = scenarioResult ? scenarioResult.cost_per_kg - canonResult.cost_per_kg : null;

  if (isBlocked) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-center">
        <p className="text-sm text-red-800 dark:text-red-300 font-medium">
          NRV check geblokkeerd vanwege massabalansafwijking &gt; 7,5%
        </p>
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
          Admin override nodig om scenario en NRV te ontgrendelen.
        </p>
      </div>
    );
  }

  const margin = active.nrv_per_kg - active.cost_per_kg;

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
            <th className="pb-2 font-medium">Onderdeel</th>
            <th className="pb-2 text-right font-medium">Waarde (€/kg)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-gray-100 dark:border-gray-700">
            <td className="py-2 font-medium text-gray-900 dark:text-gray-100">Verkoopprijs</td>
            <td className="py-2 text-right">
              {isScenarioMode ? (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={scenarioOverrides.sellingPrices?.['filet'] ?? nrvInput.selling_price_per_kg}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= 0) {
                      onOverrideChange('selling.filet', v);
                    }
                  }}
                  className="border border-yellow-300 dark:border-yellow-600 rounded px-1 py-0.5 text-sm w-24 text-right"
                />
              ) : (
                formatEurPerKg(nrvInput.selling_price_per_kg)
              )}
            </td>
          </tr>
          <tr className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
            <td className="py-2 text-gray-600 dark:text-gray-300">- Afwerkingskosten</td>
            <td className="py-2 text-right text-gray-600 dark:text-gray-300 tabular-nums">
              {formatEurPerKg(nrvInput.completion_cost_per_kg)}
            </td>
          </tr>
          <tr className="border-t border-gray-100 dark:border-gray-700">
            <td className="py-2 text-gray-600 dark:text-gray-300">- Verkoopkosten</td>
            <td className="py-2 text-right text-gray-600 dark:text-gray-300 tabular-nums">
              {formatEurPerKg(nrvInput.selling_cost_per_kg)}
            </td>
          </tr>
          <tr className="border-t-2 border-red-200 dark:border-red-800 font-bold bg-red-50/30 dark:bg-red-900/20">
            <td className="py-2.5">NRV (netto opbrengstwaarde)</td>
            <td className="py-2.5 text-right">
              <span className="text-base tabular-nums">{formatEurPerKg(active.nrv_per_kg)}</span>
              {isScenarioMode && nrvDiff !== null && nrvDiff !== 0 && (
                <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${nrvDiff > 0 ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30' : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30'}`}>
                  {formatDelta(nrvDiff)}/kg
                </span>
              )}
            </td>
          </tr>
          <tr className="border-t border-gray-100 dark:border-gray-700">
            <td className="py-2 font-medium text-gray-900 dark:text-gray-100">Kostprijs (Level 6)</td>
            <td className="py-2 text-right tabular-nums">
              {formatEurPerKg(active.cost_per_kg)}
              {isScenarioMode && costDiff !== null && costDiff !== 0 && (
                <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${costDiff > 0 ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30' : 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'}`}>
                  {formatDelta(costDiff)}/kg
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* NRV vs Cost result */}
      <div className={`mt-3 p-3 rounded-xl flex items-center justify-between ${
        active.nrv_exceeds_cost ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
      }`}>
        <div>
          <span className={`font-bold text-sm ${active.nrv_exceeds_cost ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
            {active.nrv_exceeds_cost ? 'NRV > Kostprijs' : 'NRV < Kostprijs — Afwaardering nodig'}
          </span>
          <p className={`text-xs mt-0.5 ${active.nrv_exceeds_cost ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-300'}`}>
            Marge: {formatEurPerKg(margin)}/kg
          </p>
        </div>
        {active.writedown_required && (
          <div className="text-right">
            <span className="text-[10px] text-red-500 dark:text-red-400 uppercase tracking-wider font-semibold">Afwaardering</span>
            <p className="text-base font-bold text-red-800 dark:text-red-300 tabular-nums">
              {formatEurPerKg(active.writedown_amount_per_kg)}/kg
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
