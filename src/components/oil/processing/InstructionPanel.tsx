'use client';

/**
 * InstructionPanel — Displays generated processing instructions
 *
 * REGRESSIE-CHECK:
 * - Read-only display of ProcessingInstructionData
 * - No mutations
 */

import type { ProcessingInstructionData } from '@/types/database';

interface InstructionPanelProps {
  instruction: ProcessingInstructionData;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };
  const labels: Record<string, string> = {
    pending: 'In wacht',
    in_progress: 'In uitvoering',
    completed: 'Afgerond',
    cancelled: 'Geannuleerd',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        styles[status] || styles.pending
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

export default function InstructionPanel({ instruction }: InstructionPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {instruction.recipe_name}
        </h3>
        {statusBadge('pending')}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Product</span>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {instruction.product_name}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Hoeveelheid</span>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {instruction.quantity_kg.toLocaleString('nl-NL', {
              maximumFractionDigits: 1,
            })}{' '}
            kg
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Opbrengst %</span>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {instruction.yield_percentage != null
              ? `${instruction.yield_percentage}%`
              : '—'}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Verwachte output</span>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {instruction.expected_output_kg != null
              ? `${instruction.expected_output_kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg`
              : '—'}
          </p>
        </div>
      </div>

      {instruction.steps.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Stappen
          </h4>
          <ol className="space-y-2">
            {instruction.steps.map((step) => (
              <li
                key={step.step_number}
                className="flex gap-3 text-sm"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-medium">
                  {step.step_number}
                </span>
                <div>
                  <p className="text-gray-900 dark:text-gray-100">
                    {step.description}
                  </p>
                  {step.parameters && Object.keys(step.parameters).length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {Object.entries(step.parameters)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ')}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
