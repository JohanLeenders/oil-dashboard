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
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
        <p className="text-sm text-red-800 font-medium">
          NRV check geblokkeerd vanwege massabalansafwijking &gt; 7,5%
        </p>
        <p className="text-xs text-red-600 mt-1">
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
          <tr className="text-left text-gray-500">
            <th className="pb-2">Item</th>
            <th className="pb-2 text-right">Waarde (€/kg)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-gray-100">
            <td className="py-1.5 font-medium">Verkoopprijs</td>
            <td className="py-1.5 text-right">
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
                  className="border border-yellow-300 rounded px-1 py-0.5 text-sm w-24 text-right"
                />
              ) : (
                formatEurPerKg(nrvInput.selling_price_per_kg)
              )}
            </td>
          </tr>
          <tr className="border-t border-gray-100">
            <td className="py-1.5 text-gray-600">- Afwerkingskosten</td>
            <td className="py-1.5 text-right text-gray-600">
              {formatEurPerKg(nrvInput.completion_cost_per_kg)}
            </td>
          </tr>
          <tr className="border-t border-gray-100">
            <td className="py-1.5 text-gray-600">- Verkoopkosten</td>
            <td className="py-1.5 text-right text-gray-600">
              {formatEurPerKg(nrvInput.selling_cost_per_kg)}
            </td>
          </tr>
          <tr className="border-t-2 border-red-200 font-bold">
            <td className="py-2">NRV (netto opbrengstwaarde)</td>
            <td className="py-2 text-right">
              {formatEurPerKg(active.nrv_per_kg)}
              {isScenarioMode && nrvDiff !== null && nrvDiff !== 0 && (
                <span className={`ml-2 text-xs ${nrvDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ({formatDelta(nrvDiff)}/kg)
                </span>
              )}
            </td>
          </tr>
          <tr className="border-t border-gray-100">
            <td className="py-1.5 font-medium">Kostprijs (Level 6)</td>
            <td className="py-1.5 text-right">
              {formatEurPerKg(active.cost_per_kg)}
              {isScenarioMode && costDiff !== null && costDiff !== 0 && (
                <span className={`ml-2 text-xs ${costDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ({formatDelta(costDiff)}/kg)
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* NRV vs Cost result */}
      <div className={`mt-3 p-3 rounded-lg flex items-center justify-between ${
        active.nrv_exceeds_cost ? 'bg-green-50' : 'bg-red-50'
      }`}>
        <div>
          <span className={`font-bold text-sm ${active.nrv_exceeds_cost ? 'text-green-800' : 'text-red-800'}`}>
            {active.nrv_exceeds_cost ? 'NRV > Kostprijs' : 'NRV < Kostprijs — Afwaardering nodig'}
          </span>
          <p className={`text-xs mt-0.5 ${active.nrv_exceeds_cost ? 'text-green-700' : 'text-red-700'}`}>
            Marge: {formatEurPerKg(margin)}/kg
          </p>
        </div>
        {active.writedown_required && (
          <div className="text-right">
            <span className="text-xs text-red-600 font-medium">Afwaardering</span>
            <p className="text-sm font-bold text-red-800">
              {formatEurPerKg(active.writedown_amount_per_kg)}/kg
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
