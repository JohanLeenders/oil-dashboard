'use client';

import type { MassBalanceStatus } from '@/lib/data/demo-batch-v2';
import { formatKg, formatPct } from '@/lib/data/demo-batch-v2';
import { MassBalanceIndicator } from './MassBalanceIndicator';
import { KFactorDisplay } from './KFactorDisplay';

interface BovenbalkProps {
  batch: {
    batch_id: string;
    batch_ref: string;
    date: string;
    input_live_kg: number;
    input_count: number;
    griller_output_kg: number;
    griller_yield_pct: number;
    k_factor: number;
    k_factor_interpretation: 'PROFITABLE' | 'BREAK_EVEN' | 'LOSS';
    mass_balance_deviation_pct: number;
    mass_balance_status: MassBalanceStatus;
  };
  isScenarioMode: boolean;
  canUseScenario: boolean;
  onScenarioToggle: () => void;
  showExplanation: boolean;
  onExplanationToggle: () => void;
}

export function Bovenbalk({
  batch,
  isScenarioMode,
  canUseScenario,
  onScenarioToggle,
  showExplanation,
  onExplanationToggle,
}: BovenbalkProps) {
  return (
    <div>
      {/* Top bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Title + Batch selector */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kostprijswaterval</h1>
              <p className="text-sm text-gray-500">Canonieke 7-level kostprijsberekening</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Batch:</label>
              <select className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white">
                <option>{batch.batch_ref} | {batch.date}</option>
              </select>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-4">
            <MassBalanceIndicator
              status={batch.mass_balance_status}
              deviationPct={batch.mass_balance_deviation_pct}
            />
            <KFactorDisplay
              kFactor={batch.k_factor}
              interpretation={batch.k_factor_interpretation}
            />
            {/* Canon/Scenario toggle */}
            <button
              onClick={onScenarioToggle}
              disabled={!canUseScenario && !isScenarioMode}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isScenarioMode
                  ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400 hover:bg-yellow-200'
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
              } ${!canUseScenario && !isScenarioMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={!canUseScenario && !isScenarioMode ? 'Geblokkeerd: mass balance afwijking > 7.5%' : ''}
            >
              {isScenarioMode ? 'Scenario' : 'Canon (Werkelijk)'}
            </button>
            {/* Explanation toggle */}
            <button
              onClick={onExplanationToggle}
              className="px-3 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
            >
              {showExplanation ? 'Verberg uitleg' : 'Toon uitleg'}
            </button>
          </div>
        </div>
      </div>

      {/* Batch summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Input Live</div>
          <div className="text-xl font-bold text-gray-900">{formatKg(batch.input_live_kg)}</div>
          <div className="text-sm text-gray-500">{batch.input_count.toLocaleString('nl-NL')} vogels</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Griller Output</div>
          <div className="text-xl font-bold text-gray-900">{formatKg(batch.griller_output_kg)}</div>
          <div className="text-sm text-gray-500">{formatPct(batch.griller_yield_pct)} rendement</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">k-factor</div>
          <KFactorDisplay
            kFactor={batch.k_factor}
            interpretation={batch.k_factor_interpretation}
            size="lg"
          />
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Mass Balance</div>
          <MassBalanceIndicator
            status={batch.mass_balance_status}
            deviationPct={batch.mass_balance_deviation_pct}
            size="lg"
          />
        </div>
      </div>
    </div>
  );
}
