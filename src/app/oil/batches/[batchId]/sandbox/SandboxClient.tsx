'use client';

/**
 * Sandbox Client Component — Sprint 12.2
 *
 * Interactive scenario sandbox interface.
 * Manages state for scenario inputs and results.
 * All UI text from sandboxLabels — handler LOGIC untouched.
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
import {
  BASELINE, BUTTONS, TOASTS, SCENARIO_LIST, ERRORS, RESULTS,
  fmtEur, fmtKg, fmtK, fmtInt, fmtKgPrecise,
} from '@/lib/ui/sandboxLabels';
import { InputOverridesForm } from './InputOverridesForm';
import { ResultsDisplay } from './ResultsDisplay';
import { ScenarioList } from './ScenarioList';
import { SaveScenarioDialog } from './SaveScenarioDialog';
import { Toast, type ToastType } from './Toast';
import { ProcessChainEditor } from './ProcessChainEditor';
import { ChainResultsDisplay } from './ChainResultsDisplay';
import { ScenarioPresets } from './ScenarioPresets';
import { Accordion } from './Accordion';

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
  const [currentScenarioName, setCurrentScenarioName] = useState<string>(SCENARIO_LIST.defaultName);

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
        message: TOASTS.chainValidationFailed(chainValidationErrors.join(', ')),
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
          ? TOASTS.scenarioChainSuccess
          : TOASTS.scenarioSuccess;
        setToast({ message: msg, type: 'success' });
      } else {
        setToast({ message: result.error || TOASTS.scenarioFailed, type: 'error' });
      }
    } catch (error) {
      console.error('Error running scenario:', error);
      setToast({ message: TOASTS.scenarioFailed, type: 'error' });
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
      setToast({ message: TOASTS.scenarioSaved, type: 'success' });
    } else {
      setToast({ message: result.error || TOASTS.scenarioSaveFailed, type: 'error' });
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
    setToast({ message: TOASTS.scenarioLoaded(scenario.name), type: 'success' });
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
    setCurrentScenarioName(SCENARIO_LIST.defaultName);
  };

  // Handle exporting to CSV
  const handleExportCSV = () => {
    if (!scenarioResult) return;
    try {
      exportScenarioCSV(scenarioResult, currentScenarioName, batchDetail.batch.batch_ref);
      setToast({ message: TOASTS.csvExported, type: 'success' });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setToast({ message: TOASTS.csvFailed, type: 'error' });
    }
  };

  // Apply a preset — only calls existing state setters (no new logic)
  const applyPreset = (presetId: string) => {
    switch (presetId) {
      case 'breast_price_up_10': {
        const bp = baseline.joint_products.find(jp => jp.part_code === 'breast_cap');
        if (bp) {
          setPriceOverrides([{ part_code: 'breast_cap', price_per_kg: bp.shadow_price_per_kg * 1.10 }]);
        }
        break;
      }
      case 'live_price_up_010': {
        setLivePriceOverride(baseline.live_price_per_kg + 0.10);
        break;
      }
      case 'legs_price_up_15': {
        const lp = baseline.joint_products.find(jp => jp.part_code === 'legs');
        if (lp) {
          setPriceOverrides([{ part_code: 'legs', price_per_kg: lp.shadow_price_per_kg * 1.15 }]);
        }
        break;
      }
      case 'yield_down_2': {
        // Scale joint products down 2%, add the freed weight to back_carcass
        // so total still equals griller_weight_kg → no mass-balance hard-block.
        const jointReduction = baseline.joint_products.reduce(
          (sum, jp) => sum + jp.weight_kg * 0.02, 0
        );
        const newYields: YieldOverride[] = baseline.joint_products.map(jp => ({
          part_code: jp.part_code,
          weight_kg: jp.weight_kg * 0.98,
        }));
        // Push the freed weight onto back_carcass (it's a by-product in all_parts)
        const backCarcass = baseline.by_products.find(bp => bp.type === 'back_carcass');
        if (backCarcass) {
          newYields.push({
            part_code: backCarcass.id, // 'back' — mergeOverrides matches on bp.id
            weight_kg: backCarcass.weight_kg + jointReduction,
          });
        }
        setYieldOverrides(newYields);
        break;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Baseline — ALWAYS visible */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {BASELINE.heading}
        </h3>
        <p className="text-xs text-gray-500 mt-1">{BASELINE.explanation}</p>
        <p className="text-sm text-gray-600">
          Batch {batchDetail.batch.batch_ref}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">{BASELINE.liveWeight}</p>
            <p className="text-sm font-medium">{fmtKg(baseline.live_weight_kg)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{BASELINE.grillerWeight}</p>
            <p className="text-sm font-medium">{fmtKg(baseline.griller_weight_kg)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{BASELINE.birdCount}</p>
            <p className="text-sm font-medium">{fmtInt(baseline.bird_count)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{BASELINE.livePrice}</p>
            <p className="text-sm font-medium">{fmtEur(baseline.live_price_per_kg)}/kg</p>
          </div>
        </div>

        {/* Baseline waterfall results */}
        {scenarioResult && scenarioResult.baseline && (
          <div className="border-t border-gray-100 pt-4 mt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{BASELINE.baselineWaterfall}</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{BASELINE.l0}</span>
                <span className="font-medium">
                  {fmtEur(scenarioResult.baseline.l0_landed_cost.landed_cost_eur)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{BASELINE.l1}</span>
                <span className="font-medium">
                  {fmtEur(scenarioResult.baseline.l1_joint_cost_pool.joint_cost_pool_eur)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{BASELINE.l2}</span>
                <span className="font-medium">
                  {fmtEur(scenarioResult.baseline.l2_net_joint_cost.net_joint_cost_eur)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{BASELINE.l3}</span>
                <span className="font-medium">
                  {fmtK(scenarioResult.baseline.l3_svaso_allocation.k_factor)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Scenario header */}
      <h3 className="text-lg font-semibold text-gray-900">
        {BASELINE.scenarioPrefix(currentScenarioName)}
      </h3>

      {/* Presets */}
      <ScenarioPresets onApply={applyPreset} />

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

      {/* Process Chain Editor in Accordion */}
      <Accordion label={BUTTONS.advanced}>
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
      </Accordion>

      {/* Run / Reset buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleRunScenario}
          disabled={isRunning}
          className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? BUTTONS.running : BUTTONS.runScenario}
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
        >
          {BUTTONS.reset}
        </button>
      </div>

      {/* Step 3: Results (only after run) */}
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
              <p className="text-sm font-semibold text-red-900">{ERRORS.scenarioFailed}</p>
              <p className="text-sm text-red-800 mt-1">{scenarioResult.error}</p>
              {scenarioResult.meta.mass_balance_check && !scenarioResult.meta.mass_balance_check.valid && (
                <div className="mt-3 p-3 bg-red-100 rounded">
                  <p className="text-xs font-medium text-red-900 mb-1">{ERRORS.massBalanceDetails}:</p>
                  <div className="text-xs text-red-800 space-y-1">
                    <div>{RESULTS.parts}: {fmtKgPrecise(scenarioResult.meta.mass_balance_check.parts_total_kg)}</div>
                    <div>{RESULTS.griller}: {fmtKgPrecise(scenarioResult.meta.mass_balance_check.griller_kg)}</div>
                    <div>{ERRORS.deltaExceedsTolerance(
                      fmtKgPrecise(scenarioResult.meta.mass_balance_check.delta_kg),
                      fmtKgPrecise(scenarioResult.meta.mass_balance_check.tolerance_kg)
                    )}</div>
                    <div className="mt-2 pt-2 border-t border-red-300">
                      <strong>{ERRORS.fixInstruction(
                        fmtKgPrecise(scenarioResult.meta.mass_balance_check.griller_kg),
                        fmtKgPrecise(scenarioResult.meta.mass_balance_check.tolerance_kg)
                      )}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save/Export buttons (only show if scenario has been run successfully) */}
      {scenarioResult && scenarioResult.success && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            {BUTTONS.exportCsv}
          </button>
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            {BUTTONS.save}
          </button>
        </div>
      )}

      {/* Saved scenarios — at bottom */}
      {savedScenarios.length > 0 && (
        <ScenarioList
          scenarios={savedScenarios}
          currentScenarioName={currentScenarioName}
          onLoad={handleLoadScenario}
        />
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
