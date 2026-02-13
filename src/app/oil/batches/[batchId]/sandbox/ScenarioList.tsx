'use client';

/**
 * Scenario List Component — Sprint 12.2
 *
 * Displays list of saved scenarios for the current batch.
 * All UI text from sandboxLabels (NL).
 */

import { useState } from 'react';
import type { SandboxScenario } from '@/types/database';
import { SCENARIO_LIST } from '@/lib/ui/sandboxLabels';

interface ScenarioListProps {
  scenarios: SandboxScenario[];
  currentScenarioName: string;
  onLoad: (scenario: SandboxScenario) => void;
}

export function ScenarioList({
  scenarios,
  currentScenarioName,
  onLoad,
}: ScenarioListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (scenarios.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {SCENARIO_LIST.heading(scenarios.length)}
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          {isExpanded ? SCENARIO_LIST.hide : SCENARIO_LIST.show}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {scenarios.map((scenario) => {
            const isActive = scenario.name === currentScenarioName;
            return (
              <div
                key={scenario.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isActive
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{scenario.name}</p>
                  {scenario.description && (
                    <p className="text-xs text-gray-600 mt-0.5">{scenario.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {SCENARIO_LIST.created}: {new Date(scenario.created_at).toLocaleString('nl-NL')}
                  </p>
                </div>
                {!isActive && (
                  <button
                    onClick={() => onLoad(scenario)}
                    className="ml-4 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                  >
                    {SCENARIO_LIST.load}
                  </button>
                )}
                {isActive && (
                  <span className="ml-4 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded">
                    {SCENARIO_LIST.active}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
