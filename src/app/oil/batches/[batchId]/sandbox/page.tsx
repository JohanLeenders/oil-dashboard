/**
 * Scenario Sandbox Page — Sprint 12.2
 *
 * What-if analysis UI for batch cost scenarios.
 * All UI text imported from sandboxLabels (NL).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SandboxClient } from './SandboxClient';
import { getBatchDetail } from '@/lib/actions/batches';
import { listScenarios } from '@/lib/actions/scenarios';
import { PAGE } from '@/lib/ui/sandboxLabels';

interface PageProps {
  params: Promise<{ batchId: string }>;
}

export default async function SandboxPage({ params }: PageProps) {
  const { batchId } = await params;

  // Fetch batch detail (baseline data)
  const batchDetail = await getBatchDetail(batchId);

  if (!batchDetail) {
    notFound();
  }

  // Fetch saved scenarios for this batch
  const scenariosResult = await listScenarios(batchId);
  const savedScenarios = scenariosResult.success ? scenariosResult.data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/oil/batches/${batchId}`}
              className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:text-gray-600"
            >
              {PAGE.backLink(batchDetail.batch.batch_ref)}
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {PAGE.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-600 mt-1">
            {PAGE.subtitle}
          </p>
        </div>
      </div>

      {/* Disclaimer — amber styling */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-900">{PAGE.disclaimerTitle}</p>
            <p className="text-sm text-amber-700 mt-1">
              {PAGE.disclaimerBody}
            </p>
          </div>
        </div>
      </div>

      {/* Client-side sandbox interface */}
      <SandboxClient
        batchId={batchId}
        batchDetail={batchDetail}
        savedScenarios={savedScenarios}
      />
    </div>
  );
}
