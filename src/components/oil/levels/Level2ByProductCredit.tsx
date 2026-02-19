'use client';

import type { NetJointCostResult } from '@/lib/engine/canonical-cost';
import { formatEur, formatKg, formatEurPerKg, formatDelta, getPartNameDutch } from '@/lib/data/demo-batch-v2';
import { BY_PRODUCT_RATE_PER_KG } from '@/lib/engine/canonical-cost';

interface Props {
  canonResult: NetJointCostResult;
  scenarioResult?: NetJointCostResult;
  isScenarioMode: boolean;
}

export function Level2ByProductCredit({ canonResult, scenarioResult, isScenarioMode }: Props) {
  const active = scenarioResult ?? canonResult;
  const diff = scenarioResult ? scenarioResult.net_joint_cost_eur - canonResult.net_joint_cost_eur : null;

  return (
    <div>
      {/* By-product table */}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-500">
            <th className="pb-2">Bijproduct</th>
            <th className="pb-2 text-right">Gewicht</th>
            <th className="pb-2 text-right">Tarief</th>
            <th className="pb-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {active.by_product_details.map(bp => (
            <tr key={bp.id} className="border-t border-gray-100 dark:border-gray-700">
              <td className="py-1.5">{getPartNameDutch(bp.type)}</td>
              <td className="py-1.5 text-right">{formatKg(bp.weight_kg)}</td>
              <td className="py-1.5 text-right font-mono text-gray-500 dark:text-gray-500">
                {formatEurPerKg(BY_PRODUCT_RATE_PER_KG)}
              </td>
              <td className="py-1.5 text-right text-green-600">
                -{formatEur(bp.credit_eur)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-bold">
            <td className="py-2">Totaal</td>
            <td className="py-2 text-right">{formatKg(active.by_product_weight_kg)}</td>
            <td className="py-2 text-right text-gray-400 dark:text-gray-500">vast</td>
            <td className="py-2 text-right text-green-700">
              -{formatEur(active.by_product_credit_eur)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Result */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-gray-500 dark:text-gray-500">C_joint:</span>
        <span className="font-medium">{formatEur(active.joint_cost_pool_eur)}</span>
        <span className="text-gray-400 dark:text-gray-500">-</span>
        <span className="text-green-600 font-medium">{formatEur(active.by_product_credit_eur)}</span>
        <span className="text-gray-400 dark:text-gray-500">=</span>
        <span className="font-bold text-emerald-800">
          C_netto_joint: {formatEur(active.net_joint_cost_eur)}
        </span>
        {isScenarioMode && diff !== null && diff !== 0 && (
          <span className={`text-xs font-medium ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ({formatDelta(diff)})
          </span>
        )}
      </div>
    </div>
  );
}
