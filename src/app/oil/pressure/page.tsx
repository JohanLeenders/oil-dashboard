/**
 * Pressure Board Page — Sprint 3
 *
 * SPRINT 3 CONTRACT:
 * - ✅ OBSERVATIONAL ONLY - no actions
 * - ✅ Druk per onderdeel zichtbaar
 * - ✅ DSI volledig uitlegbaar
 * - ✅ Kleurindicatie (groen/oranje/rood)
 * - ✅ Uitleg per signaal (tekstueel)
 * - ✅ Geen automatische acties
 * - ✅ Geen prijsadvies
 */

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import {
  getPressureColorClass,
  getPressureLabel,
  getVelocityTrendArrow,
  getVelocityTrendColorClass,
  type PressureFlag,
  type VelocityTrend,
} from '@/lib/engine';

interface PressureData {
  part_code: string;
  inventory_kg: number;
  batch_count: number;
  avg_daily_sales_kg: number;
  days_sales_inventory: number | null;
  pressure_flag: PressureFlag;
  velocity_trend: VelocityTrend;
  tht_batches_red: number;
  tht_batches_orange: number;
  tht_batches_green: number;
  explanation: string;
  batch_distribution: unknown;
  data_status: string;
}

async function getPressureData(): Promise<PressureData[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('v_sales_pressure_score')
    .select('*')
    .order('pressure_flag');

  if (error) {
    console.error('Error fetching pressure data:', error);
    return [];
  }

  return (data || []).map(row => ({
    part_code: row.part_code || 'unknown',
    inventory_kg: Number(row.inventory_kg) || 0,
    batch_count: Number(row.batch_count) || 0,
    avg_daily_sales_kg: Number(row.avg_daily_sales_kg) || 0,
    days_sales_inventory: row.days_sales_inventory != null ? Number(row.days_sales_inventory) : null,
    pressure_flag: (row.pressure_flag as PressureFlag) || 'no_stock',
    velocity_trend: (row.velocity_trend as VelocityTrend) || 'NO_DATA',
    tht_batches_red: Number(row.tht_batches_red) || 0,
    tht_batches_orange: Number(row.tht_batches_orange) || 0,
    tht_batches_green: Number(row.tht_batches_green) || 0,
    explanation: row.explanation || '',
    batch_distribution: row.batch_distribution,
    data_status: row.data_status || 'NO_DATA',
  }));
}

export default async function PressureBoardPage() {
  const pressureData = await getPressureData();

  // Group by pressure flag for summary
  const summary = {
    red: pressureData.filter(p => p.pressure_flag === 'red').length,
    orange: pressureData.filter(p => p.pressure_flag === 'orange').length,
    green: pressureData.filter(p => p.pressure_flag === 'green').length,
    no_data: pressureData.filter(p => ['no_stock', 'no_velocity'].includes(p.pressure_flag)).length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Link
            href="/oil"
            className="text-gray-500 hover:text-gray-700"
          >
            ← Dashboard
          </Link>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mt-2">
          Voorraaddruk & Sales Pressure
        </h2>
        <p className="text-gray-600 mt-1">
          Overzicht van voorraad- en verkoopdruk per onderdeel
        </p>
      </div>

      {/* Sprint 3 Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800">Sprint 3: Observational Only</h4>
        <p className="text-sm text-blue-700 mt-1">
          Dit scherm signaleert spanningen. Het stuurt NIET en geeft geen prijsadvies.
          DSI = Days Sales Inventory = voorraad / gemiddelde dagelijkse verkoop.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Hoge druk"
          count={summary.red}
          colorClass="bg-red-50 border-red-200 text-red-700"
        />
        <SummaryCard
          label="Verhoogde druk"
          count={summary.orange}
          colorClass="bg-orange-50 border-orange-200 text-orange-700"
        />
        <SummaryCard
          label="Normale druk"
          count={summary.green}
          colorClass="bg-green-50 border-green-200 text-green-700"
        />
        <SummaryCard
          label="Geen data"
          count={summary.no_data}
          colorClass="bg-gray-50 border-gray-200 text-gray-500"
        />
      </div>

      {/* Pressure Board */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Pressure Board
          </h3>
          <p className="text-sm text-gray-500">
            Per onderdeel: voorraad, verkoopsnelheid, DSI en drukstatus
          </p>
        </div>

        {pressureData.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            Geen voorraaddata beschikbaar. Voer inventory_positions in om druk te berekenen.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pressureData.map((item, index) => (
              <PressureRow key={index} data={item} />
            ))}
          </div>
        )}
      </div>

      {/* DSI Explanation */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">DSI Uitleg</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <span className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Groen (DSI &lt; 14 dagen)</p>
              <p className="text-gray-600">Normale voorraaddruk. Voorraad draait goed.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-3 h-3 bg-orange-500 rounded-full mt-1 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Oranje (DSI 14-28 dagen)</p>
              <p className="text-gray-600">Verhoogde druk. Let op THT-risico.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Rood (DSI &gt; 28 dagen)</p>
              <p className="text-gray-600">Hoge druk. Voorraad staat te lang.</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-500">
          DSI = Days Sales Inventory = (Voorraad kg) / (Gem. dagelijkse verkoop kg).
          Thresholds: 14 en 28 dagen per Sprint 3 contract.
        </p>
      </div>

      {/* Data Source */}
      <div className="text-xs text-gray-500">
        Bron: v_sales_pressure_score (v_inventory_by_part + v_sales_velocity_by_part)
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm">{label}</p>
    </div>
  );
}

function PressureRow({ data }: { data: PressureData }) {
  const colorClass = getPressureColorClass(data.pressure_flag);
  const label = getPressureLabel(data.pressure_flag);
  const trendArrow = getVelocityTrendArrow(data.velocity_trend);
  const trendColorClass = getVelocityTrendColorClass(data.velocity_trend);

  return (
    <div className="px-6 py-4 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
              {label}
            </span>
            <h4 className="font-medium text-gray-900">
              {formatPartName(data.part_code)}
            </h4>
            {data.tht_batches_red > 0 && (
              <span className="text-xs text-red-600 font-medium">
                THT-urgent: {data.tht_batches_red} batch(es)
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-gray-600">
            {data.explanation}
          </p>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>
              Voorraad: <strong className="text-gray-900">{formatNumber(data.inventory_kg)} kg</strong>
              {data.batch_count > 0 && ` (${data.batch_count} batches)`}
            </span>
            <span>
              Verkoop: <strong className="text-gray-900">{formatNumber(data.avg_daily_sales_kg)} kg/dag</strong>
              <span className={`ml-1 ${trendColorClass}`}>{trendArrow}</span>
            </span>
            <span>
              DSI: <strong className="text-gray-900">
                {data.days_sales_inventory != null ? `${data.days_sales_inventory} dagen` : '-'}
              </strong>
            </span>
          </div>
        </div>

        {/* THT Distribution */}
        <div className="ml-4 flex gap-1">
          {data.tht_batches_green > 0 && (
            <span className="w-6 h-6 rounded bg-green-100 text-green-700 flex items-center justify-center text-xs font-medium">
              {data.tht_batches_green}
            </span>
          )}
          {data.tht_batches_orange > 0 && (
            <span className="w-6 h-6 rounded bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-medium">
              {data.tht_batches_orange}
            </span>
          )}
          {data.tht_batches_red > 0 && (
            <span className="w-6 h-6 rounded bg-red-100 text-red-700 flex items-center justify-center text-xs font-medium">
              {data.tht_batches_red}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPartName(part: string): string {
  const names: Record<string, string> = {
    breast_cap: 'Borstkap',
    leg_quarter: 'Achterkwartier',
    wings: 'Vleugels',
    back_carcass: 'Karkas/Rug',
    offal: 'Organen',
    unknown: 'Onbekend',
  };
  return names[part] || part;
}

function formatNumber(value: number): string {
  return value.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}
