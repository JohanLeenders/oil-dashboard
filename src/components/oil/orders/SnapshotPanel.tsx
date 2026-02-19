'use client';

/**
 * SnapshotPanel — Show existing snapshots and create new draft snapshot
 *
 * REGRESSIE-CHECK:
 * - Reads order_schema_snapshots (display only)
 * - Creates draft snapshots via server action (APPEND-ONLY)
 * - Finalizes draft snapshots via server action (APPEND-ONLY — inserts new row)
 */

import { useState, useTransition } from 'react';
import { createDraftSnapshot, finalizeSnapshot } from '@/lib/actions/orders';
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
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

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

  function handleFinalize(snapshotId: string) {
    setFinalizingId(snapshotId);
    startTransition(async () => {
      try {
        await finalizeSnapshot(slaughterId, snapshotId);
        onSnapshotCreated();
      } catch (err) {
        console.error('Snapshot finalization failed:', err);
      } finally {
        setFinalizingId(null);
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
          {isPending && !finalizingId ? 'Bezig...' : 'Maak concept snapshot'}
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
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {snapshots.map((snap) => {
                const data = snap.schema_data;
                const isFinalized = snap.snapshot_type === 'finalized';
                const isFinalizing = finalizingId === snap.id;
                return (
                  <tr key={snap.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      v{snap.version}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          isFinalized
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {isFinalized ? 'Definitief' : 'Concept'}
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
                    <td className="px-4 py-2 text-sm text-right">
                      {!isFinalized && (
                        <button
                          type="button"
                          onClick={() => handleFinalize(snap.id)}
                          disabled={isPending}
                          className="px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 hover:bg-green-100 dark:hover:bg-green-900 disabled:opacity-50 rounded transition-colors"
                        >
                          {isFinalizing ? 'Bezig...' : 'Finaliseer'}
                        </button>
                      )}
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
