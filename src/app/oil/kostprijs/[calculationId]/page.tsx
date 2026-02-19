/**
 * Kostprijs Detail — Tabbed view with Input + Waterfall + Marges.
 *
 * Server Component that loads batch data and passes to BatchDetailShell.
 * Engine pipeline runs server-side for initial load.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBatch } from '@/lib/data/batch-input-store';
import { runBatchPipeline } from '@/lib/data/batch-engine-bridge';
import { BatchDetailShell } from '@/components/oil/batch-input/BatchDetailShell';

interface PageProps {
  params: Promise<{ calculationId: string }>;
}

export default async function KostprijsDetailPage({ params }: PageProps) {
  const { calculationId } = await params;
  const batchInput = getBatch(decodeURIComponent(calculationId));

  if (!batchInput) {
    notFound();
  }

  // Run full engine pipeline server-side
  const waterfallData = runBatchPipeline(batchInput);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/oil" className="hover:text-blue-600 dark:hover:text-blue-400">Dashboard</Link>
        <span>/</span>
        <Link href="/oil/kostprijs" className="hover:text-blue-600 dark:hover:text-blue-400">Kostprijs</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">{batchInput.batch_ref}</span>
      </div>

      <BatchDetailShell
        initialBatchInput={batchInput}
        initialWaterfallData={waterfallData}
      />
    </div>
  );
}
