'use client';

/**
 * Input Overrides Form — Sprint 11A.3
 *
 * Form for editing scenario input overrides:
 * - Live price per kg
 * - Yield overrides (part weights)
 * - Price overrides (shadow prices for SVASO)
 */

import { useState } from 'react';
import type {
  BaselineBatchData,
  YieldOverride,
  PriceOverride,
} from '@/lib/engine/scenario-sandbox';

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

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <h4 className="text-sm font-semibold text-gray-900">Input Overrides</h4>

      {/* Live Price Override */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Live Price (€/kg)
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
          Baseline: €{baseline.live_price_per_kg.toFixed(2)}/kg
        </p>
      </div>

      {/* Yield Overrides */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Yield Overrides ({yieldOverrides.length})
          </label>
          <button
            onClick={() => setShowYieldForm(!showYieldForm)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {showYieldForm ? 'Hide' : 'Show'}
          </button>
        </div>

        {showYieldForm && (
          <div className="space-y-2">
            {baseline.joint_products.map((jp) => {
              const override = yieldOverrides.find((yo) => yo.part_code === jp.part_code);
              return (
                <div key={jp.part_code} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-24">{jp.part_code}:</span>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={jp.weight_kg.toFixed(1)}
                    value={override?.weight_kg ?? ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseFloat(e.target.value) : null;
                      if (value !== null) {
                        const newOverrides = yieldOverrides.filter((yo) => yo.part_code !== jp.part_code);
                        newOverrides.push({ part_code: jp.part_code, weight_kg: value });
                        onYieldOverridesChange(newOverrides);
                      } else {
                        onYieldOverridesChange(yieldOverrides.filter((yo) => yo.part_code !== jp.part_code));
                      }
                    }}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500">kg</span>
                </div>
              );
            })}
            <p className="text-xs text-gray-500 mt-2">
              Note: Total must balance to {baseline.griller_weight_kg.toFixed(0)} kg (±0.1%)
            </p>
          </div>
        )}
      </div>

      {/* Price Overrides (Shadow Prices) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Shadow Prices ({priceOverrides.length})
          </label>
          <button
            onClick={() => setShowPriceForm(!showPriceForm)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {showPriceForm ? 'Hide' : 'Show'}
          </button>
        </div>

        {showPriceForm && (
          <div className="space-y-2">
            {baseline.joint_products.map((jp) => {
              const override = priceOverrides.find((po) => po.part_code === jp.part_code);
              return (
                <div key={jp.part_code} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-24">{jp.part_code}:</span>
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
              Shadow prices are used for SVASO allocation (Sales Value at Split-Off)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
