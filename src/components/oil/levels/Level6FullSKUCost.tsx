'use client';

import type { FullSKUCostResult } from '@/lib/engine/canonical-cost';
import { formatEur, formatEurPerKg, formatDelta } from '@/lib/data/demo-batch-v2';

interface Props {
  canonResult: FullSKUCostResult;
  scenarioResult?: FullSKUCostResult;
  isScenarioMode: boolean;
}

export function Level6FullSKUCost({
  canonResult,
  scenarioResult,
  isScenarioMode,
}: Props) {
  const active = scenarioResult ?? canonResult;
  const diff = scenarioResult ? scenarioResult.cost_per_kg - canonResult.cost_per_kg : null;

  const rows = [
    { label: 'Vleeskost', value: active.meat_cost_eur, detail: `${formatEurPerKg(active.meat_cost_per_kg)} × ${active.meat_content_kg.toFixed(3)} kg` },
    { label: 'Verpakking', value: active.packaging_cost_eur, detail: null },
    { label: 'ABC toeslag', value: active.abc_cost_eur, detail: null },
    { label: 'Giveaway (E-mark)', value: active.giveaway_cost_eur, detail: null },
  ];

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="pb-2">Component</th>
            <th className="pb-2 text-right">Detail</th>
            <th className="pb-2 text-right">Kosten (€)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-gray-100">
              <td className="py-1.5 font-medium">{row.label}</td>
              <td className="py-1.5 text-right text-gray-500 text-xs">
                {row.detail || '—'}
              </td>
              <td className="py-1.5 text-right">{formatEur(row.value)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-orange-200 font-bold">
            <td className="py-2" colSpan={2}>Totaal SKU-kostprijs</td>
            <td className="py-2 text-right text-orange-800">
              {formatEur(active.total_sku_cost_eur)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Cost per kg summary */}
      <div className="mt-3 p-3 bg-orange-50 rounded-lg flex items-center justify-between">
        <span className="text-sm font-medium text-orange-900">Kostprijs per kg</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-orange-800">
            {formatEurPerKg(active.cost_per_kg)}
          </span>
          {isScenarioMode && diff !== null && diff !== 0 && (
            <span className={`text-xs font-medium ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ({formatDelta(diff)}/kg)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
