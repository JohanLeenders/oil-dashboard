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
import { mapBatchToBaseline } from '@/lib/sandbox/mapBatchToBaseline';
import { exportScenarioCSV } from '@/lib/sandbox/exportScenarioCSV';
import type { ProcessChain } from '@/lib/engine/chain';
import { applyProcessChainLayer, type ScenarioResultWithChain } from '@/lib/sandbox/applyProcessChainLayer';
import { InputOverridesForm } from './InputOverridesForm';
import { ResultsDisplay } from './ResultsDisplay';
import { ScenarioList } from './ScenarioList';
import { SaveScenarioDialog } from './SaveScenarioDialog';
import { Toast, type ToastType } from './Toast';
import { ProcessChainEditor } from './ProcessChainEditor';
import { ChainResultsDisplay } from './ChainResultsDisplay';

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

  // State for process chain (Sprint 11B)
  const [processChainEnabled, setProcessChainEnabled] = useState(false);
  const [processChain, setProcessChain] = useState<ProcessChain | null>(null);
  const [chainIsValid, setChainIsValid] = useState(true);
  const [chainValidationErrors, setChainValidationErrors] = useState<string[]>([]);

  // State for scenario execution
  const [scenarioResult, setScenarioResult] = useState<ScenarioResultWithChain | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenarioName, setCurrentScenarioName] = useState<string>('Unsaved Scenario');

  // State for saved scenarios
  const [savedScenarios, setSavedScenarios] = useState<SandboxScenario[]>(initialScenarios);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Map batch detail to baseline data using canonical mapper
  const baseline: BaselineBatchData = mapBatchToBaseline(batchDetail);

  // Handle running the scenario
  const handleRunScenario = () => {
    // Block if chain is enabled but invalid
    if (processChainEnabled && !chainIsValid) {
      setToast({
        message: `Chain validation failed: ${chainValidationErrors.join(', ')}`,
        type: 'error',
      });
      return;
    }

    setIsRunning(true);

    try {
      const input: ScenarioInput = {
        scenario_id: `scenario-${Date.now()}`,
        scenario_name: currentScenarioName,
        batch_id: batchId,
        live_price_per_kg: livePriceOverride ?? undefined,
        yield_overrides: yieldOverrides.length > 0 ? yieldOverrides : undefined,
        price_overrides: priceOverrides.length > 0 ? priceOverrides : undefined,
        process_chain: processChainEnabled && processChain ? processChain : undefined,
      };

      const baselineResult = runScenarioSandbox(baseline, input);

      // If chain enabled, apply chain layer
      const result = processChainEnabled && processChain
        ? applyProcessChainLayer(baseline, input, baselineResult)
        : baselineResult;

      setScenarioResult(result);

      if (result.success) {
        const msg = processChainEnabled
          ? 'Scenario with chain computed successfully'
          : 'Scenario computed successfully';
        setToast({ message: msg, type: 'success' });
      } else {
        setToast({ message: result.error || 'Scenario failed', type: 'error' });
      }
    } catch (error) {
      console.error('Error running scenario:', error);
      setToast({ message: 'Error running scenario', type: 'error' });
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
      process_chain: processChainEnabled && processChain ? processChain : undefined,
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
      setToast({ message: 'Scenario saved successfully', type: 'success' });
    } else {
      setToast({ message: result.error || 'Failed to save scenario', type: 'error' });
      console.error('Error saving scenario:', result.error);
    }
  };

  // Handle loading a saved scenario
  const handleLoadScenario = (scenario: SandboxScenario) => {
    const inputs = scenario.inputs_json as unknown as ScenarioInput;
    const result = scenario.result_json as unknown as ScenarioResultWithChain;

    setLivePriceOverride(inputs.live_price_per_kg ?? null);
    setYieldOverrides(inputs.yield_overrides ?? []);
    setPriceOverrides(inputs.price_overrides ?? []);

    // Load process chain if present
    if (inputs.process_chain) {
      setProcessChainEnabled(true);
      setProcessChain(inputs.process_chain);
    } else {
      setProcessChainEnabled(false);
      setProcessChain(null);
    }

    setScenarioResult(result);
    setCurrentScenarioName(scenario.name);
    setToast({ message: `Loaded scenario: ${scenario.name}`, type: 'success' });
  };

  // Reset to baseline
  const handleReset = () => {
    setLivePriceOverride(null);
    setYieldOverrides([]);
    setPriceOverrides([]);
    setProcessChainEnabled(false);
    setProcessChain(null);
    setChainIsValid(true);
    setChainValidationErrors([]);
    setScenarioResult(null);
    setCurrentScenarioName('Unsaved Scenario');
  };

  // Handle exporting to CSV
  const handleExportCSV = () => {
    if (!scenarioResult) return;
    try {
      exportScenarioCSV(scenarioResult, currentScenarioName, batchDetail.batch.batch_ref);
      setToast({ message: 'CSV exported successfully', type: 'success' });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setToast({ message: 'Failed to export CSV', type: 'error' });
    }
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

          {/* Process Chain Editor (Sprint 11B.2) */}
          <ProcessChainEditor
            enabled={processChainEnabled}
            chain={processChain}
            onChange={(chain) => {
              setProcessChain(chain);
              setProcessChainEnabled(chain !== null);
            }}
            onValidationChange={(isValid, errors) => {
              setChainIsValid(isValid);
              setChainValidationErrors(errors);
            }}
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

          {/* Chain layer results (Sprint 11B.2) */}
          {scenarioResult && scenarioResult.chain_layer && (
            <ChainResultsDisplay chainResult={scenarioResult.chain_layer.chain_execution} />
          )}

          {/* Error display */}
          {scenarioResult && !scenarioResult.success && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900">Scenario Failed</p>
                  <p className="text-sm text-red-800 mt-1">{scenarioResult.error}</p>
                  {scenarioResult.meta.mass_balance_check && !scenarioResult.meta.mass_balance_check.valid && (
                    <div className="mt-3 p-3 bg-red-100 rounded">
                      <p className="text-xs font-medium text-red-900 mb-1">Mass Balance Details:</p>
                      <div className="text-xs text-red-800 space-y-1">
                        <div>Parts Total: {scenarioResult.meta.mass_balance_check.parts_total_kg.toFixed(2)} kg</div>
                        <div>Griller Weight: {scenarioResult.meta.mass_balance_check.griller_kg.toFixed(2)} kg</div>
                        <div>Delta: {scenarioResult.meta.mass_balance_check.delta_kg.toFixed(2)} kg (exceeds tolerance of {scenarioResult.meta.mass_balance_check.tolerance_kg.toFixed(2)} kg)</div>
                        <div className="mt-2 pt-2 border-t border-red-300">
                          <strong>Fix:</strong> Adjust yield overrides to ensure parts sum to {scenarioResult.meta.mass_balance_check.griller_kg.toFixed(2)} kg ±{scenarioResult.meta.mass_balance_check.tolerance_kg.toFixed(2)} kg
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save/Export buttons (only show if scenario has been run successfully) */}
      {scenarioResult && scenarioResult.success && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            Export CSV
          </button>
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

      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
