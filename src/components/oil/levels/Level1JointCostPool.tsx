'use client';

import type { JointCostPoolResult } from '@/lib/engine/canonical-cost';
import { formatEur, formatEurPerKg, formatPct, formatDelta } from '@/lib/data/demo-batch-v2';

interface Props {
  canonResult: JointCostPoolResult;
  scenarioResult?: JointCostPoolResult;
  isScenarioMode: boolean;
}

export function Level1JointCostPool({ canonResult, scenarioResult, isScenarioMode }: Props) {
  const active = scenarioResult ?? canonResult;
  const diff = scenarioResult ? scenarioResult.joint_cost_pool_eur - canonResult.joint_cost_pool_eur : null;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div className="space-y-0.5">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Inkoopkosten</span>
          <p className="font-medium text-gray-900 dark:text-gray-100">{formatEur(active.landed_cost_eur)}</p>
        </div>
        <div className="space-y-0.5">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Slachtkosten</span>
          <p className="font-medium text-gray-900 dark:text-gray-100">{formatEur(active.slaughter_cost_eur)}</p>
        </div>
        <div className="space-y-0.5">
          <span className="text-xs text-gray-400 uppercase tracking-wider">C_joint (kostenpool)</span>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatEur(active.joint_cost_pool_eur)}</p>
            {isScenarioMode && diff !== null && diff !== 0 && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${diff > 0 ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40' : 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'}`}>
                {formatDelta(diff)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded-md">
          Griller rendement: <strong>{formatPct(active.griller_yield_pct)}</strong>
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded-md">
          Kostprijs/kg (griller): <strong>{formatEurPerKg(active.griller_cost_per_kg)}</strong>
        </span>
        <span className="text-xs text-oranje-600 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-md">
          C_joint = inkoop + slacht
        </span>
      </div>
    </div>
  );
}
