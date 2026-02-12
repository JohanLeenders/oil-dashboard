/**
 * Batch Input Detail — Tabbed view with Input + Waterfall
 *
 * Server Component that loads batch data and passes to client shell.
 * Engine pipeline runs server-side for initial load.
 *
 * NO modifications to existing /oil/batches/[batchId] pages.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBatch } from '@/lib/data/batch-input-store';
import { runBatchPipeline } from '@/lib/data/batch-engine-bridge';
import { BatchDetailShell } from '@/components/oil/batch-input/BatchDetailShell';

interface PageProps {
  params: Promise<{ batchId: string }>;
}

export default async function BatchInputDetailPage({ params }: PageProps) {
  const { batchId } = await params;
  const batchInput = getBatch(decodeURIComponent(batchId));

  if (!batchInput) {
    notFound();
  }

  // Run full engine pipeline server-side
  const waterfallData = runBatchPipeline(batchInput);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/oil" className="hover:text-blue-600">Dashboard</Link>
        <span>/</span>
        <Link href="/oil/batch-input" className="hover:text-blue-600">Batch Input</Link>
        <span>/</span>
        <span className="text-gray-900">{batchInput.batch_ref}</span>
      </div>

      <BatchDetailShell
        initialBatchInput={batchInput}
        initialWaterfallData={waterfallData}
      />
    </div>
  );
}
