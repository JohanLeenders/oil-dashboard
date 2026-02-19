'use client';

/**
 * LevelRouteResults — Waterfall component for processing route results (Sprint 14b).
 *
 * Displays computed route costs between Level 5 (ABC) and Level 6 (SKU).
 * Shows per route:
 * - Source material cost (from SVASO/Mini-SVASO)
 * - Yield correction
 * - Processing steps breakdown
 * - End product cost per kg
 * - For blend routes: recipe with weighted inputs
 * - Mass balance warnings if applicable
 */

import type { RouteResult } from '@/components/oil/CostWaterfallShell';
import { getPartNameDutch } from '@/lib/engine/canonical-cost';

interface Props {
  routeResults: RouteResult[];
  isScenarioMode: boolean;
}

export function LevelRouteResults({ routeResults }: Props) {
  return (
    <div className="space-y-4">
      {routeResults.map((route) => (
        <RouteResultCard key={route.route_id} route={route} />
      ))}
    </div>
  );
}

function RouteResultCard({ route }: { route: RouteResult }) {
  const yieldPct = route.yield_factor ? (route.yield_factor * 100).toFixed(0) : null;

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {route.route_name || route.route_id}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            route.type === 'blend'
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
          }`}>
            {route.type}
          </span>
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {fmt(route.end_product_cost_per_kg)} /kg
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Mass balance warning */}
        {route.mass_balance_warning && (
          <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded text-xs text-yellow-800 dark:text-yellow-300">
            {route.mass_balance_warning}
          </div>
        )}

        {/* Blend recipe (only for blend routes) */}
        {route.type === 'blend' && route.recipe && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Recept (blend)</span>
            {route.recipe.inputs.map((inp, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 pl-3">
                <span className="text-gray-400">{idx === route.recipe!.inputs.length - 1 ? '\u2514\u2500' : '\u251C\u2500'}</span>
                <span>{getPartNameDutch(inp.part)}</span>
                <span className="text-gray-400">({(inp.ratio * 100).toFixed(0)}%)</span>
                <span>@ {fmt(inp.cost_per_kg)} /kg</span>
                <span className={`text-[10px] px-1 py-0.5 rounded ${
                  inp.source_type === 'by_product'
                    ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    : 'bg-purple-50 text-purple-600 dark:bg-purple-900 dark:text-purple-300'
                }`}>
                  {inp.source_type}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 pt-1 border-t border-gray-100 dark:border-gray-700">
              <span>Gewogen grondstofkost:</span>
              <span className="font-medium">{fmt(route.svaso_cost_per_kg)} /kg</span>
            </div>
          </div>
        )}

        {/* Single-source: material cost */}
        {route.type === 'single-source' && (
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>Grondstof: {getPartNameDutch(route.source_part)} (SVASO)</span>
            <span>{fmt(route.svaso_cost_per_kg)} /kg</span>
          </div>
        )}

        {/* Yield correction */}
        {yieldPct && (
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>Yield: {yieldPct}% &rarr; gecorrigeerd</span>
            <span>{fmt(route.yield_adjusted_svaso_per_kg)} /kg</span>
          </div>
        )}

        {/* Processing steps */}
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Verwerking</span>
          {route.processing_steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 pl-3">
              <span className="text-gray-400">{idx === route.processing_steps.length - 1 ? '\u2514\u2500' : '\u251C\u2500'}</span>
              <span>{step.processor}: {step.activity}</span>
              <span className="ml-auto">{fmt(step.cost_per_kg)} /kg</span>
            </div>
          ))}
          <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 pt-1 border-t border-gray-100 dark:border-gray-700">
            <span>Subtotaal verwerking:</span>
            <span className="font-medium">{fmt(route.total_processing_cost_per_kg)} /kg</span>
          </div>
        </div>

        {/* Final cost */}
        <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300 dark:border-gray-500">
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Kostprijs {getPartNameDutch(route.end_product)}:
            </span>
            <span className="text-xs text-gray-400 ml-2">
              ({route.input_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg input)
            </span>
          </div>
          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
            {fmt(route.end_product_cost_per_kg)} /kg
          </span>
        </div>
      </div>
    </div>
  );
}

function fmt(val: number): string {
  return '\u20AC' + val.toFixed(2);
}
