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
    <div className="space-y-4">
      {/* Top bar — compact dark-ish banner */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Title + Batch */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Kostprijswaterval</h1>
              <p className="text-xs text-gray-400">7-level kostprijsberekening</p>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden md:block" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Batch</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-600">
                {batch.batch_ref} — {batch.date}
              </span>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {/* Canon/Scenario toggle */}
            <button
              onClick={onScenarioToggle}
              disabled={!canUseScenario && !isScenarioMode}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isScenarioMode
                  ? 'bg-yellow-400 text-yellow-900 shadow-sm hover:bg-yellow-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${!canUseScenario && !isScenarioMode ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={!canUseScenario && !isScenarioMode ? 'Geblokkeerd: mass balance afwijking > 7.5%' : ''}
            >
              {isScenarioMode ? '● Scenario' : 'Canon'}
            </button>
            {/* Explanation toggle */}
            <button
              onClick={onExplanationToggle}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {showExplanation ? 'Verberg uitleg' : 'Uitleg'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards — compact 4-grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Levend gewicht</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1 tabular-nums">{formatKg(batch.input_live_kg)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{batch.input_count.toLocaleString('nl-NL')} vogels</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Griller opbrengst</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1 tabular-nums">{formatKg(batch.griller_output_kg)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{formatPct(batch.griller_yield_pct)} rendement</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider">k-factor</div>
          <div className="mt-1">
            <KFactorDisplay
              kFactor={batch.k_factor}
              interpretation={batch.k_factor_interpretation}
              size="lg"
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Massabalans</div>
          <div className="mt-1">
            <MassBalanceIndicator
              status={batch.mass_balance_status}
              deviationPct={batch.mass_balance_deviation_pct}
              size="lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
