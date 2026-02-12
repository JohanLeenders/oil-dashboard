'use client';

/**
 * Sandbox Client Component — Sprint 11A.3
 *
 * Interactive scenario sandbox interface.
 * Manages state for scenario inputs and results.
 */

import { useState } from 'react';
import type { SandboxScenario } from '@/types/database';
import type {
  ScenarioInput,
  ScenarioResult,
  BaselineBatchData,
  YieldOverride,
  PriceOverride,
} from '@/lib/engine/scenario-sandbox';
import { runScenarioSandbox } from '@/lib/engine/scenario-sandbox';
import { createScenario } from '@/lib/actions/scenarios';
import { InputOverridesForm } from './InputOverridesForm';
import { ResultsDisplay } from './ResultsDisplay';
import { ScenarioList } from './ScenarioList';
import { SaveScenarioDialog } from './SaveScenarioDialog';

interface SandboxClientProps {
  batchId: string;
  batchDetail: any; // BatchDetail from getBatchDetail
  savedScenarios: SandboxScenario[];
}

export function SandboxClient({
  batchId,
  batchDetail,
  savedScenarios: initialScenarios,
}: SandboxClientProps) {
  // State for scenario inputs
  const [livePriceOverride, setLivePriceOverride] = useState<number | null>(null);
  const [yieldOverrides, setYieldOverrides] = useState<YieldOverride[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<PriceOverride[]>([]);

  // State for scenario execution
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenarioName, setCurrentScenarioName] = useState<string>('Unsaved Scenario');

  // State for saved scenarios
  const [savedScenarios, setSavedScenarios] = useState<SandboxScenario[]>(initialScenarios);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Prepare baseline data for engine
  // NOTE: This is a simplified version - you'll need to map batchDetail to BaselineBatchData format
  const baseline: BaselineBatchData = {
    batch_id: batchId,
    batch_ref: batchDetail.batch.batch_ref,
    live_weight_kg: batchDetail.batch.live_weight_kg || 0,
    bird_count: batchDetail.batch.bird_count || 0,
    griller_weight_kg: batchDetail.batch.griller_weight_kg || 0,
    griller_yield_pct: batchDetail.batch.griller_yield_pct || 0,
    live_price_per_kg: 2.60, // TODO: Get from actual batch data
    transport_cost_eur: 91.68, // TODO: Get from actual batch data
    catching_fee_eur: 50.00, // TODO: Get from actual batch data
    slaughter_fee_per_head: 0.276, // TODO: Get from actual batch data
    doa_count: 0,
    doa_threshold_pct: 0.02,
    joint_products: [], // TODO: Map from batchDetail.yields
    by_products: [], // TODO: Map from batchDetail
    waterfall: {
      l0_landed_cost: {} as any,
      l1_joint_cost_pool: {} as any,
      l2_net_joint_cost: {} as any,
      l3_svaso_allocation: {} as any,
    },
  };

  // Handle running the scenario
  const handleRunScenario = () => {
    setIsRunning(true);

    try {
      const input: ScenarioInput = {
        scenario_id: `scenario-${Date.now()}`,
        scenario_name: currentScenarioName,
        batch_id: batchId,
        live_price_per_kg: livePriceOverride ?? undefined,
        yield_overrides: yieldOverrides.length > 0 ? yieldOverrides : undefined,
        price_overrides: priceOverrides.length > 0 ? priceOverrides : undefined,
      };

      const result = runScenarioSandbox(baseline, input);
      setScenarioResult(result);
    } catch (error) {
      console.error('Error running scenario:', error);
      // TODO: Show error toast
    } finally {
      setIsRunning(false);
    }
  };

  // Handle saving the scenario
  const handleSaveScenario = async (name: string, description?: string) => {
    if (!scenarioResult) return;

    const input: ScenarioInput = {
      scenario_id: `scenario-${Date.now()}`,
      scenario_name: name,
      description,
      batch_id: batchId,
      live_price_per_kg: livePriceOverride ?? undefined,
      yield_overrides: yieldOverrides.length > 0 ? yieldOverrides : undefined,
      price_overrides: priceOverrides.length > 0 ? priceOverrides : undefined,
    };

    const result = await createScenario({
      batch_id: batchId,
      name,
      description,
      inputs: input,
      result: scenarioResult,
    });

    if (result.success) {
      setSavedScenarios([result.data, ...savedScenarios]);
      setCurrentScenarioName(name);
      setShowSaveDialog(false);
      // TODO: Show success toast
    } else {
      // TODO: Show error toast
      console.error('Error saving scenario:', result.error);
    }
  };

  // Handle loading a saved scenario
  const handleLoadScenario = (scenario: SandboxScenario) => {
    const inputs = scenario.inputs_json as unknown as ScenarioInput;
    const result = scenario.result_json as unknown as ScenarioResult;

    setLivePriceOverride(inputs.live_price_per_kg ?? null);
    setYieldOverrides(inputs.yield_overrides ?? []);
    setPriceOverrides(inputs.price_overrides ?? []);
    setScenarioResult(result);
    setCurrentScenarioName(scenario.name);
  };

  // Reset to baseline
  const handleReset = () => {
    setLivePriceOverride(null);
    setYieldOverrides([]);
    setPriceOverrides([]);
    setScenarioResult(null);
    setCurrentScenarioName('Unsaved Scenario');
  };

  return (
    <div className="space-y-6">
      {/* Scenario List (if any saved scenarios exist) */}
      {savedScenarios.length > 0 && (
        <ScenarioList
          scenarios={savedScenarios}
          currentScenarioName={currentScenarioName}
          onLoad={handleLoadScenario}
        />
      )}

      {/* Main content: Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Baseline */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Baseline (Actueel)
          </h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              Batch {batchDetail.batch.batch_ref}
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Live weight:</span>
                <span className="font-medium">{baseline.live_weight_kg.toFixed(0)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Griller weight:</span>
                <span className="font-medium">{baseline.griller_weight_kg.toFixed(0)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bird count:</span>
                <span className="font-medium">{baseline.bird_count}</span>
              </div>
            </div>
          </div>

          {/* Baseline waterfall results would go here */}
          {scenarioResult && scenarioResult.baseline && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Baseline Waterfall</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">L0 Landed Cost:</span>
                  <span className="font-medium">
                    €{scenarioResult.baseline.l0_landed_cost.landed_cost_eur.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">L1 Joint Cost Pool:</span>
                  <span className="font-medium">
                    €{scenarioResult.baseline.l1_joint_cost_pool.joint_cost_pool_eur.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">L2 Net Joint Cost:</span>
                  <span className="font-medium">
                    €{scenarioResult.baseline.l2_net_joint_cost.net_joint_cost_eur.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">L3 k-factor:</span>
                  <span className="font-medium">
                    {scenarioResult.baseline.l3_svaso_allocation.k_factor.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Scenario */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Scenario: {currentScenarioName}
          </h3>

          {/* Input overrides form */}
          <InputOverridesForm
            baseline={baseline}
            livePriceOverride={livePriceOverride}
            yieldOverrides={yieldOverrides}
            priceOverrides={priceOverrides}
            onLivePriceChange={setLivePriceOverride}
            onYieldOverridesChange={setYieldOverrides}
            onPriceOverridesChange={setPriceOverrides}
          />

          {/* Run scenario button */}
          <div className="flex gap-2">
            <button
              onClick={handleRunScenario}
              disabled={isRunning}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? 'Running...' : 'Run Scenario'}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Scenario results */}
          {scenarioResult && scenarioResult.scenario && (
            <ResultsDisplay
              baseline={scenarioResult.baseline}
              scenario={scenarioResult.scenario}
              deltas={scenarioResult.deltas}
              meta={scenarioResult.meta}
            />
          )}

          {/* Error display */}
          {scenarioResult && !scenarioResult.success && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-900">Scenario Failed</p>
              <p className="text-sm text-red-700 mt-1">{scenarioResult.error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Save scenario button (only show if scenario has been run successfully) */}
      {scenarioResult && scenarioResult.success && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Save Scenario
          </button>
        </div>
      )}

      {/* Save scenario dialog */}
      {showSaveDialog && (
        <SaveScenarioDialog
          onSave={handleSaveScenario}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}
