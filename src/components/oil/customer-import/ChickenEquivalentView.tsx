'use client';

/**
 * ChickenEquivalentView — Kip-overzicht
 *
 * Inverse view: toont hoeveel hele kippen nodig zijn voor de klantafname,
 * en wat de natuurlijke productie is per categorie. Maakt het "surplus probleem"
 * zichtbaar — delen die geproduceerd worden maar niet door deze klant worden afgenomen.
 *
 * Sprint 16C: Perspectief-toggle — wissel tussen categorieën om te zien
 * hoeveel kippen per onderdeel nodig zijn en wat de consequenties zijn.
 */

import { useMemo, useState } from 'react';
import {
  calculateChickenEquivalent,
  DEFAULT_GRILLER_WEIGHT_KG,
} from '@/lib/engine/chicken-equivalent';
import type { CherryPickerAnalysis } from '@/lib/engine/cherry-picker';
import type { ProductCategory } from '@/types/database';
import { ProductionComparisonBar } from './ProductionComparisonBar';

interface Props {
  analysis: CherryPickerAnalysis;
  grillerWeight?: number;
}

/** Categorie labels in het Nederlands */
const CATEGORY_LABELS: Record<string, string> = {
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

export function ChickenEquivalentView({ analysis, grillerWeight }: Props) {
  const weight = grillerWeight ?? DEFAULT_GRILLER_WEIGHT_KG;

  // undefined = auto-leading (maximum kippen nodig)
  const [perspective, setPerspective] = useState<ProductCategory | undefined>(undefined);

  // Eerste berekening: auto-leading (altijd nodig voor de "Maximum" label + categorielijst)
  const autoResult = useMemo(
    () => calculateChickenEquivalent(
      analysis.category_breakdown,
      { avg_griller_weight_kg: weight },
    ),
    [analysis.category_breakdown, weight],
  );

  // Tweede berekening: met perspectief (als gekozen)
  const result = useMemo(
    () => {
      if (!perspective) return autoResult;
      return calculateChickenEquivalent(
        analysis.category_breakdown,
        { avg_griller_weight_kg: weight, perspective_category: perspective },
      );
    },
    [analysis.category_breakdown, weight, perspective, autoResult],
  );

  if (autoResult.totaal_kippen_nodig === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Geen gegevens beschikbaar voor het kip-overzicht.
      </div>
    );
  }

  // Categorieën die de klant daadwerkelijk afneemt (voor de selector)
  const soldCategories = autoResult.categories
    .filter(c => c.klant_afname_kg > 0)
    .sort((a, b) => b.kippen_nodig_voor_categorie - a.kippen_nodig_voor_categorie);

  // Max kg voor de vergelijkingsbalken
  const maxKg = Math.max(
    ...result.categories.map(c => Math.max(c.natuurlijke_productie_kg, c.klant_afname_kg))
  );

  const isAutoLeading = perspective === undefined;

  return (
    <div className="space-y-6">
      {/* Perspectief-selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
          Bekijk vanuit
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Maximum (auto-leading) knop */}
          <button
            onClick={() => setPerspective(undefined)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
              isAutoLeading
                ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-300'
                : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            Maximum ({CATEGORY_LABELS[autoResult.leading_category]})
          </button>

          {/* Per categorie */}
          {soldCategories.map(cat => {
            const isSelected = perspective === cat.category;
            const isLeading = cat.category === autoResult.leading_category;
            return (
              <button
                key={cat.category}
                onClick={() => setPerspective(cat.category)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {CATEGORY_LABELS[cat.category] ?? cat.category}
                {isLeading && !isSelected && (
                  <span className="ml-1 text-[10px] text-orange-500">max</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero: Kippen nodig */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {isAutoLeading
            ? 'Benodigd voor volledige klantafname'
            : `Benodigd voor ${CATEGORY_LABELS[perspective!]} afname`}
        </p>
        <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">
          ~{Math.round(result.totaal_kippen_nodig).toLocaleString('nl-NL')} kippen
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {formatKg(result.totaal_griller_kg)} kg grillergewicht
        </p>
        <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
          isAutoLeading
            ? 'bg-orange-50 dark:bg-orange-900/30'
            : 'bg-blue-50 dark:bg-blue-900/30'
        }`}>
          <span className={`font-medium ${
            isAutoLeading
              ? 'text-orange-700 dark:text-orange-400'
              : 'text-blue-700 dark:text-blue-400'
          }`}>
            {isAutoLeading
              ? `Bepalende categorie: ${CATEGORY_LABELS[result.leading_category] ?? result.leading_category}`
              : `Perspectief: ${CATEGORY_LABELS[perspective!]}`}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Gebaseerd op {result.avg_griller_weight_kg} kg gemiddeld grillergewicht
        </p>
      </div>

      {/* Surplus / Tekort kaarten */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-lg border p-4 ${
          result.totaal_surplus_kg > 0
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">Surplus</p>
          <p className={`text-xl font-bold mt-1 ${
            result.totaal_surplus_kg > 0
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-gray-400'
          }`}>
            {formatKg(result.totaal_surplus_kg)} kg
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Geproduceerd maar niet afgenomen
          </p>
        </div>
        <div className={`rounded-lg border p-4 ${
          result.totaal_tekort_kg > 0
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">Tekort</p>
          <p className={`text-xl font-bold mt-1 ${
            result.totaal_tekort_kg > 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-400'
          }`}>
            {formatKg(result.totaal_tekort_kg)} kg
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Klant wil meer dan beschikbaar
          </p>
        </div>
      </div>

      {/* Vergelijkingsbalken per categorie */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Productie vs afname per categorie
        </h4>
        <div className="space-y-4">
          {result.categories.map(cat => (
            <ProductionComparisonBar
              key={cat.category}
              label={CATEGORY_LABELS[cat.category] ?? cat.category}
              productionKg={cat.natuurlijke_productie_kg}
              demandKg={cat.klant_afname_kg}
              maxKg={maxKg}
              isLeading={cat.category === result.leading_category}
            />
          ))}
        </div>
      </div>

      {/* Detail tabel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categorie</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Afname (kg)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Productie (kg)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Delta (kg)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Norm %</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Kippen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {result.categories.map(cat => {
              const delta = cat.delta_kg;
              const isSurplus = delta > 10;
              const isTekort = delta < -10;
              return (
                <tr
                  key={cat.category}
                  className={cat.category === result.leading_category
                    ? isAutoLeading
                      ? 'bg-orange-50 dark:bg-orange-900/10'
                      : 'bg-blue-50 dark:bg-blue-900/10'
                    : ''}
                >
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {CATEGORY_LABELS[cat.category] ?? cat.category}
                    {cat.category === result.leading_category && (
                      <span className={`ml-1 text-xs ${isAutoLeading ? 'text-orange-600' : 'text-blue-600'}`}>
                        ({isAutoLeading ? 'bepalend' : 'perspectief'})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">
                    {formatKg(cat.klant_afname_kg)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-right">
                    {formatKg(cat.natuurlijke_productie_kg)}
                  </td>
                  <td className={`px-4 py-2 text-sm text-right font-medium ${
                    isSurplus ? 'text-orange-600' : isTekort ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {delta > 0 ? '+' : ''}{formatKg(delta)}
                    <span className="ml-1 text-xs">
                      {isSurplus ? '▲' : isTekort ? '▼' : '●'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 text-right">
                    {cat.norm_pct}%
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 text-right">
                    {cat.kippen_nodig_voor_categorie > 0
                      ? Math.round(cat.kippen_nodig_voor_categorie).toLocaleString('nl-NL')
                      : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Uitleg */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
        <p className="font-medium text-blue-800 dark:text-blue-300">Hoe lees je dit overzicht?</p>
        <ul className="mt-2 text-blue-600 dark:text-blue-400 space-y-1">
          <li>&bull; <strong>Maximum</strong>: het minimaal aantal kippen nodig om aan ALLE afname te voldoen</li>
          <li>&bull; Klik op een <strong>categorie</strong> om te zien hoeveel kippen puur voor dat onderdeel nodig zijn</li>
          <li>&bull; <strong>Surplus</strong> (▲) = vlees dat geproduceerd wordt maar niet door deze klant wordt afgenomen</li>
          <li>&bull; <strong>Tekort</strong> (▼) = klant wil meer dan de kippen natuurlijk produceren</li>
        </ul>
      </div>
    </div>
  );
}

function formatKg(kg: number): string {
  return kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 });
}
