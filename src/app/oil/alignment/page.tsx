/**
 * Sprint 4: Customer Carcass Alignment Page
 *
 * Shows customer intake profiles vs carcass balance (vierkantsverwaarding).
 * ANALYTICAL ONLY - no scoring, no blame, no recommendations.
 */

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

// Types for database results
interface CustomerIntakeRow {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  part_code: string;
  quantity_kg: number;
  share_of_total_pct: number;
  customer_total_kg: number;
}

interface CustomerAlignmentRow {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  part_code: string;
  customer_share_pct: number;
  carcass_share_pct: number;
  deviation_pct: number;
  deviation_category: string;
  alignment_score: number;
  customer_total_kg: number;
}

interface ScenarioRow {
  scenario_id: string;
  scenario_name: string;
  scenario_description: string | null;
  part_code: string;
  price_change_pct: number;
  expected_volume_change_pct: number;
  assumption_source: string;
  assumption_note: string | null;
  current_daily_kg: number | null;
  projected_daily_kg: number | null;
  disclaimer: string;
}

// Color helpers
function getAlignmentBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 50) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function getDeviationBadgeClass(category: string): string {
  switch (category) {
    case 'OVER_UPTAKE_HIGH':
      return 'bg-blue-100 text-blue-800';
    case 'OVER_UPTAKE_MODERATE':
      return 'bg-blue-50 text-blue-700';
    case 'UNDER_UPTAKE_HIGH':
      return 'bg-orange-100 text-orange-800';
    case 'UNDER_UPTAKE_MODERATE':
      return 'bg-orange-50 text-orange-700';
    default:
      return 'bg-green-100 text-green-800';
  }
}

function getDeviationLabel(category: string): string {
  switch (category) {
    case 'OVER_UPTAKE_HIGH':
      return 'Sterke over-afname';
    case 'OVER_UPTAKE_MODERATE':
      return 'Matige over-afname';
    case 'UNDER_UPTAKE_HIGH':
      return 'Sterke onder-afname';
    case 'UNDER_UPTAKE_MODERATE':
      return 'Matige onder-afname';
    default:
      return 'Gebalanceerd';
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

function formatDeviation(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export default async function AlignmentPage() {
  const supabase = await createClient();

  // Fetch customer alignment data
  const { data: alignmentData, error: alignmentError } = await supabase
    .from('v_customer_carcass_alignment')
    .select('*')
    .order('alignment_score', { ascending: true });

  // Fetch scenario data
  const { data: scenarioData, error: scenarioError } = await supabase
    .from('v_scenario_impact')
    .select('*')
    .order('scenario_id');

  // Group alignment data by customer
  const customerMap = new Map<string, CustomerAlignmentRow[]>();
  if (alignmentData) {
    for (const row of alignmentData as CustomerAlignmentRow[]) {
      const existing = customerMap.get(row.customer_id) || [];
      existing.push(row);
      customerMap.set(row.customer_id, existing);
    }
  }

  // Get unique customers with their scores
  const customers = Array.from(customerMap.entries()).map(([id, rows]) => ({
    customer_id: id,
    customer_name: rows[0]?.customer_name || 'Onbekend',
    customer_code: rows[0]?.customer_code || '',
    alignment_score: rows[0]?.alignment_score || 0,
    customer_total_kg: rows[0]?.customer_total_kg || 0,
    deviations: rows,
  }));

  // Group scenarios
  const scenarioMap = new Map<string, ScenarioRow[]>();
  if (scenarioData) {
    for (const row of scenarioData as ScenarioRow[]) {
      const existing = scenarioMap.get(row.scenario_id) || [];
      existing.push(row);
      scenarioMap.set(row.scenario_id, existing);
    }
  }

  const scenarios = Array.from(scenarioMap.entries()).map(([id, rows]) => ({
    scenario_id: id,
    scenario_name: rows[0]?.scenario_name || 'Onbekend',
    scenario_description: rows[0]?.scenario_description,
    parts: rows,
  }));

  // Calculate summary stats
  const customersWithLowAlignment = customers.filter(c => c.alignment_score < 50).length;
  const avgAlignmentScore = customers.length > 0
    ? customers.reduce((sum, c) => sum + c.alignment_score, 0) / customers.length
    : 0;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/oil" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Vierkantsverwaarding</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Klant-specifieke Vierkantsverwaarding
        </h1>
        <p className="text-gray-600 mt-2">
          Vergelijking van klantafnameprofielen met de natuurlijke karkasbalans.
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Analytisch overzicht</strong> — Deze pagina toont observaties, geen oordelen.
            Afwijkingen zijn beschrijvend, niet beoordelend.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Klanten geanalyseerd</div>
          <div className="text-3xl font-bold text-gray-900">{customers.length}</div>
          <div className="text-sm text-gray-500 mt-1">Laatste 90 dagen</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Gem. alignment score</div>
          <div className="text-3xl font-bold text-gray-900">
            {avgAlignmentScore.toFixed(1)}
          </div>
          <div className="text-sm text-gray-500 mt-1">100 = perfecte karkasbalans</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Klanten met afwijkend profiel</div>
          <div className="text-3xl font-bold text-gray-900">{customersWithLowAlignment}</div>
          <div className="text-sm text-gray-500 mt-1">Alignment score &lt; 50</div>
        </div>
      </div>

      {/* Error handling */}
      {alignmentError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="text-red-800">Fout bij laden: {alignmentError.message}</p>
        </div>
      )}

      {/* Customer Alignment Table */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Klantprofielen vs Karkasbalans</h2>
          <p className="text-sm text-gray-500 mt-1">
            Afwijking van de natuurlijke karkasverhouding (JA757 referentie)
          </p>
        </div>

        {customers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Geen klantdata beschikbaar. Controleer of er verkoopdata is in de laatste 90 dagen.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Klant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Totaal (kg)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Alignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Afwijkingen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer.customer_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{customer.customer_name}</div>
                      <div className="text-sm text-gray-500">{customer.customer_code}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {customer.customer_total_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getAlignmentBadgeClass(customer.alignment_score)}`}>
                        {customer.alignment_score.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {customer.deviations
                          .filter(d => d.deviation_category !== 'BALANCED')
                          .slice(0, 3)
                          .map((dev) => (
                            <span
                              key={dev.part_code}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDeviationBadgeClass(dev.deviation_category)}`}
                              title={getDeviationLabel(dev.deviation_category)}
                            >
                              {getPartNameDutch(dev.part_code)} {formatDeviation(dev.deviation_pct)}
                            </span>
                          ))}
                        {customer.deviations.filter(d => d.deviation_category !== 'BALANCED').length === 0 && (
                          <span className="text-sm text-gray-500">Geen significante afwijkingen</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scenario Section */}
      {scenarios.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Scenario&apos;s (Wat-als)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Projecties gebaseerd op aannames — geen voorspellingen of aanbevelingen
            </p>
          </div>

          {/* Disclaimer banner */}
          <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Let op:</strong> Deze projecties zijn gebaseerd op aannames en zijn GEEN voorspellingen
              of aanbevelingen. Gebruik alleen ter illustratie.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {scenarios.map((scenario) => (
              <div key={scenario.scenario_id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{scenario.scenario_name}</h3>
                    {scenario.scenario_description && (
                      <p className="text-sm text-gray-500">{scenario.scenario_description}</p>
                    )}
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                    AANNAME
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Onderdeel</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Prijswijziging</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Volumewijziging</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Huidige dag/kg</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Projectie dag/kg</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Bron</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {scenario.parts.map((part) => (
                        <tr key={part.part_code}>
                          <td className="px-3 py-2 font-medium">{getPartNameDutch(part.part_code)}</td>
                          <td className="px-3 py-2">
                            <span className={part.price_change_pct < 0 ? 'text-orange-600' : 'text-blue-600'}>
                              {formatDeviation(part.price_change_pct)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={part.expected_volume_change_pct > 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatDeviation(part.expected_volume_change_pct)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {part.current_daily_kg?.toFixed(1) || '-'} kg
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {part.projected_daily_kg?.toFixed(1) || '-'} kg
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-gray-500">{part.assumption_source}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {scenario.parts[0]?.assumption_note && (
                  <div className="mt-3 text-xs text-gray-500">
                    <strong>Toelichting:</strong> {scenario.parts[0].assumption_note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {scenarios.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Scenario&apos;s</h2>
          <p>Geen scenario&apos;s geconfigureerd. Voeg elasticiteitsaannames toe om wat-als analyses te zien.</p>
        </div>
      )}

      {/* Reference Info */}
      <div className="mt-8 text-sm text-gray-500">
        <h3 className="font-medium text-gray-700 mb-2">Referentie</h3>
        <ul className="space-y-1">
          <li>• Karkasratio&apos;s: JA757 (Hubbard spec) — <strong>NORMATIEF</strong></li>
          <li>• Analyseperiode: Laatste 90 dagen</li>
          <li>• Alignment score: 100 = perfecte karkasbalans, 0 = maximale afwijking</li>
          <li>• Data bron: v_customer_carcass_alignment, v_scenario_impact</li>
        </ul>
      </div>
    </div>
  );
}
