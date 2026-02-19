'use client';

/**
 * SnapshotPanel — Show existing snapshots and create new draft snapshot
 *
 * REGRESSIE-CHECK:
 * - Reads order_schema_snapshots (display only)
 * - Creates draft snapshots via server action (APPEND-ONLY)
 */

import { useTransition } from 'react';
import { createDraftSnapshot } from '@/lib/actions/orders';
import type { OrderSchemaSnapshot } from '@/types/database';

interface SnapshotPanelProps {
  slaughterId: string;
  snapshots: OrderSchemaSnapshot[];
  onSnapshotCreated: () => void;
}

export default function SnapshotPanel({
  slaughterId,
  snapshots,
  onSnapshotCreated,
}: SnapshotPanelProps) {
  const [isPending, startTransition] = useTransition();

  function handleCreateSnapshot() {
    startTransition(async () => {
      try {
        await createDraftSnapshot(slaughterId);
        onSnapshotCreated();
      } catch (err) {
        console.error('Snapshot creation failed:', err);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Snapshots
        </h3>
        <button
          type="button"
          onClick={handleCreateSnapshot}
          disabled={isPending}
          className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-md transition-colors"
        >
          {isPending ? 'Bezig...' : 'Maak concept snapshot'}
        </button>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nog geen snapshots. Maak een concept snapshot om de huidige orderstatus
          vast te leggen.
        </p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Versie
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Datum
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Orders
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Producten
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {snapshots.map((snap) => {
                const data = snap.schema_data;
                return (
                  <tr key={snap.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      v{snap.version}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          snap.snapshot_type === 'finalized'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {snap.snapshot_type === 'finalized'
                          ? 'Definitief'
                          : 'Concept'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(snap.snapshot_date).toLocaleDateString('nl-NL', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 text-right">
                      {data?.orders?.length ?? 0}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 text-right">
                      {data?.surplus_deficit?.length ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
