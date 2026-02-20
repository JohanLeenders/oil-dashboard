'use client';

/**
 * PlanningSimulator — Interactive "wat als" calculator for order planning
 *
 * Features:
 *   - Input: bird count, live weight, griller yield %
 *   - Whole-bird pulls by weight class (1300-1600, 1700-1800, etc.)
 *   - Auto-recalculates cascaded availability on every change
 *   - Shows Putten primary + Nijkerk secondary products
 *   - Save/load scenarios
 */

import { useState, useMemo, useCallback } from 'react';
import {
  computeSimulatedAvailability,
  DEFAULT_WHOLE_BIRD_CLASSES,
  type WholeBirdPull,
} from '@/lib/engine/availability/simulator';
import type { LocationYieldProfile, ProductYieldChain } from '@/lib/engine/availability/cascading';
import type { SimulatorYieldConfig } from '@/lib/actions/availability';
import SaveScenarioDialog from './SaveScenarioDialog';
import ScenarioListPanel from './ScenarioListPanel';

// Product descriptions that belong in the "Organen & rest" collapsible group
const ORGAN_KEYWORDS = ['lever', 'hart', 'maag', 'nek', 'hals', 'vel', 'karkas'];

function isOrganProduct(description: string): boolean {
  const lower = description.toLowerCase();
  return ORGAN_KEYWORDS.some((kw) => lower.includes(kw));
}

function formatKg(value: number): string {
  return value.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}

function formatNum(value: number, decimals = 2): string {
  return value.toLocaleString('nl-NL', { maximumFractionDigits: decimals });
}

interface PlanningSimulatorProps {
  slaughterId: string;
  yieldConfig: SimulatorYieldConfig;
}

export default function PlanningSimulator({
  slaughterId,
  yieldConfig,
}: PlanningSimulatorProps) {
  // Input state — initialised from slaughter data
  const [birds, setBirds] = useState(yieldConfig.expected_birds);
  const [liveWeightKg, setLiveWeightKg] = useState(yieldConfig.expected_live_weight_kg);
  const [grillerYieldPct, setGrillerYieldPct] = useState(70.4); // percentage display

  // Whole-bird pull counts per class
  const [pullCounts, setPullCounts] = useState<Record<string, number>>(
    Object.fromEntries(DEFAULT_WHOLE_BIRD_CLASSES.map((c) => [c.label, 0]))
  );

  // UI state
  const [organsOpen, setOrgansOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);

  // Build pulls array from state
  const wholeBirdPulls: WholeBirdPull[] = useMemo(
    () =>
      DEFAULT_WHOLE_BIRD_CLASSES.map((cls) => ({
        label: cls.label,
        count: pullCounts[cls.label] ?? 0,
        avg_kg: cls.avg_kg,
      })),
    [pullCounts]
  );

  // Compute simulation on every state change
  const simulation = useMemo(
    () =>
      computeSimulatedAvailability({
        total_birds: birds,
        total_live_weight_kg: liveWeightKg,
        griller_yield_pct: grillerYieldPct / 100,
        whole_bird_pulls: wholeBirdPulls,
        yield_profiles: yieldConfig.yield_profiles,
        yield_chains: yieldConfig.yield_chains,
      }),
    [birds, liveWeightKg, grillerYieldPct, wholeBirdPulls, yieldConfig]
  );

  const handlePullCountChange = useCallback(
    (label: string, value: number) => {
      setPullCounts((prev) => ({ ...prev, [label]: Math.max(0, value) }));
    },
    []
  );

  // Load saved scenario into inputs
  const handleLoadScenario = useCallback(
    (inputs: Record<string, unknown>) => {
      if (typeof inputs.input_birds === 'number') setBirds(inputs.input_birds);
      if (typeof inputs.input_live_weight_kg === 'number')
        setLiveWeightKg(inputs.input_live_weight_kg);
      if (typeof inputs.griller_yield_pct === 'number')
        setGrillerYieldPct(inputs.griller_yield_pct * 100);

      // Restore pull counts
      const pulls = inputs.whole_bird_pulls as
        | { label: string; count: number }[]
        | undefined;
      if (Array.isArray(pulls)) {
        const newCounts: Record<string, number> = {};
        for (const cls of DEFAULT_WHOLE_BIRD_CLASSES) {
          const saved = pulls.find((p) => p.label === cls.label);
          newCounts[cls.label] = saved?.count ?? 0;
        }
        setPullCounts(newCounts);
      }

      setShowScenarios(false);
    },
    []
  );

  // Split products into main vs organs
  const primaryMain = simulation.cascaded.primary_products.filter(
    (p) => !isOrganProduct(p.product_description)
  );
  const primaryOrgans = simulation.cascaded.primary_products.filter(
    (p) => isOrganProduct(p.product_description)
  );
  const secondaryMain = simulation.cascaded.secondary_products.filter(
    (c) => !isOrganProduct(c.product_description)
  );
  const secondaryOrgans = simulation.cascaded.secondary_products.filter(
    (c) => isOrganProduct(c.product_description)
  );

  const organTotalKg =
    primaryOrgans.reduce((s, p) => s + p.primary_available_kg, 0) +
    secondaryOrgans.reduce((s, c) => s + c.available_kg, 0);

  const hasPulls = simulation.total_whole_birds_pulled > 0;

  return (
    <div className="space-y-4">
      {/* ── Input Section ── */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Aantal kippen
            </label>
            <input
              type="number"
              value={birds}
              onChange={(e) => setBirds(Number(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Levend gew. (kg)
            </label>
            <input
              type="number"
              value={liveWeightKg}
              onChange={(e) => setLiveWeightKg(Number(e.target.value) || 0)}
              step="0.1"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 tabular-nums"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Griller rendement (%)
          </label>
          <input
            type="number"
            value={grillerYieldPct}
            onChange={(e) => setGrillerYieldPct(Number(e.target.value) || 0)}
            step="0.1"
            min="0"
            max="100"
            className="w-28 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 tabular-nums"
          />
        </div>

        {/* Computed summary */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Griller totaal
              </div>
              <div className="text-xl font-bold text-amber-900 dark:text-amber-200 tabular-nums">
                {formatKg(simulation.original_griller_kg)} kg
              </div>
            </div>
            <div className="text-right text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
              <div>Gem. levend: {formatNum(simulation.avg_live_weight_kg)} kg</div>
              <div>
                Gem. griller: {formatNum(simulation.avg_live_weight_kg * (grillerYieldPct / 100))} kg
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hele hoenen eruit ── */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Hele hoenen eruit
        </h4>
        <div className="space-y-1.5">
          {DEFAULT_WHOLE_BIRD_CLASSES.map((cls) => {
            const count = pullCounts[cls.label] ?? 0;
            const totalKg = count * cls.avg_kg;
            return (
              <div
                key={cls.label}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-20 text-xs text-gray-600 dark:text-gray-400 shrink-0">
                  {cls.label}
                </span>
                <input
                  type="number"
                  value={count}
                  onChange={(e) =>
                    handlePullCountChange(cls.label, Number(e.target.value) || 0)
                  }
                  min="0"
                  className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 tabular-nums text-right"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">st</span>
                <span className="ml-auto text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {totalKg > 0 ? `${formatKg(totalKg)} kg` : '–'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Na aftrek summary ── */}
      {hasPulls && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-blue-700 dark:text-blue-400">
              Hele hoenen eruit
            </span>
            <span className="tabular-nums font-medium text-blue-900 dark:text-blue-200">
              {simulation.total_whole_birds_pulled} st &middot; {formatKg(simulation.total_whole_bird_kg)} kg
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-700 dark:text-blue-400">Resterend</span>
            <span className="tabular-nums font-semibold text-blue-900 dark:text-blue-200">
              {formatKg(simulation.remaining_griller_kg)} kg
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-700 dark:text-blue-400">Nieuw gem. gewicht</span>
            <span className="tabular-nums text-blue-900 dark:text-blue-200">
              {formatNum(simulation.adjusted_avg_griller_weight_kg)} kg griller
            </span>
          </div>
        </div>
      )}

      {/* ── Putten (Dag 0) — Products ── */}
      {primaryMain.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Putten — Dag 0
            </h4>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left py-1.5 px-3 font-medium text-gray-500 dark:text-gray-400">
                    Product
                  </th>
                  <th className="text-right py-1.5 px-3 font-medium text-gray-500 dark:text-gray-400">
                    Kg
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {primaryMain.map((p) => (
                  <tr key={p.product_id}>
                    <td className="py-1.5 px-3 text-gray-900 dark:text-gray-100">
                      {p.product_description}
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-gray-900 dark:text-gray-100 font-medium">
                      {formatKg(p.primary_available_kg)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Nijkerk (Dag +1) — Cascade Products ── */}
      {secondaryMain.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Nijkerk — Dag +1
            </h4>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left py-1.5 px-3 font-medium text-gray-500 dark:text-gray-400">
                    Product
                  </th>
                  <th className="text-right py-1.5 px-3 font-medium text-gray-500 dark:text-gray-400">
                    Kg
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {secondaryMain.map((c) => (
                  <tr key={c.product_id}>
                    <td className="py-1.5 px-3 text-gray-900 dark:text-gray-100">
                      {c.product_description}
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-gray-900 dark:text-gray-100 font-medium">
                      {formatKg(c.available_kg)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Organen & rest (collapsible) ── */}
      {(primaryOrgans.length > 0 || secondaryOrgans.length > 0) && (
        <div>
          <button
            type="button"
            onClick={() => setOrgansOpen(!organsOpen)}
            className="w-full flex items-center justify-between gap-2 py-2 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Organen &amp; rest
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {formatKg(organTotalKg)} kg
              </span>
              <svg
                className={`w-3 h-3 text-gray-400 transition-transform ${organsOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {organsOpen && (
            <div className="mt-1.5 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {primaryOrgans.map((p) => (
                    <tr key={p.product_id}>
                      <td className="py-1.5 px-3 text-gray-900 dark:text-gray-100">
                        {p.product_description}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {formatKg(p.primary_available_kg)} kg
                      </td>
                    </tr>
                  ))}
                  {secondaryOrgans.map((c) => (
                    <tr key={c.product_id}>
                      <td className="py-1.5 px-3 text-gray-900 dark:text-gray-100">
                        {c.product_description}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {formatKg(c.available_kg)} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={() => setShowSaveDialog(true)}
          className="w-full px-3 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
        >
          Scenario opslaan
        </button>
        <button
          type="button"
          onClick={() => setShowScenarios(!showScenarios)}
          className="w-full px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          {showScenarios ? 'Verberg scenario\'s' : 'Opgeslagen scenario\'s'}
        </button>
      </div>

      {/* ── Save Dialog ── */}
      {showSaveDialog && (
        <SaveScenarioDialog
          slaughterId={slaughterId}
          simulation={simulation}
          onClose={() => setShowSaveDialog(false)}
          onSaved={() => {
            setShowSaveDialog(false);
            setShowScenarios(true);
          }}
        />
      )}

      {/* ── Scenario List ── */}
      {showScenarios && (
        <ScenarioListPanel
          slaughterId={slaughterId}
          onLoadScenario={handleLoadScenario}
        />
      )}
    </div>
  );
}
