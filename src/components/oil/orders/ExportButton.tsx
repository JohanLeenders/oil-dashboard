'use client';

/**
 * ExportButton — Download Storteboom bestelschema as Excel (.xlsx)
 *
 * Wave 8: Full Storteboom-format export with simulator toggle.
 *
 * REGRESSIE-CHECK:
 * - Pure client component, no DB access
 * - Uses exportStorteboomBestelschema (pure function)
 * - Validates with validateStorteboomExport before export
 */

import { useState } from 'react';
import {
  exportStorteboomBestelschema,
  type StorteboomExportInput,
} from '@/lib/export/orderSchemaExport';
import { validateStorteboomExport } from '@/lib/export/storteboomValidator';
import { buildStorteboomExportData } from '@/lib/actions/export';
import type { SimulatedAvailability } from '@/lib/engine/availability/simulator';

interface ExportButtonProps {
  slaughterId: string;
  slaughterDate: string;
  mester?: string;
  simulatorResult?: SimulatedAvailability | null;
}

export default function ExportButton({
  slaughterId,
  slaughterDate,
  mester,
  simulatorResult,
}: ExportButtonProps) {
  const [includeSimulator, setIncludeSimulator] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      // Build export data from server
      const data: StorteboomExportInput = await buildStorteboomExportData(
        slaughterId,
        includeSimulator && simulatorResult ? simulatorResult : undefined
      );

      // Validate before export
      const validation = validateStorteboomExport(data);

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

      // Generate Excel
      const buffer = exportStorteboomBestelschema(data);
      const blob = new Blob([buffer.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateParts = slaughterDate.split('-');
      const fileDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      a.download = `bestelschema_${mester ?? 'onbekend'}_${fileDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export fout: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {simulatorResult && (
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeSimulator}
            onChange={(e) => setIncludeSimulator(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          Met simulator data
        </label>
      )}
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
      >
        {loading ? 'Exporteren...' : 'Exporteer Bestelschema'}
      </button>
    </div>
  );
}
