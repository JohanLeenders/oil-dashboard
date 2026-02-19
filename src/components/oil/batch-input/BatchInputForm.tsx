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
import type { BatchInputData, BatchDerivedValues, JointProductEntry } from '@/lib/data/batch-input-store';
import { computeDerivedValues } from '@/lib/data/batch-input-store';
import { BATCH_PROFILES, getPartNameDutch } from '@/lib/engine/canonical-cost';
import { MassBalancePanel } from './MassBalancePanel';
import { ProcessingRoutesEditor } from './ProcessingRoutesEditor';
import { formatEur, formatKg, formatPct } from '@/lib/data/demo-batch-v2';

interface Props {
  initialData: BatchInputData;
  onSave: (data: BatchInputData) => void;
  onSaveAndRecalc: (data: BatchInputData) => void;
}

export function BatchInputForm({ initialData, onSave, onSaveAndRecalc }: Props) {
  const [data, setData] = useState<BatchInputData>(initialData);
  const [showShadowPrice, setShowShadowPrice] = useState(false);

  const derived = useMemo(() => computeDerivedValues(data), [data]);

  // Profile-aware flags (replaces old binary isExternal)
  const profile = data.batch_profile;
  const usesDynamicJP = profile === 'cuno_moormann' || profile === 'crisp';
  const showSubCuts = profile === 'oranjehoen' || profile === 'picnic';
  const showProcessingRoutes = profile === 'picnic';
  const showExternalFee = profile !== 'oranjehoen';

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

  const updateJointProduct = useCallback((idx: number, field: keyof JointProductEntry, raw: string) => {
    const v = parseFloat(raw);
    const val = (!isNaN(v) && v >= 0) ? v : 0;
    setData(prev => {
      const updated = [...prev.joint_products];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, joint_products: updated };
    });
  }, []);

  const addJointProduct = useCallback(() => {
    setData(prev => ({
      ...prev,
      joint_products: [
        ...prev.joint_products,
        { part_code: '', weight_kg: 0, shadow_price_per_kg: 0, selling_price_per_kg: 0 },
      ],
    }));
  }, []);

  const removeJointProduct = useCallback((idx: number) => {
    setData(prev => ({
      ...prev,
      joint_products: prev.joint_products.filter((_, i) => i !== idx),
    }));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column: Form sections */}
      <div className="lg:col-span-2 space-y-6">
        {/* SECTIE 0: Header */}
        <SectionHeader data={data} derived={derived} />

        {/* PROFIEL SELECTOR */}
        <div className="bg-white rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Verwerkingsprofiel</label>
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            {BATCH_PROFILES.map(profile => (
              <button
                key={profile.profile_id}
                type="button"
                onClick={() => update('batch_profile', profile.profile_id)}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  data.batch_profile === profile.profile_id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {profile.profile_name}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {BATCH_PROFILES.find(p => p.profile_id === data.batch_profile)?.description ?? ''}
          </p>
        </div>

        {/* SECTIE 1: Basis + Kosten (Level 0) */}
        <FormSection title="1. Aanvoer & Kosten" level={0} color="blue">
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

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">Kosten aanvoer</h4>
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Live cost"
                value={data.live_cost_per_kg}
                onChange={(v) => updateNum('live_cost_per_kg', v)}
                unit="€/kg levend"
                step="0.01"
              />
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
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Slachtkosten</label>
            <div className="flex items-center gap-3">
              <select
                value={data.slaughter_cost_mode}
                onChange={(e) => update('slaughter_cost_mode', e.target.value as 'per_bird' | 'total')}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm"
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

          {/* External processing fee (Cuno/Crisp/Picnic versnijdtoeslag) */}
          {showExternalFee && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Versnijdtoeslag externe verwerker</h4>
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Versnijdtoeslag"
                  value={data.processing_fee_per_bird}
                  onChange={(v) => updateNum('processing_fee_per_bird', v)}
                  unit="€/kip"
                  step="0.01"
                />
                <ReadOnlyField
                  label="Versnijdtoeslag totaal"
                  value={formatEur(derived.processing_fee_eur)}
                />
              </div>
            </div>
          )}
        </FormSection>

        {/* SECTIE 3: Bijproducten (Level 2) — vóór joint products */}
        <FormSection title="3. Bijproducten" level={2} color="emerald">
          <div className="grid grid-cols-3 gap-4">
            {!usesDynamicJP && (
              <>
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
              </>
            )}
            <NumberField
              label="Rug/karkas"
              value={data.back_carcass_kg}
              onChange={(v) => updateNum('back_carcass_kg', v)}
              unit="kg"
            />
            {!usesDynamicJP && (
              <NumberField
                label="Cat3/overig"
                value={data.cat3_other_kg}
                onChange={(v) => updateNum('cat3_other_kg', v)}
                unit="kg"
              />
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <ReadOnlyField label="Totaal bijproducten" value={formatKg(derived.by_product_total_kg)} />
            <ReadOnlyField label="Credit (€0,20/kg)" value={formatEur(derived.by_product_credit_eur)} />
          </div>
        </FormSection>

        {/* SECTIE 4: Joint Products (Level 3 Input) */}
        {!usesDynamicJP ? (
          <FormSection title="4. Hoofdproducten (Joint)" level={3} color="purple">
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
        ) : (
          <FormSection title="4. Producten (Extern)" level={3} color="purple">
            <div className="space-y-3">
              {/* Toggle schaduwprijs */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowShadowPrice(p => !p)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
                >
                  {showShadowPrice ? 'Verberg schaduwprijs' : 'Toon schaduwprijs'}
                </button>
              </div>

              {/* Column headers */}
              <div className={`grid ${showShadowPrice ? 'grid-cols-14' : 'grid-cols-12'} gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium`}>
                <span className="col-span-3">Product code</span>
                <span className="col-span-2 text-right">Gewicht</span>
                {showShadowPrice && <span className="col-span-2 text-right">Schaduwprijs</span>}
                <span className="col-span-2 text-right">Verpakking</span>
                <span className="col-span-2 text-right">Verkoopprijs</span>
                <span className="col-span-2 text-right">Marktwaarde</span>
                <span className="col-span-1" />
              </div>

              {data.joint_products.map((jp, idx) => (
                <div key={idx} className={`grid ${showShadowPrice ? 'grid-cols-14' : 'grid-cols-12'} gap-2 items-center rounded-lg px-2 py-1.5 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60 dark:bg-gray-700/40'}`}>
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={jp.part_code}
                      onChange={(e) => {
                        setData(prev => {
                          const updated = [...prev.joint_products];
                          updated[idx] = { ...updated[idx], part_code: e.target.value };
                          return { ...prev, joint_products: updated };
                        });
                      }}
                      placeholder="bijv. filet_supremes"
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-full"
                    />
                    <span className="text-[10px] text-gray-400">{getPartNameDutch(jp.part_code)}</span>
                  </div>
                  <div className="col-span-2">
                    <NumberField
                      label=""
                      value={jp.weight_kg}
                      onChange={(v) => updateJointProduct(idx, 'weight_kg', v)}
                      unit="kg"
                      inline
                    />
                  </div>
                  {showShadowPrice && (
                    <div className="col-span-2">
                      <NumberField
                        label=""
                        value={jp.shadow_price_per_kg}
                        onChange={(v) => updateJointProduct(idx, 'shadow_price_per_kg', v)}
                        unit="€/kg"
                        inline
                        step="0.01"
                      />
                    </div>
                  )}
                  <div className="col-span-2">
                    <NumberField
                      label=""
                      value={jp.cutting_cost_per_kg ?? 0}
                      onChange={(v) => updateJointProduct(idx, 'cutting_cost_per_kg', v)}
                      unit="€/kg"
                      inline
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2">
                    <NumberField
                      label=""
                      value={jp.selling_price_per_kg ?? 0}
                      onChange={(v) => updateJointProduct(idx, 'selling_price_per_kg', v)}
                      unit="€/kg"
                      inline
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2 text-right text-sm text-gray-600 dark:text-gray-300">
                    {formatEur(jp.weight_kg * jp.shadow_price_per_kg)}
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeJointProduct(idx)}
                      className="text-red-400 hover:text-red-600 text-sm px-1"
                      title="Verwijder product"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addJointProduct}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Product toevoegen
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <ReadOnlyField label="Som joint kg" value={formatKg(derived.joint_total_kg)} />
              <ReadOnlyField
                label="Totaal marktwaarde"
                value={formatEur(data.joint_products.reduce((s, jp) => s + jp.weight_kg * jp.shadow_price_per_kg, 0))}
              />
            </div>
          </FormSection>
        )}

        {/* SECTIE 5: Sub-cuts (Level 4 Input) — Oranjehoen + Picnic */}
        {showSubCuts && (
          <FormSection title="5. Sub-cuts" level={4} color="indigo">
            {/* Borstkap sub-cuts */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Borstkap → Sub-cuts</h4>
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
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Bouten → Sub-cuts</h4>
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
        )}

        {/* SECTIE 6: Processing Routes (Level 5b) — Picnic only */}
        {showProcessingRoutes && (
          <FormSection title="6. Verwerkingsroutes" level={5} color="orange">
            <ProcessingRoutesEditor
              routes={data.processing_routes}
              onChange={(routes) => update('processing_routes', routes)}
            />
          </FormSection>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onSave(data)}
            className="px-5 py-2.5 bg-gray-700 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all shadow-sm"
          >
            Opslaan
          </button>
          <button
            onClick={() => onSaveAndRecalc(data)}
            className="px-5 py-2.5 bg-oranje-500 text-white text-sm font-semibold rounded-xl hover:bg-oranje-600 transition-all shadow-sm"
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

  const statusBg = derived.mass_balance_status === 'green' ? 'bg-green-50 border-green-200 dark:border-green-800'
    : derived.mass_balance_status === 'yellow' ? 'bg-yellow-50 border-yellow-200 dark:border-yellow-800' : 'bg-red-50 border-red-200 dark:border-red-800';

  return (
    <div className={`p-4 rounded-xl border ${statusBg}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Batch {data.batch_ref}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {data.date}
          </p>
        </div>
        <div className="text-right flex items-center gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {statusLabel}
            </p>
            <p className="text-[10px] text-gray-400">
              Afwijking: {derived.mass_balance_deviation_pct.toFixed(2)}%
            </p>
          </div>
          <span className="text-xl">{statusEmoji}</span>
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
  const bgClasses: Record<string, string> = {
    blue: 'bg-blue-50/40 border-l-blue-400 dark:bg-blue-950/30',
    green: 'bg-green-50/40 border-l-green-400 dark:bg-green-950/30',
    emerald: 'bg-emerald-50/40 border-l-emerald-400 dark:bg-emerald-950/30',
    purple: 'bg-purple-50/40 border-l-purple-400 dark:bg-purple-950/30',
    indigo: 'bg-indigo-50/40 border-l-indigo-400 dark:bg-indigo-950/30',
    amber: 'bg-amber-50/40 border-l-amber-400 dark:bg-amber-950/30',
    orange: 'bg-orange-50/40 border-l-orange-400 dark:bg-orange-950/30',
    red: 'bg-red-50/40 border-l-red-400 dark:bg-red-950/30',
  };

  const badgeClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 dark:text-blue-300',
    green: 'bg-green-100 text-green-700 dark:text-green-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:text-emerald-300',
    purple: 'bg-purple-100 text-purple-700 dark:text-purple-300',
    indigo: 'bg-indigo-100 text-indigo-700 dark:text-indigo-300',
    amber: 'bg-amber-100 text-amber-700 dark:text-amber-300',
    orange: 'bg-orange-100 text-orange-700 dark:text-orange-300',
    red: 'bg-red-100 text-red-700 dark:text-red-300',
  };

  return (
    <div className={`rounded-xl border border-gray-200 border-l-4 dark:border-gray-700 ${bgClasses[color] || 'bg-white border-l-gray-400'} p-5`}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        {title}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${badgeClasses[color] || 'bg-gray-100 text-gray-600 dark:text-gray-300'}`}>L{level}</span>
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
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-28 text-right"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">{unit}</span>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
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
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-full text-right"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{unit}</span>
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
      {label && <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</span>}
      <span className={`text-sm font-medium ${highlight ? 'text-orange-600' : 'text-gray-700 dark:text-gray-300'} bg-gray-50 px-2 py-1.5 rounded dark:bg-gray-700 block text-right`}>
        {value}
      </span>
    </div>
  );
}
