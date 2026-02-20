'use client';

/**
 * OrderLineEditor — Add/remove/edit order lines
 *
 * REGRESSIE-CHECK:
 * - Writes to order_lines via server actions (add, remove, update)
 * - Wave 7: Inline editing (click kg → input, Enter=save, Escape=cancel, Tab=save+next)
 * - Wave 7: Delete with confirmation dialog
 */

import { useState, useRef, useTransition, useCallback } from 'react';
import { addOrderLine, removeOrderLine, updateOrderLine } from '@/lib/actions/orders';
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
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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
    setConfirmDeleteId(null);
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

  const startEditing = useCallback((lineId: string, currentKg: number) => {
    setEditingLineId(lineId);
    setEditValue(String(currentKg));
    // Focus the input after render
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingLineId(null);
    setEditValue('');
  }, []);

  const saveEditing = useCallback((lineId: string, nextLineId?: string) => {
    const kg = parseFloat(editValue);
    if (isNaN(kg) || kg <= 0) {
      cancelEditing();
      return;
    }

    startTransition(async () => {
      try {
        await updateOrderLine(lineId, kg);
        setEditingLineId(null);
        setEditValue('');
        // If Tab was pressed, move to next line
        if (nextLineId) {
          const nextLine = lines.find((l) => l.id === nextLineId);
          if (nextLine) {
            startEditing(nextLineId, nextLine.quantity_kg);
          }
        }
        onLinesChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fout bij opslaan');
      }
    });
  }, [editValue, cancelEditing, startEditing, lines, onLinesChanged]);

  function handleEditKeyDown(e: React.KeyboardEvent, lineId: string, lineIndex: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEditing(lineId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const nextLine = lines[lineIndex + 1];
      saveEditing(lineId, nextLine?.id);
    }
  }

  const confirmLine = confirmDeleteId ? lines.find((l) => l.id === confirmDeleteId) : null;

  return (
    <div className="space-y-3">
      {/* Existing lines */}
      {lines.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          {lines.map((line, index) => (
            <div
              key={line.id}
              className="flex items-center justify-between px-3 py-2"
            >
              <div className="text-sm flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {line.product_name}
                </span>
                {editingLineId === line.id ? (
                  <input
                    ref={editInputRef}
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, line.id, index)}
                    onBlur={() => saveEditing(line.id)}
                    className="w-20 text-right rounded border border-blue-400 dark:border-blue-500 bg-white dark:bg-gray-700 px-2 py-0.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                    disabled={isPending}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(line.id, line.quantity_kg)}
                    className="ml-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer tabular-nums"
                    title="Klik om te bewerken"
                  >
                    {line.quantity_kg.toLocaleString('nl-NL', {
                      maximumFractionDigits: 1,
                    })}{' '}
                    kg
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(line.id)}
                disabled={isPending}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs disabled:opacity-50"
              >
                Verwijder
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDeleteId && confirmLine && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 flex items-center justify-between">
          <span className="text-sm text-red-700 dark:text-red-400">
            Orderregel verwijderen? ({confirmLine.quantity_kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg {confirmLine.product_name})
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={() => handleRemove(confirmDeleteId)}
              disabled={isPending}
              className="px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded"
            >
              Verwijderen
            </button>
          </div>
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
