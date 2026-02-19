/**
 * OIL Planning Page — Slachtkalender overzicht
 * Sprint: Wave 2 — A1-S1 Planning UI
 *
 * REGRESSIE-CHECK:
 * - ✅ Leest alleen uit slaughter_calendar via server action
 * - ✅ Geen mutations of forms
 * - ✅ Read-only display
 * - ✅ Server Component (no 'use client')
 */

import Link from 'next/link';
import { getSlaughterCalendar } from '@/lib/actions/planning';
import SlaughterCalendarList from '@/components/oil/planning/SlaughterCalendarList';

export default async function PlanningPage() {
  const items = await getSlaughterCalendar();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Planning
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Slachtkalender en beschikbaarheidsplanning
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {items.length} slachtdag{items.length !== 1 ? 'en' : ''}
          </span>
          <Link
            href="/oil/orders"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            Naar orders &rarr;
          </Link>
        </div>
      </div>

      <SlaughterCalendarList items={items} />
    </div>
  );
}
