/**
 * Customer Import Store — Sprint 16
 *
 * Importeert Exact Online verkoopanalyse Excel-exports en
 * mapt artikelen naar anatomische categorieën voor cherry-picker analyse.
 *
 * Patroon: zelfde als batch-input-store.ts — Map-based in-memory, pure functies, geen DB.
 * Engine: cherry-picker.ts wordt NIET gewijzigd, alleen aangeroepen.
 *
 * CORE CONCEPT — Verwaardingsdiepte:
 * Een bout ≠ dijfilet. Wie 100 kg bout koopt, verwaard méér van de kip
 * dan wie 100 kg dijfilet koopt. Samengestelde producten worden gesplitst
 * naar hun anatomische componenten via SPLIT_RULES.
 */

import * as XLSX from 'xlsx';
import type { ProductCategory } from '@/types/database';
import {
  analyzeCherryPicker,
  type CustomerProductMix,
  type CherryPickerAnalysis,
} from '@/lib/engine/cherry-picker';

// ============================================================================
// TYPES
// ============================================================================

/** Rij uit Exact Online Excel export */
export interface ExactSalesRow {
  artikelcode: string;
  artikelomschrijving: string;
  aantal: number;
  eenheid: string;
  verkoopbedrag: number;
}

/** Split-onderdeel: categorie + ratio */
export interface SplitPart {
  category: ProductCategory;
  ratio: number; // 0-1, alle parts moeten optellen tot 1.0
}

/** Split-regel: verdeelt kg over meerdere categorieën */
export interface SplitRule {
  key: string;
  label: string;
  parts: SplitPart[];
}

/**
 * Mapping: artikelcode → categorie of split-rule
 * - category = ProductCategory string → directe toewijzing
 * - category = split-rule key (bijv. 'bout_split') → split via SPLIT_RULES
 * - category = null → uitgesloten
 */
export interface ArtikelMapping {
  artikelcode: string;
  category: ProductCategory | string | null;
  is_kg_product: boolean;
  label?: string;
}

/** Item dat is uitgesloten van de kg-analyse */
export interface ExcludedItem {
  artikelcode: string;
  omschrijving: string;
  aantal: number;
  eenheid: string;
  verkoopbedrag: number;
  reason: string;
}

/** Gemapte rij met categorie-info */
export interface MappedSalesRow extends ExactSalesRow {
  mapped_category: ProductCategory | string | null;
  is_excluded: boolean;
  exclude_reason?: string;
}

/** Geïmporteerd klantprofiel */
export interface CustomerImportProfile {
  import_id: string;
  customer_name: string;
  import_date: string;
  source_filename: string;
  raw_rows: ExactSalesRow[];
  mapped_rows: MappedSalesRow[];
  unmapped_codes: string[];
  product_mix: CustomerProductMix[];
  excluded_items: ExcludedItem[];
  total_kg: number;
  total_revenue: number;
  total_excluded_revenue: number;
  analysis: CherryPickerAnalysis | null;
}

// ============================================================================
// CONSTANTS: Split Rules
// ============================================================================

/**
 * Split-regels voor samengestelde producten.
 * Anatomische splits zijn vast (bout), receptuur-splits zijn defaults (bewerkbaar in UI).
 */
export const DEFAULT_SPLIT_RULES: Record<string, SplitRule> = {
  bout_split: {
    key: 'bout_split',
    label: 'Bout → dijfilet + drumstick + karkas (bot)',
    parts: [
      // Bout = 51.7% dij anatomisch (mét bot) + 48.3% drumstick
      // Dij anatomisch → 62.5% dijfilet = 51.7% × 0.625 = 32.3%
      // Rest dij (bot) = 51.7% × 0.375 = 19.4% → karkas
      { category: 'dij', ratio: 0.323 },
      { category: 'drumstick', ratio: 0.483 },
      { category: 'karkas', ratio: 0.194 },
    ],
  },
  kipburger: {
    key: 'kipburger',
    label: 'Kipburger → drumvlees + vel',
    parts: [
      { category: 'drumvlees', ratio: 0.80 },
      { category: 'vel', ratio: 0.20 },
    ],
  },
  kipgehakt: {
    key: 'kipgehakt',
    label: 'Kipgehakt → filet + vel',
    parts: [
      { category: 'filet', ratio: 0.70 },
      { category: 'vel', ratio: 0.30 },
    ],
  },
  borrelmix: {
    key: 'borrelmix',
    label: 'Borrelmix → vleugels',
    parts: [
      { category: 'vleugels', ratio: 1.00 },
    ],
  },
};

// ============================================================================
// CONSTANTS: Hardcoded Artikel Mappings (Oranjehoen assortiment)
// ============================================================================

/** Productcategorieën die geldig zijn als directe toewijzing */
const VALID_CATEGORIES: ProductCategory[] = [
  'hele_kip', 'filet', 'haas', 'dij', 'drumstick',
  'drumvlees', 'vleugels', 'karkas', 'organen', 'vel',
  'kosten', 'emballage',
];

export const DEFAULT_ARTIKEL_MAPPINGS: ArtikelMapping[] = [
  // FILET — alle kipfilet varianten
  { artikelcode: '79001', category: 'filet', is_kg_product: true },
  { artikelcode: '79002', category: 'filet', is_kg_product: true },
  { artikelcode: '79003', category: 'filet', is_kg_product: true },

  // DIJ — dijfilet, dijblokjes
  { artikelcode: '79005', category: 'dij', is_kg_product: true },
  { artikelcode: '79041', category: 'dij', is_kg_product: true },
  { artikelcode: '79020', category: 'dij', is_kg_product: true },
  { artikelcode: 'LW 79019', category: 'dij', is_kg_product: true },

  // BOUTEN → split 54% dij + 46% drumstick
  { artikelcode: 'Bouten', category: 'bout_split', is_kg_product: true, label: 'Bouten (split)' },
  { artikelcode: '79013', category: 'bout_split', is_kg_product: true, label: 'Kippenbouten (split)' },
  { artikelcode: 'LW 79013', category: 'bout_split', is_kg_product: true, label: 'LW Bouten (split)' },

  // DRUMSTICK
  { artikelcode: '79006', category: 'drumstick', is_kg_product: true },

  // SAMENGESTELD — kipburger, gehakt
  { artikelcode: '79022', category: 'kipburger', is_kg_product: true, label: 'Kipburger (split)' },
  { artikelcode: '79023', category: 'kipgehakt', is_kg_product: true, label: 'Kipgehakt (split)' },

  // VLEUGELS
  { artikelcode: '79008', category: 'vleugels', is_kg_product: true },

  // HELE KIP
  { artikelcode: '79000', category: 'hele_kip', is_kg_product: true },

  // ORGANEN
  { artikelcode: '79012', category: 'organen', is_kg_product: true },
  { artikelcode: '79017', category: 'organen', is_kg_product: true },
  { artikelcode: '79011', category: 'organen', is_kg_product: true },

  // KARKAS
  { artikelcode: '79014', category: 'karkas', is_kg_product: true },

  // BORRELMIX — kg (eenheid in Exact staat fout als 'Stuk', is kg)
  { artikelcode: '79021', category: 'borrelmix', is_kg_product: true, label: 'Borrelmix (split: vleugels)' },

  // UITGESLOTEN — niet-vlees
  { artikelcode: 'Eieren', category: null, is_kg_product: false, label: 'Eieren (geen kipproduct)' },
  { artikelcode: '79052', category: null, is_kg_product: false, label: 'Leghennen (levend)' },
  { artikelcode: 'fust2', category: 'emballage', is_kg_product: false, label: 'Emballage' },
];

// ============================================================================
// EXCEL PARSER
// ============================================================================

/**
 * Parse een Exact Online verkoopanalyse Excel-export.
 *
 * De export heeft een bekende structuur:
 * - Rij 1-9: metadata (administratie, datum, filters)
 * - Rij 10: headers (Artikelcode, Artikelomschrijving, Aantal, Eenheid, Verkoopbedrag)
 * - Rij 11+: data
 */
export function parseExactSalesExport(arrayBuffer: ArrayBuffer): {
  rows: ExactSalesRow[];
  customerHint: string | null;
  errors: string[];
} {
  const errors: string[] = [];

  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], customerHint: null, errors: ['Geen werkbladen gevonden in het Excel-bestand.'] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Zoek klantnaam in metadata (rij 5 in Exact: "Klant" header met waarde)
  let customerHint: string | null = null;
  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = rawData[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '');
      // Exact Online format: cell bevat klantnummer + naam, bijv. "5 - Zorg&Natuur BV"
      const match = cell.match(/^\d+\s*-\s*(.+)/);
      if (match) {
        customerHint = match[1].trim();
        break;
      }
    }
    if (customerHint) break;
  }

  // Zoek header-rij (bevat "Artikelcode")
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (!row) continue;
    const hasArtikelcode = row.some(
      (cell) => String(cell ?? '').toLowerCase().includes('artikelcode')
    );
    if (hasArtikelcode) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return {
      rows: [],
      customerHint,
      errors: ['Kan headers niet vinden. Verwacht: "Artikelcode" in een van de eerste 20 rijen.'],
    };
  }

  // Map column indices
  const headerRow = rawData[headerRowIdx].map((cell) => String(cell ?? '').toLowerCase().trim());
  const colIdx = {
    artikelcode: headerRow.findIndex((h) => h.includes('artikelcode')),
    omschrijving: headerRow.findIndex((h) => h.includes('artikelomschrijving') || h.includes('omschrijving')),
    aantal: headerRow.findIndex((h) => h.includes('aantal')),
    eenheid: headerRow.findIndex((h) => h.includes('eenheid')),
    verkoopbedrag: headerRow.findIndex((h) => h.includes('verkoopbedrag') || h.includes('bedrag')),
  };

  if (colIdx.artikelcode === -1) {
    errors.push('Kolom "Artikelcode" niet gevonden.');
    return { rows: [], customerHint, errors };
  }
  if (colIdx.aantal === -1) {
    errors.push('Kolom "Aantal" niet gevonden.');
  }

  // Parse data rows
  const rows: ExactSalesRow[] = [];
  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === '')) {
      continue;
    }

    const artikelcode = String(row[colIdx.artikelcode] ?? '').trim();
    if (!artikelcode) continue;

    const omschrijving = colIdx.omschrijving >= 0
      ? String(row[colIdx.omschrijving] ?? '').trim()
      : '';
    const aantal = colIdx.aantal >= 0
      ? parseNumberValue(row[colIdx.aantal])
      : 0;
    const eenheid = colIdx.eenheid >= 0
      ? String(row[colIdx.eenheid] ?? '').trim()
      : 'Kilogram';
    const verkoopbedrag = colIdx.verkoopbedrag >= 0
      ? parseNumberValue(row[colIdx.verkoopbedrag])
      : 0;

    rows.push({
      artikelcode,
      artikelomschrijving: omschrijving,
      aantal,
      eenheid,
      verkoopbedrag,
    });
  }

  return { rows, customerHint, errors };
}

/** Parse een getal dat komma of punt als decimaal kan hebben */
function parseNumberValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  // Vervang komma door punt voor Nederlandse getallen
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ============================================================================
// MAPPING RESOLVER
// ============================================================================

/**
 * Resolve artikelcodes naar categorieën mbv de mapping tabel.
 * Returns gemapte rijen + lijst van onbekende codes.
 */
export function resolveArtikelMappings(
  rows: ExactSalesRow[],
  mappings: ArtikelMapping[]
): {
  mapped: MappedSalesRow[];
  unmappedCodes: string[];
} {
  const mappingMap = new Map<string, ArtikelMapping>();
  for (const m of mappings) {
    mappingMap.set(m.artikelcode, m);
  }

  const mapped: MappedSalesRow[] = [];
  const unmappedSet = new Set<string>();

  for (const row of rows) {
    const mapping = mappingMap.get(row.artikelcode);

    if (!mapping) {
      unmappedSet.add(row.artikelcode);
      mapped.push({
        ...row,
        mapped_category: null,
        is_excluded: false,
      });
      continue;
    }

    const isExcluded =
      mapping.category === null ||
      mapping.category === 'emballage' ||
      mapping.category === 'kosten' ||
      !mapping.is_kg_product;

    let excludeReason: string | undefined;
    if (mapping.category === null) excludeReason = 'Niet-vleesproduct';
    else if (mapping.category === 'emballage') excludeReason = 'Emballage';
    else if (mapping.category === 'kosten') excludeReason = 'Kosten';
    else if (!mapping.is_kg_product) excludeReason = `Geen kg-product (${row.eenheid})`;

    mapped.push({
      ...row,
      mapped_category: mapping.category,
      is_excluded: isExcluded,
      exclude_reason: excludeReason,
    });
  }

  return { mapped, unmappedCodes: Array.from(unmappedSet) };
}

// ============================================================================
// AGGREGATION (with split rules)
// ============================================================================

/**
 * Aggregeer gemapte rijen naar CustomerProductMix[].
 * Past split-rules toe voor samengestelde producten.
 */
export function aggregateToProductMix(
  mappedRows: MappedSalesRow[],
  splitRules: Record<string, SplitRule>
): {
  productMix: CustomerProductMix[];
  excludedItems: ExcludedItem[];
  totalKg: number;
  totalRevenue: number;
  totalExcludedRevenue: number;
} {
  const categoryTotals = new Map<ProductCategory, { kg: number; revenue: number }>();
  const excludedItems: ExcludedItem[] = [];
  let totalExcludedRevenue = 0;

  for (const row of mappedRows) {
    // Uitgesloten items
    if (row.is_excluded || row.mapped_category === null) {
      excludedItems.push({
        artikelcode: row.artikelcode,
        omschrijving: row.artikelomschrijving,
        aantal: row.aantal,
        eenheid: row.eenheid,
        verkoopbedrag: row.verkoopbedrag,
        reason: row.exclude_reason || 'Uitgesloten',
      });
      totalExcludedRevenue += row.verkoopbedrag;
      continue;
    }

    // Onbekende codes (nog niet gemapped) — skip
    if (!row.mapped_category) continue;

    const category = row.mapped_category;

    // Check of het een split-rule is
    const splitRule = splitRules[category];
    if (splitRule) {
      // Verdeel kg en revenue over de split-onderdelen
      for (const part of splitRule.parts) {
        const partKg = row.aantal * part.ratio;
        const partRevenue = row.verkoopbedrag * part.ratio;
        const existing = categoryTotals.get(part.category) || { kg: 0, revenue: 0 };
        existing.kg += partKg;
        existing.revenue += partRevenue;
        categoryTotals.set(part.category, existing);
      }
    } else if (isValidCategory(category)) {
      // Directe toewijzing
      const existing = categoryTotals.get(category as ProductCategory) || { kg: 0, revenue: 0 };
      existing.kg += row.aantal;
      existing.revenue += row.verkoopbedrag;
      categoryTotals.set(category as ProductCategory, existing);
    }
  }

  // Convert naar CustomerProductMix[]
  const productMix: CustomerProductMix[] = [];
  let totalKg = 0;
  let totalRevenue = 0;

  for (const [category, totals] of categoryTotals) {
    if (totals.kg > 0) {
      productMix.push({
        category,
        quantity_kg: Number(totals.kg.toFixed(2)),
        revenue: Number(totals.revenue.toFixed(2)),
      });
      totalKg += totals.kg;
      totalRevenue += totals.revenue;
    }
  }

  // Sorteer op kg (hoogste eerst)
  productMix.sort((a, b) => b.quantity_kg - a.quantity_kg);

  return {
    productMix,
    excludedItems,
    totalKg: Number(totalKg.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalExcludedRevenue: Number(totalExcludedRevenue.toFixed(2)),
  };
}

/** Check of een string een geldige ProductCategory is */
export function isValidCategory(category: string): category is ProductCategory {
  return VALID_CATEGORIES.includes(category as ProductCategory);
}

/** Check of een category string een split-rule key is */
export function isSplitRule(
  category: string,
  splitRules: Record<string, SplitRule>
): boolean {
  return category in splitRules;
}

// ============================================================================
// ANALYSIS
// ============================================================================

/**
 * Voer cherry-picker analyse uit op een klantprofiel.
 * Roept analyzeCherryPicker() aan (LOCKED engine, geen wijzigingen).
 */
export function runImportAnalysis(
  importId: string,
  customerName: string,
  productMix: CustomerProductMix[]
): CherryPickerAnalysis {
  return analyzeCherryPicker(importId, customerName, productMix);
}

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

const importStore = new Map<string, CustomerImportProfile>();

/** Sla een geïmporteerd klantprofiel op */
export function saveImport(profile: CustomerImportProfile): void {
  importStore.set(profile.import_id, profile);
}

/** Haal een klantprofiel op */
export function getImport(importId: string): CustomerImportProfile | undefined {
  return importStore.get(importId);
}

/** Haal alle geïmporteerde profielen op */
export function getAllImports(): CustomerImportProfile[] {
  return Array.from(importStore.values()).sort(
    (a, b) => b.import_date.localeCompare(a.import_date)
  );
}

/** Verwijder een import */
export function deleteImport(importId: string): boolean {
  return importStore.delete(importId);
}

// ============================================================================
// USER MAPPING STORE (persistent in sessie)
// ============================================================================

const userMappings = new Map<string, ArtikelMapping>();
const userSplitRules = new Map<string, SplitRule>();

/** Voeg een user-gedefinieerde mapping toe (overschrijft hardcoded) */
export function addUserMapping(mapping: ArtikelMapping): void {
  userMappings.set(mapping.artikelcode, mapping);
}

/** Voeg een user-gedefinieerde split-rule toe */
export function addUserSplitRule(rule: SplitRule): void {
  userSplitRules.set(rule.key, rule);
}

/** Haal alle mappings op (hardcoded + user, user wint) */
export function getAllMappings(): ArtikelMapping[] {
  const merged = new Map<string, ArtikelMapping>();
  // Hardcoded eerst
  for (const m of DEFAULT_ARTIKEL_MAPPINGS) {
    merged.set(m.artikelcode, m);
  }
  // User overschrijft
  for (const [code, m] of userMappings) {
    merged.set(code, m);
  }
  return Array.from(merged.values());
}

/** Haal alle split-rules op (default + user, user wint) */
export function getAllSplitRules(): Record<string, SplitRule> {
  const merged: Record<string, SplitRule> = { ...DEFAULT_SPLIT_RULES };
  for (const [key, rule] of userSplitRules) {
    merged[key] = rule;
  }
  return merged;
}

/** Genereer een uniek import-ID */
export function generateImportId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
