/**
 * Sprint 7: Cost Waterfall Page
 *
 * Displays the canonical cost waterfall from Live Batch → SKU.
 * Implements exactly the logic from CANON_Poultry_Cost_Accounting.md
 *
 * Per Canon Section 8 (Conclusion):
 * "The dashboard must clearly show the Waterfall of costs:
 *  Live Cost → Yield Loss → Processing Cost → Variance → Final SKU Cost"
 *
 * UI LIMIT: Only waterfall viewing and scenario pricing per Sprint 7 contract.
 */

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import {
  calculateLandedCost,
  calculateGrillerCost,
  calculatePrimalAllocation,
  simulateScenarioImpact,
  getKFactorInterpretation,
  getKFactorBadgeClass,
  formatCurrency,
  formatCostPerKg,
  calculateLiveToMeatMultiplier,
  DEFAULT_STD_PRICES,
  SCENARIO_DISCLAIMER,
  type LandedCostInput,
  type ByProductInput,
  type PrimalCutInput,
  type ScenarioPriceVector,
} from '@/lib/engine/canonical-cost';

// ============================================================================
// VALIDATION BATCH DATA
// Per Sprint 7 Requirement: "Validate with at least one historical batch"
// ============================================================================

/**
 * [ASSUMPTION] This is demonstration data for validation.
 * In production, this would come from actual batch records.
 * All assumptions are explicitly documented per Sprint 7 contract.
 */
const VALIDATION_BATCH: LandedCostInput = {
  batch_id: 'VALIDATION-001',
  input_live_kg: 10000,
  input_count: 5000,
  live_price_per_kg: 2.60, // [ASSUMPTION] Based on canon reference value for BLK1STER
  transport_cost_eur: 382, // [ASSUMPTION] €0.0764 × 5000 birds
  catching_fee_eur: 150, // [ASSUMPTION] Estimated catching crew cost
  slaughter_fee_per_head: 0.276, // [ASSUMPTION] Labor €0.12 + Overhead €0.156 per canon
  doa_count: 50, // [ASSUMPTION] 1% normal mortality
  doa_threshold_pct: 0.02, // 2% threshold per canon
};

const VALIDATION_BY_PRODUCTS: ByProductInput[] = [
  // Per Canon Section 3.2: Blood 2.7%, Feathers 4.7%, Offal 3.5%
  { id: 'blood', type: 'blood', weight_kg: 270, nrv_price_per_kg: 0.05 },
  { id: 'feathers', type: 'feathers', weight_kg: 470, nrv_price_per_kg: -0.02 }, // [ASSUMPTION] Disposal cost
  { id: 'offal', type: 'offal', weight_kg: 350, nrv_price_per_kg: 0.15 },
];

// Griller yield ~70.5% of usable live weight per canon
const VALIDATION_GRILLER_KG = 6965; // ~70.5% of 9900 usable

// Primal cuts per canon Section 4.1 example
const VALIDATION_PRIMAL_CUTS: PrimalCutInput[] = [
  { part_code: 'breast_cap', weight_kg: 2498, std_market_price_per_kg: 5.50 }, // 35.85%
  { part_code: 'leg_quarter', weight_kg: 3023, std_market_price_per_kg: 2.00 }, // 43.40%
  { part_code: 'wings', weight_kg: 745, std_market_price_per_kg: 2.50 }, // 10.70%
  { part_code: 'back_carcass', weight_kg: 529, std_market_price_per_kg: 0.15 }, // 7.60%
];

// Pre-defined scenarios per canon Section 4.2
const SCENARIOS: ScenarioPriceVector[] = [
  {
    scenario_id: 'BASE',
    scenario_name: 'Basis (huidige markt)',
    description: 'Standaard marktprijzen voor SVASO allocatie',
    prices: { breast_cap: 5.50, leg_quarter: 2.00, wings: 2.50, back_carcass: 0.15 },
  },
  {
    scenario_id: 'WING_DROP_20',
    scenario_name: 'Vleugels -20% (exportban)',
    description: 'Scenario: Exportban naar belangrijke afzetmarkt. Vleugelprijs daalt 20%.',
    prices: { breast_cap: 5.50, leg_quarter: 2.00, wings: 2.00, back_carcass: 0.15 },
  },
  {
    scenario_id: 'BREAST_PREMIUM',
    scenario_name: 'Filet +20% (BBQ seizoen)',
    description: 'Scenario: Premium vraag naar filet in BBQ seizoen.',
    prices: { breast_cap: 6.60, leg_quarter: 2.00, wings: 2.50, back_carcass: 0.15 },
  },
  {
    scenario_id: 'LEG_DROP_15',
    scenario_name: 'Poot -15% (overaanbod)',
    description: 'Scenario: Overaanbod donker vlees door exportproblemen.',
    prices: { breast_cap: 5.50, leg_quarter: 1.70, wings: 2.50, back_carcass: 0.15 },
  },
];

// ============================================================================
// UI HELPERS
// ============================================================================

function getPartNameDutch(partCode: string): string {
  const names: Record<string, string> = {
    breast_cap: 'Filet',
    leg_quarter: 'Poot',
    wings: 'Vleugels',
    back_carcass: 'Rug/karkas',
  };
  return names[partCode] || partCode;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatKg(kg: number): string {
  return `${kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg`;
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function CostWaterfallPage() {
  // Calculate the validation batch waterfall
  const landedResult = calculateLandedCost(VALIDATION_BATCH);
  const slaughter_fee = VALIDATION_BATCH.input_count * VALIDATION_BATCH.slaughter_fee_per_head;

  const grillerResult = calculateGrillerCost(
    VALIDATION_BATCH.batch_id,
    landedResult,
    slaughter_fee,
    VALIDATION_GRILLER_KG,
    VALIDATION_BY_PRODUCTS
  );

  const primalResult = calculatePrimalAllocation(
    VALIDATION_BATCH.batch_id,
    grillerResult,
    VALIDATION_PRIMAL_CUTS
  );

  // Calculate base scenario for comparison
  const baseScenario = SCENARIOS[0];

  // Calculate all scenario impacts
  const scenarioResults = SCENARIOS.slice(1).map(scenario =>
    simulateScenarioImpact(
      VALIDATION_BATCH.batch_id,
      grillerResult,
      VALIDATION_PRIMAL_CUTS.map(cut => ({
        ...cut,
        std_market_price_per_kg: baseScenario.prices[cut.part_code] ?? cut.std_market_price_per_kg,
      })),
      scenario
    )
  );

  // Calculate live-to-meat multiplier using engine function with audit trail
  // Definition: griller_cost_per_kg / landed_cost_per_kg (measures yield-driven cost multiplication)
  const liveToMeatMultiplierResult = calculateLiveToMeatMultiplier(
    landedResult.landed_cost_per_kg,
    grillerResult.griller_cost_per_kg
  );

  // Reconciliation check - using the new audit-proof properties from engine
  // HARD INVARIANT: reconciliation_delta_eur < 0.01
  const isReconciled = primalResult.reconciliation_delta_eur < 0.01;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500 mb-2">
          <Link href="/oil" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Cost Waterfall</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Canonical Cost Waterfall
        </h1>
        <p className="text-gray-600 dark:text-gray-600 mt-2">
          Kostenverloop van Live Batch → Griller → Primal Cuts per SVASO allocatie
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Sprint 7 Validatie</strong> — Dit is een demonstratie batch ter validatie van de canonieke kostprijsberekening.
            Alle aannames zijn expliciet gedocumenteerd.
          </p>
        </div>
      </div>

      {/* Batch Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Batch: {VALIDATION_BATCH.batch_id}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500">Validatie batch per Canon Sectie 3 & 4</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="text-sm text-gray-500 dark:text-gray-500">Input Live</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatKg(VALIDATION_BATCH.input_live_kg)}</div>
              <div className="text-sm text-gray-500 dark:text-gray-500">{VALIDATION_BATCH.input_count.toLocaleString()} vogels</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="text-sm text-gray-500 dark:text-gray-500">Griller Output</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatKg(VALIDATION_GRILLER_KG)}</div>
              <div className="text-sm text-gray-500 dark:text-gray-500">{formatPercent(grillerResult.griller_yield_pct)} rendement</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="text-sm text-gray-500 dark:text-gray-500">k-factor</div>
              <div className="text-2xl font-bold">
                <span className={`inline-flex items-center px-2 py-0.5 rounded ${getKFactorBadgeClass(primalResult.k_factor)}`}>
                  {primalResult.k_factor.toFixed(4)}
                </span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-500">{getKFactorInterpretation(primalResult.k_factor)}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="text-sm text-gray-500 dark:text-gray-500">Live→Griller Multiplier</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{liveToMeatMultiplierResult.multiplier.toFixed(2)}×</div>
              <div className="text-xs text-gray-500 dark:text-gray-500" title={liveToMeatMultiplierResult.definition}>
                {liveToMeatMultiplierResult.definition}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Waterfall */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Cost Waterfall</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Per Canon Sectie 8: Live Cost → Yield Loss → Processing Cost → Final Cost
          </p>
        </div>
        <div className="p-6">
          {/* Level 0: Landed Cost */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">Level 0</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">Landed Cost</span>
            </div>
            <div className="ml-4 bg-blue-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-500">Live Material:</span>
                  <span className="ml-2 font-medium">{formatCurrency(VALIDATION_BATCH.input_live_kg * VALIDATION_BATCH.live_price_per_kg)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-500">Transport:</span>
                  <span className="ml-2 font-medium">{formatCurrency(VALIDATION_BATCH.transport_cost_eur)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-500">Vangkosten:</span>
                  <span className="ml-2 font-medium">{formatCurrency(VALIDATION_BATCH.catching_fee_eur)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-500 font-medium">Totaal Landed:</span>
                  <span className="ml-2 font-bold text-blue-800">{formatCurrency(landedResult.landed_cost_eur)}</span>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-600">
                Kostprijs per kg (live): {formatCostPerKg(landedResult.landed_cost_per_kg)}
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center mb-4">
            <div className="text-2xl text-gray-400 dark:text-gray-500">↓</div>
            <div className="ml-2 text-sm text-red-600">
              Yield Loss: ~{formatPercent(100 - grillerResult.griller_yield_pct)}
            </div>
          </div>

          {/* Level 1: Griller Cost */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded">Level 1</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">Griller Cost</span>
            </div>
            <div className="ml-4 bg-green-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-500">Slacht kosten:</span>
                  <span className="ml-2 font-medium">{formatCurrency(slaughter_fee)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-500">By-product credit:</span>
                  <span className="ml-2 font-medium text-green-600">-{formatCurrency(grillerResult.by_product_credit_eur)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-500 font-medium">Joint Cost Pool:</span>
                  <span className="ml-2 font-bold text-green-800">{formatCurrency(grillerResult.joint_cost_pool_eur)}</span>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-600">
                Kostprijs per kg (griller): {formatCostPerKg(grillerResult.griller_cost_per_kg)}
                <span className="ml-4 text-orange-600">
                  (+{formatPercent((grillerResult.griller_cost_per_kg / landedResult.landed_cost_per_kg - 1) * 100)} t.o.v. live)
                </span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center mb-4">
            <div className="text-2xl text-gray-400 dark:text-gray-500">↓</div>
            <div className="ml-2 text-sm text-blue-600">
              SVASO Allocatie (k = {primalResult.k_factor.toFixed(4)})
            </div>
          </div>

          {/* Level 2: Primal Allocation */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-0.5 rounded">Level 2</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">Primal Cuts (SVASO)</span>
            </div>
            <div className="ml-4 bg-purple-50 rounded-lg p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-500">
                    <th className="pb-2">Onderdeel</th>
                    <th className="pb-2 text-right">Gewicht</th>
                    <th className="pb-2 text-right">Std Prijs</th>
                    <th className="pb-2 text-right">Marktwaarde</th>
                    <th className="pb-2 text-right">Allocatie %</th>
                    <th className="pb-2 text-right">Alloc. Cost/kg</th>
                    <th className="pb-2 text-right">Totaal Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {primalResult.allocations.map(alloc => (
                    <tr key={alloc.part_code} className="border-t border-purple-100">
                      <td className="py-2 font-medium">{getPartNameDutch(alloc.part_code)}</td>
                      <td className="py-2 text-right">{formatKg(alloc.weight_kg)}</td>
                      <td className="py-2 text-right">{formatCostPerKg(alloc.std_market_price_per_kg)}</td>
                      <td className="py-2 text-right">{formatCurrency(alloc.market_value_eur)}</td>
                      <td className="py-2 text-right">{formatPercent(alloc.allocation_factor * 100)}</td>
                      <td className="py-2 text-right font-medium">{formatCostPerKg(alloc.allocated_cost_per_kg)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(alloc.allocated_cost_total_eur)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-purple-200 font-bold">
                    <td className="py-2">Totaal</td>
                    <td className="py-2 text-right">{formatKg(primalResult.allocations.reduce((s, a) => s + a.weight_kg, 0))}</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right">{formatCurrency(primalResult.total_market_value_eur)}</td>
                    <td className="py-2 text-right">{formatPercent(primalResult.sum_allocation_factors * 100)}</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right text-purple-800">{formatCurrency(primalResult.sum_allocated_cost_eur)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Reconciliation - Audit Proof */}
          <div className={`rounded-lg p-4 ${isReconciled ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">Reconciliatie Check (Audit-Proof)</span>
                <p className="text-sm text-gray-600 dark:text-gray-600">
                  sum_allocated_cost_eur vs joint_cost_pool_eur
                </p>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${isReconciled ? 'text-green-800' : 'text-red-800'}`}>
                  {isReconciled ? '✓ Gesloten (< €0.01)' : '✗ Delta gevonden'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-600">
                  Joint Pool: {formatCurrency(primalResult.joint_cost_pool_eur)} |
                  Allocated: {formatCurrency(primalResult.sum_allocated_cost_eur)} |
                  Delta: {formatCurrency(primalResult.reconciliation_delta_eur)}
                </div>
                {primalResult.rounding_residual_eur !== 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    Rounding residual: {formatCurrency(primalResult.rounding_residual_eur)} (applied to last allocation)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Scenario Analyse</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Per Canon Sectie 4.2: &quot;What-if&quot; simulatie met alternatieve prijsvectoren
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Let op:</strong> {SCENARIO_DISCLAIMER}
          </p>
        </div>

        <div className="p-6">
          {scenarioResults.map((scenarioResult, idx) => {
            const scenario = SCENARIOS[idx + 1];
            return (
              <div key={scenario.scenario_id} className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{scenario.scenario_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-500">{scenario.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500 dark:text-gray-500">k-factor wijziging</div>
                    <div className={`font-medium ${
                      scenarioResult.scenario.k_factor > scenarioResult.base.k_factor
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}>
                      {scenarioResult.base.k_factor.toFixed(4)} → {scenarioResult.scenario.k_factor.toFixed(4)}
                    </div>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-500">
                      <th className="pb-2">Onderdeel</th>
                      <th className="pb-2 text-right">Basis €/kg</th>
                      <th className="pb-2 text-right">Scenario €/kg</th>
                      <th className="pb-2 text-right">Wijziging</th>
                      <th className="pb-2">Toelichting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioResult.impact.map(impact => (
                      <tr key={impact.part_code} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-2 font-medium">{getPartNameDutch(impact.part_code)}</td>
                        <td className="py-2 text-right">{formatCostPerKg(impact.base_cost_per_kg)}</td>
                        <td className="py-2 text-right">{formatCostPerKg(impact.scenario_cost_per_kg)}</td>
                        <td className={`py-2 text-right font-medium ${
                          impact.cost_change_per_kg > 0 ? 'text-red-600' :
                          impact.cost_change_per_kg < 0 ? 'text-green-600' : 'text-gray-600 dark:text-gray-600'
                        }`}>
                          {impact.cost_change_per_kg >= 0 ? '+' : ''}{impact.cost_change_per_kg.toFixed(4)}
                          <span className="text-gray-400 dark:text-gray-500 ml-1">({impact.cost_change_pct.toFixed(1)}%)</span>
                        </td>
                        <td className="py-2 text-xs text-gray-600 dark:text-gray-600">{impact.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assumptions Documentation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Gedocumenteerde Aannames</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Per Sprint 7 contract: expliciet gedocumenteerd, NIET ingebouwd in berekeningen
          </p>
        </div>
        <div className="p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-500">
                <th className="pb-2">Parameter</th>
                <th className="pb-2">Waarde</th>
                <th className="pb-2">Bron</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2">[ASSUMPTION] Live prijs per kg</td>
                <td className="py-2 font-mono">€2.60</td>
                <td className="py-2 text-gray-600 dark:text-gray-600">Canon referentie: &quot;BLK1STER&quot;</td>
              </tr>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2">[ASSUMPTION] Transport per vogel</td>
                <td className="py-2 font-mono">€0.0764</td>
                <td className="py-2 text-gray-600 dark:text-gray-600">Canon Sectie 3.1</td>
              </tr>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2">[ASSUMPTION] Slacht arbeid + overhead</td>
                <td className="py-2 font-mono">€0.276/hoofd</td>
                <td className="py-2 text-gray-600 dark:text-gray-600">Canon: €0.12 + €0.156</td>
              </tr>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2">[ASSUMPTION] Griller yield</td>
                <td className="py-2 font-mono">70.5%</td>
                <td className="py-2 text-gray-600 dark:text-gray-600">Canon Sectie 3.2</td>
              </tr>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2">[ASSUMPTION] Feathers NRV</td>
                <td className="py-2 font-mono">-€0.02/kg</td>
                <td className="py-2 text-gray-600 dark:text-gray-600">Disposal cost (negatief)</td>
              </tr>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2">[ASSUMPTION] Standard prices</td>
                <td className="py-2 font-mono">Canon Sectie 4.1</td>
                <td className="py-2 text-gray-600 dark:text-gray-600">Vierkantsverwaarding vector</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Reference */}
      <div className="mt-8 text-sm text-gray-500 dark:text-gray-500">
        <h3 className="font-medium text-gray-700 dark:text-gray-600 mb-2">Referentie</h3>
        <ul className="space-y-1">
          <li>• Canon: AGENT/CANON_Poultry_Cost_Accounting.md (READ-ONLY)</li>
          <li>• Allocatie methode: SVASO (Sales Value at Split-Off) voor main products</li>
          <li>• By-products: NRV behandeling (cost reduction)</li>
          <li>• k-factor interpretatie: k &lt; 1 = winstgevend, k &gt; 1 = verliesgevend</li>
          <li>• Live-to-Meat Multiplier: ~2.2× per Canon Sectie 7.2</li>
        </ul>
      </div>
    </div>
  );
}
