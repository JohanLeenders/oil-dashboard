'use client';

/**
 * ScenarioListPanel — List, load, and delete saved planning scenarios
 */

import { useState, useEffect, useTransition } from 'react';
import {
  listPlanningScenarios,
  deletePlanningScenario,
  type PlanningScenario,
} from '@/lib/actions/planning-scenarios';

interface ScenarioListPanelProps {
  slaughterId: string;
  onLoadScenario: (inputs: Record<string, unknown>) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ScenarioListPanel({
  slaughterId,
  onLoadScenario,
}: ScenarioListPanelProps) {
  const [scenarios, setScenarios] = useState<PlanningScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Fetch scenarios on mount and when slaughterId changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listPlanningScenarios(slaughterId)
      .then((data) => {
        if (!cancelled) {
          setScenarios(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Fout bij laden');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slaughterId]);

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deletePlanningScenario(id);
        setScenarios((prev) => prev.filter((s) => s.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fout bij verwijderen');
      }
    });
  }

  if (loading) {
    return (
      <div className="text-center py-3 text-xs text-gray-500 dark:text-gray-400 animate-pulse">
        Scenario&apos;s laden...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-600 dark:text-red-400 py-2">{error}</div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="text-center py-3 text-xs text-gray-500 dark:text-gray-400">
        Geen opgeslagen scenario&apos;s
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
      {scenarios.map((scenario) => {
        const inputs = scenario.planning_inputs;
        const birds =
          typeof inputs.input_birds === 'number'
            ? inputs.input_birds.toLocaleString('nl-NL')
            : '?';
        const pulls =
          typeof inputs.total_whole_birds_pulled === 'number'
            ? inputs.total_whole_birds_pulled
            : 0;

        return (
          <div
            key={scenario.id}
            className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                  {scenario.name}
                </div>
                {scenario.description && (
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {scenario.description}
                  </div>
                )}
                <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 space-x-2">
                  <span>{birds} kippen</span>
                  {pulls > 0 && <span>&middot; {pulls} hele hoenen</span>}
                  <span>&middot; {formatDate(scenario.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onLoadScenario(scenario.planning_inputs)}
                  className="px-2 py-1 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                >
                  Laden
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(scenario.id)}
                  disabled={isPending}
                  className="px-2 py-1 text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
