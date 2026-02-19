/**
 * Customer Import Page — Sprint 16
 *
 * Import Exact Online verkoopanalyse en analyseer cherry-picker gedrag.
 * Client-side Excel parsing + in-memory cherry-picker engine.
 */

import Link from 'next/link';
import { ImportWizard } from '@/components/oil/customer-import/ImportWizard';

export default function CustomerImportPage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/oil" className="hover:text-blue-600 dark:hover:text-blue-400">Dashboard</Link>
        <span>/</span>
        <Link href="/oil/customers" className="hover:text-blue-600 dark:hover:text-blue-400">Klanten</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">Import</span>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Import Klantprofiel
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload een Exact Online verkoopanalyse (.xlsx) en analyseer het afnamepatroon
          ten opzichte van de natuurlijke vierkantsverwaarding.
        </p>
      </div>

      {/* Wizard */}
      <ImportWizard />

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm max-w-3xl mx-auto">
        <p className="font-medium text-blue-800 dark:text-blue-300">Hoe werkt het?</p>
        <ol className="mt-2 text-blue-600 dark:text-blue-400 space-y-1 list-decimal list-inside">
          <li>Exporteer in Exact Online: Handel → Verkoopanalyse → Excel</li>
          <li>Upload het bestand en controleer de productmappings</li>
          <li>Samengestelde producten (bouten, burgers, gehakt) worden automatisch gesplitst</li>
          <li>De cherry-picker engine vergelijkt het afnamepatroon met de anatomische norm</li>
        </ol>
      </div>
    </div>
  );
}
