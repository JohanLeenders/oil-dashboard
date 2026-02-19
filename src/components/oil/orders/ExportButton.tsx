'use client';

/**
 * ExportButton — Download order schema as Excel (.xlsx)
 *
 * REGRESSIE-CHECK:
 * - Pure client component, no DB access
 * - Uses exportOrderSchemaToExcel (pure function)
 * - Validates with validateForStorteboom before export
 */

import { exportOrderSchemaToExcel } from '@/lib/export/orderSchemaExport';
import { validateForStorteboom } from '@/lib/export/storteboomValidator';
import type { OrderSchemaData } from '@/types/database';

interface ExportButtonProps {
  schemaData: OrderSchemaData;
  slaughterDate: string;
}

export default function ExportButton({ schemaData, slaughterDate }: ExportButtonProps) {
  function handleExport() {
    // Validate before export
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

    const buffer = exportOrderSchemaToExcel(schemaData, slaughterDate);
    const blob = new Blob([buffer.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bestelschema_${slaughterDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-md transition-colors"
    >
      Exporteer Excel
    </button>
  );
}
