'use client';

/**
 * OrderLineEditor — Add/remove order lines (select product, enter kg)
 *
 * REGRESSIE-CHECK:
 * - Writes to order_lines via server actions
 * - Deletes order lines via server action
 */

import { useState, useTransition } from 'react';
import { addOrderLine, removeOrderLine } from '@/lib/actions/orders';
import type { OrderLine } from '@/types/database';

interface OrderLineWithProduct extends OrderLine {
  product_name: string;
}

interface OrderLineEditorProps {
  orderId: string;
  lines: OrderLineWithProduct[];
  products: { id: string; name: string }[];
  onLinesChanged: () => void;
}

export default function OrderLineEditor({
  orderId,
  lines,
  products,
  onLinesChanged,
}: OrderLineEditorProps) {
  const [productId, setProductId] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!productId) {
      setError('Selecteer een product');
      return;
    }

    const kg = parseFloat(quantityKg);
    if (isNaN(kg) || kg <= 0) {
      setError('Voer een geldig gewicht in (> 0 kg)');
      return;
    }

    startTransition(async () => {
      try {
        await addOrderLine(orderId, productId, kg);
        setProductId('');
        setQuantityKg('');
        onLinesChanged();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Fout bij toevoegen'
        );
      }
    });
  }

  function handleRemove(lineId: string) {
    startTransition(async () => {
      try {
        await removeOrderLine(lineId);
        onLinesChanged();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Fout bij verwijderen'
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Existing lines */}
      {lines.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          {lines.map((line) => (
            <div
              key={line.id}
              className="flex items-center justify-between px-3 py-2"
            >
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {line.product_name}
                </span>
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  {line.quantity_kg.toLocaleString('nl-NL', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  kg
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(line.id)}
                disabled={isPending}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs disabled:opacity-50"
              >
                Verwijder
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add line form */}
      <form onSubmit={handleAdd} className="flex gap-2 items-end">
        <div className="flex-1">
          <label
            htmlFor="product"
            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
          >
            Product
          </label>
          <select
            id="product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={isPending}
          >
            <option value="">-- Product --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-24">
          <label
            htmlFor="quantity"
            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
          >
            Kg
          </label>
          <input
            id="quantity"
            type="number"
            step="0.1"
            min="0.1"
            value={quantityKg}
            onChange={(e) => setQuantityKg(e.target.value)}
            placeholder="0.0"
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={isPending}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-md transition-colors"
        >
          {isPending ? '...' : '+'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
