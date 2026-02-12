/**
 * Phase 2 — Demo/Validation Data for 7-Level Cost Waterfall
 *
 * Uses NEW canon types (Phase 1 engine).
 * All values are explicitly documented assumptions for demo/validation.
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
} from '@/lib/engine/canonical-cost';

// ============================================================================
// MASS BALANCE THRESHOLDS (hardcoded per v3)
// ============================================================================

/** Deviation <= 3% = green (OK) */
export const MB_GREEN_THRESHOLD = 0.03;
/** Deviation > 3% and <= 7.5% = yellow (warning, allowed) */
export const MB_WARN_THRESHOLD = 0.075;
/** Deviation > 7.5% = red (blocked, unless admin override) */
export const MB_BLOCK_THRESHOLD = 0.075;

export type MassBalanceStatus = 'green' | 'yellow' | 'red';

export function getMassBalanceStatus(deviationPct: number): MassBalanceStatus {
  if (deviationPct <= MB_GREEN_THRESHOLD * 100) return 'green';
  if (deviationPct <= MB_BLOCK_THRESHOLD * 100) return 'yellow';
  return 'red';
}

// ============================================================================
// LEVEL 0: LANDED COST INPUT
// ============================================================================

export const DEMO_BATCH: LandedCostInput = {
  batch_id: 'DEMO-V2-001',
  input_live_kg: 10000,
  input_count: 5000,
  live_price_per_kg: 2.60,
  transport_cost_eur: 382,        // €0.0764 × 5000 birds
  catching_fee_eur: 150,
  slaughter_fee_per_head: 0.28,
  doa_count: 50,                  // 1% mortality
  doa_threshold_pct: 0.02,        // 2% threshold
};

export const DEMO_BATCH_REF = 'DEMO-V2-001';
export const DEMO_BATCH_DATE = '2025-01-20';

// ============================================================================
// LEVEL 1: SLAUGHTER
// ============================================================================

export const DEMO_SLAUGHTER_FEE_EUR = 1400; // 5000 × €0.28
export const DEMO_GRILLER_WEIGHT_KG = 6965; // ~70.5% of 9900 usable

// ============================================================================
// LEVEL 2: BY-PRODUCTS
// ============================================================================

export const DEMO_BY_PRODUCTS: ByProductPhysical[] = [
  { id: 'blood',    type: 'blood',         weight_kg: 270 },
  { id: 'feathers', type: 'feathers',      weight_kg: 470 },
  { id: 'offal',    type: 'offal',         weight_kg: 350 },
  { id: 'back',     type: 'back_carcass',  weight_kg: 798 },
];

// ============================================================================
// LEVEL 3: JOINT PRODUCTS (SVASO)
// ============================================================================

export const DEMO_JOINT_PRODUCTS: JointProductInput[] = [
  { part_code: 'breast_cap', weight_kg: 2443, shadow_price_per_kg: 9.50 },
  { part_code: 'legs',       weight_kg: 3010, shadow_price_per_kg: 5.50 },
  { part_code: 'wings',      weight_kg: 749,  shadow_price_per_kg: 4.50 },
];

// ============================================================================
// LEVEL 4: MINI-SVASO SUB-CUTS
// ============================================================================

export const DEMO_SUB_CUTS: Record<JointProductCode, SubJointCutInput[]> = {
  breast_cap: [
    {
      parent_joint_code: 'breast_cap',
      sub_cut_code: 'filet',
      weight_kg: 2443,    // 100% of breast_cap
      shadow_price_per_kg: 9.50,
    },
  ],
  legs: [
    {
      parent_joint_code: 'legs',
      sub_cut_code: 'thigh_fillet',
      weight_kg: 1800,
      shadow_price_per_kg: 7.00,
    },
    {
      parent_joint_code: 'legs',
      sub_cut_code: 'drum_meat',
      weight_kg: 1050,
      shadow_price_per_kg: 4.00,
    },
  ],
  wings: [
    {
      parent_joint_code: 'wings',
      sub_cut_code: 'whole_wing',
      weight_kg: 749,     // 100% of wings
      shadow_price_per_kg: 4.50,
    },
  ],
};

// ============================================================================
// LEVEL 5: ABC COST DRIVERS
// ============================================================================

export const DEMO_ABC_DRIVERS: ABCCostDriver[] = [
  {
    driver_code: 'vacuum_sealing',
    driver_name: 'Vacuümverpakking',
    rate_per_unit: 0.08,
    units_consumed: 120,
  },
  {
    driver_code: 'labeling',
    driver_name: 'Etikettering',
    rate_per_unit: 0.03,
    units_consumed: 120,
  },
  {
    driver_code: 'quality_check',
    driver_name: 'Kwaliteitscontrole',
    rate_per_unit: 0.15,
    units_consumed: 10,   // per batch sample
  },
];

// ============================================================================
// LEVEL 6: SKU DEFINITION
// ============================================================================

export const DEMO_SKU: SkuDefinition = {
  sku_code: 'FILET-500G',
  source_product_code: 'filet',
  meat_content_kg: 0.50,
  packaging_cost_eur: 0.12,
  abc_drivers: DEMO_ABC_DRIVERS,
  weight_type: 'fixed',
  label_weight_kg: 0.500,
  actual_fill_weight_kg: 0.510, // 2% giveaway
};

// ============================================================================
// LEVEL 7: NRV INPUT
// ============================================================================

export const DEMO_NRV_INPUT: NRVInput = {
  product_code: 'filet',
  selling_price_per_kg: 12.50,
  completion_cost_per_kg: 0.30,
  selling_cost_per_kg: 0.45,
};

// ============================================================================
// EXTRA BEWERKING (Scenario demo)
// ============================================================================

export interface ExtraBewerkingInput {
  id: string;
  input_sku_codes: string[];
  operation_type: 'extern_verpakken' | 'malen' | 'worstmaken' | 'overig';
  operation_label: string;
  cost_per_kg_eur: number;
  cost_per_batch_eur: number;
  yield_pct: number;
  output_sku_code: string;
  output_selling_price_per_kg: number;
}

export const DEMO_EXTRA_BEWERKING: ExtraBewerkingInput = {
  id: 'EB-001',
  input_sku_codes: ['FILET-500G'],
  operation_type: 'extern_verpakken',
  operation_label: 'Extern verpakken (MAP-tray)',
  cost_per_kg_eur: 0.85,
  cost_per_batch_eur: 25.00,
  yield_pct: 97,       // 3% loss in repack
  output_sku_code: 'FILET-MAP-500G',
  output_selling_price_per_kg: 14.20,
};

// ============================================================================
// ADMIN OVERRIDE TYPES
// ============================================================================

export interface OverrideEvent {
  timestamp: string;        // ISO 8601
  batch_id: string;
  deviation_pct: number;
  reason: string;
  duration: '1h' | '4h' | 'end_of_day';
  expires_at: string;       // ISO 8601
  user: string;             // placeholder 'admin' until auth
}

export const OVERRIDE_STORAGE_KEY = 'oil_mass_balance_overrides';

// ============================================================================
// PART NAME HELPERS (Dutch)
// ============================================================================

export function getPartNameDutch(partCode: string): string {
  const names: Record<string, string> = {
    breast_cap: 'Borstlap',
    legs: 'Poot',
    wings: 'Vleugels',
    filet: 'Filet',
    thigh_fillet: 'Dijfilet',
    drum_meat: 'Drumvlees',
    whole_wing: 'Hele vleugel',
    back_carcass: 'Rug/karkas',
    blood: 'Bloed',
    feathers: 'Veren',
    offal: 'Organen',
  };
  return names[partCode] || partCode;
}

export function getOperationLabel(type: ExtraBewerkingInput['operation_type']): string {
  const labels: Record<string, string> = {
    extern_verpakken: 'Extern verpakken',
    malen: 'Malen',
    worstmaken: 'Worstmaken',
    overig: 'Overig',
  };
  return labels[type] || type;
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatEur(value: number): string {
  return `\u20AC${value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatEurPerKg(value: number): string {
  return `\u20AC${value.toLocaleString('nl-NL', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}/kg`;
}

export function formatKg(value: number): string {
  return `${value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg`;
}

export function formatPct(value: number): string {
  return `${value.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function formatDelta(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}\u20AC${value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDeltaPerKg(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}\u20AC${value.toLocaleString('nl-NL', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}/kg`;
}
