/**
 * Sprint 5: Customer Margin Context Page
 *
 * Shows customer margins in carcass context with contract deviations.
 * ANALYTICAL ONLY - no price advice, no customer scoring.
 */

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

// Types for database results
interface CustomerMarginRow {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  part_code: string;
  quantity_kg: number;
  revenue_eur: number;
  cost_eur: number;
  margin_eur: number;
  margin_pct: number | null;
  customer_share_pct: number | null;
  customer_total_kg: number;
  customer_total_revenue_eur: number;
  customer_total_cost_eur: number;
  cost_data_status: 'COST_AVAILABLE' | 'NO_COST_DATA';
}

interface ContractDeviationRow {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  part_code: string;
  actual_share: number;
  agreed_share_min: number | null;
  agreed_share_max: number | null;
  agreed_range: string | null;
  deviation_pct: number | null;
  deviation_flag: 'WITHIN_RANGE' | 'BELOW_RANGE' | 'ABOVE_RANGE' | 'NO_CONTRACT';
  explanation: string;
  price_tier: string | null;
}

// JA757 carcass reference
const CARCASS_REFERENCE: Record<string, number> = {
  breast_cap: 35.85,
  leg_quarter: 43.40,
  wings: 10.70,
  back_carcass: 7.60,
  offal: 4.00,
};

// UI Helpers
function getMarginBadgeClass(marginPct: number | null): string {
  if (marginPct === null) return 'bg-gray-100 text-gray-600';
  if (marginPct < 0) return 'bg-red-100 text-red-800';
  if (marginPct < 5) return 'bg-orange-100 text-orange-800';
  if (marginPct > 15) return 'bg-green-100 text-green-800';
  return 'bg-yellow-100 text-yellow-800';
}

function getDeviationFlagClass(flag: string): string {
  switch (flag) {
    case 'WITHIN_RANGE':
      return 'bg-green-100 text-green-800';
    case 'BELOW_RANGE':
      return 'bg-orange-100 text-orange-800';
    case 'ABOVE_RANGE':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getDeviationFlagLabel(flag: string): string {
  switch (flag) {
    case 'WITHIN_RANGE':
      return 'Binnen afspraak';
    case 'BELOW_RANGE':
      return 'Onder minimum';
    case 'ABOVE_RANGE':
      return 'Boven maximum';
    default:
      return 'Geen contract';
  }
}

function getPartNameDutch(partCode: string): string {
  const names: Record<string, string> = {
    breast_cap: 'Filet',
    leg_quarter: 'Poot',
    wings: 'Vleugels',
    back_carcass: 'Rug/karkas',
    offal: 'Organen',
  };
  return names[partCode] || partCode;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatPercent(pct: number | null): string {
  if (pct === null) return '-';
  return `${pct.toFixed(1)}%`;
}

function formatDeviation(pct: number | null): string {
  if (pct === null) return '-';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export default async function MarginsPage() {
  const supabase = await createClient();

  // Fetch customer margin data
  const { data: marginData, error: marginError } = await supabase
    .from('v_customer_margin_by_part')
    .select('*')
    .order('customer_name');

  // Fetch contract deviation data
  const { data: deviationData, error: deviationError } = await supabase
    .from('v_customer_contract_deviation')
    .select('*')
    .order('customer_name');

  // Group margin data by customer
  const customerMarginMap = new Map<string, CustomerMarginRow[]>();
  if (marginData) {
    for (const row of marginData as CustomerMarginRow[]) {
      const existing = customerMarginMap.get(row.customer_id) || [];
      existing.push(row);
      customerMarginMap.set(row.customer_id, existing);
    }
  }

  // Group deviation data by customer
  const customerDeviationMap = new Map<string, ContractDeviationRow[]>();
  if (deviationData) {
    for (const row of deviationData as ContractDeviationRow[]) {
      const existing = customerDeviationMap.get(row.customer_id) || [];
      existing.push(row);
      customerDeviationMap.set(row.customer_id, existing);
    }
  }

  // Build customer summary
  const customers = Array.from(customerMarginMap.entries()).map(([id, margins]) => {
    const totalRevenue = margins.reduce((sum, m) => sum + m.revenue_eur, 0);
    const totalCost = margins.reduce((sum, m) => sum + m.cost_eur, 0);
    const totalMargin = totalRevenue - totalCost;
    const totalMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : null;
    const deviations = customerDeviationMap.get(id) || [];
    const contractDeviations = deviations.filter(
      d => d.deviation_flag === 'BELOW_RANGE' || d.deviation_flag === 'ABOVE_RANGE'
    );

    return {
      customer_id: id,
      customer_name: margins[0]?.customer_name || 'Onbekend',
      customer_code: margins[0]?.customer_code || '',
      total_revenue_eur: totalRevenue,
      total_cost_eur: totalCost,
      total_margin_eur: totalMargin,
      total_margin_pct: totalMarginPct,
      total_kg: margins[0]?.customer_total_kg || 0,
      part_margins: margins,
      contract_deviations: contractDeviations,
      has_cost_data: margins.some(m => m.cost_data_status === 'COST_AVAILABLE'),
    };
  });

  // Sort by margin
  customers.sort((a, b) => (b.total_margin_pct ?? 0) - (a.total_margin_pct ?? 0));

  // Calculate summary stats
  const totalCustomers = customers.length;
  const customersWithDeviations = customers.filter(c => c.contract_deviations.length > 0).length;
  const avgMarginPct = customers.length > 0
    ? customers.filter(c => c.total_margin_pct !== null)
        .reduce((sum, c) => sum + (c.total_margin_pct ?? 0), 0) /
      customers.filter(c => c.total_margin_pct !== null).length
    : 0;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/oil" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Klantmarges</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Klantafspraken, Marges & Karkascontext
        </h1>
        <p className="text-gray-600 mt-2">
          Marges per klant in relatie tot karkasafname en contractuele afspraken.
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Analytisch overzicht</strong> — Deze pagina toont marges ter ondersteuning van commerciële gesprekken.
            Geen klant-ranking, geen prijsadvies.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Klanten geanalyseerd</div>
          <div className="text-3xl font-bold text-gray-900">{totalCustomers}</div>
          <div className="text-sm text-gray-500 mt-1">Laatste 90 dagen</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Gem. marge</div>
          <div className={`text-3xl font-bold ${avgMarginPct < 5 ? 'text-orange-600' : avgMarginPct > 15 ? 'text-green-600' : 'text-gray-900'}`}>
            {formatPercent(avgMarginPct)}
          </div>
          <div className="text-sm text-gray-500 mt-1">Over alle klanten</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Klanten met contractafwijking</div>
          <div className="text-3xl font-bold text-gray-900">{customersWithDeviations}</div>
          <div className="text-sm text-gray-500 mt-1">Buiten afgesproken range</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Totale omzet (90d)</div>
          <div className="text-3xl font-bold text-gray-900">
            {formatMoney(customers.reduce((sum, c) => sum + c.total_revenue_eur, 0))}
          </div>
          <div className="text-sm text-gray-500 mt-1">Alle klanten</div>
        </div>
      </div>

      {/* Error handling */}
      {(marginError || deviationError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="text-red-800">
            Fout bij laden: {marginError?.message || deviationError?.message}
          </p>
        </div>
      )}

      {/* Customer Margin Table */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Klantoverzicht</h2>
          <p className="text-sm text-gray-500 mt-1">
            Marge per onderdeel met afwijkingen van contracten en karkasbalans
          </p>
        </div>

        {customers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Geen klantdata beschikbaar. Controleer of er verkoopdata is in de laatste 90 dagen.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {customers.map((customer) => (
              <div key={customer.customer_id} className="p-6">
                {/* Customer Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{customer.customer_name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{customer.customer_code}</span>
                      <span>•</span>
                      <span>{customer.total_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg totaal</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatMoney(customer.total_margin_eur)}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getMarginBadgeClass(customer.total_margin_pct)}`}>
                      {formatPercent(customer.total_margin_pct)} marge
                    </span>
                  </div>
                </div>

                {/* Contract Deviations Alert */}
                {customer.contract_deviations.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Contractafwijkingen:</strong>{' '}
                      {customer.contract_deviations.map((d, i) => (
                        <span key={d.part_code}>
                          {i > 0 && ', '}
                          {getPartNameDutch(d.part_code)} ({getDeviationFlagLabel(d.deviation_flag)})
                        </span>
                      ))}
                    </p>
                  </div>
                )}

                {/* No Cost Data Warning */}
                {!customer.has_cost_data && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <strong>Let op:</strong> Geen kostprijsdata beschikbaar. Margeberekening is onvolledig.
                    </p>
                  </div>
                )}

                {/* Part-by-Part Margin Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Onderdeel</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Omzet</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Kosten</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Marge</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Marge %</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Afname %</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">vs Karkas</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Contract</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customer.part_margins.map((margin) => {
                        const carcassShare = CARCASS_REFERENCE[margin.part_code] || 0;
                        const alignmentDelta = margin.customer_share_pct !== null
                          ? margin.customer_share_pct - carcassShare
                          : null;
                        const deviation = customer.contract_deviations.find(
                          d => d.part_code === margin.part_code
                        );

                        return (
                          <tr key={margin.part_code} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">
                              {getPartNameDutch(margin.part_code)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-900">
                              {formatMoney(margin.revenue_eur)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {margin.cost_data_status === 'COST_AVAILABLE'
                                ? formatMoney(margin.cost_eur)
                                : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              <span className={margin.margin_eur < 0 ? 'text-red-600' : 'text-gray-900'}>
                                {formatMoney(margin.margin_eur)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMarginBadgeClass(margin.margin_pct)}`}>
                                {formatPercent(margin.margin_pct)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600">
                              {formatPercent(margin.customer_share_pct)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {alignmentDelta !== null ? (
                                <span className={`text-xs ${Math.abs(alignmentDelta) > 5 ? (alignmentDelta > 0 ? 'text-blue-600' : 'text-orange-600') : 'text-green-600'}`}>
                                  {formatDeviation(alignmentDelta)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {deviation ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDeviationFlagClass(deviation.deviation_flag)}`}>
                                  {getDeviationFlagLabel(deviation.deviation_flag)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">Geen contract</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Margin Explanation */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Context:</strong>{' '}
                    {customer.total_margin_pct !== null && customer.total_margin_pct < 5
                      ? 'Lage totale marge.'
                      : customer.total_margin_pct !== null && customer.total_margin_pct > 15
                        ? 'Hoge totale marge.'
                        : 'Gemiddelde totale marge.'}{' '}
                    {customer.contract_deviations.length > 0
                      ? `${customer.contract_deviations.length} onderde${customer.contract_deviations.length === 1 ? 'el wijkt' : 'len wijken'} af van contractafspraken.`
                      : 'Alle onderdelen binnen contractafspraken (indien van toepassing).'}{' '}
                    {!customer.has_cost_data && 'Kostprijsdata ontbreekt — marge is indicatief.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reference Info */}
      <div className="mt-8 text-sm text-gray-500">
        <h3 className="font-medium text-gray-700 mb-2">Referentie</h3>
        <ul className="space-y-1">
          <li>• Karkasratio&apos;s: JA757 (Hubbard spec) — voor alignment berekening</li>
          <li>• Analyseperiode: Laatste 90 dagen</li>
          <li>• Kosten: NRV-gebaseerde kostprijs (Sprint 2)</li>
          <li>• Data bronnen: v_customer_margin_by_part, v_customer_contract_deviation</li>
        </ul>
      </div>
    </div>
  );
}
