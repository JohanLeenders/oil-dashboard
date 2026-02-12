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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Overzicht vierkantsverwaarding en massabalans</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          title="Sankey Diagram"
          description="Visualiseer massabalans flow (Demo: P2520210)"
          href="/oil/batches"
          icon="📊"
        />
      </div>

      {/* System Info */}
      <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-600">
        <p className="font-medium mb-2">Systeem Configuratie (Locked)</p>
        <ul className="space-y-1">
          <li>• THT Thresholds: Groen &lt;70%, Oranje 70-90%, Rood &gt;90%</li>
          <li>• SVASO: Sales Value at Split-off allocatie (enige methode)</li>
          <li>• Cherry-Picker: Alert bij filet &gt;30% (anatomisch ~24%)</li>
          <li>• Data: Append-only met effective views</li>
        </ul>
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
      className={`bg-white rounded-lg border p-6 ${
        alert ? 'border-orange-300' : 'border-gray-200'
      } ${href ? 'hover:border-gray-300 transition-colors' : ''}`}
    >
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${alert ? 'text-orange-600' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
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
      className="bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
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
