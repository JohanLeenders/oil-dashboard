'use client';

/**
 * FullAvailabilityButton — "Volledige beschikbaarheid" capture
 *
 * Captures all remaining availability as order line suggestions,
 * shows preview modal, then adds as order lines.
 */

import { useState, useTransition } from 'react';
import { captureFullAvailability } from '@/lib/engine/orders/captureFullAvailability';
import type { AvailabilitySuggestion } from '@/lib/engine/orders/captureFullAvailability';
import type { CascadedAvailability } from '@/lib/engine/availability/cascading';
import { addOrderLine } from '@/lib/actions/orders';

interface FullAvailabilityButtonProps {
  orderId: string;
  availability: CascadedAvailability;
  onDone: () => void;
}

export default function FullAvailabilityButton({
  orderId,
  availability,
  onDone,
}: FullAvailabilityButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [suggestions, setSuggestions] = useState<AvailabilitySuggestion[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasOversubscription = availability.primary_products.some(
    (p) => p.oversubscribed_kg > 0
  );

  function handleOpen() {
    const result = captureFullAvailability(availability);
    setSuggestions(result);
    setShowModal(true);
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        for (const line of suggestions) {
          if (line.quantity_kg > 0) {
            await addOrderLine(orderId, line.product_id, line.quantity_kg);
          }
        }
        setShowModal(false);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fout bij toevoegen');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
      >
        Volledige beschikbaarheid
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Resterende beschikbaarheid
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                &times;
              </button>
            </div>

            {hasOversubscription && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-700 dark:text-red-400">
                Waarschuwing: sommige producten zijn overbezet. Overbestelde producten zijn niet opgenomen.
              </div>
            )}

            {suggestions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                Alle producten zijn volledig bezet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-1.5 font-medium text-gray-600 dark:text-gray-400">Product</th>
                    <th className="text-right py-1.5 font-medium text-gray-600 dark:text-gray-400">Kg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {suggestions.map((line) => (
                    <tr key={line.product_id}>
                      <td className="py-1.5 text-gray-900 dark:text-gray-100">{line.product_description}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">
                        {line.quantity_kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Annuleren
              </button>
              {suggestions.length > 0 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-md transition-colors"
                >
                  {isPending ? 'Bezig...' : 'Toevoegen'}
                </button>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
