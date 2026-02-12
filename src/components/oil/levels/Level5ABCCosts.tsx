'use client';

import type { ABCCostResult, ABCCostDriver } from '@/lib/engine/canonical-cost';
import type { ScenarioOverrides } from '../CostWaterfallShell';
import { formatEur, formatDelta } from '@/lib/data/demo-batch-v2';

interface Props {
  canonResult: ABCCostResult;
  scenarioResult?: ABCCostResult;
  isScenarioMode: boolean;
  drivers: ABCCostDriver[];
  onOverrideChange: (key: string, value: number) => void;
  scenarioOverrides: ScenarioOverrides;
}

export function Level5ABCCosts({
  canonResult,
  scenarioResult,
  isScenarioMode,
  drivers,
  onOverrideChange,
  scenarioOverrides,
}: Props) {
  const active = scenarioResult ?? canonResult;
  const diff = scenarioResult ? scenarioResult.total_abc_cost_eur - canonResult.total_abc_cost_eur : null;

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="pb-2">Kostdriver</th>
            <th className="pb-2 text-right">Tarief/eenheid</th>
            <th className="pb-2 text-right">Eenheden</th>
            <th className="pb-2 text-right">Kosten</th>
          </tr>
        </thead>
        <tbody>
          {active.abc_drivers.map((d, i) => {
            const baseDriver = drivers[i];
            return (
              <tr key={d.driver_code} className="border-t border-gray-100">
                <td className="py-1.5 font-medium">{d.driver_name}</td>
                <td className="py-1.5 text-right">
                  {isScenarioMode && baseDriver ? (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={scenarioOverrides.abcRates?.[d.driver_code] ?? baseDriver.rate_per_unit}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0) {
                          onOverrideChange(`abc.${d.driver_code}`, v);
                        }
                      }}
                      className="border border-yellow-300 rounded px-1 py-0.5 text-sm w-20 text-right"
                    />
                  ) : (
                    <span>{formatEur(d.rate_per_unit)}</span>
                  )}
                </td>
                <td className="py-1.5 text-right">{d.units_consumed}</td>
                <td className="py-1.5 text-right font-medium">{formatEur(d.cost_eur)}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-amber-200 font-bold">
            <td className="py-2" colSpan={3}>Totaal ABC</td>
            <td className="py-2 text-right text-amber-800">
              {formatEur(active.total_abc_cost_eur)}
              {isScenarioMode && diff !== null && diff !== 0 && (
                <span className={`ml-2 text-xs ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ({formatDelta(diff)})
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2 text-xs text-gray-500">
        ABC is additief per SKU. Heeft geen invloed op SVASO allocatie.
      </div>
    </div>
  );
}
