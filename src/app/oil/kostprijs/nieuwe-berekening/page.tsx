/**
 * Nieuwe Kostprijsberekening — Start a new cost price calculation.
 *
 * Wrapper around NewBatchShell with kostprijs-oriented breadcrumbs.
 */

import Link from 'next/link';
import { NewBatchShell } from '@/components/oil/batch-input/NewBatchShell';

export default function NieuweKostprijsPage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/oil" className="hover:text-blue-600 dark:hover:text-blue-400">Dashboard</Link>
        <span>/</span>
        <Link href="/oil/kostprijs" className="hover:text-blue-600 dark:hover:text-blue-400">Kostprijs</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">Nieuwe berekening</span>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Nieuwe Kostprijsberekening</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Selecteer een profiel en voer de batchgegevens in
        </p>
      </div>

      <NewBatchShell />
    </div>
  );
}
