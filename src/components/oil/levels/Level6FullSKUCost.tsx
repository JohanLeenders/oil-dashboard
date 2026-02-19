'use client';

import type { FullSKUCostResult, SVASOAllocationResult, ABCCostResult } from '@/lib/engine/canonical-cost';
import { formatEur, formatEurPerKg, formatDelta } from '@/lib/data/demo-batch-v2';

/** Map part_code → readable article name */
const PART_NAMES: Record<string, string> = {
  filet_supremes: 'Filet Suprêmes',
  drumsticks: 'Drumsticks',
  dijfilet_vel: 'Dijfilet m/v',
  platte_vleugels: 'Platte Vleugels',
  breast_cap: 'Borstkap',
  legs: 'Poten',
  wings: 'Vleugels',
};

interface PerSkuRow {
  partCode: string;
  name: string;
  weightKg: number;
  svasoCostPerKg: number;
  svasoCostTotal: number;
  abcCostPerKg: number;
  abcCostTotal: number;
  totalCostPerKg: number;
  totalCostEur: number;
}

interface Props {
  canonResult: FullSKUCostResult;
  scenarioResult?: FullSKUCostResult;
  isScenarioMode: boolean;
  /** SVASO allocations from Level 3 — used for per-SKU breakdown */
  svasoAllocations?: SVASOAllocationResult;
  /** ABC result from Level 5 — used for per-SKU breakdown */
  abcResult?: ABCCostResult;
}

function buildPerSkuRows(
  svasoAllocations: SVASOAllocationResult,
  abcResult: ABCCostResult,
): PerSkuRow[] {
  // Index ABC drivers by part_code (extracted from driver_code: "cutting_filet_supremes" → "filet_supremes")
  const abcByPart: Record<string, { ratePerKg: number; units: number; cost: number }> = {};
  for (const d of abcResult.abc_drivers) {
    const partCode = d.driver_code.replace(/^cutting_/, '');
    abcByPart[partCode] = {
      ratePerKg: d.rate_per_unit,
      units: d.units_consumed,
      cost: d.cost_eur,
    };
  }

  return svasoAllocations.allocations.map((alloc) => {
    const abc = abcByPart[alloc.part_code] ?? { ratePerKg: 0, units: 0, cost: 0 };
    const totalCostPerKg = alloc.allocated_cost_per_kg + abc.ratePerKg;
    const totalCostEur = alloc.allocated_cost_total_eur + abc.cost;

    return {
      partCode: alloc.part_code,
      name: PART_NAMES[alloc.part_code] ?? alloc.part_code,
      weightKg: alloc.weight_kg,
      svasoCostPerKg: alloc.allocated_cost_per_kg,
      svasoCostTotal: alloc.allocated_cost_total_eur,
      abcCostPerKg: abc.ratePerKg,
      abcCostTotal: abc.cost,
      totalCostPerKg,
      totalCostEur,
    };
  });
}

export function Level6FullSKUCost({
  canonResult,
  scenarioResult,
  isScenarioMode,
  svasoAllocations,
  abcResult,
}: Props) {
  const active = scenarioResult ?? canonResult;
  const diff = scenarioResult ? scenarioResult.cost_per_kg - canonResult.cost_per_kg : null;

  // If we have per-SKU data, show the detailed breakdown
  const hasPerSkuData = svasoAllocations && abcResult && abcResult.abc_drivers.length > 0;
  const skuRows = hasPerSkuData ? buildPerSkuRows(svasoAllocations, abcResult) : null;

  if (skuRows && skuRows.length > 0) {
    const totalWeight = skuRows.reduce((s, r) => s + r.weightKg, 0);
    const totalSvaso = skuRows.reduce((s, r) => s + r.svasoCostTotal, 0);
    const totalAbc = skuRows.reduce((s, r) => s + r.abcCostTotal, 0);
    const grandTotal = skuRows.reduce((s, r) => s + r.totalCostEur, 0);

    return (
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
              <th className="pb-2 font-medium">Artikel (SKU)</th>
              <th className="pb-2 text-right font-medium">Gewicht</th>
              <th className="pb-2 text-right font-medium">SVASO/kg</th>
              <th className="pb-2 text-right font-medium">ABC/kg</th>
              <th className="pb-2 text-right font-medium">Kostprijs/kg</th>
              <th className="pb-2 text-right font-medium">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {skuRows.map((row, i) => (
              <tr key={row.partCode} className={`border-t border-gray-100 dark:border-gray-700 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/50'}`}>
                <td className="py-2 font-semibold text-gray-900 dark:text-gray-100">{row.name}</td>
                <td className="py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{row.weightKg.toFixed(0)} kg</td>
                <td className="py-2 text-right tabular-nums">{formatEurPerKg(row.svasoCostPerKg)}</td>
                <td className="py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatEurPerKg(row.abcCostPerKg)}</td>
                <td className="py-2 text-right tabular-nums font-semibold">{formatEurPerKg(row.totalCostPerKg)}</td>
                <td className="py-2 text-right tabular-nums font-medium">{formatEur(row.totalCostEur)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-orange-200 dark:border-orange-800 font-bold bg-orange-50/30 dark:bg-orange-900/20">
              <td className="py-2.5">Totaal</td>
              <td className="py-2.5 text-right tabular-nums">{totalWeight.toFixed(0)} kg</td>
              <td className="py-2.5 text-right tabular-nums text-gray-500">{formatEur(totalSvaso)}</td>
              <td className="py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatEur(totalAbc)}</td>
              <td className="py-2.5 text-right">—</td>
              <td className="py-2.5 text-right text-orange-700 dark:text-orange-400 text-base">{formatEur(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-2 text-[10px] text-gray-400 uppercase tracking-wider">
          Kostprijs/kg = SVASO allocatie + ABC verwerking per artikel
        </div>
      </div>
    );
  }

  // Fallback: original single-SKU view (for Oranjehoen profile or missing data)
  const rows = [
    { label: 'Vleeskost', value: active.meat_cost_eur, detail: `${formatEurPerKg(active.meat_cost_per_kg)} × ${active.meat_content_kg.toFixed(3)} kg` },
    { label: 'Verpakking', value: active.packaging_cost_eur, detail: null },
    { label: 'ABC toeslag', value: active.abc_cost_eur, detail: null },
    { label: 'Weggeeflast (E-merk)', value: active.giveaway_cost_eur, detail: null },
  ];

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
            <th className="pb-2 font-medium">Onderdeel</th>
            <th className="pb-2 text-right font-medium">Detail</th>
            <th className="pb-2 text-right font-medium">Kosten (€)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={`border-t border-gray-100 dark:border-gray-700 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/50'}`}>
              <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{row.label}</td>
              <td className="py-2 text-right text-gray-400 text-xs">
                {row.detail || '—'}
              </td>
              <td className="py-2 text-right tabular-nums">{formatEur(row.value)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-orange-200 dark:border-orange-800 font-bold bg-orange-50/30 dark:bg-orange-900/20">
            <td className="py-2.5" colSpan={2}>Totaal SKU-kostprijs</td>
            <td className="py-2.5 text-right text-orange-700 dark:text-orange-400 text-base">
              {formatEur(active.total_sku_cost_eur)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Cost per kg summary */}
      <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-between">
        <span className="text-xs font-semibold text-orange-800 dark:text-orange-300 uppercase tracking-wider">Kostprijs per kg</span>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-orange-700 dark:text-orange-400 tabular-nums">
            {formatEurPerKg(active.cost_per_kg)}
          </span>
          {isScenarioMode && diff !== null && diff !== 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diff > 0 ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40' : 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'}`}>
              {formatDelta(diff)}/kg
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
