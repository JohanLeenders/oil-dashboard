/**
 * OIL Dashboard Home
 *
 * REGRESSIE-CHECK:
 * - Read-only stats display
 * - THT via engine (70/90)
 * - Geen mutations
 * - Wave 9: OIL design tokens, DashboardKpiGrid with drill-down modals
 */

import Link from 'next/link';
import { getBatchStats } from '@/lib/actions/batches';
import OrderStatusTiles from '@/components/oil/dashboard/OrderStatusTiles';
import DashboardKpiGrid from '@/components/oil/dashboard/DashboardKpiGrid';

export default async function OilDashboardPage() {
  const stats = await getBatchStats();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-brand tracking-tight" style={{ color: 'var(--color-text-main)' }}>
          Dashboard
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
          Overzicht vierkantsverwaarding en massabalans
        </p>
      </div>

      {/* KPI Cards — clickable with drill-down modals (UX-5) */}
      <DashboardKpiGrid stats={stats} />

      {/* Order Status */}
      <OrderStatusTiles />

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLinkCard
          title="Batches"
          description="Bekijk alle slachtbatches met massabalans en THT status"
          href="/oil/batches"
          icon="&#128230;"
        />
        <QuickLinkCard
          title="Cherry-Picker Analyse"
          description="Identificeer klanten met ongebalanceerde afname"
          href="/oil/customers"
          icon="&#127826;"
        />
        <QuickLinkCard
          title="Kostprijs"
          description="Kostprijsberekeningen per profiel met 7-level waterval"
          href="/oil/kostprijs"
          icon="&#128176;"
        />
      </div>

      {/* System Info — compact */}
      <div
        className="oil-card p-4 text-xs"
        style={{ color: 'var(--color-text-dim)' }}
      >
        <span className="font-semibold" style={{ color: 'var(--color-text-muted)' }}>Systeem:</span>{' '}
        THT 70/90 &middot; SVASO allocatie &middot; Cherry-Picker alert bij filet &gt;30% &middot; Append-only
      </div>
    </div>
  );
}

function QuickLinkCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="oil-card p-5 transition-all group"
      style={{ cursor: 'pointer' }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" dangerouslySetInnerHTML={{ __html: icon }} />
        <div>
          <h3
            className="font-semibold text-sm transition-colors"
            style={{ color: 'var(--color-text-main)' }}
          >
            {title}
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
