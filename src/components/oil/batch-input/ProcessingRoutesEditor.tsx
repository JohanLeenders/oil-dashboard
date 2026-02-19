'use client';

/**
 * ProcessingRoutesEditor — Dynamic editor for Picnic processing routes (Sprint 14b).
 *
 * Allows users to:
 * - Add/remove routes
 * - Set route type (single-source or blend)
 * - Configure processors per route (add/remove steps)
 * - For blend routes: manage recipe inputs with ratio + source_type
 * - Set yield_factor and input_kg per route
 */

import { useCallback } from 'react';
import type { ProcessingRoute, ProcessingStep, BlendInput } from '@/lib/data/batch-input-store';
import { getPartNameDutch } from '@/lib/engine/canonical-cost';

interface Props {
  routes: ProcessingRoute[];
  onChange: (routes: ProcessingRoute[]) => void;
}

export function ProcessingRoutesEditor({ routes, onChange }: Props) {
  const updateRoute = useCallback((idx: number, patch: Partial<ProcessingRoute>) => {
    onChange(routes.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }, [routes, onChange]);

  const removeRoute = useCallback((idx: number) => {
    onChange(routes.filter((_, i) => i !== idx));
  }, [routes, onChange]);

  const addRoute = useCallback(() => {
    const id = `route_${Date.now()}`;
    onChange([...routes, {
      route_id: id,
      route_name: '',
      type: 'single-source',
      source_part: '',
      end_product: '',
      processors: [],
      yield_factor: 1.0,
      input_kg: 0,
    }]);
  }, [routes, onChange]);

  // Processor helpers
  const addProcessor = useCallback((routeIdx: number) => {
    const route = routes[routeIdx];
    updateRoute(routeIdx, {
      processors: [...route.processors, { processor_name: '', activity: '', cost_per_kg: 0 }],
    });
  }, [routes, updateRoute]);

  const updateProcessor = useCallback((routeIdx: number, stepIdx: number, patch: Partial<ProcessingStep>) => {
    const route = routes[routeIdx];
    const updated = route.processors.map((s, i) => i === stepIdx ? { ...s, ...patch } : s);
    updateRoute(routeIdx, { processors: updated });
  }, [routes, updateRoute]);

  const removeProcessor = useCallback((routeIdx: number, stepIdx: number) => {
    const route = routes[routeIdx];
    updateRoute(routeIdx, { processors: route.processors.filter((_, i) => i !== stepIdx) });
  }, [routes, updateRoute]);

  // Blend recipe helpers
  const addBlendInput = useCallback((routeIdx: number) => {
    const route = routes[routeIdx];
    const inputs = route.recipe?.inputs ?? [];
    updateRoute(routeIdx, {
      recipe: { inputs: [...inputs, { part: '', ratio: 0, source_type: 'joint_product' }] },
    });
  }, [routes, updateRoute]);

  const updateBlendInput = useCallback((routeIdx: number, inputIdx: number, patch: Partial<BlendInput>) => {
    const route = routes[routeIdx];
    const inputs = (route.recipe?.inputs ?? []).map((inp, i) =>
      i === inputIdx ? { ...inp, ...patch } : inp
    );
    updateRoute(routeIdx, { recipe: { inputs } });
  }, [routes, updateRoute]);

  const removeBlendInput = useCallback((routeIdx: number, inputIdx: number) => {
    const route = routes[routeIdx];
    const inputs = (route.recipe?.inputs ?? []).filter((_, i) => i !== inputIdx);
    updateRoute(routeIdx, { recipe: { inputs } });
  }, [routes, updateRoute]);

  const totalInputKg = routes.reduce((sum, r) => sum + r.input_kg, 0);

  return (
    <div className="space-y-4">
      {routes.map((route, rIdx) => (
        <RouteCard
          key={route.route_id}
          route={route}
          index={rIdx}
          onUpdate={(patch) => updateRoute(rIdx, patch)}
          onRemove={() => removeRoute(rIdx)}
          onAddProcessor={() => addProcessor(rIdx)}
          onUpdateProcessor={(sIdx, patch) => updateProcessor(rIdx, sIdx, patch)}
          onRemoveProcessor={(sIdx) => removeProcessor(rIdx, sIdx)}
          onAddBlendInput={() => addBlendInput(rIdx)}
          onUpdateBlendInput={(iIdx, patch) => updateBlendInput(rIdx, iIdx, patch)}
          onRemoveBlendInput={(iIdx) => removeBlendInput(rIdx, iIdx)}
        />
      ))}

      <button
        type="button"
        onClick={addRoute}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + Route toevoegen
      </button>

      <div className="mt-3 flex gap-6 text-sm text-gray-500 dark:text-gray-400">
        <span>Routes: <strong className="text-gray-700 dark:text-gray-300">{routes.length}</strong></span>
        <span>Totaal input: <strong className="text-gray-700 dark:text-gray-300">{totalInputKg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg</strong></span>
      </div>
    </div>
  );
}

// ============================================================================
// ROUTE CARD
// ============================================================================

interface RouteCardProps {
  route: ProcessingRoute;
  index: number;
  onUpdate: (patch: Partial<ProcessingRoute>) => void;
  onRemove: () => void;
  onAddProcessor: () => void;
  onUpdateProcessor: (stepIdx: number, patch: Partial<ProcessingStep>) => void;
  onRemoveProcessor: (stepIdx: number) => void;
  onAddBlendInput: () => void;
  onUpdateBlendInput: (inputIdx: number, patch: Partial<BlendInput>) => void;
  onRemoveBlendInput: (inputIdx: number) => void;
}

function RouteCard({
  route, index, onUpdate, onRemove,
  onAddProcessor, onUpdateProcessor, onRemoveProcessor,
  onAddBlendInput, onUpdateBlendInput, onRemoveBlendInput,
}: RouteCardProps) {
  const totalProcessingCost = route.processors.reduce((sum, s) => sum + s.cost_per_kg, 0);
  const ratioSum = route.recipe?.inputs.reduce((sum, inp) => sum + inp.ratio, 0) ?? 0;
  const isBlend = route.type === 'blend';

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">R{index + 1}</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {route.route_name || `Route ${index + 1}`}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300">
            {route.type}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-red-400 hover:text-red-600 text-sm px-2"
          title="Verwijder route"
        >
          Verwijder
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Row 1: Name + Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Route naam</label>
            <input
              type="text"
              value={route.route_name}
              onChange={(e) => onUpdate({ route_name: e.target.value })}
              placeholder="bijv. Borstkap → Filet (Cor Voet)"
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <div className="flex gap-4 mt-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  checked={route.type === 'single-source'}
                  onChange={() => onUpdate({ type: 'single-source', recipe: undefined })}
                  className="accent-orange-500"
                />
                Single-source
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  checked={route.type === 'blend'}
                  onChange={() => onUpdate({ type: 'blend', recipe: { inputs: [] } })}
                  className="accent-orange-500"
                />
                Blend
              </label>
            </div>
          </div>
        </div>

        {/* Row 2: Source, End product, Input kg, Yield */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Bronproduct</label>
            <input
              type="text"
              value={route.source_part}
              onChange={(e) => onUpdate({ source_part: e.target.value })}
              placeholder="breast_cap"
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-full"
            />
            <span className="text-[10px] text-gray-400">{getPartNameDutch(route.source_part)}</span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Eindproduct</label>
            <input
              type="text"
              value={route.end_product}
              onChange={(e) => onUpdate({ end_product: e.target.value })}
              placeholder="filet_picnic"
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-full"
            />
            <span className="text-[10px] text-gray-400">{getPartNameDutch(route.end_product)}</span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Input kg</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={route.input_kg || ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onUpdate({ input_kg: !isNaN(v) && v >= 0 ? v : 0 });
              }}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-full text-right"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Yield factor</label>
            <input
              type="number"
              min={0}
              max={1}
              step="0.01"
              value={route.yield_factor ?? ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onUpdate({ yield_factor: !isNaN(v) && v >= 0 ? v : undefined });
              }}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-full text-right"
            />
            <span className="text-[10px] text-gray-400">0.68 = 68%</span>
          </div>
        </div>

        {/* Blend recipe (only for blend type) */}
        {isBlend && (
          <div className="border border-orange-200 dark:border-orange-800 rounded-lg p-3 bg-orange-50/30 dark:bg-orange-950/20">
            <h5 className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase mb-2">Recept (blend)</h5>
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                <span className="col-span-4">Part code</span>
                <span className="col-span-2 text-right">Ratio</span>
                <span className="col-span-4">Source type</span>
                <span className="col-span-2" />
              </div>

              {(route.recipe?.inputs ?? []).map((inp, iIdx) => (
                <div key={iIdx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <input
                      type="text"
                      value={inp.part}
                      onChange={(e) => onUpdateBlendInput(iIdx, { part: e.target.value })}
                      placeholder="drum_meat"
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step="0.01"
                      value={inp.ratio || ''}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        onUpdateBlendInput(iIdx, { ratio: !isNaN(v) ? v : 0 });
                      }}
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-full text-right"
                    />
                  </div>
                  <div className="col-span-4">
                    <select
                      value={inp.source_type}
                      onChange={(e) => onUpdateBlendInput(iIdx, { source_type: e.target.value as 'joint_product' | 'by_product' })}
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-full"
                    >
                      <option value="joint_product">joint_product</option>
                      <option value="by_product">by_product</option>
                    </select>
                  </div>
                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRemoveBlendInput(iIdx)}
                      className="text-red-400 hover:text-red-600 text-xs px-1"
                    >
                      verwijder
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={onAddBlendInput}
                className="text-xs text-orange-600 hover:text-orange-800 font-medium"
              >
                + ingredient toevoegen
              </button>

              {/* Ratio validation */}
              {(route.recipe?.inputs?.length ?? 0) > 0 && (
                <div className={`text-xs mt-1 ${Math.abs(ratioSum - 1.0) < 0.001 ? 'text-green-600' : 'text-red-600'}`}>
                  Ratio som: {ratioSum.toFixed(2)} {Math.abs(ratioSum - 1.0) < 0.001 ? ' OK' : ' (moet 1.00 zijn)'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing steps */}
        <div>
          <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Verwerkingsstappen</h5>
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
              <span className="col-span-4">Verwerker</span>
              <span className="col-span-4">Activiteit</span>
              <span className="col-span-2 text-right">Kosten</span>
              <span className="col-span-2" />
            </div>

            {route.processors.map((step, sIdx) => (
              <div key={sIdx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <input
                    type="text"
                    value={step.processor_name}
                    onChange={(e) => onUpdateProcessor(sIdx, { processor_name: e.target.value })}
                    placeholder="Cor Voet"
                    className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-full"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="text"
                    value={step.activity}
                    onChange={(e) => onUpdateProcessor(sIdx, { activity: e.target.value })}
                    placeholder="fileren"
                    className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-full"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={step.cost_per_kg || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onUpdateProcessor(sIdx, { cost_per_kg: !isNaN(v) && v >= 0 ? v : 0 });
                    }}
                    className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-full text-right"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <span className="text-xs text-gray-400">/kg</span>
                  <button
                    type="button"
                    onClick={() => onRemoveProcessor(sIdx)}
                    className="text-red-400 hover:text-red-600 text-xs px-1 ml-auto"
                  >
                    x
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={onAddProcessor}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + stap toevoegen
            </button>
          </div>

          {/* Processing cost summary */}
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Totaal verwerking: <strong className="text-gray-700 dark:text-gray-300">{totalProcessingCost.toFixed(2)} /kg</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
