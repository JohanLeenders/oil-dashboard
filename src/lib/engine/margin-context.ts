/**
 * Sprint 5: Margin Context Engine
 *
 * Provides contextual margin analysis per customer in carcass context.
 * ANALYTICAL ONLY - no price advice, no customer scoring, no optimization.
 *
 * Key concepts:
 * - Margin per part linked to carcass alignment (Sprint 4)
 * - Contract deviations explained, not judged
 * - All explanations in Dutch for commercial conversations
 */

import type { AnatomicalPart } from '@/types/database';
import { getCarcassShare, getPartNameDutch } from './carcass-alignment';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Customer margin data per part (from v_customer_margin_by_part)
 */
export interface CustomerMarginByPart {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  part_code: AnatomicalPart;
  quantity_kg: number;
  revenue_eur: number;
  cost_eur: number;
  margin_eur: number;
  margin_pct: number | null;
  customer_share_pct: number | null;
  customer_total_kg: number;
  customer_total_revenue_eur: number;
  customer_total_cost_eur: number;
  transaction_count: number;
  cost_data_status: 'COST_AVAILABLE' | 'NO_COST_DATA';
}

/**
 * Contract agreement for a customer/part
 */
export interface CustomerContract {
  customer_id: string;
  part_code: AnatomicalPart;
  agreed_share_min: number;
  agreed_share_max: number;
  price_tier: string | null;
  notes: string | null;
}

/**
 * Deviation flag (DESCRIPTIVE, not prescriptive)
 */
export type DeviationFlag = 'WITHIN_RANGE' | 'BELOW_RANGE' | 'ABOVE_RANGE' | 'NO_CONTRACT';

/**
 * Contract deviation result
 */
export interface ContractDeviation {
  customer_id: string;
  part_code: AnatomicalPart;
  actual_share: number;
  agreed_share_min: number | null;
  agreed_share_max: number | null;
  deviation_pct: number | null;
  deviation_flag: DeviationFlag;
  explanation: string;
}

/**
 * Margin context result (combines margin + alignment + contract)
 */
export interface MarginContextResult {
  customer_id: string;
  customer_name: string;
  part_code: AnatomicalPart;
  margin_eur: number;
  margin_pct: number | null;
  customer_share_pct: number | null;
  carcass_share_pct: number;
  alignment_deviation_pct: number | null;
  contract_deviation: ContractDeviation | null;
  margin_explanation: string;
}

/**
 * Full customer margin context
 */
export interface CustomerMarginContext {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  total_margin_eur: number;
  total_margin_pct: number | null;
  part_margins: MarginContextResult[];
  overall_explanation: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Margin thresholds for explanation categorization
 * These are DESCRIPTIVE, not targets
 */
export const MARGIN_CONTEXT_THRESHOLDS = {
  low_margin_pct: 5,      // Below this = low margin (descriptive)
  high_margin_pct: 15,    // Above this = high margin (descriptive)
  significant_deviation_pct: 5, // Above this = significant contract deviation
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Check if actual share is within contract range
 */
export function checkContractCompliance(
  actual_share: number,
  agreed_min: number | null,
  agreed_max: number | null
): DeviationFlag {
  if (agreed_min === null || agreed_max === null) {
    return 'NO_CONTRACT';
  }
  if (actual_share < agreed_min) {
    return 'BELOW_RANGE';
  }
  if (actual_share > agreed_max) {
    return 'ABOVE_RANGE';
  }
  return 'WITHIN_RANGE';
}

/**
 * Calculate contract deviation percentage
 * Positive = above range, Negative = below range
 */
export function calculateContractDeviation(
  actual_share: number,
  agreed_min: number | null,
  agreed_max: number | null
): number | null {
  if (agreed_min === null || agreed_max === null) {
    return null;
  }
  if (actual_share < agreed_min) {
    return Math.round((actual_share - agreed_min) * 100) / 100;
  }
  if (actual_share > agreed_max) {
    return Math.round((actual_share - agreed_max) * 100) / 100;
  }
  return 0;
}

/**
 * Generate Dutch explanation for contract deviation
 */
export function generateContractDeviationExplanation(
  part_code: AnatomicalPart,
  actual_share: number,
  agreed_min: number | null,
  agreed_max: number | null,
  deviation_flag: DeviationFlag
): string {
  const partName = getPartNameDutch(part_code);

  switch (deviation_flag) {
    case 'NO_CONTRACT':
      return `Geen contractafspraak voor ${partName}.`;

    case 'WITHIN_RANGE':
      return `${partName}: afname (${actual_share.toFixed(1)}%) valt binnen afgesproken bandbreedte (${agreed_min}% - ${agreed_max}%).`;

    case 'BELOW_RANGE':
      return `${partName}: afname (${actual_share.toFixed(1)}%) is lager dan afgesproken minimum (${agreed_min}%).`;

    case 'ABOVE_RANGE':
      return `${partName}: afname (${actual_share.toFixed(1)}%) is hoger dan afgesproken maximum (${agreed_max}%).`;

    default:
      return `${partName}: onbekende status.`;
  }
}

/**
 * Generate Dutch explanation for margin in carcass context
 * ANALYTICAL ONLY - no advice, no judgment
 */
export function generateMarginExplanation(
  part_code: AnatomicalPart,
  margin_pct: number | null,
  customer_share_pct: number | null,
  carcass_share_pct: number,
  cost_data_status: 'COST_AVAILABLE' | 'NO_COST_DATA'
): string {
  const partName = getPartNameDutch(part_code);

  if (cost_data_status === 'NO_COST_DATA') {
    return `${partName}: geen kostprijsdata beschikbaar. Margeberekening onvolledig.`;
  }

  if (margin_pct === null) {
    return `${partName}: geen omzet voor margeberekening.`;
  }

  const parts: string[] = [];

  // Describe margin level
  if (margin_pct < MARGIN_CONTEXT_THRESHOLDS.low_margin_pct) {
    parts.push(`${partName}: lage marge (${margin_pct.toFixed(1)}%)`);
  } else if (margin_pct > MARGIN_CONTEXT_THRESHOLDS.high_margin_pct) {
    parts.push(`${partName}: hoge marge (${margin_pct.toFixed(1)}%)`);
  } else {
    parts.push(`${partName}: gemiddelde marge (${margin_pct.toFixed(1)}%)`);
  }

  // Add carcass context if available
  if (customer_share_pct !== null) {
    const alignmentDelta = customer_share_pct - carcass_share_pct;
    if (Math.abs(alignmentDelta) > 5) {
      if (alignmentDelta > 0) {
        parts.push(`meer afname dan karkasratio (+${alignmentDelta.toFixed(1)}%)`);
      } else {
        parts.push(`minder afname dan karkasratio (${alignmentDelta.toFixed(1)}%)`);
      }
    } else {
      parts.push('in lijn met karkasratio');
    }
  }

  return parts.join(', ') + '.';
}

/**
 * Calculate margin context for a single part
 */
export function calculatePartMarginContext(
  margin: CustomerMarginByPart,
  contract: CustomerContract | null
): MarginContextResult {
  const carcass_share_pct = getCarcassShare(margin.part_code);

  // Calculate alignment deviation
  const alignment_deviation_pct = margin.customer_share_pct !== null
    ? Math.round((margin.customer_share_pct - carcass_share_pct) * 100) / 100
    : null;

  // Calculate contract deviation
  let contractDeviation: ContractDeviation | null = null;
  if (margin.customer_share_pct !== null) {
    const deviation_flag = checkContractCompliance(
      margin.customer_share_pct,
      contract?.agreed_share_min ?? null,
      contract?.agreed_share_max ?? null
    );
    const deviation_pct = calculateContractDeviation(
      margin.customer_share_pct,
      contract?.agreed_share_min ?? null,
      contract?.agreed_share_max ?? null
    );

    contractDeviation = {
      customer_id: margin.customer_id,
      part_code: margin.part_code,
      actual_share: margin.customer_share_pct,
      agreed_share_min: contract?.agreed_share_min ?? null,
      agreed_share_max: contract?.agreed_share_max ?? null,
      deviation_pct,
      deviation_flag,
      explanation: generateContractDeviationExplanation(
        margin.part_code,
        margin.customer_share_pct,
        contract?.agreed_share_min ?? null,
        contract?.agreed_share_max ?? null,
        deviation_flag
      ),
    };
  }

  // Generate margin explanation
  const margin_explanation = generateMarginExplanation(
    margin.part_code,
    margin.margin_pct,
    margin.customer_share_pct,
    carcass_share_pct,
    margin.cost_data_status
  );

  return {
    customer_id: margin.customer_id,
    customer_name: margin.customer_name,
    part_code: margin.part_code,
    margin_eur: margin.margin_eur,
    margin_pct: margin.margin_pct,
    customer_share_pct: margin.customer_share_pct,
    carcass_share_pct,
    alignment_deviation_pct,
    contract_deviation: contractDeviation,
    margin_explanation,
  };
}

/**
 * Calculate full margin context for a customer
 */
export function calculateCustomerMarginContext(
  margins: CustomerMarginByPart[],
  contracts: CustomerContract[]
): CustomerMarginContext {
  if (margins.length === 0) {
    return {
      customer_id: '',
      customer_name: '',
      customer_code: '',
      total_margin_eur: 0,
      total_margin_pct: null,
      part_margins: [],
      overall_explanation: 'Geen verkoopdata beschikbaar.',
    };
  }

  // Get customer info from first margin
  const { customer_id, customer_name, customer_code } = margins[0];

  // Calculate part margins
  const part_margins = margins.map(margin => {
    const contract = contracts.find(
      c => c.customer_id === customer_id && c.part_code === margin.part_code
    ) ?? null;
    return calculatePartMarginContext(margin, contract);
  });

  // Calculate totals
  const total_margin_eur = margins.reduce((sum, m) => sum + m.margin_eur, 0);
  const total_revenue = margins.reduce((sum, m) => sum + m.revenue_eur, 0);
  const total_margin_pct = total_revenue > 0
    ? Math.round((total_margin_eur / total_revenue * 100) * 100) / 100
    : null;

  // Generate overall explanation
  const overall_explanation = generateOverallExplanation(part_margins, total_margin_pct);

  return {
    customer_id,
    customer_name,
    customer_code,
    total_margin_eur: Math.round(total_margin_eur * 100) / 100,
    total_margin_pct,
    part_margins,
    overall_explanation,
  };
}

/**
 * Generate overall Dutch explanation for customer margin context
 * ANALYTICAL ONLY - no advice
 */
export function generateOverallExplanation(
  part_margins: MarginContextResult[],
  total_margin_pct: number | null
): string {
  if (part_margins.length === 0) {
    return 'Geen verkoopdata beschikbaar voor analyse.';
  }

  const parts: string[] = [];

  // Overall margin description
  if (total_margin_pct !== null) {
    if (total_margin_pct < MARGIN_CONTEXT_THRESHOLDS.low_margin_pct) {
      parts.push(`Totale marge is laag (${total_margin_pct.toFixed(1)}%).`);
    } else if (total_margin_pct > MARGIN_CONTEXT_THRESHOLDS.high_margin_pct) {
      parts.push(`Totale marge is hoog (${total_margin_pct.toFixed(1)}%).`);
    } else {
      parts.push(`Totale marge is gemiddeld (${total_margin_pct.toFixed(1)}%).`);
    }
  }

  // Contract deviations summary
  const deviations = part_margins
    .filter(p => p.contract_deviation?.deviation_flag === 'BELOW_RANGE' ||
                 p.contract_deviation?.deviation_flag === 'ABOVE_RANGE');

  if (deviations.length > 0) {
    const deviationParts = deviations.map(d => getPartNameDutch(d.part_code));
    parts.push(`Contractafwijkingen bij: ${deviationParts.join(', ')}.`);
  }

  // Alignment summary
  const misaligned = part_margins.filter(
    p => p.alignment_deviation_pct !== null && Math.abs(p.alignment_deviation_pct) > 5
  );

  if (misaligned.length > 0) {
    const overUptake = misaligned.filter(p => (p.alignment_deviation_pct ?? 0) > 0);
    const underUptake = misaligned.filter(p => (p.alignment_deviation_pct ?? 0) < 0);

    if (overUptake.length > 0) {
      const names = overUptake.map(p => getPartNameDutch(p.part_code)).join(', ');
      parts.push(`Meer dan karkasratio: ${names}.`);
    }
    if (underUptake.length > 0) {
      const names = underUptake.map(p => getPartNameDutch(p.part_code)).join(', ');
      parts.push(`Minder dan karkasratio: ${names}.`);
    }
  }

  return parts.join(' ');
}

/**
 * Calculate margin context for all customers
 */
export function calculateAllCustomerMarginContexts(
  margins: CustomerMarginByPart[],
  contracts: CustomerContract[]
): CustomerMarginContext[] {
  // Group margins by customer
  const customerIds = [...new Set(margins.map(m => m.customer_id))];

  return customerIds.map(customerId => {
    const customerMargins = margins.filter(m => m.customer_id === customerId);
    const customerContracts = contracts.filter(c => c.customer_id === customerId);
    return calculateCustomerMarginContext(customerMargins, customerContracts);
  });
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get color class for margin percentage
 */
export function getMarginColorClass(margin_pct: number | null): string {
  if (margin_pct === null) return 'text-gray-500 bg-gray-50';
  if (margin_pct < 0) return 'text-red-700 bg-red-50';
  if (margin_pct < MARGIN_CONTEXT_THRESHOLDS.low_margin_pct) return 'text-orange-600 bg-orange-50';
  if (margin_pct > MARGIN_CONTEXT_THRESHOLDS.high_margin_pct) return 'text-green-600 bg-green-50';
  return 'text-yellow-600 bg-yellow-50';
}

/**
 * Get color class for deviation flag
 */
export function getDeviationFlagColorClass(flag: DeviationFlag): string {
  switch (flag) {
    case 'WITHIN_RANGE':
      return 'text-green-600 bg-green-50';
    case 'BELOW_RANGE':
      return 'text-orange-600 bg-orange-50';
    case 'ABOVE_RANGE':
      return 'text-blue-600 bg-blue-50';
    case 'NO_CONTRACT':
    default:
      return 'text-gray-500 bg-gray-50';
  }
}

/**
 * Get Dutch label for deviation flag
 */
export function getDeviationFlagLabel(flag: DeviationFlag): string {
  switch (flag) {
    case 'WITHIN_RANGE':
      return 'Binnen afspraak';
    case 'BELOW_RANGE':
      return 'Onder minimum';
    case 'ABOVE_RANGE':
      return 'Boven maximum';
    case 'NO_CONTRACT':
    default:
      return 'Geen contract';
  }
}

/**
 * Format margin with sign
 */
export function formatMargin(margin_eur: number): string {
  const formatted = Math.abs(margin_eur).toLocaleString('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
  return margin_eur >= 0 ? formatted : `-${formatted}`;
}

/**
 * Format percentage with optional sign
 */
export function formatPercentage(pct: number | null, withSign = false): string {
  if (pct === null) return '-';
  const sign = withSign && pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
