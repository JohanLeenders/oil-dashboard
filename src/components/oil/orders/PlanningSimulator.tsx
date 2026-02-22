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
 *   - Wave 9 (UX-2): Impact Zone — delta tracking, flash feedback, impact summary
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  computeSimulatedAvailability,
  DEFAULT_WHOLE_BIRD_CLASSES,
  type WholeBirdPull,
  type SimulatedAvailability,
} from '@/lib/engine/availability/simulator';
import type { LocationYieldProfile, ProductYieldChain } from '@/lib/engine/availability/cascading';
import type { SimulatorYieldConfig } from '@/lib/actions/availability';
import SaveScenarioDialog from './SaveScenarioDialog';
import ScenarioListPanel from './ScenarioListPanel';

// Product descriptions that belong in the "Organen & rest" collapsible group
const ORGAN_KEYWORDS = ['lever', 'hart', 'maag', 'nek', 'hals', 'vel', 'karkas'];
// Products that should NEVER be classified as organs, even if they contain organ keywords
const ORGAN_EXCEPTIONS = ['borstkap'];

function isOrganProduct(description: string): boolean {
  const lower = description.toLowerCase();
  if (ORGAN_EXCEPTIONS.some((ex) => lower.includes(ex))) return false;
  return ORGAN_KEYWORDS.some((kw) => lower.includes(kw));
}

function formatKg(value: number): string {
  return value.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}

function formatNum(value: number, decimals = 2): string {
  return value.toLocaleString('nl-NL', { maximumFractionDigits: decimals });
}

// ---------------------------------------------------------------------------
// Delta tracking for Impact Zone (UX-2)
// ---------------------------------------------------------------------------

interface ProductDelta {
  product_id: string;
  product_description: string;
  previous_kg: number;
  current_kg: number;
  delta_kg: number;
  delta_pct: number; // percentage change relative to previous
}

/** Build delta map by comparing previous and current simulation results */
function computeDeltas(
  prev: SimulatedAvailability | null,
  curr: SimulatedAvailability
): Map<string, ProductDelta> {
  const deltas = new Map<string, ProductDelta>();
  if (!prev) return deltas;

  // Build previous kg map (primary + secondary)
  const prevKg = new Map<string, { kg: number; desc: string }>();
  for (const p of prev.cascaded.primary_products) {
    prevKg.set(p.product_id, { kg: p.primary_available_kg, desc: p.product_description });
  }
  for (const c of prev.cascaded.secondary_products) {
    prevKg.set(c.product_id, { kg: c.available_kg, desc: c.product_description });
  }

  // Compare current primary products
  for (const p of curr.cascaded.primary_products) {
    const prev_entry = prevKg.get(p.product_id);
    const prev_kg = prev_entry?.kg ?? 0;
    const delta_kg = p.primary_available_kg - prev_kg;
    const delta_pct = prev_kg > 0 ? (delta_kg / prev_kg) * 100 : 0;
    deltas.set(p.product_id, {
      product_id: p.product_id,
      product_description: p.product_description,
      previous_kg: prev_kg,
      current_kg: p.primary_available_kg,
      delta_kg,
      delta_pct,
    });
  }

  // Compare current secondary products
  for (const c of curr.cascaded.secondary_products) {
    const prev_entry = prevKg.get(c.product_id);
    const prev_kg = prev_entry?.kg ?? 0;
    const delta_kg = c.available_kg - prev_kg;
    const delta_pct = prev_kg > 0 ? (delta_kg / prev_kg) * 100 : 0;
    deltas.set(c.product_id, {
      product_id: c.product_id,
      product_description: c.product_description,
      previous_kg: prev_kg,
      current_kg: c.available_kg,
      delta_kg,
      delta_pct,
    });
  }

  return deltas;
}

/** Build a short summary of the most significant deltas */
function buildImpactSummary(deltas: Map<string, ProductDelta>, totalPulled: number): string[] {
  const parts: string[] = [];

  // Sort by absolute delta_kg descending, take top 3 significant changes
  const significantDeltas = [...deltas.values()]
    .filter((d) => Math.abs(d.delta_pct) > 5 && Math.abs(d.delta_kg) > 1)
    .sort((a, b) => Math.abs(b.delta_kg) - Math.abs(a.delta_kg))
    .slice(0, 3);

  for (const d of significantDeltas) {
    const sign = d.delta_kg > 0 ? '+' : '';
    parts.push(`${sign}${formatKg(d.delta_kg)} kg ${d.product_description.toLowerCase()}`);
  }

  if (totalPulled > 0) {
    parts.push(`${totalPulled} hele hoenen eruit`);
  }

  return parts;
}

interface PlanningSimulatorProps {
  slaughterId: string;
  yieldConfig: SimulatorYieldConfig;
  avgBirdWeightKg?: number;
}

export default function PlanningSimulator({
  slaughterId,
  yieldConfig,
  avgBirdWeightKg = 2.5,
}: PlanningSimulatorProps) {
  // Input state — initialised from slaughter data
  const [birds, setBirds] = useState(yieldConfig.expected_birds);
  const [grillerYieldPct, setGrillerYieldPct] = useState(70.4); // percentage display

  // Derived: live weight = birds × avg bird weight (syncs with top-level control)
  const liveWeightKg = birds * avgBirdWeightKg;

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

  // ── Impact Zone (UX-2): Delta tracking ──
  const previousSimRef = useRef<SimulatedAvailability | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [deltas, setDeltas] = useState<Map<string, ProductDelta>>(new Map());
  const [impactParts, setImpactParts] = useState<string[]>([]);

  // When simulation changes, compute deltas against previous and trigger flash
  useEffect(() => {
    const prev = previousSimRef.current;
    if (prev) {
      const newDeltas = computeDeltas(prev, simulation);
      setDeltas(newDeltas);
      setImpactParts(buildImpactSummary(newDeltas, simulation.total_whole_birds_pulled));
      // Increment flash key to restart CSS animations
      setFlashKey((k) => k + 1);
    }
    previousSimRef.current = simulation;
  }, [simulation]);

  /** Get flash CSS class for a product row based on its delta */
  const getFlashClass = useCallback(
    (productId: string): string => {
      const d = deltas.get(productId);
      if (!d || Math.abs(d.delta_pct) <= 10) return '';
      return d.delta_kg < 0 ? 'flash-red' : 'flash-green';
    },
    [deltas]
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
      // liveWeightKg is now derived from birds × avgBirdWeightKg (no separate setter)
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
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Aantal kippen
          </label>
          <input
            type="number"
            value={birds}
            onChange={(e) => setBirds(Number(e.target.value) || 0)}
            className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '8px',
              color: 'var(--color-text-main)',
            }}
          />
          <div className="mt-1 text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
            = {liveWeightKg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg levend ({formatNum(avgBirdWeightKg)} kg/dier)
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Griller rendement (%)
          </label>
          <input
            type="number"
            value={grillerYieldPct}
            onChange={(e) => setGrillerYieldPct(Number(e.target.value) || 0)}
            step="0.1"
            min="0"
            max="100"
            className="w-28 px-2.5 py-1.5 text-sm font-mono tabular-nums"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '8px',
              color: 'var(--color-text-main)',
            }}
          />
        </div>

        {/* Computed summary */}
        <div
          className="rounded-lg p-3"
          style={{
            background: 'rgba(246, 126, 32, 0.1)',
            border: '1px solid rgba(246, 126, 32, 0.3)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-oil-orange)' }}>
                Griller totaal
              </div>
              <div className="text-xl font-bold font-mono tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                {formatKg(simulation.original_griller_kg)} kg
              </div>
            </div>
            <div className="text-right text-xs font-mono tabular-nums space-y-0.5" style={{ color: 'var(--color-oil-orange)' }}>
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
        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-dim)' }}>
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
                <span className="w-20 text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  {cls.label}
                </span>
                <input
                  type="number"
                  value={count}
                  onChange={(e) =>
                    handlePullCountChange(cls.label, Number(e.target.value) || 0)
                  }
                  min="0"
                  className="w-20 px-2 py-1 text-xs font-mono tabular-nums text-right"
                  style={{
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--color-text-main)',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>st</span>
                <span className="ml-auto text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
                  {totalKg > 0 ? `${formatKg(totalKg)} kg` : '\u2013'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Na aftrek summary ── */}
      {hasPulls && (
        <div
          className="rounded-lg p-3 space-y-1"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--color-text-muted)' }}>Hele hoenen eruit</span>
            <span className="font-mono tabular-nums font-medium" style={{ color: 'var(--color-text-main)' }}>
              {simulation.total_whole_birds_pulled} st &middot; {formatKg(simulation.total_whole_bird_kg)} kg
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--color-text-muted)' }}>Resterend</span>
            <span className="font-mono tabular-nums font-semibold" style={{ color: 'var(--color-text-main)' }}>
              {formatKg(simulation.remaining_griller_kg)} kg
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--color-text-muted)' }}>Nieuw gem. gewicht</span>
            <span className="font-mono tabular-nums" style={{ color: 'var(--color-text-main)' }}>
              {formatNum(simulation.adjusted_avg_griller_weight_kg)} kg griller
            </span>
          </div>
        </div>
      )}

      {/* ── Impact Zone Banner (UX-2, C6c) ── */}
      {impactParts.length > 0 && (
        <div
          key={`impact-${flashKey}`}
          className="rounded-lg px-3 py-2 text-xs font-mono"
          style={{
            background: 'rgba(246, 126, 32, 0.1)',
            border: '1px solid var(--color-oil-orange)',
          }}
        >
          <span style={{ color: 'var(--color-oil-orange)' }}>&#9889; Impact: </span>
          {impactParts.map((part, i) => {
            const isNegative = part.startsWith('-') || part.startsWith('\u2212');
            const isPositive = part.startsWith('+');
            const color = isNegative
              ? 'var(--color-data-red)'
              : isPositive
                ? 'var(--color-data-green)'
                : 'var(--color-text-muted)';
            return (
              <span key={i}>
                {i > 0 && <span style={{ color: 'var(--color-text-dim)' }}> / </span>}
                <span style={{ color }}>{part}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Putten (Dag 0) — Products ── */}
      {primaryMain.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-oil-orange)' }} />
            <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Putten — Dag 0
            </h4>
          </div>
          <div className="overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--color-bg-elevated)' }}>
                  <th className="text-left py-1.5 px-3 font-medium" style={{ color: 'var(--color-text-dim)' }}>
                    Product
                  </th>
                  <th className="text-right py-1.5 px-3 font-medium" style={{ color: 'var(--color-text-dim)' }}>
                    Kg
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {primaryMain.map((p) => {
                  const flash = getFlashClass(p.product_id);
                  const delta = deltas.get(p.product_id);
                  return (
                    <tr
                      key={`${p.product_id}-${flashKey}`}
                      className={flash}
                      style={{ border: '1px solid transparent' }}
                    >
                      <td className="py-1.5 px-3" style={{ color: 'var(--color-text-main)' }}>
                        {p.product_description}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums font-medium">
                        <span style={{ color: 'var(--color-text-main)' }}>
                          {formatKg(p.primary_available_kg)}
                        </span>
                        {delta && Math.abs(delta.delta_kg) > 1 && (
                          <span
                            className="ml-1.5 text-[10px]"
                            style={{
                              color: delta.delta_kg < 0
                                ? 'var(--color-data-red)'
                                : 'var(--color-data-green)',
                            }}
                          >
                            {delta.delta_kg > 0 ? '+' : ''}{formatKg(delta.delta_kg)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
            <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Nijkerk — Dag +1
            </h4>
          </div>
          <div className="overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--color-bg-elevated)' }}>
                  <th className="text-left py-1.5 px-3 font-medium" style={{ color: 'var(--color-text-dim)' }}>
                    Product
                  </th>
                  <th className="text-right py-1.5 px-3 font-medium" style={{ color: 'var(--color-text-dim)' }}>
                    Kg
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {secondaryMain.map((c) => {
                  const flash = getFlashClass(c.product_id);
                  const delta = deltas.get(c.product_id);
                  return (
                    <tr
                      key={`${c.product_id}-${flashKey}`}
                      className={flash}
                      style={{ border: '1px solid transparent' }}
                    >
                      <td className="py-1.5 px-3" style={{ color: 'var(--color-text-main)' }}>
                        {c.product_description}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums font-medium">
                        <span style={{ color: 'var(--color-text-main)' }}>
                          {formatKg(c.available_kg)}
                        </span>
                        {delta && Math.abs(delta.delta_kg) > 1 && (
                          <span
                            className="ml-1.5 text-[10px]"
                            style={{
                              color: delta.delta_kg < 0
                                ? 'var(--color-data-red)'
                                : 'var(--color-data-green)',
                            }}
                          >
                            {delta.delta_kg > 0 ? '+' : ''}{formatKg(delta.delta_kg)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
            className="w-full flex items-center justify-between gap-2 py-2 px-3 rounded-lg transition-colors"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-text-dim)' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Organen &amp; rest
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
                {formatKg(organTotalKg)} kg
              </span>
              <svg
                className={`w-3 h-3 transition-transform ${organsOpen ? 'rotate-180' : ''}`}
                style={{ color: 'var(--color-text-dim)' }}
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
            <div className="mt-1.5 overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' }}>
              <table className="w-full text-xs">
                <tbody>
                  {primaryOrgans.map((p) => (
                    <tr key={p.product_id}>
                      <td className="py-1.5 px-3" style={{ color: 'var(--color-text-main)' }}>
                        {p.product_description}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                        {formatKg(p.primary_available_kg)} kg
                      </td>
                    </tr>
                  ))}
                  {secondaryOrgans.map((c) => (
                    <tr key={c.product_id}>
                      <td className="py-1.5 px-3" style={{ color: 'var(--color-text-main)' }}>
                        {c.product_description}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
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
          className="w-full px-3 py-2 text-xs font-medium text-white rounded-lg transition-colors"
          style={{ background: 'var(--color-data-green)', borderRadius: '8px' }}
        >
          Scenario opslaan
        </button>
        <button
          type="button"
          onClick={() => setShowScenarios(!showScenarios)}
          className="w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors"
          style={{
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '8px',
          }}
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
