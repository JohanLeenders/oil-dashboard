'use client';

/**
 * AutoDistributeModal — "Verdeel X kippen" distribution preview
 *
 * Input: bird count → distributeByBirds() → preview table → add as order lines
 * Putten products ONLY. Does NOT create Nijkerk child lines.
 */

import { useState, useTransition } from 'react';
import { distributeByBirds } from '@/lib/engine/orders/distributeByBirds';
import type { DistributionPreview } from '@/lib/engine/orders/distributeByBirds';
import type { LocationYieldProfile } from '@/lib/engine/availability/cascading';
import { addOrderLine } from '@/lib/actions/orders';

interface AutoDistributeModalProps {
  orderId: string;
  avgWeightKg: number;
  grillerYieldPct: number;
  yieldProfiles: LocationYieldProfile[];
  onDone: () => void;
  onClose: () => void;
}

export default function AutoDistributeModal({
  orderId,
  avgWeightKg,
  grillerYieldPct,
  yieldProfiles,
  onDone,
  onClose,
}: AutoDistributeModalProps) {
  const [birdCount, setBirdCount] = useState('');
  const [preview, setPreview] = useState<DistributionPreview | null>(null);
  const [editableLines, setEditableLines] = useState<
    { product_id: string; product_description: string; quantity_kg: number }[]
  >([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace' | null>(null);

  function handleCalculate() {
    setError(null);
    const count = parseInt(birdCount, 10);
    if (isNaN(count) || count <= 0) {
      setError('Voer een geldig aantal kippen in');
      return;
    }

    const result = distributeByBirds({
      bird_count: count,
      avg_weight_kg: avgWeightKg,
      griller_yield_pct: grillerYieldPct,
      yield_profiles: yieldProfiles,
    });

    setPreview(result);
    setEditableLines(result.lines.map((l) => ({ ...l })));
  }

  function handleQuantityChange(index: number, value: string) {
    const kg = parseFloat(value);
    setEditableLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity_kg: isNaN(kg) ? 0 : kg };
      return copy;
    });
  }

  function handleSubmit() {
    if (!mode) {
      setError('Kies "Toevoegen" of "Vervangen"');
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        for (const line of editableLines) {
          if (line.quantity_kg > 0) {
            await addOrderLine(orderId, line.product_id, line.quantity_kg);
          }
        }
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fout bij toevoegen');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Verdeel kippen
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            &times;
          </button>
        </div>

        {/* Step 1: Enter bird count */}
        {!preview && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Aantal kippen
              </label>
              <input
                type="number"
                min="1"
                value={birdCount}
                onChange={(e) => setBirdCount(e.target.value)}
                placeholder="bv. 1000"
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={handleCalculate}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Bereken
            </button>
          </div>
        )}

        {/* Step 2: Preview + edit */}
        {preview && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {preview.bird_count.toLocaleString('nl-NL')} kippen &rarr;{' '}
              {preview.griller_kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg griller
            </p>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-1.5 font-medium text-gray-600 dark:text-gray-400">Product</th>
                  <th className="text-right py-1.5 font-medium text-gray-600 dark:text-gray-400">Kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {editableLines.map((line, index) => (
                  <tr key={line.product_id}>
                    <td className="py-1.5 text-gray-900 dark:text-gray-100">
                      {line.product_description}
                    </td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={line.quantity_kg}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        className="w-24 text-right rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Merge vs Replace */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('merge')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  mode === 'merge'
                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Toevoegen aan bestaand
              </button>
              <button
                type="button"
                onClick={() => setMode('replace')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  mode === 'replace'
                    ? 'bg-orange-100 dark:bg-orange-900 border-orange-500 text-orange-700 dark:text-orange-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Vervangen
              </button>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setPreview(null); setEditableLines([]); setMode(null); }}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Terug
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !mode}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-md transition-colors"
              >
                {isPending ? 'Bezig...' : 'Toevoegen als orderregels'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
