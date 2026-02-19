'use client';

import type { ABCCostResult, ABCCostDriver } from '@/lib/engine/canonical-cost';
import type { ScenarioOverrides } from '../CostWaterfallShell';
import { formatEur, formatDelta } from '@/lib/data/demo-batch-v2';

/** Map driver_code → readable article name */
const ARTIKEL_FROM_CODE: Record<string, string> = {
  cutting_filet_supremes: 'Filet Suprêmes',
  cutting_drumsticks: 'Drumsticks',
  cutting_dijfilet_vel: 'Dijfilet m/v',
  cutting_platte_vleugels: 'Platte Vleugels',
  cutting_breast_cap: 'Borstkap',
  cutting_legs: 'Poten',
  cutting_wings: 'Vleugels',
};

function extractArtikel(driverCode: string, driverName: string): string {
  if (ARTIKEL_FROM_CODE[driverCode]) return ARTIKEL_FROM_CODE[driverCode];
  // Fallback: strip "Verwerking " prefix from driver_name
  if (driverName.startsWith('Verwerking ')) return driverName.slice(11);
  return driverName;
}

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
          <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
            <th className="pb-2 font-medium">Artikel</th>
            <th className="pb-2 font-medium">Activiteit</th>
            <th className="pb-2 text-right font-medium">Tarief/kg</th>
            <th className="pb-2 text-right font-medium">Gewicht (kg)</th>
            <th className="pb-2 text-right font-medium">Batchkosten</th>
            <th className="pb-2 text-right font-medium">ABC / kg</th>
          </tr>
        </thead>
        <tbody>
          {active.abc_drivers.map((d, i) => {
            const baseDriver = drivers[i];
            const artikel = extractArtikel(d.driver_code, d.driver_name);
            return (
              <tr key={d.driver_code} className={`border-t border-gray-100 dark:border-gray-700 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/50'}`}>
                <td className="py-2 font-semibold text-gray-900 dark:text-gray-100">{artikel}</td>
                <td className="py-2 text-gray-500 dark:text-gray-400 text-xs">{d.driver_name}</td>
                <td className="py-2 text-right">
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
                      className="border border-yellow-300 dark:border-yellow-600 rounded px-1 py-0.5 text-sm w-20 text-right"
                    />
                  ) : (
                    <span className="tabular-nums">{formatEur(d.rate_per_unit)}</span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{d.units_consumed.toFixed(2)}</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatEur(d.cost_eur)}</td>
                <td className="py-2 text-right tabular-nums text-amber-700 dark:text-amber-400 font-semibold">
                  {d.units_consumed > 0 ? formatEur(d.cost_eur / d.units_consumed) : '—'}
                  <span className="text-[10px] text-gray-400 ml-0.5">/kg</span>
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-amber-200 dark:border-amber-800 font-bold bg-amber-50/30 dark:bg-amber-900/20">
            <td className="py-2.5" colSpan={4}>Totaal ABC (batch)</td>
            <td className="py-2.5 text-right text-amber-700 dark:text-amber-400 text-base">
              {formatEur(active.total_abc_cost_eur)}
              {isScenarioMode && diff !== null && diff !== 0 && (
                <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${diff > 0 ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40' : 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'}`}>
                  {formatDelta(diff)}
                </span>
              )}
            </td>
            <td className="py-2.5"></td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2 text-[10px] text-gray-400 uppercase tracking-wider">
        ABC is additief per SKU — geen invloed op SVASO allocatie
      </div>
    </div>
  );
}
