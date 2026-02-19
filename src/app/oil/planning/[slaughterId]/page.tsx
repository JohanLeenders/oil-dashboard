/**
 * OIL Planning Detail Page — Slachtdag details
 * Sprint: Wave 2 — A1-S1 Planning UI
 *
 * REGRESSIE-CHECK:
 * - ✅ Leest alleen uit slaughter_calendar via server action
 * - ✅ Geen mutations of forms
 * - ✅ Read-only display
 * - ✅ Server Component (no 'use client')
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSlaughterDetail } from '@/lib/actions/planning';
import SlaughterDetail from '@/components/oil/planning/SlaughterDetail';
import AvailabilityTable from '@/components/oil/planning/AvailabilityTable';
import EstimateVsActual from '@/components/oil/planning/EstimateVsActual';

interface SlaughterDetailPageProps {
  params: Promise<{ slaughterId: string }>;
}

export default async function SlaughterDetailPage({ params }: SlaughterDetailPageProps) {
  const { slaughterId } = await params;
  const slaughter = await getSlaughterDetail(slaughterId);

  if (!slaughter) {
    notFound();
  }

  const displayDate = new Date(slaughter.slaughter_date).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/oil/planning"
          className="text-sm text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
        >
          ← Terug naar planning
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Slachtdag {displayDate}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Week {slaughter.week_number}, {slaughter.year}
        </p>
      </div>

      <SlaughterDetail slaughter={slaughter} />
      <AvailabilityTable expectedLiveWeightKg={slaughter.expected_live_weight_kg} />
      <EstimateVsActual />
    </div>
  );
}
