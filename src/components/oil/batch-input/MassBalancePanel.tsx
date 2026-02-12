'use client';

/**
 * MassBalancePanel — Always-visible mass balance indicator.
 *
 * Berekening:
 * - Griller basis = grillergewicht
 * - Output = joint kg + by-product kg
 * - Afwijking = |output − griller| / griller
 *
 * Status:
 * - ≤ 3% → 🟢 OK
 * - >3% en ≤7,5% → 🟡 Waarschuwing
 * - >7,5% → ⛔ Geblokkeerd
 */

import type { BatchInputData, BatchDerivedValues } from '@/lib/data/batch-input-store';
import { formatKg, formatPct } from '@/lib/data/demo-batch-v2';

interface Props {
  data: BatchInputData;
  derived: BatchDerivedValues;
}

export function MassBalancePanel({ data, derived }: Props) {
  const { mass_balance_status, mass_balance_deviation_pct, mass_balance_output_kg } = derived;

  const statusConfig = {
    green: {
      emoji: '\uD83D\uDFE2',
      label: 'OK',
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      bar: 'bg-green-500',
    },
    yellow: {
      emoji: '\uD83D\uDFE1',
      label: 'Waarschuwing',
      bg: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-800',
      bar: 'bg-yellow-500',
    },
    red: {
      emoji: '\u26D4',
      label: 'Geblokkeerd',
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      bar: 'bg-red-500',
    },
  };

  const cfg = statusConfig[mass_balance_status];
  const delta = mass_balance_output_kg - data.griller_weight_kg;
  const barWidth = Math.min(mass_balance_deviation_pct / 10 * 100, 100);

  return (
    <div className={`rounded-lg border-2 ${cfg.bg} p-4 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Massabalans</h3>
        <div className="flex items-center gap-2">
          <span className="text-xl">{cfg.emoji}</span>
          <span className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</span>
        </div>
      </div>

      {/* Deviation bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Afwijking</span>
          <span className={`font-medium ${cfg.text}`}>
            {mass_balance_deviation_pct.toFixed(2)}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${cfg.bar} rounded-full transition-all`} style={{ width: `${barWidth}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>0%</span>
          <span className="text-green-500">3%</span>
          <span className="text-yellow-500">7,5%</span>
          <span>10%</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Griller (basis)</span>
          <span className="font-medium">{formatKg(data.griller_weight_kg)}</span>
        </div>

        <div className="border-t border-gray-200 pt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Output:</span>
          </div>
          <div className="flex justify-between pl-2">
            <span className="text-gray-600">Joint products</span>
            <span>{formatKg(derived.joint_total_kg)}</span>
          </div>
          <div className="flex justify-between pl-2">
            <span className="text-gray-600">Bijproducten</span>
            <span>{formatKg(derived.by_product_total_kg)}</span>
          </div>
          <div className="flex justify-between font-medium border-t border-gray-200 pt-1 mt-1">
            <span>Totaal output</span>
            <span>{formatKg(mass_balance_output_kg)}</span>
          </div>
        </div>

        <div className={`flex justify-between font-bold border-t-2 pt-2 ${
          delta === 0 ? 'text-green-700' : Math.abs(delta) / data.griller_weight_kg <= 0.03 ? 'text-green-700' : cfg.text
        }`}>
          <span>Delta</span>
          <span>
            {delta >= 0 ? '+' : ''}{formatKg(delta)}
          </span>
        </div>
      </div>

      {/* Status effects */}
      {mass_balance_status === 'red' && (
        <div className="p-2 bg-red-100 rounded text-xs text-red-800">
          Scenario + NRV geblokkeerd. Admin override nodig.
        </div>
      )}
      {mass_balance_status === 'yellow' && (
        <div className="p-2 bg-yellow-100 rounded text-xs text-yellow-800">
          Opslaan toegestaan, maar controleer gewichten.
        </div>
      )}
    </div>
  );
}
