'use client';

/**
 * MappingReviewStep — Stap 2: Mapping review met split-editor
 *
 * Toont alle artikelcodes met hun mapping.
 * Onbekende codes krijgen een dropdown om categorie te kiezen of split te definiëren.
 */

import { useState, useMemo } from 'react';
import type { ProductCategory } from '@/types/database';
import {
  type MappedSalesRow,
  type ArtikelMapping,
  type SplitRule,
  type SplitPart,
  isValidCategory,
  isSplitRule,
} from '@/lib/data/customer-import-store';

const CATEGORY_LABELS: Record<string, string> = {
  hele_kip: 'Hele kip',
  filet: 'Filet',
  haas: 'Haas',
  dij: 'Dij',
  drumstick: 'Drumstick',
  drumvlees: 'Drumvlees',
  vleugels: 'Vleugels',
  karkas: 'Karkas',
  organen: 'Organen',
  vel: 'Vel',
  bout_split: 'Bout (split: dij+drumstick)',
  kipburger: 'Kipburger (split: drumvlees+vel)',
  kipgehakt: 'Kipgehakt (split: filet+vel)',
  borrelmix: 'Borrelmix (split: vleugels)',
};

const ASSIGNABLE_CATEGORIES: ProductCategory[] = [
  'filet', 'haas', 'dij', 'drumstick', 'drumvlees',
  'vleugels', 'hele_kip', 'karkas', 'organen', 'vel',
];

interface UniqueProduct {
  artikelcode: string;
  omschrijving: string;
  totalKg: number;
  totalRevenue: number;
  eenheid: string;
  mappedCategory: string | null;
  isExcluded: boolean;
  excludeReason?: string;
}

interface Props {
  mappedRows: MappedSalesRow[];
  unmappedCodes: string[];
  splitRules: Record<string, SplitRule>;
  onConfirm: (
    updatedMappings: ArtikelMapping[],
    updatedSplitRules: Record<string, SplitRule>
  ) => void;
  onBack: () => void;
}

export function MappingReviewStep({
  mappedRows,
  unmappedCodes,
  splitRules,
  onConfirm,
  onBack,
}: Props) {
  // Groepeer per unieke artikelcode
  const uniqueProducts = useMemo(() => {
    const map = new Map<string, UniqueProduct>();
    for (const row of mappedRows) {
      const existing = map.get(row.artikelcode);
      if (existing) {
        existing.totalKg += row.aantal;
        existing.totalRevenue += row.verkoopbedrag;
      } else {
        map.set(row.artikelcode, {
          artikelcode: row.artikelcode,
          omschrijving: row.artikelomschrijving,
          totalKg: row.aantal,
          totalRevenue: row.verkoopbedrag,
          eenheid: row.eenheid,
          mappedCategory: row.mapped_category,
          isExcluded: row.is_excluded,
          excludeReason: row.exclude_reason,
        });
      }
    }
    return Array.from(map.values());
  }, [mappedRows]);

  // State voor user-aanpassingen
  const [userOverrides, setUserOverrides] = useState<Map<string, string | null>>(new Map());
  const [customSplits, setCustomSplits] = useState<Map<string, SplitPart[]>>(new Map());
  const [editingSplit, setEditingSplit] = useState<string | null>(null);

  const handleCategoryChange = (artikelcode: string, value: string) => {
    const newOverrides = new Map(userOverrides);
    if (value === '__exclude__') {
      newOverrides.set(artikelcode, null);
    } else if (value === '__split__') {
      // Open split editor
      setEditingSplit(artikelcode);
      setCustomSplits(prev => {
        const copy = new Map(prev);
        copy.set(artikelcode, [{ category: 'drumvlees', ratio: 1.0 }]);
        return copy;
      });
    } else {
      newOverrides.set(artikelcode, value);
    }
    setUserOverrides(newOverrides);
  };

  const handleSplitSave = (artikelcode: string, parts: SplitPart[]) => {
    const totalRatio = parts.reduce((sum, p) => sum + p.ratio, 0);
    if (Math.abs(totalRatio - 1.0) > 0.01) return;

    setCustomSplits(prev => {
      const copy = new Map(prev);
      copy.set(artikelcode, parts);
      return copy;
    });

    // Gebruik custom_ prefix zodat handleConfirm het als split-rule registreert
    const splitKey = `custom_${artikelcode.replace(/\s+/g, '_')}`;
    setUserOverrides(prev => {
      const copy = new Map(prev);
      copy.set(artikelcode, splitKey);
      return copy;
    });
    setEditingSplit(null);
  };

  // Check of een product een aangepaste split heeft (voor al gemapte producten)
  const hasCustomSplit = (artikelcode: string) => userOverrides.has(artikelcode);

  // Tel hoe veel er nog unmapped zijn
  const remainingUnmapped = unmappedCodes.filter(
    code => !userOverrides.has(code)
  ).length;

  const handleConfirm = () => {
    const newMappings: ArtikelMapping[] = [];
    const newSplitRules: Record<string, SplitRule> = { ...splitRules };

    for (const [code, value] of userOverrides) {
      if (value === null) {
        newMappings.push({
          artikelcode: code,
          category: null,
          is_kg_product: false,
          label: 'Uitgesloten (handmatig)',
        });
      } else if (value.startsWith('custom_')) {
        const parts = customSplits.get(code);
        if (parts) {
          newSplitRules[value] = {
            key: value,
            label: `Custom split voor ${code}`,
            parts,
          };
          newMappings.push({
            artikelcode: code,
            category: value,
            is_kg_product: true,
            label: `Custom split`,
          });
        }
      } else {
        newMappings.push({
          artikelcode: code,
          category: value,
          is_kg_product: true,
        });
      }
    }

    onConfirm(newMappings, newSplitRules);
  };

  const mappedCount = uniqueProducts.filter(
    p => p.mappedCategory !== null || p.isExcluded || userOverrides.has(p.artikelcode)
  ).length;
  const splitCount = uniqueProducts.filter(p => {
    const cat = userOverrides.get(p.artikelcode) ?? p.mappedCategory;
    return cat && (isSplitRule(cat, splitRules) || cat?.startsWith('custom_'));
  }).length;

  return (
    <div className="space-y-4">
      {/* Samenvatting */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-gray-100">{mappedCount}</span>
          {' '}van {uniqueProducts.length} producten herkend
          {splitCount > 0 && (
            <span>, waarvan <span className="font-medium text-blue-600">{splitCount} splits</span></span>
          )}
        </div>
        {remainingUnmapped > 0 && (
          <span className="text-xs text-orange-600 font-medium">
            ⚠️ {remainingUnmapped} onbekend
          </span>
        )}
      </div>

      {/* Tabel */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Omschrijving</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aantal</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Bedrag</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categorie</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {uniqueProducts.map((product) => {
              const isUnmapped = unmappedCodes.includes(product.artikelcode) && !userOverrides.has(product.artikelcode);
              const overriddenCategory = userOverrides.get(product.artikelcode);
              const effectiveCategory = overriddenCategory !== undefined ? overriddenCategory : product.mappedCategory;
              const isSplit = effectiveCategory && (isSplitRule(effectiveCategory, splitRules) || effectiveCategory.startsWith('custom_'));

              return (
                <tr
                  key={product.artikelcode}
                  className={
                    isUnmapped
                      ? 'bg-yellow-50 dark:bg-yellow-900/10'
                      : product.isExcluded || effectiveCategory === null
                        ? 'bg-gray-50 dark:bg-gray-900/50 opacity-60'
                        : ''
                  }
                >
                  <td className="px-3 py-2 font-mono text-xs">{product.artikelcode}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                    {product.omschrijving}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {product.totalKg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}
                    <span className="text-gray-400 ml-1 text-xs">{product.eenheid === 'Stuk' ? 'st' : 'kg'}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    €{product.totalRevenue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2">
                    {isUnmapped ? (
                      <select
                        className="text-xs border border-orange-300 rounded px-1 py-0.5 bg-white dark:bg-gray-800
                                   dark:border-orange-600 dark:text-gray-100"
                        defaultValue=""
                        onChange={(e) => handleCategoryChange(product.artikelcode, e.target.value)}
                      >
                        <option value="" disabled>Kies...</option>
                        <optgroup label="Directe categorie">
                          {ASSIGNABLE_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>
                              {CATEGORY_LABELS[cat] || cat}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Split-product">
                          <option value="bout_split">Bout (32% dij + 48% drum + 19% karkas)</option>
                          <option value="kipburger">Kipburger (80% drumvlees + 20% vel)</option>
                          <option value="kipgehakt">Kipgehakt (70% filet + 30% vel)</option>
                          <option value="__split__">✏️ Aangepaste split...</option>
                        </optgroup>
                        <optgroup label="Overig">
                          <option value="__exclude__">Uitsluiten</option>
                        </optgroup>
                      </select>
                    ) : (
                      <span className={`text-xs ${isSplit ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'} inline-flex items-center gap-1`}>
                        {isSplit && '🔀 '}
                        {CATEGORY_LABELS[effectiveCategory ?? ''] || effectiveCategory || 'Uitgesloten'}
                        {isSplit && effectiveCategory && (
                          <button
                            onClick={() => {
                              // Laad bestaande split-parts als initial values
                              const ruleKey = effectiveCategory.startsWith('custom_') ? effectiveCategory : effectiveCategory;
                              const existingRule = splitRules[ruleKey];
                              const initialParts = customSplits.get(product.artikelcode)
                                || existingRule?.parts
                                || [{ category: 'drumvlees' as ProductCategory, ratio: 1.0 }];
                              setCustomSplits(prev => {
                                const copy = new Map(prev);
                                copy.set(product.artikelcode, [...initialParts]);
                                return copy;
                              });
                              setEditingSplit(product.artikelcode);
                            }}
                            className="text-blue-400 hover:text-blue-600 ml-1"
                            title="Split-ratio aanpassen"
                          >
                            ✏️
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isUnmapped ? (
                      <span className="text-yellow-500">⚠️</span>
                    ) : product.isExcluded || effectiveCategory === null ? (
                      <span className="text-gray-400">—</span>
                    ) : isSplit ? (
                      <span className="text-blue-500">🔀</span>
                    ) : (
                      <span className="text-green-500">✅</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Split Editor Modal */}
      {editingSplit && (
        <SplitEditor
          artikelcode={editingSplit}
          initialParts={customSplits.get(editingSplit) || [{ category: 'drumvlees', ratio: 1.0 }]}
          onSave={(parts) => handleSplitSave(editingSplit, parts)}
          onCancel={() => setEditingSplit(null)}
        />
      )}

      {/* Knoppen */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700
                     dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← Terug
        </button>
        <button
          onClick={handleConfirm}
          disabled={remainingUnmapped > 0}
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          Bevestig mappings →
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Split Editor (inline mini-formulier)
// ============================================================================

function SplitEditor({
  artikelcode,
  initialParts,
  onSave,
  onCancel,
}: {
  artikelcode: string;
  initialParts: SplitPart[];
  onSave: (parts: SplitPart[]) => void;
  onCancel: () => void;
}) {
  const [parts, setParts] = useState<SplitPart[]>(initialParts);

  const totalRatio = parts.reduce((sum, p) => sum + p.ratio, 0);
  const isValid = Math.abs(totalRatio - 1.0) < 0.01 && parts.every(p => p.ratio > 0);

  const updatePart = (index: number, field: 'category' | 'ratio', value: string | number) => {
    const newParts = [...parts];
    if (field === 'category') {
      newParts[index] = { ...newParts[index], category: value as ProductCategory };
    } else {
      newParts[index] = { ...newParts[index], ratio: Number(value) / 100 };
    }
    setParts(newParts);
  };

  const addPart = () => {
    setParts([...parts, { category: 'drumvlees', ratio: 0 }]);
  };

  const removePart = (index: number) => {
    if (parts.length <= 1) return;
    setParts(parts.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">
        Split definiëren voor: {artikelcode}
      </h4>

      <div className="space-y-2">
        {parts.map((part, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={part.category}
              onChange={(e) => updatePart(i, 'category', e.target.value)}
              className="text-xs border rounded px-2 py-1 bg-white dark:bg-gray-800
                         dark:border-gray-600 dark:text-gray-100"
            >
              {ASSIGNABLE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(part.ratio * 100)}
              onChange={(e) => updatePart(i, 'ratio', e.target.value)}
              className="w-16 text-xs border rounded px-2 py-1 text-right bg-white dark:bg-gray-800
                         dark:border-gray-600 dark:text-gray-100"
            />
            <span className="text-xs text-gray-500">%</span>
            {parts.length > 1 && (
              <button
                onClick={() => removePart(i)}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={addPart}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          + Onderdeel toevoegen
        </button>
        <span className={`text-xs ${isValid ? 'text-green-600' : 'text-red-500'}`}>
          Totaal: {Math.round(totalRatio * 100)}%
          {!isValid && ' (moet 100% zijn)'}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onSave(parts)}
          disabled={!isValid}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Opslaan
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded
                     text-gray-600 dark:text-gray-400"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}
