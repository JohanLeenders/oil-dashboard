'use client';

/**
 * PreviewStep — Stap 3: Aggregatie preview met vergelijkingsbalken
 */

import type { CustomerProductMix } from '@/lib/engine/cherry-picker';
import { ANATOMICAL_NORMS } from '@/lib/engine/cherry-picker';
import type { ExcludedItem } from '@/lib/data/customer-import-store';
import { MixComparisonBar } from './MixComparisonBar';

const CATEGORY_LABELS: Record<string, string> = {
  hele_kip: 'Hele kip',
  filet: 'Filet',
  haas: 'Haas',
  dij: 'Dij',
  drumstick: 'Drumstick',
  drumvlees: 'Drumvlees',
  vleugels: 'Vleugels',
  karkas: 'Karkas',
  organen: 'Organen',
  vel: 'Vel',
};

interface Props {
  customerName: string;
  productMix: CustomerProductMix[];
  excludedItems: ExcludedItem[];
  totalKg: number;
  totalRevenue: number;
  totalExcludedRevenue: number;
  onAnalyze: () => void;
  onBack: () => void;
}

export function PreviewStep({
  customerName,
  productMix,
  excludedItems,
  totalKg,
  totalRevenue,
  totalExcludedRevenue,
  onAnalyze,
  onBack,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {customerName}
        </h3>
        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Totaal kg</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {totalKg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg
            </p>
          </div>
          <div>
            <p className="text-gray-500">Omzet (kg-producten)</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              €{totalRevenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Uitgesloten omzet</p>
            <p className="text-lg font-bold text-gray-400">
              €{totalExcludedRevenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Vergelijkingsbalken */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Klant-afname vs anatomische norm
        </h4>
        <div className="space-y-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          {ANATOMICAL_NORMS
            .filter(norm => norm.category !== 'hele_kip') // Hele kip apart
            .map(norm => {
              const mix = productMix.find(p => p.category === norm.category);
              const customerPct = totalKg > 0 ? ((mix?.quantity_kg || 0) / totalKg) * 100 : 0;
              return (
                <MixComparisonBar
                  key={norm.category}
                  label={CATEGORY_LABELS[norm.category] || norm.category}
                  customerPct={customerPct}
                  anatomicalPct={norm.ratio_pct}
                />
              );
            })
          }
          {/* Vel apart (geen anatomische norm) */}
          {productMix.find(p => p.category === 'vel') && (
            <MixComparisonBar
              label="Vel"
              customerPct={totalKg > 0 ? ((productMix.find(p => p.category === 'vel')!.quantity_kg) / totalKg) * 100 : 0}
              anatomicalPct={0}
            />
          )}
        </div>
      </div>

      {/* Detail tabel */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categorie</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Kg</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Omzet</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">% Totaal</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Norm %</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Delta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {productMix.map(item => {
              const pct = totalKg > 0 ? (item.quantity_kg / totalKg) * 100 : 0;
              const norm = ANATOMICAL_NORMS.find(n => n.category === item.category);
              const normPct = norm?.ratio_pct ?? 0;
              const delta = pct - normPct;
              const isOver = delta > 5;
              const isUnder = delta < -5;

              return (
                <tr key={item.category} className={isOver ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {item.quantity_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    €{item.revenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono font-medium ${
                    isOver ? 'text-red-600' : isUnder ? 'text-blue-500' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-gray-500">
                    {normPct > 0 ? `${normPct}%` : '-'}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono ${
                    isOver ? 'text-red-600 font-medium' : isUnder ? 'text-blue-500' : 'text-gray-400'
                  }`}>
                    {normPct > 0 ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <td className="px-4 py-2 font-bold text-gray-900 dark:text-gray-100">Totaal</td>
              <td className="px-4 py-2 text-right font-mono font-bold">
                {totalKg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </td>
              <td className="px-4 py-2 text-right font-mono font-bold">
                €{totalRevenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </td>
              <td className="px-4 py-2 text-right font-bold">100%</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Uitgesloten items */}
      {excludedItems.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Uitgesloten items ({excludedItems.length})
          </h4>
          <div className="text-xs space-y-1">
            {excludedItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-gray-500">
                <span>{item.omschrijving} ({item.artikelcode})</span>
                <span>
                  {item.aantal} {item.eenheid === 'Stuk' ? 'st' : 'kg'}
                  {item.verkoopbedrag > 0 && ` • €${item.verkoopbedrag.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`}
                  {' • '}{item.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knoppen */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700
                     dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← Terug
        </button>
        <button
          onClick={onAnalyze}
          className="flex-1 py-2.5 px-4 bg-green-600 text-white rounded-lg font-medium
                     hover:bg-green-700 transition-colors"
        >
          🔍 Bereken Cherry-Picker Score
        </button>
      </div>
    </div>
  );
}
