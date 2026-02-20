'use client';

/**
 * SaveScenarioDialog — Modal for saving a planning scenario
 */

import { useState, useTransition } from 'react';
import { createPlanningScenario } from '@/lib/actions/planning-scenarios';
import type { SimulatedAvailability } from '@/lib/engine/availability/simulator';

interface SaveScenarioDialogProps {
  slaughterId: string;
  simulation: SimulatedAvailability;
  onClose: () => void;
  onSaved: () => void;
}

export default function SaveScenarioDialog({
  slaughterId,
  simulation,
  onClose,
  onSaved,
}: SaveScenarioDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!name.trim()) {
      setError('Vul een naam in');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createPlanningScenario(
          slaughterId,
          name.trim(),
          description.trim() || null,
          simulation
        );
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fout bij opslaan');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Scenario opslaan
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            &times;
          </button>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-md p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Kippen</span>
            <span className="tabular-nums text-gray-900 dark:text-gray-100">
              {simulation.input_birds.toLocaleString('nl-NL')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Griller</span>
            <span className="tabular-nums text-gray-900 dark:text-gray-100">
              {simulation.remaining_griller_kg.toLocaleString('nl-NL', {
                maximumFractionDigits: 1,
              })}{' '}
              kg
            </span>
          </div>
          {simulation.total_whole_birds_pulled > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Hele hoenen</span>
              <span className="tabular-nums text-gray-900 dark:text-gray-100">
                {simulation.total_whole_birds_pulled} st
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Naam *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="bijv. Scenario basis week 12"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Beschrijving
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionele toelichting..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-md transition-colors"
          >
            {isPending ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
