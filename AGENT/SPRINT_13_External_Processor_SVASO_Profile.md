# SPRINT 13 — Externe Verwerker via SVASO Profielen (CLI-Executable)

**Versie:** 1.0.0
**Status:** READY FOR CLI
**Auteur:** Claude Orchestrator (Opus 4.6)
**Datum:** 2026-02-14
**Hangt af van:** Batch Input v1 (DONE), Sprint 7 (DONE)
**Blokkeert:** Niets

---

## 0. MISSION

Oranjehoen stuurt grillers naar externe verwerker Cuno Moormann voor uitsnij. De eindproducten (filet suprêmes, drumsticks, dijfilet met vel, platte vleugels, karkassen) hebben elk eigen snijkosten en verkoopprijzen. Deze sprint generaliseert de SVASO canon zodat dezelfde wiskunde werkt voor zowel interne als externe productprofielen.

**Target:** Gebruiker kan een batch aanmaken met profiel "Externe Verwerker", dynamische producten invoeren, en ziet SVASO-allocatie + marges per product.

**Kernbeslissing:** Geen aparte module — de SVASO-wiskunde is universeel. We introduceren `BatchProfile` om `JOINT_PRODUCT_CODES` configureerbaar te maken per batch.

**Hard constraints:**
- SVASO wiskundige kern UNTOUCHED (k-factor, allocation_factor, rounding residual)
- Decimal.js gebruik ongewijzigd
- Bestaande VALIDATIE batch werkt exact als voorheen (regressie)
- Bestaande tests mogen NIET breken
- `supabase/**` UNTOUCHED (geen migraties)
- Bestaande batch-input routes ongewijzigd
- `internal` profiel is altijd default (backward compatible)

---

## DEMO BATCH DATA (Cuno Moormann pakbon)

```
Bron: Pakbon Storteboom → Cuno Moormann
PLU 400577: BLK1Ster OH Naakt vrs 8×1700-1800
128 kratten × 8 = ~1024 grillers
Netto: 1.793,5 kg grillers

Live cost: €2,50/kg levend
Slachtrendement: 72% → levend gewicht = 1.793,5 / 0,72 = 2.490,97 kg
Slachtkosten: €0,89/kip × 1.024 = €911,36
Transport: €0 (opgenomen in live cost)

Landed cost: 2.490,97 × €2,50 = €6.227,43
C_joint: €6.227,43 + €911,36 = €7.138,79

By-products: 570 kg karkassen × €0,20 = €114,00 credit
C_netto_joint: €7.138,79 - €114,00 = €7.024,79

Joint products (van uitsnij):
- Filet Suprêmes: 621,64 kg, snijkosten €1,29/kg, VP €15,35/kg
- Drumsticks: 253,50 kg, snijkosten €1,98/kg, VP €8,00/kg
- Dijfilet met vel: 252,00 kg, snijkosten €1,98/kg, VP €15,00/kg
- Platte vleugels: 79,27 kg, snijkosten €1,98/kg, VP €6,00/kg
- Karkassen (by-product): 570 kg, VP wisselend (soms €0,75/kg, soms afval)

Massabalans: joint (1.206,41 kg) + by-product (570 kg) = 1.776,41 kg
             vs griller 1.793,5 kg → 17,09 kg verschil (0,95% — binnen tolerantie)
```

### Verwachte SVASO resultaten:

| Product | kg | Shadow €/kg | Marktwaarde | Alloc% | SVASO €/kg | +Snij/kg | =Totaal/kg | VP/kg | Marge/kg | Marge% |
|---------|-----|------------|-------------|--------|-----------|----------|-----------|-------|----------|--------|
| Filet Suprêmes | 621,64 | 15,35 | 9.542,17 | 60,3% | 6,81 | 1,29 | **8,10** | 15,35 | **7,25** | 47,2% |
| Drumsticks | 253,50 | 8,00 | 2.028,00 | 12,8% | 3,55 | 1,98 | **5,53** | 8,00 | **2,47** | 30,9% |
| Dijfilet met vel | 252,00 | 15,00 | 3.780,00 | 23,9% | 6,66 | 1,98 | **8,64** | 15,00 | **6,36** | 42,4% |
| Platte vleugels | 79,27 | 6,00 | 475,62 | 3,0% | 2,66 | 1,98 | **4,64** | 6,00 | **1,36** | 22,7% |

**k-factor:** 7.024,79 / 15.825,79 = **0,444** → PROFITABLE
**TMV:** €15.825,79

---

## 1. PHASE 13.1 — Engine: BatchProfile + Generaliseer SVASO Scope

### Doel
Introduceer `BatchProfile` type en maak `calculateSVASOAllocation()` profiel-aware zonder de wiskundige kern te wijzigen.

### 1.1 WIJZIG: `src/lib/engine/canonical-cost.ts`

**Na de bestaande `JOINT_PRODUCT_CODES` declaratie (regel 40-41), voeg toe:**

```typescript
// ============================================================================
// BATCH PROFILES — Configurable product sets for SVASO allocation
// ============================================================================

/**
 * Batch Profile — defines which product codes are valid for SVASO in a batch.
 * The SVASO math is universal; only the product names differ per profile.
 */
export interface BatchProfile {
  id: string;
  label: string;
  joint_product_codes: readonly string[];
  default_shadow_prices: Record<string, number>;
  has_mini_svaso: boolean;
  by_product_codes: readonly string[];
}

/**
 * Default joint product codes (backward compatible).
 * Renamed from JOINT_PRODUCT_CODES for clarity — original const stays for compatibility.
 */
export const DEFAULT_JOINT_PRODUCT_CODES = JOINT_PRODUCT_CODES;

/**
 * Available batch profiles.
 * 'internal' = Oranjehoen eigen uitsnij (3 joint products)
 * 'external_cuno' = Externe verwerker Cuno Moormann (4 joint products)
 */
export const BATCH_PROFILES: Record<string, BatchProfile> = {
  internal: {
    id: 'internal',
    label: 'Interne Uitsnij',
    joint_product_codes: DEFAULT_JOINT_PRODUCT_CODES,
    default_shadow_prices: { breast_cap: 9.50, legs: 5.50, wings: 4.50 },
    has_mini_svaso: true,
    by_product_codes: ['blood', 'feathers', 'offal', 'back_carcass', 'cat3_waste'],
  },
  external_cuno: {
    id: 'external_cuno',
    label: 'Externe Verwerker (Cuno Moormann)',
    joint_product_codes: ['filet_supreme', 'drumsticks', 'dijfilet_vel', 'platte_vleugels'] as const,
    default_shadow_prices: { filet_supreme: 15.35, drumsticks: 8.00, dijfilet_vel: 15.00, platte_vleugels: 6.00 },
    has_mini_svaso: false,
    by_product_codes: ['karkassen'],
  },
};

export type BatchProfileId = keyof typeof BATCH_PROFILES;
```

**Wijzig `assertJointProduct()` (regel 638-646) — voeg optioneel profiel toe:**

```typescript
/**
 * Validates that a part_code is a joint product.
 * When profile is provided, validates against that profile's codes.
 * When no profile: validates against DEFAULT (breast_cap, legs, wings).
 */
export function assertJointProduct(
  part_code: string,
  profile?: BatchProfile
): asserts part_code is JointProductCode {
  const validCodes = profile
    ? profile.joint_product_codes
    : (JOINT_PRODUCT_CODES as readonly string[]);

  if (!validCodes.includes(part_code)) {
    throw new Error(
      `SCOPE VIOLATION: "${part_code}" is NOT a joint product. ` +
      `SVASO accepts ONLY: ${validCodes.join(', ')}. ` +
      `Back/carcass and other by-products must NOT enter SVASO allocation.`
    );
  }
}
```

**Wijzig `isJointProduct()` (regel 651-653) — voeg optioneel profiel toe:**

```typescript
export function isJointProduct(part_code: string, profile?: BatchProfile): part_code is JointProductCode {
  const validCodes = profile
    ? profile.joint_product_codes
    : (JOINT_PRODUCT_CODES as readonly string[]);
  return validCodes.includes(part_code);
}
```

**Wijzig `calculateSVASOAllocation()` (regel 913-917) — voeg optioneel profiel parameter toe:**

De functie-signatuur wordt:

```typescript
export function calculateSVASOAllocation(
  batch_id: string,
  netJointCost: NetJointCostResult,
  jointProducts: JointProductInput[],
  profile?: BatchProfile
): SVASOAllocationResult {
```

En de scope enforcement (regel 920-923) wordt:

```typescript
  // HARD RAIL: Scope enforcement
  for (const jp of jointProducts) {
    assertJointProduct(jp.part_code, profile);
  }
```

**NIETS ANDERS in calculateSVASOAllocation wijzigen** — de wiskundige kern (k-factor, allocation_factor, Decimal.js, rounding residual) blijft 100% identiek.

### 1.2 WIJZIG: `src/lib/engine/canonical-cost.test.ts`

**Wijzig de bestaande test (regel 576-578):**

```typescript
  it('DEFAULT_JOINT_PRODUCT_CODES should contain exactly 3 entries', () => {
    expect(JOINT_PRODUCT_CODES).toHaveLength(3);
    expect([...JOINT_PRODUCT_CODES].sort()).toEqual(['breast_cap', 'legs', 'wings']);
  });
```

**Voeg nieuwe tests toe na de bestaande scope tests:**

```typescript
  describe('BatchProfile support', () => {
    it('BATCH_PROFILES has internal and external_cuno profiles', () => {
      expect(BATCH_PROFILES.internal).toBeDefined();
      expect(BATCH_PROFILES.external_cuno).toBeDefined();
      expect(BATCH_PROFILES.internal.joint_product_codes).toHaveLength(3);
      expect(BATCH_PROFILES.external_cuno.joint_product_codes).toHaveLength(4);
    });

    it('internal profile matches DEFAULT_JOINT_PRODUCT_CODES', () => {
      expect([...BATCH_PROFILES.internal.joint_product_codes].sort())
        .toEqual([...JOINT_PRODUCT_CODES].sort());
    });

    it('assertJointProduct with external profile accepts filet_supreme', () => {
      expect(() =>
        assertJointProduct('filet_supreme', BATCH_PROFILES.external_cuno)
      ).not.toThrow();
    });

    it('assertJointProduct with external profile rejects breast_cap', () => {
      expect(() =>
        assertJointProduct('breast_cap', BATCH_PROFILES.external_cuno)
      ).toThrow(/SCOPE VIOLATION/);
    });

    it('assertJointProduct without profile still enforces default scope', () => {
      expect(() => assertJointProduct('breast_cap')).not.toThrow();
      expect(() => assertJointProduct('filet_supreme')).toThrow(/SCOPE VIOLATION/);
    });

    it('isJointProduct respects profile parameter', () => {
      expect(isJointProduct('filet_supreme', BATCH_PROFILES.external_cuno)).toBe(true);
      expect(isJointProduct('breast_cap', BATCH_PROFILES.external_cuno)).toBe(false);
      expect(isJointProduct('breast_cap')).toBe(true);
      expect(isJointProduct('filet_supreme')).toBe(false);
    });

    it('calculateSVASOAllocation works with external profile', () => {
      const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
      const level1 = calculateJointCostPool('EXT-001', landed, 911.36, 1793.5);
      const byProducts: ByProductPhysical[] = [
        { id: 'karkassen', type: 'back_carcass', weight_kg: 570 },
      ];
      const level2 = calculateByProductCredit('EXT-001', level1, byProducts);

      const externalJoints: JointProductInput[] = [
        { part_code: 'filet_supreme' as any, weight_kg: 621.64, shadow_price_per_kg: 15.35 },
        { part_code: 'drumsticks' as any, weight_kg: 253.50, shadow_price_per_kg: 8.00 },
        { part_code: 'dijfilet_vel' as any, weight_kg: 252.00, shadow_price_per_kg: 15.00 },
        { part_code: 'platte_vleugels' as any, weight_kg: 79.27, shadow_price_per_kg: 6.00 },
      ];

      const level3 = calculateSVASOAllocation('EXT-001', level2, externalJoints, BATCH_PROFILES.external_cuno);

      expect(level3.allocations).toHaveLength(4);
      expect(level3.k_factor).toBeGreaterThan(0);
      expect(level3.k_factor).toBeLessThan(1); // Profitable
      expect(level3.k_factor_interpretation).toBe('PROFITABLE');

      // Sum of allocations must reconcile to net joint cost
      const sumAllocated = level3.allocations.reduce((s, a) => s + a.allocated_cost_total_eur, 0);
      expect(Math.abs(sumAllocated - level3.net_joint_cost_eur)).toBeLessThan(0.01);

      // Allocation factors must sum to ~1
      const sumFactors = level3.allocations.reduce((s, a) => s + a.allocation_factor, 0);
      expect(Math.abs(sumFactors - 1.0)).toBeLessThan(0.0001);
    });
  });
```

**Update imports** bovenaan het testbestand: voeg `BATCH_PROFILES, assertJointProduct, isJointProduct, ByProductPhysical` toe.

### Verificatie fase 13.1

```bash
npm test
npm run build
```

Controleer specifiek:
- Bestaande SVASO tests passen (geen regressie)
- Nieuwe profiel-tests slagen
- `assertJointProduct('breast_cap')` (geen profiel) gooit NIET
- `assertJointProduct('filet_supreme', BATCH_PROFILES.external_cuno)` gooit NIET

**STOP na Phase 13.1. Report results. Wait for GO.**

---

## 2. PHASE 13.2 — Store: BatchInputData + Prefilled CUNO Batch

### Doel
Extend `BatchInputData` met profiel-ondersteuning en dynamische producten. Prefill een demo batch met echte Cuno Moormann pakbon data.

### 2.1 WIJZIG: `src/lib/data/batch-input-store.ts`

**Voeg velden toe aan `BatchInputData` interface (na regel 67, vóór de sluitende `}`):**

```typescript
  // PROFIEL — bepaalt welke productset geldig is
  batch_profile?: 'internal' | 'external_cuno';
  processor_name?: string;
  pakbon_ref?: string;

  // DYNAMISCHE JOINT PRODUCTS — voor external profielen
  // Bij internal profiel: gebruik breast_cap_kg, legs_kg, wings_kg (backward compatible)
  // Bij external profiel: gebruik dit array
  joint_products?: Array<{
    product_code: string;
    product_name: string;
    weight_kg: number;
    shadow_price_per_kg: number;
    cutting_cost_per_kg?: number;
    is_by_product: boolean;
  }>;

  // VERKOOPPRIJZEN — voor marge-berekening
  selling_prices?: Record<string, number>;
```

Alle velden zijn optioneel → bestaande code breekt niet.

### 2.2 VOEG TOE: `createCunoBatch()` functie (na `createValidatiegolf1Batch`)

```typescript
/**
 * CUNO-2025-11-24 — Echte pakbon data Cuno Moormann
 *
 * Bron: Storteboom pakbon PLU 400577 (BLK1Ster OH Naakt vrs 8×1700-1800)
 * 128 kratten × 8 = ~1024 grillers, netto 1.793,5 kg
 *
 * Live cost: €2,50/kg levend
 * Slachtrendement: 72% → levend = 1.793,5 / 0,72 = 2.490,97 kg
 * Slachtkosten: €0,89/kip
 *
 * Uitsnijresultaten (Cuno Moormann):
 * - Filet Suprêmes: 621,64 kg (snij €1,29/kg)
 * - Drumsticks: 253,50 kg (snij €1,98/kg)
 * - Dijfilet met vel: 252,00 kg (snij €1,98/kg)
 * - Platte vleugels: 79,27 kg (snij €1,98/kg)
 * - Karkassen: 570 kg (by-product)
 *
 * Verkoopprijzen:
 * - Suprêmes: €15,35/kg
 * - Drumsticks: €8,00/kg
 * - Dijfilet met vel: €15,00/kg
 * - Platte vleugels: €6,00/kg
 * - Karkassen: wisselend (niet in marge)
 */
export function createCunoBatch(): BatchInputData {
  const griller_kg = 1793.5;
  const rendement = 0.72;
  const live_weight_kg = Math.round((griller_kg / rendement) * 100) / 100; // 2490.97
  const bird_count = 1024; // 128 kratten × 8

  return {
    batch_id: 'CUNO-2025-11-24',
    batch_ref: 'CUNO-2025-11-24',
    date: '2025-11-24',

    bird_count,
    doa_count: 0,
    live_weight_kg,

    griller_weight_kg: griller_kg,
    slaughter_cost_mode: 'per_bird',
    slaughter_cost_per_bird: 0.89,
    slaughter_cost_total: 0,

    // Internal fields — zeros for external profile
    breast_cap_kg: 0,
    legs_kg: 0,
    wings_kg: 0,
    filet_kg: 0,
    thigh_fillet_kg: 0,
    drum_meat_kg: 0,

    // By-products — alleen karkassen relevant
    blood_kg: 0,
    feathers_kg: 0,
    offal_kg: 0,
    back_carcass_kg: 0,
    cat3_other_kg: 0,

    live_cost_per_kg: 2.50,
    transport_cost_eur: 0,
    catching_fee_eur: 0,

    // === PROFIEL VELDEN ===
    batch_profile: 'external_cuno',
    processor_name: 'Cuno Moormann',
    pakbon_ref: 'PLU 400577 — BLK1Ster OH Naakt vrs 8×1700-1800',

    joint_products: [
      { product_code: 'filet_supreme', product_name: 'Filet Suprêmes', weight_kg: 621.64, shadow_price_per_kg: 15.35, cutting_cost_per_kg: 1.29, is_by_product: false },
      { product_code: 'drumsticks', product_name: 'Drumsticks', weight_kg: 253.50, shadow_price_per_kg: 8.00, cutting_cost_per_kg: 1.98, is_by_product: false },
      { product_code: 'dijfilet_vel', product_name: 'Dijfilet met vel', weight_kg: 252.00, shadow_price_per_kg: 15.00, cutting_cost_per_kg: 1.98, is_by_product: false },
      { product_code: 'platte_vleugels', product_name: 'Platte vleugels', weight_kg: 79.27, shadow_price_per_kg: 6.00, cutting_cost_per_kg: 1.98, is_by_product: false },
      { product_code: 'karkassen', product_name: 'Karkassen', weight_kg: 570, shadow_price_per_kg: 0.20, cutting_cost_per_kg: 0, is_by_product: true },
    ],

    selling_prices: {
      filet_supreme: 15.35,
      drumsticks: 8.00,
      dijfilet_vel: 15.00,
      platte_vleugels: 6.00,
    },
  };
}
```

### 2.3 WIJZIG: Store initialisatie (regel 413-415)

Voeg de CUNO batch toe aan de store initialisatie:

```typescript
// Initialize store with prefilled batches
const validatieBatch = createValidatiegolf1Batch();
saveBatch(validatieBatch);

const cunoBatch = createCunoBatch();
saveBatch(cunoBatch);
```

### 2.4 WIJZIG: `computeDerivedValues()` — support external profiel

De bestaande functie berekent `joint_total_kg` uit `breast_cap_kg + legs_kg + wings_kg`. Voor external profiel moet dit ook werken met `joint_products[]`:

Na regel 123 (`const joint_total_kg = ...`), voeg toe:

```typescript
  // Support external profile: use joint_products array if present
  const effective_joint_total_kg = (input.joint_products && input.joint_products.length > 0)
    ? input.joint_products.filter(jp => !jp.is_by_product).reduce((s, jp) => s + jp.weight_kg, 0)
    : joint_total_kg;

  const effective_by_product_total_kg = (input.joint_products && input.joint_products.length > 0)
    ? input.joint_products.filter(jp => jp.is_by_product).reduce((s, jp) => s + jp.weight_kg, 0)
    : by_product_total_kg;
```

En pas de mass balance berekening aan:

```typescript
  const mass_balance_output_kg = effective_joint_total_kg + effective_by_product_total_kg;
```

### Verificatie fase 13.2

```bash
npm test
npm run build
```

Controleer:
- `getAllBatches()` retourneert 2 batches (VALIDATIE + CUNO)
- CUNO batch heeft `batch_profile === 'external_cuno'`
- `computeDerivedValues(cunoBatch)` geeft valide massabalans

**STOP na Phase 13.2. Report results. Wait for GO.**

---

## 3. PHASE 13.3 — Bridge: Profiel-aware Pipeline

### Doel
`runBatchPipeline()` detecteert het profiel en routeert external batches door de juiste SVASO flow.

### 3.1 WIJZIG: `src/lib/data/batch-engine-bridge.ts`

**Voeg import toe:**

```typescript
import { BATCH_PROFILES } from '@/lib/engine/canonical-cost';
import type { BatchProfile } from '@/lib/engine/canonical-cost';
```

**Voeg profiel-specifieke bridge functies toe (na `batchInputToSubCuts`):**

```typescript
/**
 * Convert external profile joint_products to engine JointProductInput[].
 * Filters out by-products — only joint products enter SVASO.
 */
export function externalBatchToJointProducts(input: BatchInputData): JointProductInput[] {
  if (!input.joint_products) return [];
  return input.joint_products
    .filter(jp => !jp.is_by_product)
    .map(jp => ({
      part_code: jp.product_code as JointProductCode,
      weight_kg: jp.weight_kg,
      shadow_price_per_kg: jp.shadow_price_per_kg,
    }));
}

/**
 * Convert external profile by-products from joint_products array.
 */
export function externalBatchToByProducts(input: BatchInputData): ByProductPhysical[] {
  if (!input.joint_products) return [];
  return input.joint_products
    .filter(jp => jp.is_by_product)
    .map(jp => ({
      id: jp.product_code,
      type: jp.product_code as any,
      weight_kg: jp.weight_kg,
    }));
}
```

**Wijzig `runBatchPipeline()` — voeg profiel-routing toe:**

Vervang de functie body. De sleutel is:
- Detecteer `input.batch_profile`
- Bij `'external_cuno'`: gebruik `externalBatchToJointProducts`, `externalBatchToByProducts`, pass profile aan SVASO, skip mini-SVASO
- Bij default (`'internal'` of undefined): bestaande flow ongewijzigd

```typescript
export function runBatchPipeline(input: BatchInputData): CanonWaterfallData {
  const derived = computeDerivedValues(input);
  const profile = input.batch_profile ? BATCH_PROFILES[input.batch_profile] : BATCH_PROFILES.internal;
  const isExternal = input.batch_profile === 'external_cuno';

  // Convert batch input to engine types
  const landedCostInput = batchInputToLandedCost(input);
  const slaughterFeeEur = batchInputToSlaughterFee(input);
  const byProducts = isExternal
    ? externalBatchToByProducts(input)
    : batchInputToByProducts(input);
  const jointProducts = isExternal
    ? externalBatchToJointProducts(input)
    : batchInputToJointProducts(input);

  // Level 0: Landed Cost
  const level0 = calculateLandedCost(landedCostInput);

  // Level 1: Joint Cost Pool
  const level1 = calculateJointCostPool(
    input.batch_id,
    level0,
    slaughterFeeEur,
    input.griller_weight_kg,
  );

  // Level 2: By-product Credit
  const level2 = calculateByProductCredit(
    input.batch_id,
    level1,
    byProducts,
  );

  // Level 3: SVASO Allocation — with profile for scope enforcement
  const level3 = calculateSVASOAllocation(
    input.batch_id,
    level2,
    jointProducts,
    profile,
  );

  // Level 4: Mini-SVASO — skip for profiles without sub-cuts
  const level4: Record<string, MiniSVASOResult> = {};
  if (profile.has_mini_svaso) {
    const subCuts = batchInputToSubCuts(input);
    for (const alloc of level3.allocations) {
      const partSubCuts = subCuts[alloc.part_code];
      if (partSubCuts && partSubCuts.length > 0) {
        level4[alloc.part_code] = calculateMiniSVASO(alloc, partSubCuts);
      }
    }
  }

  // Level 5: ABC Costs
  const abcDrivers = getDefaultABCDrivers();
  const skuDefinition = getDefaultSkuDefinition();
  const level5 = calculateABCCosts(skuDefinition.sku_code, abcDrivers);

  // Level 6: Full SKU Cost
  const filetAlloc = level4['breast_cap']?.sub_allocations?.[0];
  const meatCostPerKg = filetAlloc?.allocated_cost_per_kg ?? level3.allocations[0]?.allocated_cost_per_kg ?? 0;
  const level6 = calculateFullSKUCost(skuDefinition, meatCostPerKg, level5);

  // Level 7: NRV Check
  const nrvInput = getDefaultNRVInput();
  const level7 = calculateNRV(nrvInput, level6.cost_per_kg);

  return {
    batch: {
      batch_id: input.batch_id,
      batch_ref: input.batch_ref,
      date: input.date,
      input_live_kg: input.live_weight_kg,
      input_count: input.bird_count,
      griller_output_kg: input.griller_weight_kg,
      griller_yield_pct: derived.griller_yield_pct,
      k_factor: level3.k_factor,
      k_factor_interpretation: level3.k_factor_interpretation,
      mass_balance_deviation_pct: derived.mass_balance_deviation_pct,
      mass_balance_status: derived.mass_balance_status,
    },
    level0,
    level1,
    level2,
    level3,
    level4,
    level5,
    level6,
    level7,
    inputs: {
      landedCostInput,
      slaughterFeeEur,
      grillerWeightKg: input.griller_weight_kg,
      byProducts,
      jointProducts,
      subCuts: isExternal ? {} : batchInputToSubCuts(input),
      abcDrivers,
      skuDefinition,
      nrvInput,
    },
  };
}
```

### Verificatie fase 13.3

```bash
npm test
npm run build
```

Controleer:
- `runBatchPipeline(cunoBatch)` produceert geldige output
- `level3.k_factor` ≈ 0,44
- `level3.allocations` heeft 4 items
- `runBatchPipeline(validatieBatch)` werkt nog steeds exact als voorheen

**STOP na Phase 13.3. Report results. Wait for GO.**

---

## 4. PHASE 13.4 — UI: Profiel Selector + Dynamische Producten + Marge Tab

### Doel
BatchInputForm toont profiel-selector, dynamische producttabel bij external profiel, en een nieuw Marge-tab.

### 4.1 WIJZIG: `src/components/oil/batch-input/BatchInputForm.tsx`

**Na de SectionHeader component (rond regel 48), voeg profiel-toggle toe:**

```tsx
{/* PROFIEL SELECTOR */}
<div className="bg-white rounded-xl border border-gray-200 p-4">
  <label className="block text-sm font-semibold text-gray-700 mb-2">Verwerkingsprofiel</label>
  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
    <button
      type="button"
      onClick={() => update('batch_profile', 'internal')}
      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
        (data.batch_profile || 'internal') === 'internal'
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      Interne Uitsnij
    </button>
    <button
      type="button"
      onClick={() => update('batch_profile', 'external_cuno')}
      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
        data.batch_profile === 'external_cuno'
          ? 'bg-purple-600 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      Externe Verwerker
    </button>
  </div>
</div>
```

**Bij external profiel — toon extra velden:**

```tsx
{data.batch_profile === 'external_cuno' && (
  <FormSection title="Verwerker" color="purple">
    <NumberField label="Verwerker" type="text" value={data.processor_name || ''} onChange={v => update('processor_name', v)} />
    <NumberField label="Pakbon ref" type="text" value={data.pakbon_ref || ''} onChange={v => update('pakbon_ref', v)} />
  </FormSection>
)}
```

**Sectie 3 conditioneel maken:**
- Bij `internal`: bestaande vaste velden (breast_cap_kg, legs_kg, wings_kg)
- Bij `external_cuno`: dynamische product-tabel uit `data.joint_products`

```tsx
{(data.batch_profile || 'internal') === 'internal' ? (
  {/* Bestaande Sectie 3 — ongewijzigd */}
) : (
  <FormSection title="Producten (Externe Verwerker)" color="purple">
    <div className="space-y-3">
      {(data.joint_products || []).map((jp, idx) => (
        <div key={jp.product_code} className={`grid grid-cols-5 gap-2 items-center ${jp.is_by_product ? 'opacity-60' : ''}`}>
          <span className="text-sm font-medium col-span-1">{jp.product_name}</span>
          <NumberField label="kg" value={jp.weight_kg} onChange={v => {
            const updated = [...(data.joint_products || [])];
            updated[idx] = { ...updated[idx], weight_kg: parseFloat(v) || 0 };
            setData(prev => ({ ...prev, joint_products: updated }));
          }} />
          <NumberField label="Snij €/kg" value={jp.cutting_cost_per_kg || 0} onChange={v => {
            const updated = [...(data.joint_products || [])];
            updated[idx] = { ...updated[idx], cutting_cost_per_kg: parseFloat(v) || 0 };
            setData(prev => ({ ...prev, joint_products: updated }));
          }} />
          <NumberField label="VP €/kg" value={(data.selling_prices || {})[jp.product_code] || 0} onChange={v => {
            setData(prev => ({
              ...prev,
              selling_prices: { ...(prev.selling_prices || {}), [jp.product_code]: parseFloat(v) || 0 },
            }));
          }} />
          <span className="text-xs text-gray-500">{jp.is_by_product ? 'bijproduct' : 'joint'}</span>
        </div>
      ))}
    </div>
  </FormSection>
)}
```

**Sectie 4 verbergen bij external profiel:**

```tsx
{(data.batch_profile || 'internal') === 'internal' && (
  {/* Bestaande Sectie 4: Sub-cuts */}
)}
```

### 4.2 WIJZIG: `src/components/oil/batch-input/BatchDetailShell.tsx`

Voeg Marge tab toe aan de tab-lijst. Toon alleen voor external profiel:

```tsx
{batch.batch_profile === 'external_cuno' && (
  <Tab label="Marges">
    <MarginAnalysis batch={batch} waterfallData={waterfallData} />
  </Tab>
)}
```

### 4.3 NIEUW: `src/components/oil/batch-input/MarginAnalysis.tsx`

Dit component toont:
1. **Batch samenvatting cards**: Totale kosten | Omzet | Marge € | Marge %
2. **Product marge tabel**: Per product → SVASO €/kg | +Snij/kg | =Totaal/kg | VP/kg | Marge/kg | Marge%
3. **Kleurcodering**: groen (>15%), oranje (5-15%), rood (<5%)

```typescript
'use client';

import type { BatchInputData } from '@/lib/data/batch-input-store';
import type { CanonWaterfallData } from '@/components/oil/CostWaterfallShell';

interface Props {
  batch: BatchInputData;
  waterfallData: CanonWaterfallData | null;
}

export function MarginAnalysis({ batch, waterfallData }: Props) {
  if (!waterfallData || !batch.joint_products || !batch.selling_prices) {
    return <div className="p-4 text-gray-500">Geen marge-data beschikbaar. Sla de batch op en herbereken.</div>;
  }

  const { level3 } = waterfallData;
  const products = batch.joint_products.filter(jp => !jp.is_by_product);

  const rows = products.map(jp => {
    const alloc = level3.allocations.find(a => a.part_code === jp.product_code);
    const svaso_per_kg = alloc?.allocated_cost_per_kg ?? 0;
    const cutting_per_kg = jp.cutting_cost_per_kg ?? 0;
    const total_cost_per_kg = svaso_per_kg + cutting_per_kg;
    const vp_per_kg = batch.selling_prices?.[jp.product_code] ?? 0;
    const marge_per_kg = vp_per_kg > 0 ? vp_per_kg - total_cost_per_kg : 0;
    const marge_pct = vp_per_kg > 0 ? (marge_per_kg / vp_per_kg) * 100 : 0;
    const total_omzet = jp.weight_kg * vp_per_kg;
    const total_kosten = jp.weight_kg * total_cost_per_kg;
    const total_marge = total_omzet - total_kosten;

    return { ...jp, svaso_per_kg, cutting_per_kg, total_cost_per_kg, vp_per_kg, marge_per_kg, marge_pct, total_omzet, total_kosten, total_marge };
  });

  const totals = rows.reduce((acc, r) => ({
    kosten: acc.kosten + r.total_kosten,
    omzet: acc.omzet + r.total_omzet,
    marge: acc.marge + r.total_marge,
  }), { kosten: 0, omzet: 0, marge: 0 });

  const totalMargePct = totals.omzet > 0 ? (totals.marge / totals.omzet) * 100 : 0;

  const marginColor = (pct: number) =>
    pct > 15 ? 'text-green-700 bg-green-50' :
    pct > 5 ? 'text-orange-700 bg-orange-50' :
    'text-red-700 bg-red-50';

  const fmt = (n: number) => n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Totale kosten" value={`€${fmt(totals.kosten)}`} />
        <SummaryCard label="Omzet" value={`€${fmt(totals.omzet)}`} />
        <SummaryCard label="Marge" value={`€${fmt(totals.marge)}`} color={marginColor(totalMargePct)} />
        <SummaryCard label="Marge %" value={`${fmt(totalMargePct)}%`} color={marginColor(totalMargePct)} />
      </div>

      {/* k-factor badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">k-factor:</span>
        <span className={`px-2 py-1 rounded text-sm font-bold ${
          level3.k_factor < 1 ? 'bg-green-100 text-green-800' :
          level3.k_factor === 1 ? 'bg-gray-100 text-gray-800' :
          'bg-red-100 text-red-800'
        }`}>
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
              <th className="pb-2 text-right">+ Snij €/kg</th>
              <th className="pb-2 text-right">= Totaal €/kg</th>
              <th className="pb-2 text-right">VP €/kg</th>
              <th className="pb-2 text-right">Marge €/kg</th>
              <th className="pb-2 text-right">Marge %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.product_code} className="border-b border-gray-100">
                <td className="py-2 font-medium">{r.product_name}</td>
                <td className="py-2 text-right">{fmt(r.weight_kg)}</td>
                <td className="py-2 text-right">€{r.svaso_per_kg.toFixed(2)}</td>
                <td className="py-2 text-right">€{r.cutting_per_kg.toFixed(2)}</td>
                <td className="py-2 text-right font-medium">€{r.total_cost_per_kg.toFixed(2)}</td>
                <td className="py-2 text-right">€{r.vp_per_kg.toFixed(2)}</td>
                <td className="py-2 text-right font-medium">€{r.marge_per_kg.toFixed(2)}</td>
                <td className="py-2 text-right">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${marginColor(r.marge_pct)}`}>
                    {r.marge_pct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${color || 'bg-white'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}
```

### 4.4 WIJZIG: `src/components/oil/batch-input/MassBalancePanel.tsx`

De massabalans moet werken met dynamische producten. Controleer of het component `computeDerivedValues` aanroept — die is al geüpdated in Phase 13.2. Eventueel moet de weergave van producten dynamisch worden:

Als het component hardcoded productnamen toont, vervang met:

```tsx
{(batch.joint_products && batch.joint_products.length > 0)
  ? batch.joint_products.map(jp => (
      <div key={jp.product_code} className="flex justify-between text-xs">
        <span>{jp.product_name}</span>
        <span>{jp.weight_kg.toFixed(1)} kg</span>
      </div>
    ))
  : <>
      {/* Bestaande hardcoded producten voor internal profiel */}
    </>
}
```

### Verificatie fase 13.4

```bash
npm run build
npm run lint
```

Visuele verificatie:
1. Open `/oil/batch-input` → lijst toont VALIDATIE + CUNO-2025-11-24
2. CUNO batch → profiel "Externe Verwerker" is geselecteerd
3. Formulier toont dynamische producttabel (5 rijen)
4. "Opslaan & herbereken" → waterval met SVASO over 4 joint products
5. Tab "Marges" verschijnt bij CUNO batch
6. VALIDATIE batch: nul visuele wijzigingen

**STOP na Phase 13.4. Report results. Wait for GO.**

---

## 5. PHASE 13.5 — Integratie + Verificatie

### Doel
End-to-end verificatie van alle flows. Geen nieuwe code.

### 5.1 Regressietest

```bash
npm test
npm run build
npm run lint
```

### 5.2 Functionele verificatie

| # | Check | Verwachting |
|---|-------|------------|
| 1 | `/oil/batch-input` lijst | 2 batches (VALIDATIE + CUNO) |
| 2 | VALIDATIE batch openen | Geen wijzigingen, profiel = internal (default) |
| 3 | VALIDATIE "Opslaan & herbereken" | Waterval identiek aan voor sprint |
| 4 | CUNO batch openen | Profiel "Externe Verwerker", producttabel, verkoopprijzen |
| 5 | CUNO "Opslaan & herbereken" | SVASO over 4 products, k-factor ≈ 0,44 |
| 6 | CUNO tab "Marges" | Product-marges met kleurbadges |
| 7 | CUNO filet marge | ~47% (groen badge) |
| 8 | CUNO platte vleugels marge | ~23% (groen badge) |
| 9 | k-factor badge | "PROFITABLE" |
| 10 | Massabalans CUNO | ≤ 3% afwijking (groen/geel) |

### 5.3 MUST NOT have changed

```bash
# Wiskundige kern ongewijzigd (k-factor, allocation_factor, rounding residual logic):
# Verify geen wijzigingen in de SVASO kern-berekeningen (regels 925-1060):
git diff HEAD -- src/lib/engine/canonical-cost.ts | grep "^[+-]" | grep -v "^[+-][+-][+-]" | grep -v "profile\|BatchProfile\|assertJoint\|isJoint\|BATCH_PROFILES\|DEFAULT_JOINT"

# Supabase ongewijzigd:
git diff HEAD -- supabase/

# Bestaande tests moeten nog steeds passen:
npm test
```

---

## 6. COMMIT & DEFINITION OF DONE

### 6.1 Files Changed Summary

| File | Phase | Action |
|------|-------|--------|
| `src/lib/engine/canonical-cost.ts` | 13.1 | ADD BatchProfile type + BATCH_PROFILES config, generaliseer assertJointProduct + isJointProduct + calculateSVASOAllocation |
| `src/lib/engine/canonical-cost.test.ts` | 13.1 | UPDATE scope test, ADD BatchProfile tests + external SVASO test |
| `src/lib/data/batch-input-store.ts` | 13.2 | ADD batch_profile + joint_products + selling_prices to interface, ADD createCunoBatch(), UPDATE computeDerivedValues + store init |
| `src/lib/data/batch-engine-bridge.ts` | 13.3 | ADD externalBatchToJointProducts + externalBatchToByProducts, UPDATE runBatchPipeline with profile routing |
| `src/components/oil/batch-input/BatchInputForm.tsx` | 13.4 | ADD profile selector, dynamic product table for external, conditional sections |
| `src/components/oil/batch-input/BatchDetailShell.tsx` | 13.4 | ADD Marge tab (conditional on external profile) |
| `src/components/oil/batch-input/MarginAnalysis.tsx` | 13.4 | NEW — margin table + summary cards |
| `src/components/oil/batch-input/MassBalancePanel.tsx` | 13.4 | UPDATE to support dynamic products |

### 6.2 MUST NOT have changed

- SVASO wiskundige kern (k-factor, allocation_factor, Decimal.js, rounding residual)
- `supabase/**`
- Bestaande batch-input routes
- `internal` profiel default gedrag

### 6.3 Commit

```bash
git add \
  src/lib/engine/canonical-cost.ts \
  src/lib/engine/canonical-cost.test.ts \
  src/lib/data/batch-input-store.ts \
  src/lib/data/batch-engine-bridge.ts \
  src/components/oil/batch-input/BatchInputForm.tsx \
  src/components/oil/batch-input/BatchDetailShell.tsx \
  src/components/oil/batch-input/MarginAnalysis.tsx \
  src/components/oil/batch-input/MassBalancePanel.tsx

git commit -m "Sprint 13: External processor via SVASO profiles — Cuno Moormann support

- Add BatchProfile type: configurable joint product codes per batch
- Generalize assertJointProduct/isJointProduct/calculateSVASOAllocation with optional profile
- Add external_cuno profile (filet_supreme, drumsticks, dijfilet_vel, platte_vleugels)
- Add prefilled CUNO-2025-11-24 batch with real pakbon data
- Profile-aware pipeline routing in batch-engine-bridge
- Dynamic product table in BatchInputForm for external profiles
- New MarginAnalysis component with per-product margin table
- SVASO math core unchanged — only scope enforcement generalized
- No regression on VALIDATIE batch or existing tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 7. WHAT IS NOT IN SPRINT 13 (deferred)

| Item | Deferred to | Reason |
|------|-------------|--------|
| Snijkosten als L5 ABC per product | Sprint 14 | Nu simpel additief, later ABC-drivers |
| Multiple external processors | Sprint 14+ | Start met 1 (Cuno), valideer met users |
| Selling price marktdata import | Sprint 9 (data import) | Handmatig invoeren is voldoende v1 |
| Scenario's op external batches | Sprint 11+ | Sandbox nog niet profiel-aware |
| PDF pakbon parser | Sprint 9 | Handmatige invoer eerst |
| Karkassen verkoopprijs tracking | Sprint 14 | "Wisselend" — user moet dit definiëren |
