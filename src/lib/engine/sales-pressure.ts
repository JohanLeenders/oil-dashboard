/**
 * Sales Pressure Engine — Sprint 3
 *
 * OBSERVATIONAL ONLY - no actions, no advice, no optimization
 *
 * Key Metrics:
 * - DSI (Days Sales Inventory) = inventory / avg_daily_sales
 * - Pressure Flag: green (<14d), orange (14-28d), red (>28d)
 * - THT Risk: overlay of shelf life pressure
 *
 * Sprint 3 Contract:
 * - Signaleert spanningen
 * - Maakt zichtbaar waar actie nodig is
 * - Stuurt NIET
 * - Geen prijsadvies
 * - Geen automatische optimalisatie
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Pressure flag values
 */
export type PressureFlag = 'green' | 'orange' | 'red' | 'no_stock' | 'no_velocity';

/**
 * Velocity trend values
 */
export type VelocityTrend = 'ACCELERATING' | 'DECELERATING' | 'STABLE' | 'NO_DATA';

/**
 * Inventory input for pressure calculation
 */
export interface InventoryInput {
  part_code: string;
  inventory_kg: number;
  batch_count: number;
}

/**
 * Velocity input for pressure calculation
 */
export interface VelocityInput {
  part_code: string;
  avg_daily_sales_kg: number;
  avg_daily_sales_7d_kg?: number;
  velocity_trend?: VelocityTrend;
}

/**
 * THT (shelf life) risk input
 */
export interface ThtRiskInput {
  part_code: string;
  batches_red: number;
  batches_orange: number;
  batches_green: number;
}

/**
 * Pressure calculation result
 */
export interface PressureResult {
  part_code: string;
  inventory_kg: number;
  batch_count: number;
  avg_daily_sales_kg: number;
  days_sales_inventory: number | null;
  pressure_flag: PressureFlag;
  velocity_trend: VelocityTrend;
  tht_risk: {
    batches_red: number;
    batches_orange: number;
    batches_green: number;
    has_urgent_tht: boolean;
  };
  explanation: string;
  data_status: 'OK' | 'NO_DATA' | 'NO_INVENTORY_DATA' | 'NO_VELOCITY_DATA';
}

/**
 * Pressure thresholds (configurable but locked per Sprint 3)
 */
export interface PressureThresholds {
  /** DSI below this = green (fast moving) */
  green_max_days: number;
  /** DSI below this = orange, above = red */
  orange_max_days: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default pressure thresholds
 * Per Sprint 3 contract - these are LOCKED
 */
export const DEFAULT_PRESSURE_THRESHOLDS: PressureThresholds = {
  green_max_days: 14,
  orange_max_days: 28,
};

// ============================================================================
// CORE ENGINE
// ============================================================================

/**
 * Calculate DSI (Days Sales Inventory)
 *
 * DSI = inventory / avg_daily_sales
 *
 * Returns null if velocity is zero or undefined
 */
export function calculateDsi(
  inventory_kg: number,
  avg_daily_sales_kg: number
): number | null {
  if (avg_daily_sales_kg <= 0) {
    return null;
  }
  return inventory_kg / avg_daily_sales_kg;
}

/**
 * Determine pressure flag from DSI
 */
export function getPressureFlag(
  inventory_kg: number,
  dsi: number | null,
  thresholds: PressureThresholds = DEFAULT_PRESSURE_THRESHOLDS
): PressureFlag {
  if (inventory_kg <= 0) {
    return 'no_stock';
  }

  if (dsi === null) {
    return 'no_velocity';
  }

  if (dsi < thresholds.green_max_days) {
    return 'green';
  }

  if (dsi < thresholds.orange_max_days) {
    return 'orange';
  }

  return 'red';
}

/**
 * Generate pressure explanation (Dutch per Sprint 3)
 */
export function generatePressureExplanation(
  inventory_kg: number,
  dsi: number | null,
  pressure_flag: PressureFlag
): string {
  if (pressure_flag === 'no_stock') {
    return 'Geen voorraad beschikbaar.';
  }

  if (pressure_flag === 'no_velocity') {
    return 'Geen verkoopdata beschikbaar voor berekening verkoopdruk.';
  }

  const daysText = dsi !== null ? Math.round(dsi).toString() : '?';

  switch (pressure_flag) {
    case 'green':
      return `Normale voorraaddruk. Voorraad reikt ca. ${daysText} dagen bij huidig tempo.`;
    case 'orange':
      return `Verhoogde voorraaddruk. Voorraad reikt ca. ${daysText} dagen. Let op THT-risico.`;
    case 'red':
      return `Hoge voorraaddruk! Voorraad reikt ca. ${daysText} dagen. Actie vereist.`;
    default:
      return `Voorraad reikt ca. ${daysText} dagen.`;
  }
}

/**
 * Calculate pressure for a single part
 */
export function calculatePartPressure(
  inventory: InventoryInput,
  velocity: VelocityInput | null,
  thtRisk: ThtRiskInput | null,
  thresholds: PressureThresholds = DEFAULT_PRESSURE_THRESHOLDS
): PressureResult {
  const avg_daily_sales_kg = velocity?.avg_daily_sales_kg ?? 0;
  const dsi = calculateDsi(inventory.inventory_kg, avg_daily_sales_kg);
  const pressure_flag = getPressureFlag(inventory.inventory_kg, dsi, thresholds);
  const explanation = generatePressureExplanation(inventory.inventory_kg, dsi, pressure_flag);

  // Determine data status
  let data_status: PressureResult['data_status'] = 'OK';
  if (inventory.inventory_kg <= 0 && avg_daily_sales_kg <= 0) {
    data_status = 'NO_DATA';
  } else if (inventory.inventory_kg <= 0) {
    data_status = 'NO_INVENTORY_DATA';
  } else if (avg_daily_sales_kg <= 0) {
    data_status = 'NO_VELOCITY_DATA';
  }

  return {
    part_code: inventory.part_code,
    inventory_kg: inventory.inventory_kg,
    batch_count: inventory.batch_count,
    avg_daily_sales_kg,
    days_sales_inventory: dsi !== null ? Math.round(dsi * 10) / 10 : null,
    pressure_flag,
    velocity_trend: velocity?.velocity_trend ?? 'NO_DATA',
    tht_risk: {
      batches_red: thtRisk?.batches_red ?? 0,
      batches_orange: thtRisk?.batches_orange ?? 0,
      batches_green: thtRisk?.batches_green ?? 0,
      has_urgent_tht: (thtRisk?.batches_red ?? 0) > 0,
    },
    explanation,
    data_status,
  };
}

/**
 * Calculate pressure for all parts
 */
export function calculateAllPressures(
  inventories: InventoryInput[],
  velocities: VelocityInput[],
  thtRisks: ThtRiskInput[],
  thresholds: PressureThresholds = DEFAULT_PRESSURE_THRESHOLDS
): PressureResult[] {
  // Create lookup maps
  const velocityMap = new Map(velocities.map(v => [v.part_code, v]));
  const thtMap = new Map(thtRisks.map(t => [t.part_code, t]));

  // Calculate pressure for each inventory item
  const results = inventories.map(inv =>
    calculatePartPressure(
      inv,
      velocityMap.get(inv.part_code) ?? null,
      thtMap.get(inv.part_code) ?? null,
      thresholds
    )
  );

  // Sort by pressure: red first, then orange, then green
  return results.sort((a, b) => {
    const order: Record<PressureFlag, number> = {
      red: 1,
      orange: 2,
      green: 3,
      no_velocity: 4,
      no_stock: 5,
    };
    return order[a.pressure_flag] - order[b.pressure_flag];
  });
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get Tailwind color class for pressure flag
 */
export function getPressureColorClass(flag: PressureFlag): string {
  switch (flag) {
    case 'green':
      return 'text-green-600 bg-green-50';
    case 'orange':
      return 'text-orange-600 bg-orange-50';
    case 'red':
      return 'text-red-600 bg-red-50';
    case 'no_stock':
      return 'text-gray-400 bg-gray-50';
    case 'no_velocity':
      return 'text-blue-600 bg-blue-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * Get display label for pressure flag (Dutch)
 */
export function getPressureLabel(flag: PressureFlag): string {
  switch (flag) {
    case 'green':
      return 'Normaal';
    case 'orange':
      return 'Verhoogd';
    case 'red':
      return 'Hoog';
    case 'no_stock':
      return 'Geen voorraad';
    case 'no_velocity':
      return 'Geen data';
    default:
      return flag;
  }
}

/**
 * Get velocity trend arrow
 */
export function getVelocityTrendArrow(trend: VelocityTrend): string {
  switch (trend) {
    case 'ACCELERATING':
      return '↑';
    case 'DECELERATING':
      return '↓';
    case 'STABLE':
      return '→';
    case 'NO_DATA':
      return '-';
    default:
      return '-';
  }
}

/**
 * Get velocity trend color class
 */
export function getVelocityTrendColorClass(trend: VelocityTrend): string {
  switch (trend) {
    case 'ACCELERATING':
      return 'text-green-600';
    case 'DECELERATING':
      return 'text-red-600';
    case 'STABLE':
      return 'text-gray-600';
    case 'NO_DATA':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}
