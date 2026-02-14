'use client';

/**
 * BatchDetailShell — Client component managing tabs for batch detail.
 *
 * Tabs:
 * 1. Input — BatchInputForm (this sprint)
 * 2. Kostprijswaterval — CostWaterfallShell (reuses existing)
 * 3. Scenario's (later)
 * 4. Log (later)
 *
 * Dataflow: BatchInput → Canon Engine → Waterval UI
 */

import { useState, useCallback, useMemo } from 'react';
import type { BatchInputData } from '@/lib/data/batch-input-store';
import { saveBatch } from '@/lib/data/batch-input-store';
import type { CanonWaterfallData } from '@/components/oil/CostWaterfallShell';
import { CostWaterfallShell } from '@/components/oil/CostWaterfallShell';
import { BatchInputForm } from './BatchInputForm';
import { MarginAnalysis } from './MarginAnalysis';

// We need a client-side version of the pipeline for recalculation
import { runBatchPipeline } from '@/lib/data/batch-engine-bridge';

interface Props {
  initialBatchInput: BatchInputData;
  initialWaterfallData: CanonWaterfallData;
}

type Tab = 'input' | 'waterfall' | 'marges' | 'scenarios' | 'log';

export function BatchDetailShell({ initialBatchInput, initialWaterfallData }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('input');
  const [batchData, setBatchData] = useState<BatchInputData>(initialBatchInput);
  const [waterfallData, setWaterfallData] = useState<CanonWaterfallData>(initialWaterfallData);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'recalculated'>('idle');

  const isExternal = batchData.batch_profile !== 'oranjehoen';

  const tabs = useMemo(() => [
    { id: 'input' as Tab, label: 'Input', enabled: true },
    { id: 'waterfall' as Tab, label: 'Kostprijswaterval', enabled: true },
    ...(isExternal ? [{ id: 'marges' as Tab, label: 'Marges', enabled: true }] : []),
    { id: 'scenarios' as Tab, label: "Scenario's", enabled: false },
    { id: 'log' as Tab, label: 'Log', enabled: false },
  ], [isExternal]);

  const handleSave = useCallback((data: BatchInputData) => {
    saveBatch(data);
    setBatchData(data);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  const handleSaveAndRecalc = useCallback((data: BatchInputData) => {
    saveBatch(data);
    setBatchData(data);
    const newWaterfall = runBatchPipeline(data);
    setWaterfallData(newWaterfall);
    setSaveStatus('recalculated');
    setTimeout(() => setSaveStatus('idle'), 3000);
  }, []);

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.enabled && setActiveTab(tab.id)}
              disabled={!tab.enabled}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : tab.enabled
                    ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    : 'border-transparent text-gray-300 cursor-not-allowed'
              }`}
            >
              {tab.label}
              {!tab.enabled && <span className="ml-1 text-xs">(later)</span>}
            </button>
          ))}

          {/* Save status indicator */}
          {saveStatus !== 'idle' && (
            <div className="ml-auto flex items-center px-3">
              <span className={`text-sm font-medium ${
                saveStatus === 'saved' ? 'text-green-600' : 'text-blue-600'
              }`}>
                {saveStatus === 'saved' ? 'Opgeslagen' : 'Herberekend'}
              </span>
            </div>
          )}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'input' && (
        <BatchInputForm
          initialData={initialBatchInput}
          onSave={handleSave}
          onSaveAndRecalc={handleSaveAndRecalc}
        />
      )}

      {activeTab === 'waterfall' && (
        <CostWaterfallShell canonData={waterfallData} />
      )}

      {activeTab === 'marges' && (
        <MarginAnalysis batch={batchData} waterfallData={waterfallData} />
      )}

      {activeTab === 'scenarios' && (
        <div className="p-8 text-center text-gray-500">
          Scenario-analyse komt in een volgende sprint.
        </div>
      )}

      {activeTab === 'log' && (
        <div className="p-8 text-center text-gray-500">
          Audit log komt in een volgende sprint.
        </div>
      )}
    </div>
  );
}
