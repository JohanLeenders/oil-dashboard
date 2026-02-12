/**
 * Phase 2: Cost Waterfall V2 — Server Component
 *
 * Runs all 7 canonical engine levels with demo data,
 * packages results into CanonWaterfallData, and renders
 * the interactive CostWaterfallShell client component.
 *
 * Engine is LOCKED — UI calls only, no business logic here.
 */

import Link from 'next/link';
import {
  calculateLandedCost,
  calculateJointCostPool,
  calculateByProductCredit,
  calculateSVASOAllocation,
  calculateMiniSVASO,
  calculateABCCosts,
  calculateFullSKUCost,
  calculateNRV,
} from '@/lib/engine/canonical-cost';
import {
  DEMO_BATCH,
  DEMO_BATCH_REF,
  DEMO_BATCH_DATE,
  DEMO_SLAUGHTER_FEE_EUR,
  DEMO_GRILLER_WEIGHT_KG,
  DEMO_BY_PRODUCTS,
  DEMO_JOINT_PRODUCTS,
  DEMO_SUB_CUTS,
  DEMO_ABC_DRIVERS,
  DEMO_SKU,
  DEMO_NRV_INPUT,
  getMassBalanceStatus,
} from '@/lib/data/demo-batch-v2';
import { CostWaterfallShell } from '@/components/oil/CostWaterfallShell';
import type { CanonWaterfallData } from '@/components/oil/CostWaterfallShell';

export default async function CostWaterfallV2Page() {
  // ====== Run full 7-level pipeline ======

  // Level 0: Landed Cost
  const level0 = calculateLandedCost(DEMO_BATCH);

  // Level 1: Joint Cost Pool
  const level1 = calculateJointCostPool(
    DEMO_BATCH.batch_id,
    level0,
    DEMO_SLAUGHTER_FEE_EUR,
    DEMO_GRILLER_WEIGHT_KG,
  );

  // Level 2: By-product Credit
  const level2 = calculateByProductCredit(
    DEMO_BATCH.batch_id,
    level1,
    DEMO_BY_PRODUCTS,
  );

  // Level 3: SVASO Allocation
  const level3 = calculateSVASOAllocation(
    DEMO_BATCH.batch_id,
    level2,
    DEMO_JOINT_PRODUCTS,
  );

  // Level 4: Mini-SVASO for each joint product
  const level4: Record<string, ReturnType<typeof calculateMiniSVASO>> = {};
  for (const alloc of level3.allocations) {
    const subCuts = DEMO_SUB_CUTS[alloc.part_code];
    if (subCuts && subCuts.length > 0) {
      level4[alloc.part_code] = calculateMiniSVASO(alloc, subCuts);
    }
  }

  // Level 5: ABC Costs
  const level5 = calculateABCCosts(DEMO_SKU.sku_code, DEMO_ABC_DRIVERS);

  // Level 6: Full SKU Cost
  // Use filet cost from Mini-SVASO (breast_cap → filet)
  const filetAlloc = level4['breast_cap']?.sub_allocations?.[0];
  const meatCostPerKg = filetAlloc?.allocated_cost_per_kg ?? level3.allocations[0].allocated_cost_per_kg;
  const level6 = calculateFullSKUCost(DEMO_SKU, meatCostPerKg, level5);

  // Level 7: NRV Check
  const level7 = calculateNRV(DEMO_NRV_INPUT, level6.cost_per_kg);

  // ====== Mass Balance Calculation ======
  const totalJointWeight = DEMO_JOINT_PRODUCTS.reduce((s, jp) => s + jp.weight_kg, 0);
  const totalByProductWeight = DEMO_BY_PRODUCTS.reduce((s, bp) => s + bp.weight_kg, 0);
  const accountedWeight = totalJointWeight + totalByProductWeight;
  const massBalanceDeviation = Math.abs(accountedWeight - DEMO_GRILLER_WEIGHT_KG) / DEMO_GRILLER_WEIGHT_KG * 100;
  const massBalanceStatus = getMassBalanceStatus(massBalanceDeviation);

  // ====== Package data for client shell ======
  const canonData: CanonWaterfallData = {
    batch: {
      batch_id: DEMO_BATCH.batch_id,
      batch_ref: DEMO_BATCH_REF,
      date: DEMO_BATCH_DATE,
      input_live_kg: DEMO_BATCH.input_live_kg,
      input_count: DEMO_BATCH.input_count,
      griller_output_kg: DEMO_GRILLER_WEIGHT_KG,
      griller_yield_pct: level1.griller_yield_pct,
      k_factor: level3.k_factor,
      k_factor_interpretation: level3.k_factor_interpretation,
      mass_balance_deviation_pct: massBalanceDeviation,
      mass_balance_status: massBalanceStatus,
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
      landedCostInput: DEMO_BATCH,
      slaughterFeeEur: DEMO_SLAUGHTER_FEE_EUR,
      grillerWeightKg: DEMO_GRILLER_WEIGHT_KG,
      byProducts: DEMO_BY_PRODUCTS,
      jointProducts: DEMO_JOINT_PRODUCTS,
      subCuts: DEMO_SUB_CUTS,
      abcDrivers: DEMO_ABC_DRIVERS,
      skuDefinition: DEMO_SKU,
      nrvInput: DEMO_NRV_INPUT,
    },
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/oil" className="hover:text-blue-600">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-900">Kostprijswaterval</span>
      </div>

      <CostWaterfallShell canonData={canonData} />
    </div>
  );
}
