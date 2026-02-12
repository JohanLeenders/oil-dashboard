/**
 * Scenario Sandbox Page — Sprint 11A.3
 *
 * What-if analysis UI for batch cost scenarios.
 * Allows users to override inputs (live price, yields, shadow prices)
 * and see the impact on cost waterfall and allocations.
 *
 * LAYOUT:
 * - Left: Baseline (actual batch data)
 * - Right: Scenario (with overrides applied)
 * - Bottom: Deltas + Save/Load controls
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SandboxClient } from './SandboxClient';
import { getBatchDetail } from '@/lib/actions/batches';
import { listScenarios } from '@/lib/actions/scenarios';

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
              className="text-gray-500 hover:text-gray-700"
            >
              ← Batch {batchDetail.batch.batch_ref}
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mt-2">
            Scenario Sandbox
          </h2>
          <p className="text-gray-600 mt-1">
            What-if analyse: wijzig inputs en zie de impact op kostprijs en allocatie
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">Scenario Disclaimer</p>
            <p className="text-sm text-blue-700 mt-1">
              Dit is een simulatie tool. Alle resultaten zijn WHAT-IF analyses op basis van hypothetische inputs.
              Gebruik dit NIET als boekhoudkundig advies. Alle scenario&apos;s zijn gemarkeerd als simulaties.
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
