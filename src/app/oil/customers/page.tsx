/**
 * Customers / Cherry-Picker Analysis Page
 *
 * REGRESSIE-CHECK:
 * - Read-only display
 * - Cherry-picker detectie via engine (30% filet threshold)
 * - Balance score via engine
 * - Geen mutations
 * - Geen aannames over thresholds (in engine)
 *
 * Sprint 1: Added links to customer detail pages
 */

import Link from 'next/link';
import { getCustomersWithAnalysis, getCustomerStats } from '@/lib/actions/customers';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default async function CustomersPage() {
  const [customers, stats] = await Promise.all([
    getCustomersWithAnalysis(),
    getCustomerStats(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Cherry-Picker Analyse</h2>
        <p className="text-gray-600 mt-1">
          Identificeer klanten met ongebalanceerde afname (filet &gt;30%)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Actieve Klanten"
          value={stats.total_customers.toString()}
        />
        <StatCard
          label="Cherry Pickers"
          value={stats.cherry_pickers.toString()}
          highlight={stats.cherry_pickers > 0}
        />
        <StatCard
          label="Gem. Balance Score"
          value={`${stats.avg_balance_score}/100`}
          highlight={stats.avg_balance_score < 70}
        />
        <StatCard
          label="Opportunity Cost"
          value={`€${stats.total_opportunity_cost.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`}
          highlight={stats.total_opportunity_cost > 1000}
        />
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-600">Cherry Picker (filet &gt;30%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-gray-600">Score &lt;70</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-600">Gebalanceerd</span>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Klant
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Omzet YTD
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Balance Score
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Filet %
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Opportunity Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Aanbeveling
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  Geen klanten gevonden. Run migraties en seed data.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <CustomerRow key={customer.id} customer={customer} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="font-medium text-blue-800">Detectie Logica</p>
        <ul className="mt-2 text-blue-600 space-y-1">
          <li>• Cherry Picker: Klant neemt &gt;30% filet af (anatomisch ~24% beschikbaar)</li>
          <li>• Minimum omzet voor analyse: €10.000 YTD</li>
          <li>• Balance Score: 100 = perfect gebalanceerd, 0 = extreme cherry picker</li>
          <li>• Opportunity Cost: Geschatte impact op vierkantsverwaarding</li>
        </ul>
      </div>
    </div>
  );
}

function CustomerRow({
  customer,
}: {
  customer: Awaited<ReturnType<typeof getCustomersWithAnalysis>>[0];
}) {
  const { analysis } = customer;

  const filetBreakdown = analysis.category_breakdown.find(c => c.category === 'filet');
  const filetPct = filetBreakdown?.percentage_of_total || 0;

  const scoreColor = analysis.balance_score >= 80
    ? 'text-green-600'
    : analysis.balance_score >= 50
      ? 'text-yellow-600'
      : 'text-red-600';

  const scoreBg = analysis.balance_score >= 80
    ? 'bg-green-100'
    : analysis.balance_score >= 50
      ? 'bg-yellow-100'
      : 'bg-red-100';

  return (
    <tr className={`hover:bg-gray-50 ${analysis.is_cherry_picker ? 'bg-red-50' : ''}`}>
      <td className="px-6 py-4">
        <Link href={`/oil/customers/${customer.id}`} className="block group">
          <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
            {customer.name}
          </p>
          <p className="text-xs text-gray-500">{customer.customer_code}</p>
        </Link>
      </td>
      <td className="px-6 py-4 text-sm text-gray-900 text-right">
        €{customer.total_revenue_ytd.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
      </td>
      <td className="px-6 py-4 text-center">
        <span className={`inline-flex items-center justify-center w-12 h-8 rounded-full text-sm font-bold ${scoreBg} ${scoreColor}`}>
          {analysis.balance_score}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        {analysis.is_cherry_picker ? (
          <StatusBadge status="red" label="Cherry Picker" size="sm" />
        ) : analysis.balance_score < 70 ? (
          <StatusBadge status="orange" label="Aandacht" size="sm" />
        ) : (
          <StatusBadge status="green" label="OK" size="sm" />
        )}
      </td>
      <td className={`px-6 py-4 text-sm text-right font-medium ${
        filetPct > 30 ? 'text-red-600' : filetPct > 24 ? 'text-yellow-600' : 'text-gray-900'
      }`}>
        {filetPct.toFixed(1)}%
        {filetPct > 30 && <span className="text-xs text-red-500 ml-1">(max 30%)</span>}
      </td>
      <td className={`px-6 py-4 text-sm text-right ${
        analysis.opportunity_cost > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'
      }`}>
        {analysis.opportunity_cost > 0
          ? `€${analysis.opportunity_cost.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`
          : '-'}
      </td>
      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
        <p className="truncate" title={analysis.recommendation}>
          {analysis.recommendation}
        </p>
      </td>
    </tr>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${
      highlight ? 'border-orange-300' : 'border-gray-200'
    }`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${
        highlight ? 'text-orange-600' : 'text-gray-900'
      }`}>
        {value}
      </p>
    </div>
  );
}
