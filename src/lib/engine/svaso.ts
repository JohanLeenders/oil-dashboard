/**
 * SVASO (Sales Value at Split-off) Allocation Engine
 *
 * Kernlogica uit TRD Hoofdstuk 3.1:
 * De kostprijs van een hele kip kan niet lineair per kg worden verdeeld.
 * SVASO verdeelt kosten op basis van marktwaarde, niet gewicht.
 *
 * Formules:
 * 1. Totale Marktwaarde = Σ(Kg_onderdeel × Marktprijs_onderdeel)
 * 2. Allocatie Factor = Marktwaarde_onderdeel / Totale_Marktwaarde
 * 3. Toegewezen Kosten = Totale_Kosten × Allocatie_Factor
 */

import Decimal from 'decimal.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input voor een enkel onderdeel in de SVASO berekening
 */
export interface SvasoInputItem {
  /** Unieke identifier (SKU of product ID) */
  id: string;
  /** Hoeveelheid in kilogram */
  quantity_kg: number;
  /** Marktprijs per kilogram */
  market_price_per_kg: number;
  /** Optionele metadata */
  category?: string;
  name?: string;
}

/**
 * Resultaat per onderdeel na SVASO allocatie
 */
export interface SvasoAllocationResult {
  /** Originele input ID */
  id: string;
  /** Hoeveelheid kg */
  quantity_kg: number;
  /** Marktprijs per kg */
  market_price_per_kg: number;
  /** Berekende marktwaarde (kg × prijs) */
  market_value: number;
  /** Allocatie factor (0-1, som = 1.0) */
  allocation_factor: number;
  /** Toegewezen kosten */
  allocated_cost: number;
  /** Kostprijs per kg na allocatie */
  cost_per_kg: number;
  /** Bruto marge (marktwaarde - allocated_cost) */
  gross_margin: number;
  /** Marge percentage */
  margin_pct: number;
  /** Optionele metadata */
  category?: string;
  name?: string;
}

/**
 * Totaal resultaat van SVASO berekening
 */
export interface SvasoCalculationOutput {
  /** Totale kosten die verdeeld zijn */
  total_cost: number;
  /** Totale marktwaarde van alle onderdelen */
  total_market_value: number;
  /** Totale kilogrammen */
  total_kg: number;
  /** Allocatie per onderdeel */
  allocations: SvasoAllocationResult[];
  /** Validatie: som allocatie factoren (moet 1.0 zijn) */
  sum_allocation_factors: number;
  /** Timestamp van berekening */
  calculated_at: string;
  /** Eventuele waarschuwingen */
  warnings: string[];
}

// ============================================================================
// CORE ENGINE
// ============================================================================

/**
 * Bereken SVASO allocatie voor een batch
 *
 * @param items - Array van onderdelen met kg en marktprijs
 * @param totalCost - Totale kosten om te verdelen
 * @param options - Optionele configuratie
 * @returns Volledige SVASO allocatie met per-item breakdown
 *
 * @example
 * ```ts
 * const result = calculateSvasoAllocation(
 *   [
 *     { id: 'filet', quantity_kg: 100, market_price_per_kg: 9.50 },
 *     { id: 'dij', quantity_kg: 120, market_price_per_kg: 7.00 },
 *     { id: 'vleugels', quantity_kg: 45, market_price_per_kg: 5.50 },
 *   ],
 *   1500.00 // Totale batch kosten
 * );
 * ```
 */
export function calculateSvasoAllocation(
  items: SvasoInputItem[],
  totalCost: number,
  options: {
    /** Aantal decimalen voor allocatie factor (default: 6) */
    allocationPrecision?: number;
    /** Aantal decimalen voor bedragen (default: 2) */
    amountPrecision?: number;
  } = {}
): SvasoCalculationOutput {
  const {
    allocationPrecision = 6,
    amountPrecision = 2,
  } = options;

  const warnings: string[] = [];

  // Validatie
  if (!items || items.length === 0) {
    throw new Error('SVASO: Geen items opgegeven voor allocatie');
  }

  if (totalCost <= 0) {
    throw new Error('SVASO: Totale kosten moeten groter dan 0 zijn');
  }

  // Filter items met geldige waarden
  const validItems = items.filter(item => {
    if (item.quantity_kg <= 0) {
      warnings.push(`Item ${item.id}: quantity_kg <= 0, uitgesloten van allocatie`);
      return false;
    }
    if (item.market_price_per_kg <= 0) {
      warnings.push(`Item ${item.id}: market_price_per_kg <= 0, uitgesloten van allocatie`);
      return false;
    }
    return true;
  });

  if (validItems.length === 0) {
    throw new Error('SVASO: Geen geldige items na validatie');
  }

  // Gebruik Decimal.js voor precisie
  const decTotalCost = new Decimal(totalCost);

  // Stap 1: Bereken marktwaarde per onderdeel
  const itemsWithMarketValue = validItems.map(item => {
    const marketValue = new Decimal(item.quantity_kg).mul(item.market_price_per_kg);
    return {
      ...item,
      marketValue,
    };
  });

  // Stap 2: Bereken totale marktwaarde
  const totalMarketValue = itemsWithMarketValue.reduce(
    (sum, item) => sum.add(item.marketValue),
    new Decimal(0)
  );

  if (totalMarketValue.isZero()) {
    throw new Error('SVASO: Totale marktwaarde is 0, kan niet alloceren');
  }

  // Stap 3: Bereken allocatie factor en toegewezen kosten per onderdeel
  const allocations: SvasoAllocationResult[] = itemsWithMarketValue.map(item => {
    // Allocatie factor = Marktwaarde_onderdeel / Totale_Marktwaarde
    const allocationFactor = item.marketValue.div(totalMarketValue);

    // Toegewezen kosten = Totale_Kosten × Allocatie_Factor
    const allocatedCost = decTotalCost.mul(allocationFactor);

    // Kostprijs per kg = Toegewezen kosten / Kg
    const costPerKg = allocatedCost.div(item.quantity_kg);

    // Bruto marge = Marktwaarde - Allocated cost
    const grossMargin = item.marketValue.sub(allocatedCost);

    // Marge % = (Bruto marge / Marktwaarde) × 100
    const marginPct = item.marketValue.isZero()
      ? new Decimal(0)
      : grossMargin.div(item.marketValue).mul(100);

    return {
      id: item.id,
      quantity_kg: item.quantity_kg,
      market_price_per_kg: item.market_price_per_kg,
      market_value: item.marketValue.toDecimalPlaces(amountPrecision).toNumber(),
      allocation_factor: allocationFactor.toDecimalPlaces(allocationPrecision).toNumber(),
      allocated_cost: allocatedCost.toDecimalPlaces(amountPrecision).toNumber(),
      cost_per_kg: costPerKg.toDecimalPlaces(amountPrecision).toNumber(),
      gross_margin: grossMargin.toDecimalPlaces(amountPrecision).toNumber(),
      margin_pct: marginPct.toDecimalPlaces(amountPrecision).toNumber(),
      category: item.category,
      name: item.name,
    };
  });

  // Validatie: som allocatie factoren moet 1.0 zijn
  const sumAllocationFactors = allocations.reduce(
    (sum, item) => sum + item.allocation_factor,
    0
  );

  // Check voor afrondingsverschillen
  if (Math.abs(sumAllocationFactors - 1.0) > 0.0001) {
    warnings.push(
      `Som allocatie factoren = ${sumAllocationFactors.toFixed(6)}, verwacht 1.0`
    );
  }

  // Bereken totale kg
  const totalKg = validItems.reduce((sum, item) => sum + item.quantity_kg, 0);

  return {
    total_cost: decTotalCost.toDecimalPlaces(amountPrecision).toNumber(),
    total_market_value: totalMarketValue.toDecimalPlaces(amountPrecision).toNumber(),
    total_kg: totalKg,
    allocations,
    sum_allocation_factors: Number(sumAllocationFactors.toFixed(allocationPrecision)),
    calculated_at: new Date().toISOString(),
    warnings,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Bereken SVASO voor een specifieke batch met yields en marktprijzen
 *
 * @param batchYields - Yields per anatomisch deel
 * @param marketPrices - Marktprijzen per product/deel
 * @param totalBatchCost - Totale kosten van de batch
 */
export function calculateBatchSvaso(
  batchYields: Array<{
    part: string;
    weight_kg: number;
    product_id?: string;
  }>,
  marketPrices: Map<string, number>,
  totalBatchCost: number
): SvasoCalculationOutput {
  const items: SvasoInputItem[] = batchYields
    .filter(y => y.weight_kg > 0)
    .map(y => ({
      id: y.product_id || y.part,
      quantity_kg: y.weight_kg,
      market_price_per_kg: marketPrices.get(y.part) || 0,
      category: y.part,
    }));

  return calculateSvasoAllocation(items, totalBatchCost);
}

/**
 * Valideer SVASO resultaat tegen acceptance criteria
 * (TRD: Allocatiefactoren tellen op tot 1.0)
 */
export function validateSvasoResult(result: SvasoCalculationOutput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check 1: Som allocatie factoren = 1.0 (met tolerantie)
  if (Math.abs(result.sum_allocation_factors - 1.0) > 0.0001) {
    errors.push(
      `Allocatie factoren tellen niet op tot 1.0: ${result.sum_allocation_factors}`
    );
  }

  // Check 2: Alle allocated costs >= 0
  result.allocations.forEach(a => {
    if (a.allocated_cost < 0) {
      errors.push(`Negatieve allocated cost voor ${a.id}: ${a.allocated_cost}`);
    }
  });

  // Check 3: Som allocated costs = total cost (met tolerantie)
  const sumAllocatedCosts = result.allocations.reduce(
    (sum, a) => sum + a.allocated_cost,
    0
  );
  if (Math.abs(sumAllocatedCosts - result.total_cost) > 0.01) {
    errors.push(
      `Som allocated costs (${sumAllocatedCosts}) != total cost (${result.total_cost})`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Simuleer SVASO impact bij prijswijziging
 *
 * TRD Acceptance Test:
 * "Hogere marktprijs filet => hogere allocated cost filet,
 *  lagere kostprijs leg (ceteris paribus)"
 */
export function simulatePriceImpact(
  baseItems: SvasoInputItem[],
  totalCost: number,
  priceChange: {
    itemId: string;
    newPrice: number;
  }
): {
  before: SvasoCalculationOutput;
  after: SvasoCalculationOutput;
  impact: Array<{
    id: string;
    cost_change: number;
    cost_change_pct: number;
  }>;
} {
  // Bereken voor prijswijziging
  const before = calculateSvasoAllocation(baseItems, totalCost);

  // Pas prijs aan
  const modifiedItems = baseItems.map(item =>
    item.id === priceChange.itemId
      ? { ...item, market_price_per_kg: priceChange.newPrice }
      : item
  );

  // Bereken na prijswijziging
  const after = calculateSvasoAllocation(modifiedItems, totalCost);

  // Bereken impact
  const impact = before.allocations.map(beforeItem => {
    const afterItem = after.allocations.find(a => a.id === beforeItem.id);
    const costChange = afterItem
      ? afterItem.allocated_cost - beforeItem.allocated_cost
      : 0;
    const costChangePct = beforeItem.allocated_cost > 0
      ? (costChange / beforeItem.allocated_cost) * 100
      : 0;

    return {
      id: beforeItem.id,
      cost_change: Number(costChange.toFixed(2)),
      cost_change_pct: Number(costChangePct.toFixed(2)),
    };
  });

  return { before, after, impact };
}
