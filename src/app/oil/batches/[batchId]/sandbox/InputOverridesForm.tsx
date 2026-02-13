'use client';

/**
 * Input Overrides Form — Sprint 12.2
 *
 * Form for editing scenario input overrides.
 * All UI text from sandboxLabels (NL).
 */

import { useState } from 'react';
import type {
  BaselineBatchData,
  YieldOverride,
  PriceOverride,
} from '@/lib/engine/scenario-sandbox';
import { INPUTS, MASS_BALANCE, partName, fmtKg, fmtKgPrecise } from '@/lib/ui/sandboxLabels';

interface InputOverridesFormProps {
  baseline: BaselineBatchData;
  livePriceOverride: number | null;
  yieldOverrides: YieldOverride[];
  priceOverrides: PriceOverride[];
  onLivePriceChange: (value: number | null) => void;
  onYieldOverridesChange: (overrides: YieldOverride[]) => void;
  onPriceOverridesChange: (overrides: PriceOverride[]) => void;
}

export function InputOverridesForm({
  baseline,
  livePriceOverride,
  yieldOverrides,
  priceOverrides,
  onLivePriceChange,
  onYieldOverridesChange,
  onPriceOverridesChange,
}: InputOverridesFormProps) {
  const [showYieldForm, setShowYieldForm] = useState(false);
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [yieldMode, setYieldMode] = useState<'kg' | 'pct'>('pct'); // Default = % (user mental model)

  // Conversion helpers — UI-only, engine always receives weight_kg
  const grillerKg = baseline.griller_weight_kg;

  const toDisplayValue = (weightKg: number): string => {
    if (yieldMode === 'kg') return weightKg.toFixed(1);
    return ((weightKg / grillerKg) * 100).toFixed(1);
  };

  const fromInputValue = (inputValue: number): number => {
    if (yieldMode === 'kg') return inputValue;
    // % → kg: round to 0.1 kg to prevent floating-point drift
    return Math.round((inputValue / 100) * grillerKg * 10) / 10;
  };

  const unitSuffix = yieldMode === 'kg' ? 'kg' : '%';

  // Live mass balance calculation
  const computeMassBalance = (): { totalKg: number; deltaKg: number; deltaPct: number; valid: boolean } => {
    // Start with current overrides applied to baseline
    const parts = baseline.joint_products.map(jp => {
      const override = yieldOverrides.find(yo => yo.part_code === jp.part_code);
      return override ? override.weight_kg : jp.weight_kg;
    });
    // Add by-products that count toward griller mass balance (back_carcass + offal)
    const byProductKg = baseline.by_products
      .filter(bp => bp.type === 'back_carcass' || bp.type === 'offal')
      .map(bp => {
        const override = yieldOverrides.find(yo => yo.part_code === bp.id);
        return override ? override.weight_kg : bp.weight_kg;
      });
    const totalKg = parts.reduce((s, v) => s + v, 0) + byProductKg.reduce((s, v) => s + v, 0);
    const deltaKg = totalKg - grillerKg;
    const deltaPct = grillerKg > 0 ? (deltaKg / grillerKg) * 100 : 0;
    const valid = Math.abs(deltaKg / grillerKg) <= 0.001; // SANDBOX_MASS_BALANCE_TOLERANCE
    return { totalKg, deltaKg, deltaPct, valid };
  };

  const massBalance = computeMassBalance();

  // Auto-redistribute: push excess/deficit to back_carcass
  const handleAutoRedistribute = () => {
    const { deltaKg } = computeMassBalance();
    if (Math.abs(deltaKg) < 0.01) return; // Already balanced

    const backCarcass = baseline.by_products.find(bp => bp.type === 'back_carcass');
    if (!backCarcass) return;

    // Current back_carcass weight (from override or baseline)
    const currentBackOverride = yieldOverrides.find(yo => yo.part_code === backCarcass.id);
    const currentBackKg = currentBackOverride ? currentBackOverride.weight_kg : backCarcass.weight_kg;

    // Adjust: subtract the delta (if total is over, reduce back; if under, increase back)
    const newBackKg = Math.round((currentBackKg - deltaKg) * 10) / 10;

    // Guard: don't let back_carcass go negative or exceed 40% of griller
    if (newBackKg < 0) return;
    if (newBackKg > grillerKg * 0.40) return; // Physically unrealistic — user must fix manually

    const newOverrides = yieldOverrides.filter(yo => yo.part_code !== backCarcass.id);
    newOverrides.push({ part_code: backCarcass.id, weight_kg: newBackKg });
    onYieldOverridesChange(newOverrides);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <h4 className="text-sm font-semibold text-gray-900">{INPUTS.heading}</h4>
      <p className="text-xs text-gray-500">{INPUTS.explanation}</p>

      {/* Live Price Override */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {INPUTS.livePrice}
        </label>
        <input
          type="number"
          step="0.01"
          placeholder={baseline.live_price_per_kg.toFixed(2)}
          value={livePriceOverride ?? ''}
          onChange={(e) => onLivePriceChange(e.target.value ? parseFloat(e.target.value) : null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          {INPUTS.livePriceHelper(baseline.live_price_per_kg.toFixed(2))}
        </p>
      </div>

      {/* Yield Overrides */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {INPUTS.yieldHeading(yieldOverrides.length)}
          </label>
          <div className="flex items-center gap-2">
            {/* KG/% toggle */}
            <div className="flex rounded-md border border-gray-300 text-xs">
              <button
                type="button"
                onClick={() => setYieldMode('kg')}
                className={`px-2 py-1 rounded-l-md transition-colors ${
                  yieldMode === 'kg' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {INPUTS.yieldToggleKg}
              </button>
              <button
                type="button"
                onClick={() => setYieldMode('pct')}
                className={`px-2 py-1 rounded-r-md transition-colors ${
                  yieldMode === 'pct' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {INPUTS.yieldTogglePct}
              </button>
            </div>
            <button
              onClick={() => setShowYieldForm(!showYieldForm)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {showYieldForm ? INPUTS.hide : INPUTS.show}
            </button>
          </div>
        </div>

        {showYieldForm && (
          <div className="space-y-2">
            {baseline.joint_products.map((jp) => {
              const override = yieldOverrides.find((yo) => yo.part_code === jp.part_code);
              return (
                <div key={jp.part_code} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-24">{partName(jp.part_code)}:</span>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={toDisplayValue(jp.weight_kg)}
                    value={override ? toDisplayValue(override.weight_kg) : ''}
                    onChange={(e) => {
                      const raw = e.target.value ? parseFloat(e.target.value) : null;
                      if (raw !== null) {
                        const weightKg = fromInputValue(raw);
                        const newOverrides = yieldOverrides.filter((yo) => yo.part_code !== jp.part_code);
                        newOverrides.push({ part_code: jp.part_code, weight_kg: weightKg });
                        onYieldOverridesChange(newOverrides);
                      } else {
                        onYieldOverridesChange(yieldOverrides.filter((yo) => yo.part_code !== jp.part_code));
                      }
                    }}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500 w-6">{unitSuffix}</span>
                </div>
              );
            })}
            <p className="text-xs text-gray-500 mt-2">
              {yieldMode === 'kg'
                ? INPUTS.yieldHelper(baseline.griller_weight_kg.toFixed(0))
                : INPUTS.yieldModePctHelper(fmtKg(baseline.griller_weight_kg).replace(' kg', ''))}
            </p>

            {/* Live mass balance indicator */}
            <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-md text-xs ${
              massBalance.valid
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-amber-50 border border-amber-200 text-amber-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${massBalance.valid ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className="font-medium">{MASS_BALANCE.label}:</span>
              <span>{MASS_BALANCE.total(
                fmtKgPrecise(massBalance.totalKg).replace(' kg', ''),
                fmtKgPrecise(grillerKg).replace(' kg', '')
              )}</span>
              <span className={massBalance.valid ? 'text-green-600' : 'text-amber-600'}>
                ({MASS_BALANCE.delta(
                  (massBalance.deltaKg >= 0 ? '+' : '') + fmtKgPrecise(Math.abs(massBalance.deltaKg)).replace(' kg', '') + ' kg',
                  (massBalance.deltaPct >= 0 ? '+' : '') + massBalance.deltaPct.toFixed(1) + '%'
                )})
              </span>
              <span className="ml-auto">{massBalance.valid ? MASS_BALANCE.ok : MASS_BALANCE.warning}</span>
            </div>

            {/* Auto-redistribute button — only when mass balance is off */}
            {!massBalance.valid && (
              <button
                type="button"
                onClick={handleAutoRedistribute}
                className="mt-2 w-full px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-md hover:bg-amber-200 transition-colors flex items-center justify-center gap-1"
              >
                <span>⚖️</span>
                <span>{INPUTS.autoRedistribute}</span>
                <span className="text-amber-600">— {INPUTS.autoRedistributeHelper}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Price Overrides (Shadow Prices) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {INPUTS.priceHeading(priceOverrides.length)}
          </label>
          <button
            onClick={() => setShowPriceForm(!showPriceForm)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {showPriceForm ? INPUTS.hide : INPUTS.show}
          </button>
        </div>

        {showPriceForm && (
          <div className="space-y-2">
            {baseline.joint_products.map((jp) => {
              const override = priceOverrides.find((po) => po.part_code === jp.part_code);
              return (
                <div key={jp.part_code} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-24">{partName(jp.part_code)}:</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={jp.shadow_price_per_kg.toFixed(2)}
                    value={override?.price_per_kg ?? ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseFloat(e.target.value) : null;
                      if (value !== null) {
                        const newOverrides = priceOverrides.filter((po) => po.part_code !== jp.part_code);
                        newOverrides.push({ part_code: jp.part_code, price_per_kg: value });
                        onPriceOverridesChange(newOverrides);
                      } else {
                        onPriceOverridesChange(priceOverrides.filter((po) => po.part_code !== jp.part_code));
                      }
                    }}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500">€/kg</span>
                </div>
              );
            })}
            <p className="text-xs text-gray-500 mt-2">
              {INPUTS.priceHelper}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
