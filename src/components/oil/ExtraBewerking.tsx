'use client';

import type { ExtraBewerkingInput } from '@/lib/data/demo-batch-v2';
import type { FullSKUCostResult } from '@/lib/engine/canonical-cost';
import { getOperationLabel, formatEurPerKg } from '@/lib/data/demo-batch-v2';
import { Level6bExtraBewerking } from './levels/Level6bExtraBewerking';

interface Props {
  bewerking: ExtraBewerkingInput;
  onUpdate: (updates: Partial<ExtraBewerkingInput>) => void;
  onRemove: () => void;
  inputSkuCost: FullSKUCostResult;
}

const OPERATION_TYPES: ExtraBewerkingInput['operation_type'][] = [
  'extern_verpakken', 'malen', 'worstmaken', 'overig',
];

export function ExtraBewerking({
  bewerking,
  onUpdate,
  onRemove,
  inputSkuCost,
}: Props) {
  return (
    <div className="border border-yellow-200 rounded-lg bg-white dark:bg-gray-800">
      {/* Edit form */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-yellow-900">Extra bewerking</h4>
          <button
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Verwijderen
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Operation type */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Type</label>
            <select
              value={bewerking.operation_type}
              onChange={(e) => onUpdate({
                operation_type: e.target.value as ExtraBewerkingInput['operation_type'],
                operation_label: getOperationLabel(e.target.value as ExtraBewerkingInput['operation_type']),
              })}
              className="w-full border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm"
            >
              {OPERATION_TYPES.map(t => (
                <option key={t} value={t}>{getOperationLabel(t)}</option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={bewerking.operation_label}
              onChange={(e) => onUpdate({ operation_label: e.target.value })}
              placeholder="Omschrijving"
              className="w-full border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Cost per kg */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Kost/kg</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={bewerking.cost_per_kg_eur}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0) onUpdate({ cost_per_kg_eur: v });
              }}
              className="w-full border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Cost per batch */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Kost/batch</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={bewerking.cost_per_batch_eur}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0) onUpdate({ cost_per_batch_eur: v });
              }}
              className="w-full border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Yield */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Rendement (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={bewerking.yield_pct}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0 && v <= 100) onUpdate({ yield_pct: v });
              }}
              className="w-full border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Output SKU */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Output SKU</label>
            <input
              type="text"
              value={bewerking.output_sku_code}
              onChange={(e) => onUpdate({ output_sku_code: e.target.value })}
              placeholder="SKU code"
              className="w-full border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Output selling price */}
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Verkoopprijs output/kg</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={bewerking.output_selling_price_per_kg}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0) onUpdate({ output_selling_price_per_kg: v });
              }}
              className="w-full border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Preview / result */}
      {bewerking.operation_label && bewerking.cost_per_kg_eur > 0 && (
        <div className="border-t border-yellow-200 p-4">
          <Level6bExtraBewerking
            bewerking={bewerking}
            inputSkuCost={inputSkuCost}
          />
        </div>
      )}
    </div>
  );
}
