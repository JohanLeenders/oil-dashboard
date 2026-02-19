'use client';

/**
 * OrderEntryForm — Form to create a new customer order
 *
 * REGRESSIE-CHECK:
 * - Creates customer_orders via server action
 * - Minimal validation (customer required)
 */

import { useState, useTransition } from 'react';
import { createCustomerOrder } from '@/lib/actions/orders';

interface OrderEntryFormProps {
  slaughterId: string;
  customers: { id: string; name: string }[];
  onOrderCreated: () => void;
  onCancel: () => void;
}

export default function OrderEntryForm({
  slaughterId,
  customers,
  onOrderCreated,
  onCancel,
}: OrderEntryFormProps) {
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Selecteer een klant');
      return;
    }

    startTransition(async () => {
      try {
        await createCustomerOrder(slaughterId, customerId, notes || undefined);
        onOrderCreated();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Er ging iets mis bij het aanmaken'
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Nieuwe order
      </h3>

      <div>
        <label
          htmlFor="customer"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Klant
        </label>
        <select
          id="customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          disabled={isPending}
        >
          <option value="">-- Selecteer klant --</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Notities (optioneel)
        </label>
        <input
          id="notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Eventuele opmerkingen"
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          disabled={isPending}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
        >
          {isPending ? 'Bezig...' : 'Order aanmaken'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
