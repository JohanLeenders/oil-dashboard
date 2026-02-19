/**
 * OIL Dashboard Home
 *
 * REGRESSIE-CHECK:
 * - ✅ Read-only stats display
 * - ✅ THT via engine (70/90)
 * - ✅ Geen mutations
 */

import Link from 'next/link';
import { getBatchStats } from '@/lib/actions/batches';

export default async function OilDashboardPage() {
  const stats = await getBatchStats();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Dashboard</h2>
        <p className="text-sm text-gray-400 mt-0.5">Overzicht vierkantsverwaarding en massabalans</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Totaal Batches"
          value={stats.total_batches.toString()}
          subtitle="In systeem"
          href="/oil/batches"
        />
        <KpiCard
          title="Levend Gewicht"
          value={formatWeight(stats.total_live_weight_kg)}
          subtitle="Totaal kg"
        />
        <KpiCard
          title="Gem. Griller Yield"
          value={`${stats.avg_griller_yield_pct}%`}
          subtitle="Target: 70.7%"
          alert={stats.avg_griller_yield_pct < 70}
        />
        <KpiCard
          title="Aandacht Nodig"
          value={(stats.batches_needs_review + stats.batches_tht_warning).toString()}
          subtitle={`${stats.batches_needs_review} review, ${stats.batches_tht_warning} THT`}
          alert={stats.batches_needs_review > 0 || stats.batches_tht_warning > 0}
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLinkCard
          title="Batches"
          description="Bekijk alle slachtbatches met massabalans en THT status"
          href="/oil/batches"
          icon="📦"
        />
        <QuickLinkCard
          title="Cherry-Picker Analyse"
          description="Identificeer klanten met ongebalanceerde afname"
          href="/oil/customers"
          icon="🍒"
        />
        <QuickLinkCard
          title="Kostprijs"
          description="Kostprijsberekeningen per profiel met 7-level waterval"
          href="/oil/kostprijs"
          icon="💰"
        />
      </div>

      {/* System Info — compact */}
      <div className="bg-gray-100/60 dark:bg-gray-800/60 rounded-xl p-4 text-xs text-gray-400">
        <span className="font-semibold text-gray-500 dark:text-gray-300">Systeem:</span>{' '}
        THT 70/90 · SVASO allocatie · Cherry-Picker alert bij filet &gt;30% · Append-only
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  href,
  alert = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  href?: string;
  alert?: boolean;
}) {
  const content = (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border p-5 transition-all ${
        alert ? 'border-orange-200 dark:border-orange-800' : 'border-gray-100 dark:border-gray-700'
      } ${href ? 'hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 cursor-pointer' : 'shadow-sm'}`}
    >
      <p className="text-xs text-gray-400 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1.5 tabular-nums ${alert ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
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
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all group"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm group-hover:text-oranje-600 transition-colors">{title}</h3>
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function formatWeight(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)}t`;
  }
  return `${kg.toFixed(0)} kg`;
}
