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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div className="space-y-0.5">
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>Live materiaal</span>
          <p className="font-medium" style={{ color: 'var(--color-text-main)' }}>{formatEur(liveMaterial)}</p>
        </div>
        <div className="space-y-0.5">
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>Levend €/kg</span>
          <p className="font-medium" style={{ color: 'var(--color-text-main)' }}>{formatEurPerKg(input.live_price_per_kg)}</p>
        </div>
        <div className="space-y-0.5">
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>Totaal Inkoop</span>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatEur(result.landed_cost_eur)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-xs px-2 py-1 rounded-md" style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-elevated)' }}>
          Kostprijs/kg (levend): <strong>{formatEurPerKg(result.landed_cost_per_kg)}</strong>
        </span>
        <span className="text-xs px-2 py-1 rounded-md" style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-elevated)' }}>
          DOA: {input.doa_count} ({((input.doa_count / input.input_count) * 100).toFixed(1)}%)
        </span>
        {result.abnormal_doa_variance_eur > 0 && (
          <span className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40 px-2 py-1 rounded-md font-medium">
            Abnormale DOA variantie: {formatEur(result.abnormal_doa_variance_eur)}
          </span>
        )}
      </div>

      {/* Scenario: Griller weight override */}
      {isScenarioMode && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <label className="block text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
            Griller gewicht (scenario aanpassing)
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
              className="border border-yellow-300 dark:text-gray-100 rounded px-2 py-1 text-sm w-32"
            />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>kg</span>
            <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              (canon: {formatKg(grillerWeightKg)} = {((grillerWeightKg / result.usable_live_kg) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
