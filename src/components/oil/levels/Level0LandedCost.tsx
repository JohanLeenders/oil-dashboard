'use client';

import type { LandedCostResult, LandedCostInput } from '@/lib/engine/canonical-cost';
import { formatEur, formatEurPerKg, formatKg } from '@/lib/data/demo-batch-v2';

interface Props {
  result: LandedCostResult;
  input: LandedCostInput;
  grillerWeightKg: number;
  isScenarioMode: boolean;
  scenarioGrillerWeight?: number;
  onOverrideChange: (key: string, value: number) => void;
}

export function Level0LandedCost({
  result,
  input,
  grillerWeightKg,
  isScenarioMode,
  scenarioGrillerWeight,
  onOverrideChange,
}: Props) {
  const liveMaterial = input.input_live_kg * input.live_price_per_kg;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Live materiaal:</span>
          <span className="ml-2 font-medium">{formatEur(liveMaterial)}</span>
        </div>
        <div>
          <span className="text-gray-500">Transport:</span>
          <span className="ml-2 font-medium">{formatEur(input.transport_cost_eur)}</span>
        </div>
        <div>
          <span className="text-gray-500">Vangkosten:</span>
          <span className="ml-2 font-medium">{formatEur(input.catching_fee_eur)}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">Totaal Landed:</span>
          <span className="ml-2 font-bold text-blue-800">{formatEur(result.landed_cost_eur)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-gray-600">
          Kostprijs per kg (live): {formatEurPerKg(result.landed_cost_per_kg)}
        </span>
        <span className="text-gray-600">
          DOA: {input.doa_count} ({((input.doa_count / input.input_count) * 100).toFixed(1)}%)
        </span>
        {result.abnormal_doa_variance_eur > 0 && (
          <span className="text-red-600 font-medium">
            Abnormale DOA variantie: {formatEur(result.abnormal_doa_variance_eur)}
          </span>
        )}
      </div>

      {/* Scenario: Griller weight override */}
      {isScenarioMode && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <label className="block text-sm font-medium text-yellow-800 mb-1">
            Griller gewicht (scenario override)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={input.input_live_kg}
              step={10}
              value={scenarioGrillerWeight ?? grillerWeightKg}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0 && v <= input.input_live_kg) {
                  onOverrideChange('grillerWeightKg', v);
                }
              }}
              className="border border-yellow-300 rounded px-2 py-1 text-sm w-32"
            />
            <span className="text-sm text-gray-500">kg</span>
            <span className="text-xs text-gray-400">
              (canon: {formatKg(grillerWeightKg)} = {((grillerWeightKg / result.usable_live_kg) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
