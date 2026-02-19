/**
 * Customer Import Store Tests — Sprint 16
 *
 * Validatiecase: Zorg&Natuur BV (365-dagen verkoopanalyse)
 * Tests voor parsing, mapping, aggregatie, bout-split, en engine-integratie.
 */

import { describe, test, expect } from 'vitest';
import {
  resolveArtikelMappings,
  aggregateToProductMix,
  runImportAnalysis,
  isValidCategory,
  isSplitRule,
  DEFAULT_ARTIKEL_MAPPINGS,
  DEFAULT_SPLIT_RULES,
  saveImport,
  getImport,
  getAllImports,
  deleteImport,
  addUserMapping,
  addUserSplitRule,
  getAllMappings,
  getAllSplitRules,
  generateImportId,
  type ExactSalesRow,
  type MappedSalesRow,
  type ArtikelMapping,
} from '../customer-import-store';

// ============================================================================
// MOCK DATA: Zorg&Natuur BV (exact uit de Excel-export)
// ============================================================================

const ZORG_NATUUR_ROWS: ExactSalesRow[] = [
  { artikelcode: 'Bouten', artikelomschrijving: 'Bouten Oranjehoen per 2', aantal: 547, eenheid: 'Kilogram', verkoopbedrag: 6372.55 },
  { artikelcode: 'fust2', artikelomschrijving: 'CBL 11', aantal: 180, eenheid: 'Stuk', verkoopbedrag: 0 },
  { artikelcode: '79005', artikelomschrijving: 'Dijfilet 4pak', aantal: 8652, eenheid: 'Kilogram', verkoopbedrag: 116874.83 },
  { artikelcode: '79006', artikelomschrijving: 'Drumsticks 4pack', aantal: 4135.5, eenheid: 'Kilogram', verkoopbedrag: 30858.76 },
  { artikelcode: '79023', artikelomschrijving: 'kip gehakt 250 gr', aantal: 421, eenheid: 'Kilogram', verkoopbedrag: 5528.91 },
  { artikelcode: '79001', artikelomschrijving: 'kipfilet diepvries 1 stuks', aantal: 624, eenheid: 'Kilogram', verkoopbedrag: 9266.40 },
  { artikelcode: '79002', artikelomschrijving: 'kipfilet diepvries 2 stuks', aantal: 9451, eenheid: 'Kilogram', verkoopbedrag: 137297.05 },
  { artikelcode: '79003', artikelomschrijving: 'Kipfilet diepvries blokjes 300gr', aantal: 2012, eenheid: 'Kilogram', verkoopbedrag: 30071.72 },
  { artikelcode: '79013', artikelomschrijving: 'kippenbouten 2 st. diepvries', aantal: 490, eenheid: 'Kilogram', verkoopbedrag: 5708.50 },
  { artikelcode: '79012', artikelomschrijving: 'kippenhart 200 gr diepvries', aantal: 331, eenheid: 'Kilogram', verkoopbedrag: 3024.50 },
  { artikelcode: '79017', artikelomschrijving: 'kippenmaag 1kg', aantal: 230, eenheid: 'Kilogram', verkoopbedrag: 1179.30 },
  { artikelcode: '79008', artikelomschrijving: 'Kipvleugels 4 stuks diepvries', aantal: 3211, eenheid: 'Kilogram', verkoopbedrag: 18994.20 },
  { artikelcode: '79052', artikelomschrijving: 'leghennen', aantal: 471, eenheid: 'Stuk', verkoopbedrag: 4088.28 },
  { artikelcode: 'LW 79019', artikelomschrijving: 'LW Oranjehoen Dijfilet per 2', aantal: 20, eenheid: 'Kilogram', verkoopbedrag: 313.20 },
  { artikelcode: 'LW 79013', artikelomschrijving: 'LW Oranjehoen Bouten per 2', aantal: 482, eenheid: 'Kilogram', verkoopbedrag: 6458.80 },
  { artikelcode: '79014', artikelomschrijving: 'Nekken Oranjehoen per 1 kg verpakt', aantal: 302, eenheid: 'Kilogram', verkoopbedrag: 994.20 },
  { artikelcode: '79021', artikelomschrijving: 'Oranjehoen borrelmix gegaard 12 st', aantal: 1514, eenheid: 'Stuk', verkoopbedrag: 10038.38 },
  { artikelcode: '79041', artikelomschrijving: 'Oranjehoen dijfilet per 4 met vel', aantal: 401, eenheid: 'Kilogram', verkoopbedrag: 6035.05 },
  { artikelcode: 'Eieren', artikelomschrijving: 'Oranjehoen eieren per maand', aantal: 8, eenheid: 'Stuk', verkoopbedrag: 36360 },
  { artikelcode: '79000', artikelomschrijving: 'Oranjehoen hele kip', aantal: 2875, eenheid: 'Kilogram', verkoopbedrag: 16683.45 },
  { artikelcode: '79022', artikelomschrijving: 'Oranjehoen kipburger per 2', aantal: 709, eenheid: 'Kilogram', verkoopbedrag: 7444.50 },
  { artikelcode: '79020', artikelomschrijving: 'Oranjehoen kipdij blokjes 250gr', aantal: 593, eenheid: 'Kilogram', verkoopbedrag: 7044.84 },
  { artikelcode: '79011', artikelomschrijving: 'Oranjehoen levertjes, per 200 gram', aantal: 595, eenheid: 'Kilogram', verkoopbedrag: 5438.30 },
];

// ============================================================================
// TESTS
// ============================================================================

describe('customer-import-store', () => {
  describe('resolveArtikelMappings', () => {
    test('P0: mapt alle 23 Zorg&Natuur codes correct', () => {
      const { mapped, unmappedCodes } = resolveArtikelMappings(
        ZORG_NATUUR_ROWS,
        DEFAULT_ARTIKEL_MAPPINGS
      );

      expect(mapped).toHaveLength(23);
      expect(unmappedCodes).toHaveLength(0);

      // Filet varianten
      expect(mapped.find(r => r.artikelcode === '79001')?.mapped_category).toBe('filet');
      expect(mapped.find(r => r.artikelcode === '79002')?.mapped_category).toBe('filet');
      expect(mapped.find(r => r.artikelcode === '79003')?.mapped_category).toBe('filet');

      // Dij varianten
      expect(mapped.find(r => r.artikelcode === '79005')?.mapped_category).toBe('dij');
      expect(mapped.find(r => r.artikelcode === '79020')?.mapped_category).toBe('dij');

      // Bouten → split
      expect(mapped.find(r => r.artikelcode === 'Bouten')?.mapped_category).toBe('bout_split');
      expect(mapped.find(r => r.artikelcode === '79013')?.mapped_category).toBe('bout_split');
      expect(mapped.find(r => r.artikelcode === 'LW 79013')?.mapped_category).toBe('bout_split');

      // Samengesteld
      expect(mapped.find(r => r.artikelcode === '79022')?.mapped_category).toBe('kipburger');
      expect(mapped.find(r => r.artikelcode === '79023')?.mapped_category).toBe('kipgehakt');

      // Uitgesloten
      expect(mapped.find(r => r.artikelcode === 'Eieren')?.is_excluded).toBe(true);
      expect(mapped.find(r => r.artikelcode === '79052')?.is_excluded).toBe(true);
      expect(mapped.find(r => r.artikelcode === 'fust2')?.is_excluded).toBe(true);
      // Borrelmix is nu kg-product (split: drumvlees), niet meer excluded
      expect(mapped.find(r => r.artikelcode === '79021')?.is_excluded).toBe(false);
      expect(mapped.find(r => r.artikelcode === '79021')?.mapped_category).toBe('borrelmix');
    });

    test('P0: herkent onbekende artikelcodes', () => {
      const rows: ExactSalesRow[] = [
        { artikelcode: 'ONBEKEND-001', artikelomschrijving: 'Test', aantal: 100, eenheid: 'Kilogram', verkoopbedrag: 500 },
        { artikelcode: '79001', artikelomschrijving: 'Filet', aantal: 50, eenheid: 'Kilogram', verkoopbedrag: 475 },
      ];

      const { unmappedCodes } = resolveArtikelMappings(rows, DEFAULT_ARTIKEL_MAPPINGS);
      expect(unmappedCodes).toEqual(['ONBEKEND-001']);
    });
  });

  describe('aggregateToProductMix', () => {
    test('P0: bout-split — 1000 kg bouten → 323 kg dij + 483 kg drumstick + 194 kg karkas', () => {
      const rows: MappedSalesRow[] = [
        {
          artikelcode: 'TEST-BOUT',
          artikelomschrijving: 'Test bouten',
          aantal: 1000,
          eenheid: 'Kilogram',
          verkoopbedrag: 10000,
          mapped_category: 'bout_split',
          is_excluded: false,
        },
      ];

      const { productMix } = aggregateToProductMix(rows, DEFAULT_SPLIT_RULES);

      const dij = productMix.find(p => p.category === 'dij');
      const drumstick = productMix.find(p => p.category === 'drumstick');
      const karkas = productMix.find(p => p.category === 'karkas');

      // Bout = 32.3% dijfilet + 48.3% drumstick + 19.4% karkas (bot)
      expect(dij?.quantity_kg).toBe(323);
      expect(drumstick?.quantity_kg).toBe(483);
      expect(karkas?.quantity_kg).toBe(194);
      expect(dij!.revenue + drumstick!.revenue + karkas!.revenue).toBeCloseTo(10000, 0);
    });

    test('P0: kipburger-split — 80% drumvlees + 20% vel', () => {
      const rows: MappedSalesRow[] = [
        {
          artikelcode: '79022',
          artikelomschrijving: 'Kipburger',
          aantal: 100,
          eenheid: 'Kilogram',
          verkoopbedrag: 1000,
          mapped_category: 'kipburger',
          is_excluded: false,
        },
      ];

      const { productMix } = aggregateToProductMix(rows, DEFAULT_SPLIT_RULES);

      const drumvlees = productMix.find(p => p.category === 'drumvlees');
      const vel = productMix.find(p => p.category === 'vel');

      expect(drumvlees?.quantity_kg).toBe(80);
      expect(vel?.quantity_kg).toBe(20);
    });

    test('P0: kipgehakt-split — 70% filet + 30% vel', () => {
      const rows: MappedSalesRow[] = [
        {
          artikelcode: '79023',
          artikelomschrijving: 'Gehakt',
          aantal: 421,
          eenheid: 'Kilogram',
          verkoopbedrag: 5528.91,
          mapped_category: 'kipgehakt',
          is_excluded: false,
        },
      ];

      const { productMix } = aggregateToProductMix(rows, DEFAULT_SPLIT_RULES);

      const filet = productMix.find(p => p.category === 'filet');
      const vel = productMix.find(p => p.category === 'vel');

      expect(filet?.quantity_kg).toBeCloseTo(294.70, 1);
      expect(vel?.quantity_kg).toBeCloseTo(126.30, 1);
    });

    test('P0: Zorg&Natuur volledige aggregatie met splits', () => {
      const { mapped } = resolveArtikelMappings(ZORG_NATUUR_ROWS, DEFAULT_ARTIKEL_MAPPINGS);
      const { productMix, excludedItems, totalKg } = aggregateToProductMix(
        mapped,
        DEFAULT_SPLIT_RULES
      );

      // Filet: 624 + 9451 + 2012 + 70% van 421 (gehakt) = 12381.7
      const filet = productMix.find(p => p.category === 'filet');
      expect(filet?.quantity_kg).toBeCloseTo(12381.7, 0);

      // Dij: 8652 + 20 + 593 + 401 + 32.3% van (547+490+482) = 9666 + 490.64 = 10156.64
      const dij = productMix.find(p => p.category === 'dij');
      expect(dij?.quantity_kg).toBeCloseTo(10156.64, 0);

      // Drumstick: 4135.5 + 48.3% van 1519 = 4135.5 + 733.68 = 4869.18
      const drumstick = productMix.find(p => p.category === 'drumstick');
      expect(drumstick?.quantity_kg).toBeCloseTo(4869.18, 0);

      // Drumvlees: 80% van 709 (burger) = 567.2
      const drumvlees = productMix.find(p => p.category === 'drumvlees');
      expect(drumvlees?.quantity_kg).toBeCloseTo(567.2, 0);

      // Vel: 20% van 709 + 30% van 421 = 141.8 + 126.3 = 268.1
      const vel = productMix.find(p => p.category === 'vel');
      expect(vel?.quantity_kg).toBeCloseTo(268.1, 0);

      // Vleugels: 3211 + 1514 (borrelmix) = 4725
      const vleugels = productMix.find(p => p.category === 'vleugels');
      expect(vleugels?.quantity_kg).toBe(4725);

      // Hele kip: 2875
      const heleKip = productMix.find(p => p.category === 'hele_kip');
      expect(heleKip?.quantity_kg).toBe(2875);

      // Organen: 331 + 230 + 595 = 1156
      const organen = productMix.find(p => p.category === 'organen');
      expect(organen?.quantity_kg).toBe(1156);

      // Karkas: 302 (nekken) + 19.4% van 1519 (bout-bot) = 302 + 294.69 = 596.69
      const karkas = productMix.find(p => p.category === 'karkas');
      expect(karkas?.quantity_kg).toBeCloseTo(596.69, 0);

      // Uitgesloten items: eieren, leghennen, fust (borrelmix nu meegenomen als kg)
      expect(excludedItems).toHaveLength(3);
      const excludedCodes = excludedItems.map(e => e.artikelcode).sort();
      expect(excludedCodes).toEqual(['79052', 'Eieren', 'fust2'].sort());

      // Totaal kg moet kloppen (alle kg-producten na split)
      expect(totalKg).toBeGreaterThan(35000);
      expect(totalKg).toBeLessThan(40000);
    });

    test('P0: uitgesloten items bevatten revenue', () => {
      const { mapped } = resolveArtikelMappings(ZORG_NATUUR_ROWS, DEFAULT_ARTIKEL_MAPPINGS);
      const { totalExcludedRevenue } = aggregateToProductMix(mapped, DEFAULT_SPLIT_RULES);

      // Eieren: 36360, leghennen: 4088.28, fust: 0 (borrelmix nu meegenomen)
      expect(totalExcludedRevenue).toBeCloseTo(40448.28, 0);
    });
  });

  describe('runImportAnalysis (engine integratie)', () => {
    test('P0: Zorg&Natuur is een cherry picker (filet >30%)', () => {
      const { mapped } = resolveArtikelMappings(ZORG_NATUUR_ROWS, DEFAULT_ARTIKEL_MAPPINGS);
      const { productMix } = aggregateToProductMix(mapped, DEFAULT_SPLIT_RULES);

      const analysis = runImportAnalysis('zorg-natuur-test', 'Zorg&Natuur BV', productMix);

      expect(analysis.is_cherry_picker).toBe(true);
      expect(analysis.balance_score).toBeLessThan(80);
      expect(analysis.total_kg).toBeGreaterThan(35000);

      // Filet percentage moet boven 28% threshold liggen
      const filetBreakdown = analysis.category_breakdown.find(c => c.category === 'filet');
      expect(filetBreakdown).toBeDefined();
      expect(filetBreakdown!.percentage_of_total).toBeGreaterThan(28);

      // Alerts moeten aanwezig zijn
      expect(analysis.alerts.length).toBeGreaterThan(0);
      const filetAlert = analysis.alerts.find(a => a.category === 'filet');
      expect(filetAlert?.severity).toBe('critical');

      // Opportunity cost > 0
      expect(analysis.opportunity_cost).toBeGreaterThan(0);
    });

    test('P1: gebalanceerde klant is geen cherry picker', () => {
      // Product mix die de Oranjehoen griller rendementen benadert (totaal = 100%)
      const balancedMix = [
        { category: 'filet' as const, quantity_kg: 2350, revenue: 22325 },     // 23.5%
        { category: 'haas' as const, quantity_kg: 250, revenue: 2750 },        // 2.5%
        { category: 'dij' as const, quantity_kg: 1500, revenue: 10875 },       // 15%
        { category: 'drumstick' as const, quantity_kg: 1400, revenue: 9660 },  // 14%
        { category: 'drumvlees' as const, quantity_kg: 700, revenue: 5530 },   // 7%
        { category: 'vleugels' as const, quantity_kg: 920, revenue: 5060 },    // 9.2%
        { category: 'karkas' as const, quantity_kg: 2130, revenue: 4793 },     // 21.3%
        { category: 'organen' as const, quantity_kg: 500, revenue: 1750 },     // 5%
        { category: 'vel' as const, quantity_kg: 250, revenue: 500 },          // 2.5%
      ];

      const analysis = runImportAnalysis('balanced-test', 'Gebalanceerde Klant', balancedMix);

      expect(analysis.is_cherry_picker).toBe(false);
      expect(analysis.balance_score).toBeGreaterThanOrEqual(80);
    });
  });

  describe('helpers', () => {
    test('isValidCategory herkent geldige categorieën', () => {
      expect(isValidCategory('filet')).toBe(true);
      expect(isValidCategory('dij')).toBe(true);
      expect(isValidCategory('hele_kip')).toBe(true);
      expect(isValidCategory('bout_split')).toBe(false);
      expect(isValidCategory('kipburger')).toBe(false);
      expect(isValidCategory('onzin')).toBe(false);
    });

    test('isSplitRule herkent split-rules', () => {
      expect(isSplitRule('bout_split', DEFAULT_SPLIT_RULES)).toBe(true);
      expect(isSplitRule('kipburger', DEFAULT_SPLIT_RULES)).toBe(true);
      expect(isSplitRule('kipgehakt', DEFAULT_SPLIT_RULES)).toBe(true);
      expect(isSplitRule('filet', DEFAULT_SPLIT_RULES)).toBe(false);
    });
  });

  describe('in-memory store', () => {
    test('P1: CRUD operaties op imports', () => {
      const id = generateImportId();
      expect(id).toBeTruthy();

      const profile = {
        import_id: id,
        customer_name: 'Test Klant',
        import_date: new Date().toISOString(),
        source_filename: 'test.xlsx',
        raw_rows: [],
        mapped_rows: [],
        unmapped_codes: [],
        product_mix: [],
        excluded_items: [],
        total_kg: 0,
        total_revenue: 0,
        total_excluded_revenue: 0,
        analysis: null,
      };

      saveImport(profile);
      expect(getImport(id)).toBeDefined();
      expect(getImport(id)?.customer_name).toBe('Test Klant');

      expect(getAllImports().length).toBeGreaterThanOrEqual(1);

      deleteImport(id);
      expect(getImport(id)).toBeUndefined();
    });
  });

  describe('user mappings', () => {
    test('P1: user mapping overschrijft hardcoded', () => {
      // Override: maak 79014 (nekken) → organen in plaats van karkas
      addUserMapping({
        artikelcode: '79014',
        category: 'organen',
        is_kg_product: true,
        label: 'Nekken (user override)',
      });

      const allMappings = getAllMappings();
      const nekMapping = allMappings.find(m => m.artikelcode === '79014');
      expect(nekMapping?.category).toBe('organen');
    });

    test('P1: custom split-rules', () => {
      addUserSplitRule({
        key: 'custom_product',
        label: 'Test product → 50/50',
        parts: [
          { category: 'filet', ratio: 0.50 },
          { category: 'drumvlees', ratio: 0.50 },
        ],
      });

      const rules = getAllSplitRules();
      expect(rules.custom_product).toBeDefined();
      expect(rules.custom_product.parts).toHaveLength(2);
      expect(rules.custom_product.parts[0].ratio + rules.custom_product.parts[1].ratio).toBe(1);
    });
  });

  describe('edge cases', () => {
    test('P1: lege import geeft lege resultaten', () => {
      const { mapped, unmappedCodes } = resolveArtikelMappings([], DEFAULT_ARTIKEL_MAPPINGS);
      expect(mapped).toHaveLength(0);
      expect(unmappedCodes).toHaveLength(0);

      const { productMix, excludedItems, totalKg } = aggregateToProductMix(
        mapped,
        DEFAULT_SPLIT_RULES
      );
      expect(productMix).toHaveLength(0);
      expect(excludedItems).toHaveLength(0);
      expect(totalKg).toBe(0);
    });

    test('P1: alle producten onbekend', () => {
      const rows: ExactSalesRow[] = [
        { artikelcode: 'XYZ-001', artikelomschrijving: 'Onbekend 1', aantal: 100, eenheid: 'Kilogram', verkoopbedrag: 500 },
        { artikelcode: 'XYZ-002', artikelomschrijving: 'Onbekend 2', aantal: 200, eenheid: 'Kilogram', verkoopbedrag: 1000 },
      ];

      const { unmappedCodes } = resolveArtikelMappings(rows, DEFAULT_ARTIKEL_MAPPINGS);
      expect(unmappedCodes).toHaveLength(2);
      expect(unmappedCodes).toContain('XYZ-001');
      expect(unmappedCodes).toContain('XYZ-002');
    });
  });
});
