'use client';

/**
 * CostWaterfallShell — Main interactive client component
 *
 * Receives canon results from server, handles:
 * - Collapsible level cards (all expanded by default)
 * - Scenario mode toggle with yield/price overrides
 * - Shadow price derivation (never manual)
 * - Extra bewerkingen (Level 6b, Scenario only)
 * - Mass balance gating (3-state: green/yellow/red)
 * - Admin override with localStorage audit trail
 */

import { useState, useMemo, useCallback } from 'react';
import {
  calculateJointCostPool,
  calculateByProductCredit,
  calculateSVASOAllocation,
  calculateMiniSVASO,
  calculateABCCosts,
  calculateFullSKUCost,
  calculateNRV,
  SCENARIO_DISCLAIMER,
} from '@/lib/engine/canonical-cost';
import type {
  LandedCostResult,
  JointCostPoolResult,
  NetJointCostResult,
  SVASOAllocationResult,
  MiniSVASOResult,
  ABCCostResult,
  FullSKUCostResult,
  NRVAssessment,
  LandedCostInput,
  ByProductPhysical,
  JointProductInput,
  SubJointCutInput,
  ABCCostDriver,
  SkuDefinition,
  NRVInput,
  JointProductCode,
} from '@/lib/engine/canonical-cost';
import type { ExtraBewerkingInput, OverrideEvent, MassBalanceStatus } from '@/lib/data/demo-batch-v2';
import { OVERRIDE_STORAGE_KEY } from '@/lib/data/demo-batch-v2';
import { Bovenbalk } from './Bovenbalk';
import { WaterfallLevelCard } from './WaterfallLevelCard';
import { ScenarioBadge } from './ScenarioBadge';
import { AdminOverrideModal } from './AdminOverrideModal';
import { CanonExplanationPanel } from './CanonExplanationPanel';
import { ExtraBewerkingList } from './ExtraBewerkingList';
import { Level0LandedCost } from './levels/Level0LandedCost';
import { Level1JointCostPool } from './levels/Level1JointCostPool';
import { Level2ByProductCredit } from './levels/Level2ByProductCredit';
import { Level3SVASOAllocation } from './levels/Level3SVASOAllocation';
import { Level4MiniSVASO } from './levels/Level4MiniSVASO';
import { Level5ABCCosts } from './levels/Level5ABCCosts';
import { Level6FullSKUCost } from './levels/Level6FullSKUCost';
import { Level6bExtraBewerking } from './levels/Level6bExtraBewerking';
import { Level7NRVCheck } from './levels/Level7NRVCheck';

// ============================================================================
// TYPES
// ============================================================================

export interface CanonWaterfallData {
  batch: {
    batch_id: string;
    batch_ref: string;
    date: string;
    input_live_kg: number;
    input_count: number;
    griller_output_kg: number;
    griller_yield_pct: number;
    k_factor: number;
    k_factor_interpretation: 'PROFITABLE' | 'BREAK_EVEN' | 'LOSS';
    mass_balance_deviation_pct: number;
    mass_balance_status: MassBalanceStatus;
  };
  level0: LandedCostResult;
  level1: JointCostPoolResult;
  level2: NetJointCostResult;
  level3: SVASOAllocationResult;
  level4: Record<string, MiniSVASOResult>;
  level5: ABCCostResult;
  level6: FullSKUCostResult;
  level7: Readonly<NRVAssessment>;
  inputs: {
    landedCostInput: LandedCostInput;
    slaughterFeeEur: number;
    grillerWeightKg: number;
    byProducts: ByProductPhysical[];
    jointProducts: JointProductInput[];
    subCuts: Record<string, SubJointCutInput[]>;
    abcDrivers: ABCCostDriver[];
    skuDefinition: SkuDefinition;
    nrvInput: NRVInput;
  };
}

export interface ScenarioOverrides {
  grillerWeightKg?: number;
  jointProductWeights?: Record<string, number>;
  subCutWeights?: Record<string, number>;
  sellingPrices?: Record<string, number>;
  abcRates?: Record<string, number>;
}

interface ScenarioResults {
  level1: JointCostPoolResult;
  level2: NetJointCostResult;
  level3: SVASOAllocationResult;
  level4: Record<string, MiniSVASOResult>;
  level5: ABCCostResult;
  level6: FullSKUCostResult;
  level7: Readonly<NRVAssessment>;
}

// ============================================================================
// LEVEL METADATA
// ============================================================================

interface LevelMeta {
  level: number | string;
  titleNL: string;
  engineFn: string;
  color: string;
  colorBg: string;
}

const LEVEL_META: LevelMeta[] = [
  { level: 0, titleNL: 'Inkoop & Aanvoer',           engineFn: 'calculateLandedCost',       color: 'text-blue-800',    colorBg: 'bg-blue-100' },
  { level: 1, titleNL: 'Gezamenlijke Kostenpool',     engineFn: 'calculateJointCostPool',    color: 'text-green-800',   colorBg: 'bg-green-100' },
  { level: 2, titleNL: 'Bijproductcreditering',       engineFn: 'calculateByProductCredit',  color: 'text-emerald-800', colorBg: 'bg-emerald-100' },
  { level: 3, titleNL: 'SVASO Verdeling',             engineFn: 'calculateSVASOAllocation',  color: 'text-purple-800',  colorBg: 'bg-purple-100' },
  { level: 4, titleNL: 'Mini-SVASO',                  engineFn: 'calculateMiniSVASO',        color: 'text-indigo-800',  colorBg: 'bg-indigo-100' },
  { level: 5, titleNL: 'ABC Toeslag',                 engineFn: 'calculateABCCosts',         color: 'text-amber-800',   colorBg: 'bg-amber-100' },
  { level: 6, titleNL: 'Volle SKU-kostprijs',         engineFn: 'calculateFullSKUCost',      color: 'text-orange-800',  colorBg: 'bg-orange-100' },
  { level: 7, titleNL: 'NRV Check',                   engineFn: 'calculateNRV',              color: 'text-red-800',     colorBg: 'bg-red-100' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function CostWaterfallShell({ canonData }: { canonData: CanonWaterfallData }) {
  // --- State ---
  const [isScenarioMode, setIsScenarioMode] = useState(false);
  const [collapsedLevels, setCollapsedLevels] = useState<Set<number | string>>(new Set());
  const [scenarioOverrides, setScenarioOverrides] = useState<ScenarioOverrides>({});
  const [extraBewerkingen, setExtraBewerkingen] = useState<ExtraBewerkingInput[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [adminOverride, setAdminOverride] = useState<OverrideEvent | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  // --- Mass balance gating ---
  const isBlocked = canonData.batch.mass_balance_status === 'red';
  const overrideActive = adminOverride !== null && new Date(adminOverride.expires_at) > new Date();
  const canUseScenario = !isBlocked || overrideActive;

  // --- Toggle helpers ---
  const toggleLevel = useCallback((level: number | string) => {
    setCollapsedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const handleScenarioToggle = useCallback(() => {
    if (!canUseScenario && !isScenarioMode) {
      setShowOverrideModal(true);
      return;
    }
    setIsScenarioMode(prev => !prev);
    if (isScenarioMode) {
      // Exiting scenario: reset overrides
      setScenarioOverrides({});
      setExtraBewerkingen([]);
    }
  }, [canUseScenario, isScenarioMode]);

  const handleOverrideConfirm = useCallback((event: OverrideEvent) => {
    // Write to localStorage (append-only audit log)
    try {
      const existing = JSON.parse(localStorage.getItem(OVERRIDE_STORAGE_KEY) || '[]');
      existing.push(event);
      localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(existing));
    } catch {
      // localStorage unavailable — log to console
      console.warn('[OIL] localStorage unavailable for override audit log', event);
    }
    setAdminOverride(event);
    setShowOverrideModal(false);
    setIsScenarioMode(true);
  }, []);

  // --- Scenario override handler ---
  const handleOverrideChange = useCallback((key: string, value: number) => {
    setScenarioOverrides(prev => {
      const next = { ...prev };
      if (key === 'grillerWeightKg') {
        next.grillerWeightKg = value;
      } else if (key.startsWith('joint.')) {
        const part = key.replace('joint.', '') as JointProductCode;
        next.jointProductWeights = { ...next.jointProductWeights, [part]: value };
      } else if (key.startsWith('subcut.')) {
        const subCode = key.replace('subcut.', '');
        next.subCutWeights = { ...next.subCutWeights, [subCode]: value };
      } else if (key.startsWith('selling.')) {
        const product = key.replace('selling.', '');
        next.sellingPrices = { ...next.sellingPrices, [product]: value };
      } else if (key.startsWith('abc.')) {
        const driver = key.replace('abc.', '');
        next.abcRates = { ...next.abcRates, [driver]: value };
      }
      return next;
    });
  }, []);

  // --- Scenario recalculation ---
  const scenarioResults = useMemo<ScenarioResults | null>(() => {
    if (!isScenarioMode) return null;

    const { inputs } = canonData;

    // Merge griller weight override
    const grillerWt = scenarioOverrides.grillerWeightKg ?? inputs.grillerWeightKg;

    // Recalc Level 1
    const sLevel1 = calculateJointCostPool(
      inputs.landedCostInput.batch_id,
      canonData.level0,
      inputs.slaughterFeeEur,
      grillerWt,
    );

    // Level 2
    const sLevel2 = calculateByProductCredit(
      inputs.landedCostInput.batch_id,
      sLevel1,
      inputs.byProducts,
    );

    // Merge joint product weight overrides
    const mergedJointProducts: JointProductInput[] = inputs.jointProducts.map(jp => {
      const overrideWeight = scenarioOverrides.jointProductWeights?.[jp.part_code];
      // Derive shadow price from selling prices if available
      const sellingPrice = scenarioOverrides.sellingPrices?.[jp.part_code] ?? jp.shadow_price_per_kg;
      return {
        ...jp,
        weight_kg: overrideWeight ?? jp.weight_kg,
        shadow_price_per_kg: sellingPrice,
      };
    });

    // Level 3: SVASO with derived shadow prices
    const sLevel3 = calculateSVASOAllocation(
      inputs.landedCostInput.batch_id,
      sLevel2,
      mergedJointProducts,
    );

    // Level 4: Mini-SVASO with sub-cut overrides
    const sLevel4: Record<string, MiniSVASOResult> = {};
    for (const alloc of sLevel3.allocations) {
      const baseSubCuts = inputs.subCuts[alloc.part_code];
      if (baseSubCuts && baseSubCuts.length > 0) {
        const mergedSubCuts = baseSubCuts.map(sc => ({
          ...sc,
          weight_kg: scenarioOverrides.subCutWeights?.[sc.sub_cut_code] ?? sc.weight_kg,
        }));
        sLevel4[alloc.part_code] = calculateMiniSVASO(alloc, mergedSubCuts);
      }
    }

    // Level 5: ABC with rate overrides
    const mergedDrivers = inputs.abcDrivers.map(d => ({
      ...d,
      rate_per_unit: scenarioOverrides.abcRates?.[d.driver_code] ?? d.rate_per_unit,
    }));
    const sLevel5 = calculateABCCosts(inputs.skuDefinition.sku_code, mergedDrivers);

    // Level 6: Full SKU
    const sFiletAlloc = sLevel4['breast_cap']?.sub_allocations?.[0];
    const sMeatCostPerKg = sFiletAlloc?.allocated_cost_per_kg ?? sLevel3.allocations[0].allocated_cost_per_kg;
    const sLevel6 = calculateFullSKUCost(inputs.skuDefinition, sMeatCostPerKg, sLevel5);

    // Level 7: NRV
    const mergedNrv: NRVInput = {
      ...inputs.nrvInput,
      selling_price_per_kg: scenarioOverrides.sellingPrices?.['filet'] ?? inputs.nrvInput.selling_price_per_kg,
    };
    const sLevel7 = calculateNRV(mergedNrv, sLevel6.cost_per_kg);

    return {
      level1: sLevel1,
      level2: sLevel2,
      level3: sLevel3,
      level4: sLevel4,
      level5: sLevel5,
      level6: sLevel6,
      level7: sLevel7,
    };
  }, [isScenarioMode, scenarioOverrides, canonData]);

  // --- Rendement helpers ---
  const grillerYield = scenarioResults?.level1.griller_yield_pct ?? canonData.batch.griller_yield_pct;
  const activeLevel3 = scenarioResults?.level3 ?? canonData.level3;
  const activeGrillerWt = scenarioOverrides.grillerWeightKg ?? canonData.inputs.grillerWeightKg;

  function getRendement(level: number | string): string {
    if (level === 0) return `${grillerYield.toFixed(1)}% griller v. levend`;
    if (level === 3) {
      return activeLevel3.allocations
        .map(a => `${((a.weight_kg / activeGrillerWt) * 100).toFixed(1)}%`)
        .join(' / ') + ' v. griller';
    }
    if (level === 4) {
      const parts: string[] = [];
      const l4data = scenarioResults?.level4 ?? canonData.level4;
      for (const [parentCode, mini] of Object.entries(l4data)) {
        const parent = activeLevel3.allocations.find(a => a.part_code === parentCode);
        if (parent) {
          const subs = mini.sub_allocations.map(
            sa => `${((sa.weight_kg / parent.weight_kg) * 100).toFixed(1)}%`
          ).join(' + ');
          parts.push(subs);
        }
      }
      return parts.join(' | ') || 'rendement n.v.t.';
    }
    if (level === '6b') return 'zie per bewerking';
    return 'rendement n.v.t.';
  }

  // --- Diff helper ---
  function getCostDiff(canonVal: number, scenarioVal: number | undefined): number | null {
    if (!isScenarioMode || scenarioVal === undefined) return null;
    return scenarioVal - canonVal;
  }

  return (
    <div className={isScenarioMode ? 'border-4 border-yellow-400 rounded-xl p-2 relative' : 'relative'}>
      {/* Scenario badge */}
      {isScenarioMode && <ScenarioBadge />}

      {/* Override active banner */}
      {overrideActive && adminOverride && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-orange-800">
            Override actief ({adminOverride.batch_id}) tot {new Date(adminOverride.expires_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs text-orange-600">Reden: {adminOverride.reason}</span>
        </div>
      )}

      {/* Bovenbalk */}
      <Bovenbalk
        batch={canonData.batch}
        isScenarioMode={isScenarioMode}
        canUseScenario={canUseScenario}
        onScenarioToggle={handleScenarioToggle}
        showExplanation={showExplanation}
        onExplanationToggle={() => setShowExplanation(p => !p)}
      />

      {/* Scenario disclaimer */}
      {isScenarioMode && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Let op:</strong> {SCENARIO_DISCLAIMER}
          </p>
        </div>
      )}

      {/* Waterfall Levels */}
      <div className="mt-6 space-y-4">
        {/* Level 0 */}
        <WaterfallLevelCard
          level={0}
          meta={LEVEL_META[0]}
          rendement={getRendement(0)}
          isCollapsed={collapsedLevels.has(0)}
          onToggle={() => toggleLevel(0)}
          isScenarioMode={isScenarioMode}
          costDiff={null}
        >
          <Level0LandedCost
            result={canonData.level0}
            input={canonData.inputs.landedCostInput}
            grillerWeightKg={canonData.inputs.grillerWeightKg}
            isScenarioMode={isScenarioMode}
            scenarioGrillerWeight={scenarioOverrides.grillerWeightKg}
            onOverrideChange={handleOverrideChange}
          />
        </WaterfallLevelCard>

        {/* Level 1 */}
        <WaterfallLevelCard
          level={1}
          meta={LEVEL_META[1]}
          rendement={getRendement(1)}
          isCollapsed={collapsedLevels.has(1)}
          onToggle={() => toggleLevel(1)}
          isScenarioMode={isScenarioMode}
          costDiff={getCostDiff(canonData.level1.griller_cost_per_kg, scenarioResults?.level1.griller_cost_per_kg)}
        >
          <Level1JointCostPool
            canonResult={canonData.level1}
            scenarioResult={scenarioResults?.level1}
            isScenarioMode={isScenarioMode}
          />
        </WaterfallLevelCard>

        {/* Level 2 */}
        <WaterfallLevelCard
          level={2}
          meta={LEVEL_META[2]}
          rendement={getRendement(2)}
          isCollapsed={collapsedLevels.has(2)}
          onToggle={() => toggleLevel(2)}
          isScenarioMode={isScenarioMode}
          costDiff={getCostDiff(canonData.level2.net_joint_cost_eur, scenarioResults?.level2.net_joint_cost_eur)}
        >
          <Level2ByProductCredit
            canonResult={canonData.level2}
            scenarioResult={scenarioResults?.level2}
            isScenarioMode={isScenarioMode}
          />
        </WaterfallLevelCard>

        {/* Level 3 */}
        <WaterfallLevelCard
          level={3}
          meta={LEVEL_META[3]}
          rendement={getRendement(3)}
          isCollapsed={collapsedLevels.has(3)}
          onToggle={() => toggleLevel(3)}
          isScenarioMode={isScenarioMode}
          costDiff={getCostDiff(canonData.level3.k_factor, scenarioResults?.level3.k_factor)}
        >
          <Level3SVASOAllocation
            canonResult={canonData.level3}
            scenarioResult={scenarioResults?.level3}
            isScenarioMode={isScenarioMode}
            grillerWeightKg={activeGrillerWt}
            jointProducts={canonData.inputs.jointProducts}
            onOverrideChange={handleOverrideChange}
            scenarioOverrides={scenarioOverrides}
          />
        </WaterfallLevelCard>

        {/* Level 4 */}
        <WaterfallLevelCard
          level={4}
          meta={LEVEL_META[4]}
          rendement={getRendement(4)}
          isCollapsed={collapsedLevels.has(4)}
          onToggle={() => toggleLevel(4)}
          isScenarioMode={isScenarioMode}
          costDiff={null}
        >
          <Level4MiniSVASO
            canonLevel4={canonData.level4}
            scenarioLevel4={scenarioResults?.level4}
            level3Allocations={activeLevel3.allocations}
            isScenarioMode={isScenarioMode}
            subCuts={canonData.inputs.subCuts}
            onOverrideChange={handleOverrideChange}
            scenarioOverrides={scenarioOverrides}
          />
        </WaterfallLevelCard>

        {/* Level 5 */}
        <WaterfallLevelCard
          level={5}
          meta={LEVEL_META[5]}
          rendement={getRendement(5)}
          isCollapsed={collapsedLevels.has(5)}
          onToggle={() => toggleLevel(5)}
          isScenarioMode={isScenarioMode}
          costDiff={getCostDiff(canonData.level5.total_abc_cost_eur, scenarioResults?.level5.total_abc_cost_eur)}
        >
          <Level5ABCCosts
            canonResult={canonData.level5}
            scenarioResult={scenarioResults?.level5}
            isScenarioMode={isScenarioMode}
            drivers={canonData.inputs.abcDrivers}
            onOverrideChange={handleOverrideChange}
            scenarioOverrides={scenarioOverrides}
          />
        </WaterfallLevelCard>

        {/* Level 6 */}
        <WaterfallLevelCard
          level={6}
          meta={LEVEL_META[6]}
          rendement={getRendement(6)}
          isCollapsed={collapsedLevels.has(6)}
          onToggle={() => toggleLevel(6)}
          isScenarioMode={isScenarioMode}
          costDiff={getCostDiff(canonData.level6.cost_per_kg, scenarioResults?.level6.cost_per_kg)}
        >
          <Level6FullSKUCost
            canonResult={canonData.level6}
            scenarioResult={scenarioResults?.level6}
            isScenarioMode={isScenarioMode}
          />
        </WaterfallLevelCard>

        {/* Level 6b: Extra Bewerkingen (Scenario only) */}
        {isScenarioMode && (
          <WaterfallLevelCard
            level="6b"
            meta={{ level: '6b', titleNL: 'Extra bewerking (Scenario)', engineFn: 'downstream', color: 'text-yellow-800', colorBg: 'bg-yellow-100' }}
            rendement={getRendement('6b')}
            isCollapsed={collapsedLevels.has('6b')}
            onToggle={() => toggleLevel('6b')}
            isScenarioMode={isScenarioMode}
            costDiff={null}
          >
            <ExtraBewerkingList
              bewerkingen={extraBewerkingen}
              onAdd={() => {
                const newId = `EB-${Date.now()}`;
                setExtraBewerkingen(prev => [...prev, {
                  id: newId,
                  input_sku_codes: [canonData.inputs.skuDefinition.sku_code],
                  operation_type: 'overig',
                  operation_label: '',
                  cost_per_kg_eur: 0,
                  cost_per_batch_eur: 0,
                  yield_pct: 100,
                  output_sku_code: '',
                  output_selling_price_per_kg: 0,
                }]);
              }}
              onUpdate={(id, updates) => {
                setExtraBewerkingen(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
              }}
              onRemove={(id) => {
                setExtraBewerkingen(prev => prev.filter(b => b.id !== id));
              }}
              level6Result={scenarioResults?.level6 ?? canonData.level6}
            />
          </WaterfallLevelCard>
        )}

        {/* Level 7 */}
        <WaterfallLevelCard
          level={7}
          meta={LEVEL_META[7]}
          rendement={getRendement(7)}
          isCollapsed={collapsedLevels.has(7)}
          onToggle={() => toggleLevel(7)}
          isScenarioMode={isScenarioMode}
          costDiff={null}
        >
          <Level7NRVCheck
            canonResult={canonData.level7}
            scenarioResult={scenarioResults?.level7}
            isScenarioMode={isScenarioMode}
            isBlocked={isBlocked && !overrideActive}
            nrvInput={canonData.inputs.nrvInput}
            onOverrideChange={handleOverrideChange}
            scenarioOverrides={scenarioOverrides}
          />
        </WaterfallLevelCard>
      </div>

      {/* Canon Explanation Panel */}
      {showExplanation && (
        <div className="mt-6">
          <CanonExplanationPanel />
        </div>
      )}

      {/* Admin Override Modal */}
      {showOverrideModal && (
        <AdminOverrideModal
          batchId={canonData.batch.batch_id}
          deviationPct={canonData.batch.mass_balance_deviation_pct}
          onConfirm={handleOverrideConfirm}
          onCancel={() => setShowOverrideModal(false)}
        />
      )}
    </div>
  );
}
