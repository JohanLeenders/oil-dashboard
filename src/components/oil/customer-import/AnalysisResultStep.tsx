'use client';

/**
 * AnalysisResultStep — Stap 4: Cherry-picker resultaat
 *
 * Tab-toggle: "Analyse" (cherry-picker breakdown) vs "Kip-overzicht"
 * (hoeveel kippen nodig + natuurlijke productie per categorie).
 */

import { useState } from 'react';
import type { CherryPickerAnalysis } from '@/lib/engine/cherry-picker';
import { ChickenEquivalentView } from './ChickenEquivalentView';

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
  analysis: CherryPickerAnalysis;
  onNewImport: () => void;
  onBack: () => void;
}

export function AnalysisResultStep({ analysis, onNewImport, onBack }: Props) {
  const [view, setView] = useState<'analyse' | 'kip-overzicht'>('kip-overzicht');

  const scoreColor = analysis.balance_score >= 80
    ? 'text-green-600 bg-green-100 dark:bg-green-900/30'
    : analysis.balance_score >= 50
      ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30'
      : 'text-red-600 bg-red-100 dark:bg-red-900/30';

  return (
    <div className="space-y-6">
      {/* Compacte klantheader — altijd zichtbaar */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{analysis.customer_name}</h3>
          <div className="flex gap-4 mt-1 text-xs text-gray-500">
            <span>{analysis.total_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg</span>
            <span>€{analysis.total_revenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} omzet</span>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          analysis.is_cherry_picker
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        }`}>
          {analysis.is_cherry_picker ? '🍒 Cherry Picker' : '✅ Gebalanceerd'}
        </div>
      </div>

      {/* Tab Toggle — Vierkantsverwaarding eerst */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setView('kip-overzicht')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            view === 'kip-overzicht'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          🐔 Vierkantsverwaarding
        </button>
        <button
          onClick={() => setView('analyse')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            view === 'analyse'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          📊 Cherry-picker
        </button>
      </div>

      {/* Kip-overzicht View */}
      {view === 'kip-overzicht' && (
        <ChickenEquivalentView analysis={analysis} />
      )}

      {/* Cherry-picker Analyse View */}
      {view === 'analyse' && (
      <>

      {/* Kippen nodig + Balance Score */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Kippen nodig</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            ~{analysis.kippen_nodig.toLocaleString('nl-NL')}
          </p>
          <p className="text-xs text-gray-400 mt-1">voor volledige klantafname</p>
        </div>
        <div className={`rounded-lg border p-5 text-center ${
          analysis.is_cherry_picker
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        }`}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Balance Score</p>
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-xl font-bold mt-1 ${scoreColor}`}>
            {analysis.balance_score}
          </div>
        </div>
      </div>

      {/* Opportunity Cost Hero */}
      {analysis.opportunity_cost > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-5">
          <p className="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide font-medium">Opportunity cost</p>
          <p className="text-3xl font-bold text-orange-700 dark:text-orange-300 mt-1">
            €{analysis.opportunity_cost.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-orange-500 dark:text-orange-400 mt-1">
            Waarde van surplus-delen die geproduceerd maar niet door deze klant afgenomen worden
          </p>
        </div>
      )}

      {/* Opportunity Cost Breakdown tabel */}
      {analysis.opportunity_cost_breakdown.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Categorie</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Surplus kg</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Kg-prijs</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Opportunity cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {analysis.opportunity_cost_breakdown.map(item => (
                <tr key={item.category} className={item.category === 'karkas' ? 'text-gray-400' : ''}>
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {CATEGORY_LABELS[item.category] || item.category}
                    {item.category === 'karkas' && (
                      <span className="ml-1 text-[10px] text-gray-400">(byproduct)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-orange-600">
                    +{item.surplus_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">
                    €{item.kg_prijs.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-orange-700 dark:text-orange-400">
                    €{item.opportunity_cost.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <td className="px-3 py-2 font-bold text-gray-900 dark:text-gray-100">Totaal</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-orange-600">
                  +{analysis.opportunity_cost_breakdown
                    .reduce((sum, item) => sum + item.surplus_kg, 0)
                    .toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right font-mono font-bold text-orange-700 dark:text-orange-400">
                  €{analysis.opportunity_cost.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Aanbeveling */}
      <div className={`rounded-lg p-4 ${
        analysis.is_cherry_picker
          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
      }`}>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Aanbeveling</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{analysis.recommendation}</p>
      </div>

      {/* Alerts */}
      {analysis.alerts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Alerts ({analysis.alerts.length})
          </h4>
          {analysis.alerts.map((alert, i) => (
            <div
              key={i}
              className={`text-xs px-3 py-2 rounded-lg border ${
                alert.severity === 'critical'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                  : alert.severity === 'warning'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
              }`}
            >
              {alert.severity === 'critical' && '🔴 '}
              {alert.severity === 'warning' && '🟡 '}
              {alert.severity === 'info' && '🔵 '}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      </>
      )}

      {/* Knoppen */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700
                     dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← Terug naar preview
        </button>
        <button
          onClick={onNewImport}
          className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium
                     hover:bg-blue-700 transition-colors"
        >
          📥 Nieuwe import
        </button>
      </div>
    </div>
  );
}
