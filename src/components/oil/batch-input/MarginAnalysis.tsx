'use client';

/**
 * MarginAnalysis — Marge-analyse per product voor externe verwerkers.
 *
 * Toont:
 * - Samenvatting cards: kosten, omzet, marge
 * - k-factor badge
 * - Per-product margin tabel: SVASO/kg, VP/kg, marge/kg, marge%
 * - Kleurcodering: groen (>15%), oranje (5-15%), rood (<5%)
 */

import type { BatchInputData } from '@/lib/data/batch-input-store';
import type { CanonWaterfallData } from '@/components/oil/CostWaterfallShell';
import { getPartNameDutch } from '@/lib/engine/canonical-cost';

interface Props {
  batch: BatchInputData;
  waterfallData: CanonWaterfallData;
}

export function MarginAnalysis({ batch, waterfallData }: Props) {
  const { level3 } = waterfallData;

  if (!batch.joint_products || batch.joint_products.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Geen dynamische producten. Marge-analyse is alleen beschikbaar voor externe profielen.
      </div>
    );
  }

  const rows = batch.joint_products.map(jp => {
    const alloc = level3.allocations.find(a => a.part_code === jp.part_code);
    const svaso_per_kg = alloc?.allocated_cost_per_kg ?? 0;
    const vp_per_kg = jp.selling_price_per_kg ?? 0;
    const marge_per_kg = vp_per_kg > 0 ? vp_per_kg - svaso_per_kg : 0;
    const marge_pct = vp_per_kg > 0 ? (marge_per_kg / vp_per_kg) * 100 : 0;
    const total_omzet = jp.weight_kg * vp_per_kg;
    const total_kosten = jp.weight_kg * svaso_per_kg;
    const total_marge = total_omzet - total_kosten;

    return {
      part_code: jp.part_code,
      weight_kg: jp.weight_kg,
      svaso_per_kg,
      vp_per_kg,
      marge_per_kg,
      marge_pct,
      total_omzet,
      total_kosten,
      total_marge,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      kosten: acc.kosten + r.total_kosten,
      omzet: acc.omzet + r.total_omzet,
      marge: acc.marge + r.total_marge,
    }),
    { kosten: 0, omzet: 0, marge: 0 },
  );
  const totalMargePct = totals.omzet > 0 ? (totals.marge / totals.omzet) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Totale kosten" value={fmtEur(totals.kosten)} />
        <SummaryCard label="Omzet" value={fmtEur(totals.omzet)} />
        <SummaryCard
          label="Marge"
          value={fmtEur(totals.marge)}
          color={marginColor(totalMargePct)}
        />
        <SummaryCard
          label="Marge %"
          value={`${totalMargePct.toFixed(1)}%`}
          color={marginColor(totalMargePct)}
        />
      </div>

      {/* k-factor badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">k-factor:</span>
        <span
          className={`px-2 py-1 rounded text-sm font-bold ${
            level3.k_factor < 0.95
              ? 'bg-green-100 text-green-800'
              : level3.k_factor <= 1.05
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
          }`}
        >
          {level3.k_factor.toFixed(3)} — {level3.k_factor_interpretation}
        </span>
      </div>

      {/* Product margin table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="pb-2">Product</th>
              <th className="pb-2 text-right">kg</th>
              <th className="pb-2 text-right">SVASO €/kg</th>
              <th className="pb-2 text-right">VP €/kg</th>
              <th className="pb-2 text-right">Marge €/kg</th>
              <th className="pb-2 text-right">Marge %</th>
              <th className="pb-2 text-right">Totaal marge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.part_code} className="border-b border-gray-100">
                <td className="py-2 font-medium">{getPartNameDutch(r.part_code)}</td>
                <td className="py-2 text-right">{r.weight_kg.toFixed(1)}</td>
                <td className="py-2 text-right">{fmtEur2(r.svaso_per_kg)}</td>
                <td className="py-2 text-right">{fmtEur2(r.vp_per_kg)}</td>
                <td className="py-2 text-right font-medium">{fmtEur2(r.marge_per_kg)}</td>
                <td className="py-2 text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${marginColor(r.marge_pct)}`}
                  >
                    {r.marge_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 text-right font-medium">{fmtEur(r.total_marge)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-bold">
              <td className="pt-2">Totaal</td>
              <td className="pt-2 text-right">
                {rows.reduce((s, r) => s + r.weight_kg, 0).toFixed(1)}
              </td>
              <td className="pt-2" />
              <td className="pt-2" />
              <td className="pt-2" />
              <td className="pt-2 text-right">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${marginColor(totalMargePct)}`}>
                  {totalMargePct.toFixed(1)}%
                </span>
              </td>
              <td className="pt-2 text-right">{fmtEur(totals.marge)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${color || 'bg-white border-gray-200'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function marginColor(pct: number): string {
  if (pct > 15) return 'text-green-700 bg-green-50 border-green-200';
  if (pct > 5) return 'text-orange-700 bg-orange-50 border-orange-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function fmtEur(n: number): string {
  return `\u20AC${n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtEur2(n: number): string {
  return `\u20AC${n.toFixed(2)}`;
}
