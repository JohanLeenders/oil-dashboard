'use client';

/**
 * BatchInputForm — Main form for entering batch physical data (FEITEN).
 *
 * Principes:
 * - Alleen kg en aantallen invulbaar
 * - Rendementen zijn afgeleid en read-only
 * - Massabalans altijd zichtbaar
 * - Geen engine-code in component
 */

import { useState, useMemo, useCallback } from 'react';
import type { BatchInputData, BatchDerivedValues } from '@/lib/data/batch-input-store';
import { computeDerivedValues } from '@/lib/data/batch-input-store';
import { MassBalancePanel } from './MassBalancePanel';
import { formatEur, formatKg, formatPct } from '@/lib/data/demo-batch-v2';

interface Props {
  initialData: BatchInputData;
  onSave: (data: BatchInputData) => void;
  onSaveAndRecalc: (data: BatchInputData) => void;
}

export function BatchInputForm({ initialData, onSave, onSaveAndRecalc }: Props) {
  const [data, setData] = useState<BatchInputData>(initialData);

  const derived = useMemo(() => computeDerivedValues(data), [data]);

  const update = useCallback(<K extends keyof BatchInputData>(key: K, value: BatchInputData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateNum = useCallback((key: keyof BatchInputData, raw: string) => {
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= 0) {
      setData(prev => ({ ...prev, [key]: v }));
    } else if (raw === '' || raw === '0') {
      setData(prev => ({ ...prev, [key]: 0 }));
    }
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column: Form sections */}
      <div className="lg:col-span-2 space-y-6">
        {/* SECTIE 0: Header */}
        <SectionHeader data={data} derived={derived} />

        {/* SECTIE 1: Basis (Level 0) */}
        <FormSection title="1. Basis (Aanvoer)" level={0} color="blue">
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Aantal kippen (stuks)"
              value={data.bird_count}
              onChange={(v) => updateNum('bird_count', v)}
              unit="stuks"
            />
            <NumberField
              label="DOA (stuks)"
              value={data.doa_count}
              onChange={(v) => updateNum('doa_count', v)}
              unit="stuks"
              optional
            />
            <NumberField
              label="Levend gewicht totaal"
              value={data.live_weight_kg}
              onChange={(v) => updateNum('live_weight_kg', v)}
              unit="kg"
            />
            <div className="space-y-2">
              <ReadOnlyField label="Gem. levend gewicht" value={`${derived.avg_bird_weight_kg.toFixed(3)} kg/kip`} />
              <ReadOnlyField label="DOA %" value={formatPct(derived.doa_pct)} />
            </div>
          </div>
        </FormSection>

        {/* SECTIE 2: Slacht & Griller (Level 1) */}
        <FormSection title="2. Slacht & Griller" level={1} color="green">
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Grillergewicht totaal"
              value={data.griller_weight_kg}
              onChange={(v) => updateNum('griller_weight_kg', v)}
              unit="kg"
            />
            <ReadOnlyField
              label="Griller % v. levend"
              value={formatPct(derived.griller_yield_pct)}
              highlight={derived.griller_yield_pct > 0 && derived.griller_yield_pct < 68}
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs text-gray-500 mb-2">Slachtkosten</label>
            <div className="flex items-center gap-3">
              <select
                value={data.slaughter_cost_mode}
                onChange={(e) => update('slaughter_cost_mode', e.target.value as 'per_bird' | 'total')}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="per_bird">€/kip</option>
                <option value="total">€ totaal</option>
              </select>
              {data.slaughter_cost_mode === 'per_bird' ? (
                <NumberField
                  label=""
                  value={data.slaughter_cost_per_bird}
                  onChange={(v) => updateNum('slaughter_cost_per_bird', v)}
                  unit="€/kip"
                  inline
                  step="0.01"
                />
              ) : (
                <NumberField
                  label=""
                  value={data.slaughter_cost_total}
                  onChange={(v) => updateNum('slaughter_cost_total', v)}
                  unit="€"
                  inline
                  step="0.01"
                />
              )}
            </div>
            <ReadOnlyField
              label="Slachtkosten totaal"
              value={formatEur(derived.slaughter_fee_eur)}
              className="mt-2"
            />
          </div>
        </FormSection>

        {/* SECTIE 3: Joint Products (Level 3 Input) */}
        <FormSection title="3. Hoofdproducten (Joint)" level={3} color="purple">
          <div className="grid grid-cols-3 gap-4">
            <NumberField
              label="Borstkap"
              value={data.breast_cap_kg}
              onChange={(v) => updateNum('breast_cap_kg', v)}
              unit="kg"
            />
            <NumberField
              label="Bouten / poten"
              value={data.legs_kg}
              onChange={(v) => updateNum('legs_kg', v)}
              unit="kg"
            />
            <NumberField
              label="Vleugels"
              value={data.wings_kg}
              onChange={(v) => updateNum('wings_kg', v)}
              unit="kg"
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3 text-sm">
            <ReadOnlyField label="Som joint" value={formatKg(derived.joint_total_kg)} />
            <ReadOnlyField label="Borstkap %" value={formatPct(derived.breast_cap_pct)} />
            <ReadOnlyField label="Bouten %" value={formatPct(derived.legs_pct)} />
            <ReadOnlyField label="Vleugels %" value={formatPct(derived.wings_pct)} />
          </div>
        </FormSection>

        {/* SECTIE 4: Sub-cuts (Level 4 Input) */}
        <FormSection title="4. Sub-cuts" level={4} color="indigo">
          {/* Borstkap sub-cuts */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Borstkap → Sub-cuts</h4>
            <div className="grid grid-cols-3 gap-4">
              <NumberField
                label="Filet"
                value={data.filet_kg}
                onChange={(v) => updateNum('filet_kg', v)}
                unit="kg"
              />
              <ReadOnlyField label="Rest/trim" value={formatKg(derived.breast_rest_trim_kg)} />
              <ReadOnlyField label="Filet % v. borstkap" value={formatPct(derived.filet_pct_of_breast)} />
            </div>
          </div>

          {/* Bouten sub-cuts */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Bouten → Sub-cuts</h4>
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Dijfilet"
                value={data.thigh_fillet_kg}
                onChange={(v) => updateNum('thigh_fillet_kg', v)}
                unit="kg"
              />
              <NumberField
                label="Drumvlees"
                value={data.drum_meat_kg}
                onChange={(v) => updateNum('drum_meat_kg', v)}
                unit="kg"
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <ReadOnlyField label="Rest/trim" value={formatKg(derived.legs_rest_trim_kg)} />
              <ReadOnlyField label="Dijfilet %" value={formatPct(derived.thigh_pct_of_legs)} />
              <ReadOnlyField label="Drumvlees %" value={formatPct(derived.drum_pct_of_legs)} />
            </div>
          </div>
        </FormSection>

        {/* SECTIE 5: By-Products (Level 2 Input) */}
        <FormSection title="5. Bijproducten" level={2} color="emerald">
          <div className="grid grid-cols-3 gap-4">
            <NumberField
              label="Bloed"
              value={data.blood_kg}
              onChange={(v) => updateNum('blood_kg', v)}
              unit="kg"
            />
            <NumberField
              label="Veren"
              value={data.feathers_kg}
              onChange={(v) => updateNum('feathers_kg', v)}
              unit="kg"
            />
            <NumberField
              label="Organen"
              value={data.offal_kg}
              onChange={(v) => updateNum('offal_kg', v)}
              unit="kg"
            />
            <NumberField
              label="Rug/karkas"
              value={data.back_carcass_kg}
              onChange={(v) => updateNum('back_carcass_kg', v)}
              unit="kg"
            />
            <NumberField
              label="Cat3/overig"
              value={data.cat3_other_kg}
              onChange={(v) => updateNum('cat3_other_kg', v)}
              unit="kg"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <ReadOnlyField label="Totaal bijproducten" value={formatKg(derived.by_product_total_kg)} />
            <ReadOnlyField label="Credit (€0,20/kg)" value={formatEur(derived.by_product_credit_eur)} />
          </div>
        </FormSection>

        {/* SECTIE 6: Kosten */}
        <FormSection title="6. Kosten" level={0} color="blue">
          <div className="grid grid-cols-3 gap-4">
            <NumberField
              label="Live cost"
              value={data.live_cost_per_kg}
              onChange={(v) => updateNum('live_cost_per_kg', v)}
              unit="€/kg levend"
              step="0.01"
            />
            <NumberField
              label="Transport"
              value={data.transport_cost_eur}
              onChange={(v) => updateNum('transport_cost_eur', v)}
              unit="€"
              optional
              step="0.01"
            />
            <NumberField
              label="Vangkosten"
              value={data.catching_fee_eur}
              onChange={(v) => updateNum('catching_fee_eur', v)}
              unit="€"
              optional
              step="0.01"
            />
          </div>
        </FormSection>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onSave(data)}
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            Opslaan
          </button>
          <button
            onClick={() => onSaveAndRecalc(data)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Opslaan &amp; herbereken
          </button>
        </div>
      </div>

      {/* Right column: Mass Balance Panel (always visible) */}
      <div className="lg:col-span-1">
        <div className="sticky top-4">
          <MassBalancePanel data={data} derived={derived} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function SectionHeader({ data, derived }: { data: BatchInputData; derived: BatchDerivedValues }) {
  const statusEmoji = derived.mass_balance_status === 'green' ? '\uD83D\uDFE2'
    : derived.mass_balance_status === 'yellow' ? '\uD83D\uDFE1' : '\u26D4';

  const statusLabel = derived.mass_balance_status === 'green' ? 'OK'
    : derived.mass_balance_status === 'yellow' ? 'Waarschuwing' : 'Geblokkeerd';

  const statusBg = derived.mass_balance_status === 'green' ? 'bg-green-50 border-green-200'
    : derived.mass_balance_status === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <div className={`p-4 rounded-lg border ${statusBg}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Batch {data.batch_ref}
          </h2>
          <p className="text-sm text-gray-600">
            {data.date}
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl">{statusEmoji}</span>
          <p className="text-sm font-medium text-gray-700">
            {statusLabel}
          </p>
          <p className="text-xs text-gray-500">
            Afwijking: {derived.mass_balance_deviation_pct.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}

interface FormSectionProps {
  title: string;
  level: number;
  color: string;
  children: React.ReactNode;
}

function FormSection({ title, level, color, children }: FormSectionProps) {
  const colorClasses: Record<string, string> = {
    blue: 'border-l-blue-400',
    green: 'border-l-green-400',
    emerald: 'border-l-emerald-400',
    purple: 'border-l-purple-400',
    indigo: 'border-l-indigo-400',
    amber: 'border-l-amber-400',
    orange: 'border-l-orange-400',
    red: 'border-l-red-400',
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 border-l-4 ${colorClasses[color] || 'border-l-gray-400'} p-5`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        {title}
        <span className="ml-2 text-xs text-gray-400 font-normal">Level {level}</span>
      </h3>
      {children}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: string) => void;
  unit: string;
  optional?: boolean;
  inline?: boolean;
  step?: string;
}

function NumberField({ label, value, onChange, unit, optional, inline, step = '1' }: NumberFieldProps) {
  if (inline) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step={step}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-28 text-right"
        />
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <label className="block text-xs text-gray-500 mb-1">
          {label}
          {optional && <span className="text-gray-400 ml-1">(optioneel)</span>}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step={step}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full text-right"
        />
        <span className="text-xs text-gray-500 whitespace-nowrap">{unit}</span>
      </div>
    </div>
  );
}

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}

function ReadOnlyField({ label, value, highlight, className }: ReadOnlyFieldProps) {
  return (
    <div className={className}>
      {label && <span className="block text-xs text-gray-500 mb-1">{label}</span>}
      <span className={`text-sm font-medium ${highlight ? 'text-orange-600' : 'text-gray-700'} bg-gray-50 px-2 py-1.5 rounded block text-right`}>
        {value}
      </span>
    </div>
  );
}
