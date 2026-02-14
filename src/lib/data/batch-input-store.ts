/**
 * Batch Input Store — In-memory storage for batch input data
 *
 * Route 1: Handmatige invoer.
 * Alleen kilo's en aantallen (FEITEN). Geen percentages.
 * Rendementen zijn afgeleid en read-only.
 *
 * NO DB COUPLING — pure in-memory for v1.
 * NO ENGINE MODIFICATIONS — engine is LOCKED.
 */

import type {
  LandedCostInput,
  ByProductPhysical,
  JointProductInput,
  SubJointCutInput,
  ABCCostDriver,
  SkuDefinition,
  NRVInput,
  JointProductCode,
  BatchProfile,
} from '@/lib/engine/canonical-cost';
import {
  PROFILE_ORANJEHOEN,
  getBatchProfile,
} from '@/lib/engine/canonical-cost';
import type { MassBalanceStatus } from '@/lib/data/demo-batch-v2';
import { getMassBalanceStatus } from '@/lib/data/demo-batch-v2';

// ============================================================================
// BATCH INPUT TYPE — FEITEN (kg + stuks only)
// ============================================================================

/**
 * Joint product entry for external profiles.
 * Stores part_code, weight, shadow price and optional selling price.
 */
export interface JointProductEntry {
  part_code: string;
  weight_kg: number;
  shadow_price_per_kg: number;
  /** Verkoopprijs per kg — voor marge-analyse */
  selling_price_per_kg?: number;
}

export interface BatchInputData {
  // Identity
  batch_id: string;
  batch_ref: string;
  date: string;

  // PROFIEL (Sprint 13) — default 'oranjehoen'
  batch_profile: string;

  // SECTIE 1: Basis (Level 0)
  bird_count: number;
  doa_count: number;
  live_weight_kg: number;

  // SECTIE 2: Slacht & Griller (Level 1)
  griller_weight_kg: number;
  slaughter_cost_mode: 'per_bird' | 'total';
  slaughter_cost_per_bird: number;
  slaughter_cost_total: number;

  // SECTIE 3: Joint Products (Level 3 Input) — kg only
  // Used by ORANJEHOEN profile (fixed 3 products)
  breast_cap_kg: number;
  legs_kg: number;
  wings_kg: number;

  // SECTIE 3b: Dynamic Joint Products (Sprint 13)
  // Used by external profiles (variable products + selling prices)
  joint_products: JointProductEntry[];

  // SECTIE 4: Sub-cuts (Level 4 Input) — kg only
  filet_kg: number;           // from breast_cap
  thigh_fillet_kg: number;    // from legs
  drum_meat_kg: number;       // from legs

  // SECTIE 5: By-products (Level 2 Input) — kg only
  blood_kg: number;
  feathers_kg: number;
  offal_kg: number;
  back_carcass_kg: number;
  cat3_other_kg: number;

  // SECTIE 6: Kosten
  live_cost_per_kg: number;
  transport_cost_eur: number;
  catching_fee_eur: number;
}

// ============================================================================
// DERIVED VALUES (read-only, computed from input)
// ============================================================================

export interface BatchDerivedValues {
  // Sectie 1
  avg_bird_weight_kg: number;
  doa_pct: number;

  // Sectie 2
  griller_yield_pct: number;
  slaughter_fee_eur: number;

  // Sectie 3
  joint_total_kg: number;
  breast_cap_pct: number;
  legs_pct: number;
  wings_pct: number;

  // Sectie 4
  breast_rest_trim_kg: number;
  filet_pct_of_breast: number;
  legs_rest_trim_kg: number;
  thigh_pct_of_legs: number;
  drum_pct_of_legs: number;

  // Sectie 5
  by_product_total_kg: number;
  by_product_credit_eur: number;

  // Mass balance
  mass_balance_output_kg: number;
  mass_balance_deviation_pct: number;
  mass_balance_status: MassBalanceStatus;
}

// ============================================================================
// COMPUTATION FUNCTIONS (pure, no side effects)
// ============================================================================

export function computeDerivedValues(input: BatchInputData): BatchDerivedValues {
  const isExternal = input.batch_profile !== 'oranjehoen' && input.joint_products.length > 0;

  // Sectie 1
  const avg_bird_weight_kg = input.bird_count > 0 ? input.live_weight_kg / input.bird_count : 0;
  const doa_pct = input.bird_count > 0 ? (input.doa_count / input.bird_count) * 100 : 0;

  // Sectie 2
  const griller_yield_pct = input.live_weight_kg > 0
    ? (input.griller_weight_kg / input.live_weight_kg) * 100
    : 0;
  const slaughter_fee_eur = input.slaughter_cost_mode === 'per_bird'
    ? input.slaughter_cost_per_bird * input.bird_count
    : input.slaughter_cost_total;

  // Sectie 3 — use dynamic joint_products for external profiles
  const joint_total_kg = isExternal
    ? input.joint_products.reduce((s, jp) => s + jp.weight_kg, 0)
    : input.breast_cap_kg + input.legs_kg + input.wings_kg;
  const breast_cap_pct = input.griller_weight_kg > 0 ? (input.breast_cap_kg / input.griller_weight_kg) * 100 : 0;
  const legs_pct = input.griller_weight_kg > 0 ? (input.legs_kg / input.griller_weight_kg) * 100 : 0;
  const wings_pct = input.griller_weight_kg > 0 ? (input.wings_kg / input.griller_weight_kg) * 100 : 0;

  // Sectie 4
  const breast_rest_trim_kg = Math.max(0, input.breast_cap_kg - input.filet_kg);
  const filet_pct_of_breast = input.breast_cap_kg > 0 ? (input.filet_kg / input.breast_cap_kg) * 100 : 0;
  const legs_rest_trim_kg = Math.max(0, input.legs_kg - input.thigh_fillet_kg - input.drum_meat_kg);
  const thigh_pct_of_legs = input.legs_kg > 0 ? (input.thigh_fillet_kg / input.legs_kg) * 100 : 0;
  const drum_pct_of_legs = input.legs_kg > 0 ? (input.drum_meat_kg / input.legs_kg) * 100 : 0;

  // Sectie 5
  const by_product_total_kg = input.blood_kg + input.feathers_kg + input.offal_kg
    + input.back_carcass_kg + input.cat3_other_kg;
  const by_product_credit_eur = by_product_total_kg * 0.20; // flat €0.20/kg per CANON

  // Mass balance
  const mass_balance_output_kg = joint_total_kg + by_product_total_kg;
  const mass_balance_deviation_pct = input.griller_weight_kg > 0
    ? Math.abs(mass_balance_output_kg - input.griller_weight_kg) / input.griller_weight_kg * 100
    : 0;
  const mass_balance_status = getMassBalanceStatus(mass_balance_deviation_pct);

  return {
    avg_bird_weight_kg,
    doa_pct,
    griller_yield_pct,
    slaughter_fee_eur,
    joint_total_kg,
    breast_cap_pct,
    legs_pct,
    wings_pct,
    breast_rest_trim_kg,
    filet_pct_of_breast,
    legs_rest_trim_kg,
    thigh_pct_of_legs,
    drum_pct_of_legs,
    by_product_total_kg,
    by_product_credit_eur,
    mass_balance_output_kg,
    mass_balance_deviation_pct,
    mass_balance_status,
  };
}

// ============================================================================
// BATCH → ENGINE BRIDGE (converts input to engine-compatible types)
// ============================================================================

/**
 * Shadow prices are hardcoded reference prices for SVASO allocation.
 * In production these would come from market data / configuration.
 * For Validatiegolf 1 we use the same reference prices as demo-batch-v2.
 */
const DEFAULT_SHADOW_PRICES: Record<string, number> = {
  breast_cap: 9.50,
  legs: 5.50,
  wings: 4.50,
  filet: 9.50,
  thigh_fillet: 7.00,
  drum_meat: 4.00,
  whole_wing: 4.50,
};

export function batchInputToLandedCost(input: BatchInputData): LandedCostInput {
  return {
    batch_id: input.batch_id,
    input_live_kg: input.live_weight_kg,
    input_count: input.bird_count,
    live_price_per_kg: input.live_cost_per_kg,
    transport_cost_eur: input.transport_cost_eur,
    catching_fee_eur: input.catching_fee_eur,
    slaughter_fee_per_head: input.slaughter_cost_mode === 'per_bird'
      ? input.slaughter_cost_per_bird
      : (input.bird_count > 0 ? input.slaughter_cost_total / input.bird_count : 0),
    doa_count: input.doa_count,
    doa_threshold_pct: 0.02, // 2% standard threshold
  };
}

export function batchInputToSlaughterFee(input: BatchInputData): number {
  return input.slaughter_cost_mode === 'per_bird'
    ? input.slaughter_cost_per_bird * input.bird_count
    : input.slaughter_cost_total;
}

export function batchInputToByProducts(input: BatchInputData): ByProductPhysical[] {
  const products: ByProductPhysical[] = [];

  if (input.blood_kg > 0) products.push({ id: 'blood', type: 'blood', weight_kg: input.blood_kg });
  if (input.feathers_kg > 0) products.push({ id: 'feathers', type: 'feathers', weight_kg: input.feathers_kg });
  if (input.offal_kg > 0) products.push({ id: 'offal', type: 'offal', weight_kg: input.offal_kg });
  if (input.back_carcass_kg > 0) products.push({ id: 'back', type: 'back_carcass', weight_kg: input.back_carcass_kg });
  if (input.cat3_other_kg > 0) products.push({ id: 'cat3', type: 'cat3_waste', weight_kg: input.cat3_other_kg });

  return products;
}

export function batchInputToJointProducts(input: BatchInputData): JointProductInput[] {
  // External profiles: use dynamic joint_products array
  if (input.batch_profile !== 'oranjehoen' && input.joint_products.length > 0) {
    return input.joint_products.map(jp => ({
      part_code: jp.part_code,
      weight_kg: jp.weight_kg,
      shadow_price_per_kg: jp.shadow_price_per_kg,
    }));
  }

  // Default ORANJEHOEN: fixed 3 joint products from named fields
  return [
    { part_code: 'breast_cap' as JointProductCode, weight_kg: input.breast_cap_kg, shadow_price_per_kg: DEFAULT_SHADOW_PRICES.breast_cap },
    { part_code: 'legs' as JointProductCode, weight_kg: input.legs_kg, shadow_price_per_kg: DEFAULT_SHADOW_PRICES.legs },
    { part_code: 'wings' as JointProductCode, weight_kg: input.wings_kg, shadow_price_per_kg: DEFAULT_SHADOW_PRICES.wings },
  ];
}

export function batchInputToSubCuts(input: BatchInputData): Record<string, SubJointCutInput[]> {
  return {
    breast_cap: [
      {
        parent_joint_code: 'breast_cap' as JointProductCode,
        sub_cut_code: 'filet',
        weight_kg: input.filet_kg,
        shadow_price_per_kg: DEFAULT_SHADOW_PRICES.filet,
      },
    ],
    legs: [
      {
        parent_joint_code: 'legs' as JointProductCode,
        sub_cut_code: 'thigh_fillet',
        weight_kg: input.thigh_fillet_kg,
        shadow_price_per_kg: DEFAULT_SHADOW_PRICES.thigh_fillet,
      },
      {
        parent_joint_code: 'legs' as JointProductCode,
        sub_cut_code: 'drum_meat',
        weight_kg: input.drum_meat_kg,
        shadow_price_per_kg: DEFAULT_SHADOW_PRICES.drum_meat,
      },
    ],
    wings: [
      {
        parent_joint_code: 'wings' as JointProductCode,
        sub_cut_code: 'whole_wing',
        weight_kg: input.wings_kg,
        shadow_price_per_kg: DEFAULT_SHADOW_PRICES.whole_wing,
      },
    ],
  };
}

/**
 * Default ABC drivers for Validatiegolf 1.
 * Same as demo-batch-v2 until configurable.
 */
export function getDefaultABCDrivers(): ABCCostDriver[] {
  return [
    { driver_code: 'vacuum_sealing', driver_name: 'Vacuümverpakking', rate_per_unit: 0.08, units_consumed: 120 },
    { driver_code: 'labeling', driver_name: 'Etikettering', rate_per_unit: 0.03, units_consumed: 120 },
    { driver_code: 'quality_check', driver_name: 'Kwaliteitscontrole', rate_per_unit: 0.15, units_consumed: 10 },
  ];
}

export function getDefaultSkuDefinition(): SkuDefinition {
  return {
    sku_code: 'FILET-500G',
    source_product_code: 'filet',
    meat_content_kg: 0.50,
    packaging_cost_eur: 0.12,
    abc_drivers: getDefaultABCDrivers(),
    weight_type: 'fixed',
    label_weight_kg: 0.500,
    actual_fill_weight_kg: 0.510,
  };
}

export function getDefaultNRVInput(): NRVInput {
  return {
    product_code: 'filet',
    selling_price_per_kg: 12.50,
    completion_cost_per_kg: 0.30,
    selling_cost_per_kg: 0.45,
  };
}

// ============================================================================
// IN-MEMORY BATCH STORE
// ============================================================================

const batchStore = new Map<string, BatchInputData>();

export function saveBatch(input: BatchInputData): void {
  batchStore.set(input.batch_id, { ...input });
}

export function getBatch(batchId: string): BatchInputData | undefined {
  return batchStore.get(batchId);
}

export function getAllBatches(): BatchInputData[] {
  return Array.from(batchStore.values());
}

export function deleteBatch(batchId: string): boolean {
  return batchStore.delete(batchId);
}

// ============================================================================
// VALIDATIEGOLF 1 — PREFILLED BATCH
// ============================================================================

/**
 * Validatiegolf 1 batch: "VALIDATIE-2025-09-22"
 *
 * EXACT INPUTS (per opdracht):
 * - 15.855 kippen, 38.980 kg levend, 28.056 kg griller
 * - Live cost: €2,40/kg
 * - Slachtkosten: €0,83/kip
 *
 * Joint yields (% van griller → kg):
 * - Borstkap: 36,6% × 28.056 = 10.268,496 → afgerond 10.268,50 kg
 * - Bouten:   43,56% × 28.056 = 12.221,194 → afgerond 12.221,19 kg
 * - Vleugels:  9,2% × 28.056 = 2.581,152 → afgerond 2.581,15 kg
 *
 * Sub-cuts:
 * - Filet: 68% × 10.268,50 = 6.982,58 kg
 * - Dijfilet: 0,471 × 0,625 × 12.221,19 = 0,294375 × 12.221,19 = 3.597,49 kg
 * - Drumvlees: 0,5187 × 0,625 × 12.221,19 = 0,3241875 × 12.221,19 = 3.962,07 kg
 *
 * By-products (aannames voor massabalans ≤7,5%):
 * - Joint total = 10.268,50 + 12.221,19 + 2.581,15 = 25.070,84 kg
 * - Griller = 28.056 kg
 * - Nodig voor 0% afwijking: 28.056 - 25.070,84 = 2.985,16 kg by-products
 * - Verdeling (realistische aannames):
 *   - Bloed: ~3,5% van levend = 1.364 kg
 *   → Maar bloed is by-product van slacht, niet van griller
 *   → By-products hier = van griller naar onderdelen
 *   - Rug/karkas: 1.800 kg (typisch ~6,4% van griller)
 *   - Organen: 700 kg (~2,5% van griller)
 *   - Veren: 0 kg (al verwijderd voor griller)
 *   - Bloed: 0 kg (al verwijderd voor griller)
 *   - Cat3/overig: 485,16 kg (rest voor balans)
 * - Totaal by-products: 2.985,16 kg → afwijking = 0%
 */
export function createValidatiegolf1Batch(): BatchInputData {
  // Joint products (exact from % × griller)
  const griller = 28056;
  const breast_cap_kg = Math.round(0.366 * griller * 100) / 100;   // 10268.50
  const legs_kg = Math.round(0.4356 * griller * 100) / 100;        // 12221.19
  const wings_kg = Math.round(0.092 * griller * 100) / 100;        // 2581.15

  // Sub-cuts
  const filet_kg = Math.round(0.68 * breast_cap_kg * 100) / 100;   // 6982.58
  const thigh_fillet_kg = Math.round(0.471 * 0.625 * legs_kg * 100) / 100; // 3597.49
  const drum_meat_kg = Math.round(0.5187 * 0.625 * legs_kg * 100) / 100;   // 3962.07

  // By-products to achieve 0% mass balance deviation
  const joint_total = breast_cap_kg + legs_kg + wings_kg;
  const needed_by_products = griller - joint_total;

  // Realistic distribution of by-products (from griller to parts):
  const back_carcass_kg = 1800;
  const offal_kg = 700;
  const cat3_other_kg = Math.round((needed_by_products - back_carcass_kg - offal_kg) * 100) / 100;

  return {
    batch_id: 'VALIDATIE-2025-09-22',
    batch_ref: 'VALIDATIE-2025-09-22',
    date: '2025-09-22',
    batch_profile: 'oranjehoen',

    bird_count: 15855,
    doa_count: 0,
    live_weight_kg: 38980,

    griller_weight_kg: griller,
    slaughter_cost_mode: 'per_bird',
    slaughter_cost_per_bird: 0.83,
    slaughter_cost_total: 0,

    breast_cap_kg,
    legs_kg,
    wings_kg,

    joint_products: [], // ORANJEHOEN uses named fields above

    filet_kg,
    thigh_fillet_kg,
    drum_meat_kg,

    blood_kg: 0,       // Already removed before griller stage
    feathers_kg: 0,    // Already removed before griller stage
    offal_kg,
    back_carcass_kg,
    cat3_other_kg,

    live_cost_per_kg: 2.40,
    transport_cost_eur: 0,
    catching_fee_eur: 0,
  };
}

// ============================================================================
// CUNO MOORMANN — PREFILLED EXTERNAL BATCH (Sprint 13)
// ============================================================================

/**
 * Cuno Moormann batch: externe verwerker — ECHTE PAKBON DATA
 *
 * Bron: Storteboom pakbon PLU 400577 (BLK1Ster OH Naakt vrs 8×1700-1800)
 * 128 kratten × 8 = ~1024 grillers, netto 1.793,5 kg
 *
 * Productieketen:
 * - Levende kippen: €2,50/kg levend
 * - Slachtrendement: 72% → levend gewicht = 1.793,5 / 0,72 = 2.490,97 kg
 * - Slachtkosten: €0,89/kip × 1.024 = €911,36
 * - Grillers naar Cuno Moormann voor uitsnij
 *
 * Uitsnijresultaten (Cuno factuur — snijkosten €2,00/stuk = €2.048 totaal):
 * - Filet Suprêmes:    621,64 kg (snij €1,29/kg = €801,92)
 * - Drumsticks:        253,50 kg (snij €1,98/kg = €501,93)
 * - Dijfilet met vel:  252,00 kg (snij €1,98/kg = €498,96)
 * - Platte vleugels:    79,27 kg (snij €1,98/kg = €156,95)
 * - Karkassen:         570,00 kg (by-product, €0,75/kg = €427,50)
 *
 * Verkoopprijzen:
 * - Filet Suprêmes:    €15,35/kg
 * - Drumsticks:         €8,00/kg
 * - Dijfilet met vel:  €15,00/kg
 * - Platte vleugels:    €6,00/kg
 * - Karkassen: wisselend (niet in marge)
 *
 * Massabalans: joint (1.206,41) + by-product (570) = 1.776,41 kg
 *              vs griller 1.793,5 kg → 17,09 kg verschil (0,95%)
 *
 * Verwachte SVASO (shadow = VP):
 * - TMV = €15.825,79
 * - k-factor = €7.024,79 / €15.825,79 = 0,444 → PROFITABLE
 */
export function createCunoMoormannBatch(): BatchInputData {
  const griller_kg = 1793.5;
  const rendement = 0.72;
  const live_weight_kg = Math.round((griller_kg / rendement) * 100) / 100; // 2490.97
  const bird_count = 1024; // 128 kratten × 8

  return {
    batch_id: 'CUNO-2025-11-24',
    batch_ref: 'CUNO-2025-11-24',
    date: '2025-11-24',
    batch_profile: 'cuno_moormann',

    // Basis — echte pakbon: 1024 kippen, terug-gerekend naar levend
    bird_count,
    doa_count: 0,
    live_weight_kg,

    // Griller output = netto pakbon gewicht
    griller_weight_kg: griller_kg,
    slaughter_cost_mode: 'per_bird',
    slaughter_cost_per_bird: 0.89,
    slaughter_cost_total: 0,

    // ORANJEHOEN fields — niet gebruikt bij external profile
    breast_cap_kg: 0,
    legs_kg: 0,
    wings_kg: 0,

    // Dynamic joint products — echte Cuno uitsnijdata
    // Shadow prices = verkoopprijzen (voor SVASO allocatie op marktwaarde)
    joint_products: [
      {
        part_code: 'filet_supremes',
        weight_kg: 621.64,
        shadow_price_per_kg: 15.35,
        selling_price_per_kg: 15.35,
      },
      {
        part_code: 'drumsticks',
        weight_kg: 253.50,
        shadow_price_per_kg: 8.00,
        selling_price_per_kg: 8.00,
      },
      {
        part_code: 'dijfilet_vel',
        weight_kg: 252.00,
        shadow_price_per_kg: 15.00,
        selling_price_per_kg: 15.00,
      },
      {
        part_code: 'platte_vleugels',
        weight_kg: 79.27,
        shadow_price_per_kg: 6.00,
        selling_price_per_kg: 6.00,
      },
    ],

    // Sub-cuts — niet van toepassing bij externe verwerker
    filet_kg: 0,
    thigh_fillet_kg: 0,
    drum_meat_kg: 0,

    // By-products — karkassen (€0,20/kg standaard credit in engine)
    blood_kg: 0,
    feathers_kg: 0,
    offal_kg: 0,
    back_carcass_kg: 570,   // karkassen van uitsnij
    cat3_other_kg: 0,

    // Kosten
    live_cost_per_kg: 2.50,
    transport_cost_eur: 0,
    catching_fee_eur: 0,
  };
}

// Initialize store with prefilled batches
const validatieBatch = createValidatiegolf1Batch();
saveBatch(validatieBatch);

const cunoBatch = createCunoMoormannBatch();
saveBatch(cunoBatch);
