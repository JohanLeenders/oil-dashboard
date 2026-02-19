'use client';

/**
 * ExportList — Table of finalized snapshots with download actions
 * Wave 4 — A4-S1: Export Bundle Page
 *
 * REGRESSIE-CHECK:
 * - Client component for download button interaction
 * - No DB access, receives data via props
 * - Uses exportOrderSchemaToExcel (pure function)
 */

import { exportOrderSchemaToExcel } from '@/lib/export/orderSchemaExport';
import { validateForStorteboom } from '@/lib/export/storteboomValidator';
import type { FinalizedSnapshotRow } from '@/lib/actions/exports';

interface ExportListProps {
  snapshots: FinalizedSnapshotRow[];
  snapshotInstructionCounts: Record<string, number>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ExportList({ snapshots, snapshotInstructionCounts }: ExportListProps) {
  function handleDownload(snapshot: FinalizedSnapshotRow) {
    const schemaData = snapshot.schema_data;
    const validation = validateForStorteboom(schemaData);

    if (!validation.valid) {
      alert(
        'Export niet mogelijk:\n\n' + validation.errors.map((e) => '• ' + e).join('\n')
      );
      return;
    }

    if (validation.warnings.length > 0) {
      const proceed = confirm(
        'Waarschuwingen:\n\n' +
          validation.warnings.map((w) => '• ' + w).join('\n') +
          '\n\nDoorgaan met export?'
      );
      if (!proceed) return;
    }

    const buffer = exportOrderSchemaToExcel(schemaData, snapshot.slaughter_date);
    const blob = new Blob([buffer.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bestelschema_${snapshot.slaughter_date}_v${snapshot.version}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (snapshots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-12">
        <div className="text-center">
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            Geen definitieve exports
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Er zijn nog geen gefinaliseerde bestelschema&apos;s. Finaliseer een schema
            via de Orders pagina.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Slachtdatum
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Versie
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Snapshot datum
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Orders
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Producten
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Acties
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {snapshots.map((snapshot) => {
            const orderCount = snapshot.schema_data.orders?.length ?? 0;
            const productCount = snapshot.schema_data.surplus_deficit?.length ?? 0;
            const instructionCount = snapshotInstructionCounts[snapshot.id] ?? 0;

            return (
              <tr
                key={snapshot.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatDate(snapshot.slaughter_date)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                  v{snapshot.version}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(snapshot.snapshot_date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                  {orderCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                  {productCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(snapshot)}
                      className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                      Download Excel
                    </button>
                    {instructionCount > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {instructionCount} instructie{instructionCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
