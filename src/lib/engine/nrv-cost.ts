/**
 * NRV (Net Realizable Value) Cost Engine — Sprint 2
 *
 * Builds on SVASO allocation (Split-Off) to calculate full product costs
 * by adding processing costs applied AFTER split-off.
 *
 * Cost Flow:
 * 1. Joint Cost (live bird purchase) → allocated via SVASO
 * 2. Processing Costs (cutting, vacuum, etc.) → added AFTER split-off
 * 3. NRV Cost = Allocated Joint Cost + Processing Costs
 *
 * Sprint 2 Contract:
 * - Joint cost = ONLY live bird purchase
 * - Allocation ONLY via Sales Value at Split-Off
 * - NRV applied AFTER split-off
 * - NO weight-based allocation
 * - NO price advice or optimization
 */

import Decimal from 'decimal.js';
import { calculateSvasoAllocation, type SvasoInputItem, type SvasoAllocationResult } from './svaso';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Processing cost input
 */
export interface ProcessingCostInput {
  /** Process step identifier */
  process_step: string;
  /** Cost per kg */
  cost_per_kg: number;
  /** Part code this applies to (null = all parts) */
  applies_to_part_code: string | null;
  /** SKU this applies to (null = all SKUs for that part) */
  applies_to_sku: string | null;
  /** Source of cost rate */
  source: 'manual' | 'abc' | 'contract';
}

/**
 * NRV calculation input for a single part/SKU
 */
export interface NrvInputItem extends SvasoInputItem {
  /** Part code for processing cost lookup */
  part_code: string;
  /** SKU code for SKU-specific processing costs */
  sku?: string;
}

/**
 * NRV calculation result for a single part/SKU
 */
export interface NrvResult {
  /** Part/product identifier */
  id: string;
  /** Part code */
  part_code: string;
  /** SKU (if applicable) */
  sku?: string;
  /** Weight in kg */
  weight_kg: number;
  /** Market price per kg (for SVASO allocation) */
  market_price_per_kg: number;

  /** Cost at split-off (from SVASO) */
  cost_splitoff_per_kg: number;
  cost_splitoff_total: number;

  /** Processing costs (after split-off) */
  processing_costs_per_kg: number;
  processing_costs_total: number;
  processing_breakdown: ProcessingCostBreakdown[];

  /** NRV (final cost) */
  nrv_cost_per_kg: number;
  nrv_cost_total: number;

  /** Allocation details for traceability */
  allocation_factor: number;
  allocated_joint_cost: number;
}

/**
 * Processing cost breakdown per step
 */
export interface ProcessingCostBreakdown {
  process_step: string;
  cost_per_kg: number;
  source: string;
}

/**
 * Full NRV calculation output
 */
export interface NrvCalculationOutput {
  /** Batch identifier */
  batch_id: string;
  /** Total joint cost (live bird purchase) */
  total_joint_cost: number;
  /** Total processing costs */
  total_processing_costs: number;
  /** Total NRV cost */
  total_nrv_cost: number;
  /** Results per part/SKU */
  results: NrvResult[];
  /** Validation */
  sum_allocation_factors: number;
  is_valid: boolean;
  /** Timestamp */
  calculated_at: string;
  /** Warnings */
  warnings: string[];
}

// ============================================================================
// CORE ENGINE
// ============================================================================

/**
 * Calculate NRV costs for a batch
 *
 * @param batchId - Batch identifier for traceability
 * @param items - Parts with weights and market prices
 * @param jointCost - Total joint cost (live bird purchase only)
 * @param processingCosts - Processing costs to apply after split-off
 * @returns Full NRV calculation with breakdown
 *
 * @example
 * ```ts
 * const result = calculateNrvCosts(
 *   'batch-123',
 *   [
 *     { id: 'breast', part_code: 'breast_cap', quantity_kg: 350, market_price_per_kg: 9.50 },
 *     { id: 'leg', part_code: 'leg_quarter', quantity_kg: 420, market_price_per_kg: 5.50 },
 *   ],
 *   5000.00, // Joint cost (live bird purchase)
 *   [
 *     { process_step: 'cutting', cost_per_kg: 0.15, applies_to_part_code: null, source: 'contract' },
 *     { process_step: 'vacuum', cost_per_kg: 0.08, applies_to_part_code: 'breast_cap', source: 'abc' },
 *   ]
 * );
 * ```
 */
export function calculateNrvCosts(
  batchId: string,
  items: NrvInputItem[],
  jointCost: number,
  processingCosts: ProcessingCostInput[]
): NrvCalculationOutput {
  const warnings: string[] = [];

  // Step 1: Calculate SVASO allocation for joint cost
  const svasoInput: SvasoInputItem[] = items.map(item => ({
    id: item.id,
    quantity_kg: item.quantity_kg,
    market_price_per_kg: item.market_price_per_kg,
    category: item.part_code,
    name: item.sku,
  }));

  const svasoResult = calculateSvasoAllocation(svasoInput, jointCost);
  warnings.push(...svasoResult.warnings);

  // Step 2: Calculate processing costs per part/SKU
  const results: NrvResult[] = svasoResult.allocations.map(allocation => {
    const originalItem = items.find(i => i.id === allocation.id);
    if (!originalItem) {
      warnings.push(`Item ${allocation.id} not found in original items`);
      return createEmptyResult(allocation);
    }

    // Find applicable processing costs
    const applicableCosts = findApplicableProcessingCosts(
      originalItem.part_code,
      originalItem.sku,
      processingCosts
    );

    // Sum processing costs per kg
    const processingCostPerKg = applicableCosts.reduce(
      (sum, pc) => sum.add(pc.cost_per_kg),
      new Decimal(0)
    );

    // Calculate totals
    const processingCostTotal = processingCostPerKg.mul(originalItem.quantity_kg);
    const nrvCostPerKg = new Decimal(allocation.cost_per_kg).add(processingCostPerKg);
    const nrvCostTotal = nrvCostPerKg.mul(originalItem.quantity_kg);

    return {
      id: allocation.id,
      part_code: originalItem.part_code,
      sku: originalItem.sku,
      weight_kg: allocation.quantity_kg,
      market_price_per_kg: allocation.market_price_per_kg,

      // Split-off costs (from SVASO)
      cost_splitoff_per_kg: allocation.cost_per_kg,
      cost_splitoff_total: allocation.allocated_cost,

      // Processing costs (after split-off)
      processing_costs_per_kg: processingCostPerKg.toDecimalPlaces(4).toNumber(),
      processing_costs_total: processingCostTotal.toDecimalPlaces(2).toNumber(),
      processing_breakdown: applicableCosts.map(pc => ({
        process_step: pc.process_step,
        cost_per_kg: pc.cost_per_kg,
        source: pc.source,
      })),

      // NRV (final cost)
      nrv_cost_per_kg: nrvCostPerKg.toDecimalPlaces(4).toNumber(),
      nrv_cost_total: nrvCostTotal.toDecimalPlaces(2).toNumber(),

      // Allocation details
      allocation_factor: allocation.allocation_factor,
      allocated_joint_cost: allocation.allocated_cost,
    };
  });

  // Calculate totals
  const totalProcessingCosts = results.reduce(
    (sum, r) => sum + r.processing_costs_total,
    0
  );
  const totalNrvCost = results.reduce(
    (sum, r) => sum + r.nrv_cost_total,
    0
  );

  // Validate
  const isValid = Math.abs(svasoResult.sum_allocation_factors - 1.0) < 0.0001;

  return {
    batch_id: batchId,
    total_joint_cost: jointCost,
    total_processing_costs: Number(totalProcessingCosts.toFixed(2)),
    total_nrv_cost: Number(totalNrvCost.toFixed(2)),
    results,
    sum_allocation_factors: svasoResult.sum_allocation_factors,
    is_valid: isValid,
    calculated_at: new Date().toISOString(),
    warnings,
  };
}

/**
 * Find processing costs applicable to a specific part/SKU
 */
function findApplicableProcessingCosts(
  partCode: string,
  sku: string | undefined,
  processingCosts: ProcessingCostInput[]
): ProcessingCostInput[] {
  return processingCosts.filter(pc => {
    // Check part code match (null = applies to all)
    const partMatch = pc.applies_to_part_code === null ||
                      pc.applies_to_part_code === partCode;

    // Check SKU match (null = applies to all)
    const skuMatch = pc.applies_to_sku === null ||
                     pc.applies_to_sku === sku;

    return partMatch && skuMatch;
  });
}

/**
 * Create empty result for missing items
 */
function createEmptyResult(allocation: SvasoAllocationResult): NrvResult {
  return {
    id: allocation.id,
    part_code: 'unknown',
    weight_kg: allocation.quantity_kg,
    market_price_per_kg: allocation.market_price_per_kg,
    cost_splitoff_per_kg: allocation.cost_per_kg,
    cost_splitoff_total: allocation.allocated_cost,
    processing_costs_per_kg: 0,
    processing_costs_total: 0,
    processing_breakdown: [],
    nrv_cost_per_kg: allocation.cost_per_kg,
    nrv_cost_total: allocation.allocated_cost,
    allocation_factor: allocation.allocation_factor,
    allocated_joint_cost: allocation.allocated_cost,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate NRV calculation result
 */
export function validateNrvResult(result: NrvCalculationOutput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check 1: Allocation factors sum to 1.0
  if (Math.abs(result.sum_allocation_factors - 1.0) > 0.0001) {
    errors.push(
      `Allocation factors do not sum to 1.0: ${result.sum_allocation_factors}`
    );
  }

  // Check 2: Total NRV = joint cost + processing costs
  // Use 1% tolerance to account for cumulative rounding across items
  const expectedTotal = result.total_joint_cost + result.total_processing_costs;
  const tolerance = Math.max(expectedTotal * 0.01, 0.01);
  if (Math.abs(result.total_nrv_cost - expectedTotal) > tolerance) {
    errors.push(
      `Total NRV (${result.total_nrv_cost}) != joint + processing (${expectedTotal})`
    );
  }

  // Check 3: All NRV costs are non-negative
  result.results.forEach(r => {
    if (r.nrv_cost_per_kg < 0) {
      errors.push(`Negative NRV cost for ${r.id}: ${r.nrv_cost_per_kg}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// EXPLANATION HELPERS
// ============================================================================

/**
 * Generate cost explanation text for UI
 * Per Sprint 2: "tekstuele uitleg per stap: batch → joint cost → split-off → NRV"
 */
export function generateCostExplanation(
  result: NrvResult,
  batchRef: string,
  jointCostTotal: number
): string {
  const lines: string[] = [];

  lines.push(`Kostprijsopbouw voor ${result.part_code}${result.sku ? ` (${result.sku})` : ''}:`);
  lines.push('');
  lines.push(`1. BATCH: ${batchRef}`);
  lines.push(`   Joint cost (levende kip): €${jointCostTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`);
  lines.push('');
  lines.push(`2. SPLIT-OFF ALLOCATIE (SVASO):`);
  lines.push(`   Marktwaarde: ${result.weight_kg.toFixed(2)} kg × €${result.market_price_per_kg.toFixed(2)}/kg`);
  lines.push(`   Allocatie factor: ${(result.allocation_factor * 100).toFixed(2)}%`);
  lines.push(`   Toegewezen joint cost: €${result.allocated_joint_cost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`);
  lines.push(`   → Kostprijs bij split-off: €${result.cost_splitoff_per_kg.toFixed(4)}/kg`);
  lines.push('');
  lines.push(`3. VERWERKING (ná split-off):`);
  if (result.processing_breakdown.length === 0) {
    lines.push('   Geen verwerkingskosten van toepassing');
  } else {
    result.processing_breakdown.forEach(pb => {
      lines.push(`   ${pb.process_step}: €${pb.cost_per_kg.toFixed(4)}/kg (bron: ${pb.source})`);
    });
    lines.push(`   → Totaal verwerking: €${result.processing_costs_per_kg.toFixed(4)}/kg`);
  }
  lines.push('');
  lines.push(`4. NRV KOSTPRIJS:`);
  lines.push(`   Split-off + Verwerking = €${result.cost_splitoff_per_kg.toFixed(4)} + €${result.processing_costs_per_kg.toFixed(4)}`);
  lines.push(`   → NRV kostprijs: €${result.nrv_cost_per_kg.toFixed(4)}/kg`);
  lines.push(`   → Totaal: €${result.nrv_cost_total.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`);

  return lines.join('\n');
}
