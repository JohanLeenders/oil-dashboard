/**
 * OIL Exports Page — Finalized order schema downloads
 * Wave 4 — A4-S1: Export Bundle Page
 *
 * REGRESSIE-CHECK:
 * - Read-only page, no mutations
 * - Server Component (no 'use client')
 * - Uses getFinalizedSnapshots + getInstructionsForSnapshot (read-only)
 */

import { getFinalizedSnapshots, getInstructionsForSnapshot } from '@/lib/actions/exports';
import ExportList from '@/components/oil/exports/ExportList';

export default async function ExportsPage() {
  const snapshots = await getFinalizedSnapshots();

  // Build instruction counts per snapshot
  const snapshotInstructionCounts: Record<string, number> = {};
  for (const snapshot of snapshots) {
    const instructions = await getInstructionsForSnapshot(snapshot.id);
    snapshotInstructionCounts[snapshot.id] = instructions.length;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Exports
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Download gefinaliseerde bestelschema&apos;s als Excel
          </p>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {snapshots.length} gefinaliseerd{snapshots.length !== 1 ? 'e' : ''} schema&apos;s
        </span>
      </div>

      <ExportList
        snapshots={snapshots}
        snapshotInstructionCounts={snapshotInstructionCounts}
      />
    </div>
  );
}
