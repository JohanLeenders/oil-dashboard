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
        <div>
          <span className="text-gray-500">Landed cost:</span>
          <span className="ml-2 font-medium">{formatEur(active.landed_cost_eur)}</span>
        </div>
        <div>
          <span className="text-gray-500">Slachtkosten:</span>
          <span className="ml-2 font-medium">{formatEur(active.slaughter_cost_eur)}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">C_joint (kostenpool):</span>
          <span className="ml-2 font-bold text-green-800">{formatEur(active.joint_cost_pool_eur)}</span>
          {isScenarioMode && diff !== null && diff !== 0 && (
            <span className={`ml-2 text-xs font-medium ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ({formatDelta(diff)})
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <span>Griller rendement: {formatPct(active.griller_yield_pct)}</span>
        <span>Kostprijs per kg (griller): {formatEurPerKg(active.griller_cost_per_kg)}</span>
        <span className="text-orange-600">
          C_joint = landed + slacht (bijproductcredit is Level 2)
        </span>
      </div>
    </div>
  );
}
