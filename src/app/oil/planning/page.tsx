/**
 * OIL Planning Page — Slachtkalender overzicht
 * Sprint: Wave 2 — A1-S1 Planning UI + Wave 6 — A0-S2 Import
 *
 * REGRESSIE-CHECK:
 * - ✅ Leest uit slaughter_calendar via server action
 * - ✅ ImportSlaughterDays client component voor import (Wave 6)
 * - ✅ Server Component (no 'use client')
 */

import Link from 'next/link';
import { getSlaughterCalendar } from '@/lib/actions/planning';
import SlaughterCalendarList from '@/components/oil/planning/SlaughterCalendarList';
import ImportSlaughterDays from '@/components/oil/planning/ImportSlaughterDays';

export default async function PlanningPage() {
  const items = await getSlaughterCalendar();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-brand tracking-tight" style={{ color: 'var(--color-text-main)' }}>
            Planning
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Slachtkalender en beschikbaarheidsplanning
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ImportSlaughterDays />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {items.length} slachtdag{items.length !== 1 ? 'en' : ''}
          </span>
          <Link
            href="/oil/orders"
            className="text-sm transition-colors"
            style={{ color: 'var(--color-oil-orange)' }}
          >
            Naar orders &rarr;
          </Link>
        </div>
      </div>

      <SlaughterCalendarList items={items} />
    </div>
  );
}
