'use client';

import type { ExtraBewerkingInput } from '@/lib/data/demo-batch-v2';
import type { FullSKUCostResult } from '@/lib/engine/canonical-cost';
import { formatEur, formatEurPerKg, formatPct } from '@/lib/data/demo-batch-v2';

interface Props {
  bewerking: ExtraBewerkingInput;
  inputSkuCost: FullSKUCostResult;
}

export function Level6bExtraBewerking({ bewerking, inputSkuCost }: Props) {
  const inputCostPerKg = inputSkuCost.cost_per_kg;
  const yieldFactor = bewerking.yield_pct / 100;
  const meatCostAdjusted = yieldFactor > 0 ? inputCostPerKg / yieldFactor : inputCostPerKg;
  const totalAdditionalPerKg = bewerking.cost_per_kg_eur;
  const outputCostPerKg = meatCostAdjusted + totalAdditionalPerKg;
  const margin = bewerking.output_selling_price_per_kg - outputCostPerKg;

  return (
    <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm text-yellow-900">
          {bewerking.operation_label || bewerking.operation_type}
        </h4>
        <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
          {formatPct(bewerking.yield_pct)} rendement
        </span>
      </div>

      <table className="w-full text-sm">
        <tbody>
          <tr className="border-t border-yellow-200">
            <td className="py-1.5 text-gray-600">Input SKU</td>
            <td className="py-1.5 text-right">{bewerking.input_sku_codes.join(', ')}</td>
          </tr>
          <tr className="border-t border-yellow-200">
            <td className="py-1.5 text-gray-600">Input kostprijs/kg</td>
            <td className="py-1.5 text-right">{formatEurPerKg(inputCostPerKg)}</td>
          </tr>
          <tr className="border-t border-yellow-200">
            <td className="py-1.5 text-gray-600">Yield-aangepaste kost/kg</td>
            <td className="py-1.5 text-right">{formatEurPerKg(meatCostAdjusted)}</td>
          </tr>
          <tr className="border-t border-yellow-200">
            <td className="py-1.5 text-gray-600">Bewerkingskost/kg</td>
            <td className="py-1.5 text-right">{formatEurPerKg(bewerking.cost_per_kg_eur)}</td>
          </tr>
          {bewerking.cost_per_batch_eur > 0 && (
            <tr className="border-t border-yellow-200">
              <td className="py-1.5 text-gray-600">Batchkost</td>
              <td className="py-1.5 text-right">{formatEur(bewerking.cost_per_batch_eur)}</td>
            </tr>
          )}
          <tr className="border-t-2 border-yellow-300 font-bold">
            <td className="py-1.5">Output kostprijs/kg</td>
            <td className="py-1.5 text-right text-yellow-800">{formatEurPerKg(outputCostPerKg)}</td>
          </tr>
          <tr className="border-t border-yellow-200">
            <td className="py-1.5 text-gray-600">Output SKU</td>
            <td className="py-1.5 text-right">{bewerking.output_sku_code || '(niet ingevuld)'}</td>
          </tr>
          <tr className="border-t border-yellow-200">
            <td className="py-1.5 text-gray-600">Verkoopprijs/kg</td>
            <td className="py-1.5 text-right">{formatEurPerKg(bewerking.output_selling_price_per_kg)}</td>
          </tr>
          <tr className="border-t border-yellow-200">
            <td className="py-1.5 font-medium">Marge/kg</td>
            <td className={`py-1.5 text-right font-medium ${margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatEurPerKg(margin)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
