'use client';

/**
 * Scenario Presets Component — Sprint 12.2
 *
 * Quick-start scenario buttons. Clicking fills inputs only.
 * User must still click "Bereken Scenario" to run.
 */

import { PRESETS } from '@/lib/ui/sandboxLabels';

interface ScenarioPresetsProps {
  onApply: (presetId: string) => void;
}

export function ScenarioPresets({ onApply }: ScenarioPresetsProps) {
  return (
    <div className="space-y-2">
      <h5 className="text-sm font-medium text-gray-700">
        {PRESETS.heading}
      </h5>
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.items.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onApply(preset.id)}
            className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 text-left text-sm transition-colors"
            title={preset.description}
          >
            <span className="text-lg">{preset.icon}</span>
            <div>
              <p className="font-medium text-gray-900">{preset.label}</p>
              <p className="text-xs text-gray-500">{preset.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
