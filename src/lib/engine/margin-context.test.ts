/**
 * Sprint 5: Margin Context Engine Tests
 *
 * Tests for customer margin analysis in carcass context.
 * Verifies:
 * - Contract compliance checking
 * - Deviation calculations
 * - Dutch explanation generation
 * - Margin context calculations
 */

import { describe, it, expect } from 'vitest';
import {
  checkContractCompliance,
  calculateContractDeviation,
  generateContractDeviationExplanation,
  generateMarginExplanation,
  calculatePartMarginContext,
  calculateCustomerMarginContext,
  generateOverallExplanation,
  getMarginColorClass,
  getDeviationFlagColorClass,
  getDeviationFlagLabel,
  formatMargin,
  formatPercentage,
  MARGIN_CONTEXT_THRESHOLDS,
  type CustomerMarginByPart,
  type CustomerContract,
  type MarginContextResult,
} from './margin-context';

// ============================================================================
// TEST DATA
// ============================================================================

const mockMarginData: CustomerMarginByPart[] = [
  {
    customer_id: 'cust-001',
    customer_name: 'Test Klant',
    customer_code: 'TK001',
    part_code: 'breast_cap',
    quantity_kg: 100,
    revenue_eur: 1200,
    cost_eur: 800,
    margin_eur: 400,
    margin_pct: 33.33,
    customer_share_pct: 40,
    customer_total_kg: 250,
    customer_total_revenue_eur: 2500,
    customer_total_cost_eur: 1800,
    transaction_count: 5,
    cost_data_status: 'COST_AVAILABLE',
  },
  {
    customer_id: 'cust-001',
    customer_name: 'Test Klant',
    customer_code: 'TK001',
    part_code: 'leg_quarter',
    quantity_kg: 100,
    revenue_eur: 800,
    cost_eur: 600,
    margin_eur: 200,
    margin_pct: 25,
    customer_share_pct: 40,
    customer_total_kg: 250,
    customer_total_revenue_eur: 2500,
    customer_total_cost_eur: 1800,
    transaction_count: 3,
    cost_data_status: 'COST_AVAILABLE',
  },
];

const mockContracts: CustomerContract[] = [
  {
    customer_id: 'cust-001',
    part_code: 'breast_cap',
    agreed_share_min: 30,
    agreed_share_max: 38,
    price_tier: 'A',
    notes: 'Test contract',
  },
  {
    customer_id: 'cust-001',
    part_code: 'leg_quarter',
    agreed_share_min: 35,
    agreed_share_max: 45,
    price_tier: 'B',
    notes: null,
  },
];

// ============================================================================
// CONTRACT COMPLIANCE TESTS
// ============================================================================

describe('checkContractCompliance', () => {
  it('should return NO_CONTRACT when no contract exists', () => {
    expect(checkContractCompliance(35, null, null)).toBe('NO_CONTRACT');
  });

  it('should return WITHIN_RANGE when actual is within agreed range', () => {
    expect(checkContractCompliance(35, 30, 40)).toBe('WITHIN_RANGE');
    expect(checkContractCompliance(30, 30, 40)).toBe('WITHIN_RANGE'); // At min
    expect(checkContractCompliance(40, 30, 40)).toBe('WITHIN_RANGE'); // At max
  });

  it('should return BELOW_RANGE when actual is below minimum', () => {
    expect(checkContractCompliance(25, 30, 40)).toBe('BELOW_RANGE');
    expect(checkContractCompliance(29.99, 30, 40)).toBe('BELOW_RANGE');
  });

  it('should return ABOVE_RANGE when actual is above maximum', () => {
    expect(checkContractCompliance(45, 30, 40)).toBe('ABOVE_RANGE');
    expect(checkContractCompliance(40.01, 30, 40)).toBe('ABOVE_RANGE');
  });
});

describe('calculateContractDeviation', () => {
  it('should return null when no contract exists', () => {
    expect(calculateContractDeviation(35, null, null)).toBeNull();
  });

  it('should return 0 when within range', () => {
    expect(calculateContractDeviation(35, 30, 40)).toBe(0);
  });

  it('should return negative deviation when below minimum', () => {
    expect(calculateContractDeviation(25, 30, 40)).toBe(-5);
    expect(calculateContractDeviation(20, 30, 40)).toBe(-10);
  });

  it('should return positive deviation when above maximum', () => {
    expect(calculateContractDeviation(45, 30, 40)).toBe(5);
    expect(calculateContractDeviation(50, 30, 40)).toBe(10);
  });
});

// ============================================================================
// EXPLANATION GENERATION TESTS
// ============================================================================

describe('generateContractDeviationExplanation', () => {
  it('should generate Dutch explanation for NO_CONTRACT', () => {
    const explanation = generateContractDeviationExplanation(
      'breast_cap', 35, null, null, 'NO_CONTRACT'
    );
    expect(explanation).toContain('Geen contractafspraak');
    expect(explanation).toContain('Filet');
  });

  it('should generate Dutch explanation for WITHIN_RANGE', () => {
    const explanation = generateContractDeviationExplanation(
      'breast_cap', 35, 30, 40, 'WITHIN_RANGE'
    );
    expect(explanation).toContain('binnen');
    expect(explanation).toContain('bandbreedte');
    expect(explanation).toContain('35.0%');
    expect(explanation).toContain('30% - 40%');
  });

  it('should generate Dutch explanation for BELOW_RANGE', () => {
    const explanation = generateContractDeviationExplanation(
      'leg_quarter', 25, 30, 40, 'BELOW_RANGE'
    );
    expect(explanation).toContain('lager');
    expect(explanation).toContain('minimum');
    expect(explanation).toContain('Poot');
  });

  it('should generate Dutch explanation for ABOVE_RANGE', () => {
    const explanation = generateContractDeviationExplanation(
      'wings', 45, 30, 40, 'ABOVE_RANGE'
    );
    expect(explanation).toContain('hoger');
    expect(explanation).toContain('maximum');
    expect(explanation).toContain('Vleugels');
  });
});

describe('generateMarginExplanation', () => {
  it('should generate explanation for low margin', () => {
    const explanation = generateMarginExplanation(
      'breast_cap', 3, 35, 35.85, 'COST_AVAILABLE'
    );
    expect(explanation).toContain('lage marge');
    expect(explanation).toContain('Filet');
  });

  it('should generate explanation for high margin', () => {
    const explanation = generateMarginExplanation(
      'breast_cap', 20, 35, 35.85, 'COST_AVAILABLE'
    );
    expect(explanation).toContain('hoge marge');
  });

  it('should generate explanation for average margin', () => {
    const explanation = generateMarginExplanation(
      'breast_cap', 10, 35, 35.85, 'COST_AVAILABLE'
    );
    expect(explanation).toContain('gemiddelde marge');
  });

  it('should indicate when cost data is missing', () => {
    const explanation = generateMarginExplanation(
      'breast_cap', 10, 35, 35.85, 'NO_COST_DATA'
    );
    expect(explanation).toContain('geen kostprijsdata');
    expect(explanation).toContain('onvolledig');
  });

  it('should include carcass context when share deviates significantly', () => {
    const explanation = generateMarginExplanation(
      'breast_cap', 10, 45, 35.85, 'COST_AVAILABLE' // +9.15% deviation
    );
    expect(explanation).toContain('meer afname dan karkasratio');
  });

  it('should note alignment when share is in line with carcass', () => {
    const explanation = generateMarginExplanation(
      'breast_cap', 10, 36, 35.85, 'COST_AVAILABLE' // +0.15% deviation
    );
    expect(explanation).toContain('in lijn met karkasratio');
  });
});

// ============================================================================
// MARGIN CONTEXT CALCULATION TESTS
// ============================================================================

describe('calculatePartMarginContext', () => {
  it('should calculate margin context with contract', () => {
    const result = calculatePartMarginContext(mockMarginData[0], mockContracts[0]);

    expect(result.customer_id).toBe('cust-001');
    expect(result.part_code).toBe('breast_cap');
    expect(result.margin_eur).toBe(400);
    expect(result.margin_pct).toBe(33.33);
    expect(result.carcass_share_pct).toBe(35.85); // JA757 reference
    expect(result.contract_deviation).not.toBeNull();
    expect(result.contract_deviation?.deviation_flag).toBe('ABOVE_RANGE'); // 40% > 38%
  });

  it('should calculate margin context without contract', () => {
    const result = calculatePartMarginContext(mockMarginData[0], null);

    expect(result.contract_deviation).not.toBeNull();
    expect(result.contract_deviation?.deviation_flag).toBe('NO_CONTRACT');
  });

  it('should calculate alignment deviation correctly', () => {
    const result = calculatePartMarginContext(mockMarginData[0], null);

    // customer_share_pct = 40, carcass_share_pct = 35.85
    // expected deviation = 40 - 35.85 = 4.15
    expect(result.alignment_deviation_pct).toBeCloseTo(4.15, 1);
  });
});

describe('calculateCustomerMarginContext', () => {
  it('should calculate full customer margin context', () => {
    const result = calculateCustomerMarginContext(mockMarginData, mockContracts);

    expect(result.customer_id).toBe('cust-001');
    expect(result.customer_name).toBe('Test Klant');
    expect(result.total_margin_eur).toBe(600); // 400 + 200
    expect(result.part_margins).toHaveLength(2);
  });

  it('should calculate total margin percentage correctly', () => {
    const result = calculateCustomerMarginContext(mockMarginData, mockContracts);

    // Total revenue = 1200 + 800 = 2000
    // Total margin = 400 + 200 = 600
    // Expected margin % = 600 / 2000 * 100 = 30%
    expect(result.total_margin_pct).toBe(30);
  });

  it('should handle empty margin data', () => {
    const result = calculateCustomerMarginContext([], []);

    expect(result.customer_id).toBe('');
    expect(result.total_margin_eur).toBe(0);
    expect(result.total_margin_pct).toBeNull();
    expect(result.overall_explanation).toContain('Geen verkoopdata');
  });
});

describe('generateOverallExplanation', () => {
  it('should describe low total margin', () => {
    const mockPartMargins: MarginContextResult[] = [
      {
        customer_id: 'cust-001',
        customer_name: 'Test',
        part_code: 'breast_cap',
        margin_eur: 100,
        margin_pct: 10,
        customer_share_pct: 36,
        carcass_share_pct: 35.85,
        alignment_deviation_pct: 0.15,
        contract_deviation: null,
        margin_explanation: '',
      },
    ];

    const explanation = generateOverallExplanation(mockPartMargins, 3);
    expect(explanation).toContain('Totale marge is laag');
  });

  it('should summarize contract deviations', () => {
    const mockPartMargins: MarginContextResult[] = [
      {
        customer_id: 'cust-001',
        customer_name: 'Test',
        part_code: 'breast_cap',
        margin_eur: 100,
        margin_pct: 10,
        customer_share_pct: 45,
        carcass_share_pct: 35.85,
        alignment_deviation_pct: 9.15,
        contract_deviation: {
          customer_id: 'cust-001',
          part_code: 'breast_cap',
          actual_share: 45,
          agreed_share_min: 30,
          agreed_share_max: 40,
          deviation_pct: 5,
          deviation_flag: 'ABOVE_RANGE',
          explanation: '',
        },
        margin_explanation: '',
      },
    ];

    const explanation = generateOverallExplanation(mockPartMargins, 10);
    expect(explanation).toContain('Contractafwijkingen');
    expect(explanation).toContain('Filet');
  });
});

// ============================================================================
// UI HELPER TESTS
// ============================================================================

describe('getMarginColorClass', () => {
  it('should return gray for null margin', () => {
    expect(getMarginColorClass(null)).toContain('gray');
  });

  it('should return red for negative margin', () => {
    expect(getMarginColorClass(-5)).toContain('red');
  });

  it('should return orange for low margin', () => {
    expect(getMarginColorClass(3)).toContain('orange');
  });

  it('should return green for high margin', () => {
    expect(getMarginColorClass(20)).toContain('green');
  });

  it('should return yellow for average margin', () => {
    expect(getMarginColorClass(10)).toContain('yellow');
  });
});

describe('getDeviationFlagColorClass', () => {
  it('should return green for WITHIN_RANGE', () => {
    expect(getDeviationFlagColorClass('WITHIN_RANGE')).toContain('green');
  });

  it('should return orange for BELOW_RANGE', () => {
    expect(getDeviationFlagColorClass('BELOW_RANGE')).toContain('orange');
  });

  it('should return blue for ABOVE_RANGE', () => {
    expect(getDeviationFlagColorClass('ABOVE_RANGE')).toContain('blue');
  });

  it('should return gray for NO_CONTRACT', () => {
    expect(getDeviationFlagColorClass('NO_CONTRACT')).toContain('gray');
  });
});

describe('getDeviationFlagLabel', () => {
  it('should return Dutch labels', () => {
    expect(getDeviationFlagLabel('WITHIN_RANGE')).toBe('Binnen afspraak');
    expect(getDeviationFlagLabel('BELOW_RANGE')).toBe('Onder minimum');
    expect(getDeviationFlagLabel('ABOVE_RANGE')).toBe('Boven maximum');
    expect(getDeviationFlagLabel('NO_CONTRACT')).toBe('Geen contract');
  });
});

describe('formatMargin', () => {
  it('should format positive margin', () => {
    const result = formatMargin(1234.56);
    expect(result).toContain('1.234,56');
    expect(result).toContain('€');
  });

  it('should format negative margin with minus sign', () => {
    const result = formatMargin(-500);
    expect(result).toContain('-');
    expect(result).toContain('500');
  });
});

describe('formatPercentage', () => {
  it('should format percentage without sign by default', () => {
    expect(formatPercentage(10)).toBe('10.0%');
    expect(formatPercentage(-5)).toBe('-5.0%');
  });

  it('should format percentage with sign when requested', () => {
    expect(formatPercentage(10, true)).toBe('+10.0%');
    expect(formatPercentage(-5, true)).toBe('-5.0%');
  });

  it('should return dash for null', () => {
    expect(formatPercentage(null)).toBe('-');
  });
});

// ============================================================================
// SPRINT 5 CONTRACT COMPLIANCE TESTS
// ============================================================================

describe('Sprint 5 Contract Compliance', () => {
  it('should NOT provide price advice in any explanation', () => {
    const explanation1 = generateMarginExplanation(
      'breast_cap', 3, 45, 35.85, 'COST_AVAILABLE'
    );
    const explanation2 = generateContractDeviationExplanation(
      'breast_cap', 25, 30, 40, 'BELOW_RANGE'
    );
    const explanation3 = generateOverallExplanation(
      [{ customer_id: '', customer_name: '', part_code: 'breast_cap',
         margin_eur: 100, margin_pct: 10, customer_share_pct: 40,
         carcass_share_pct: 35.85, alignment_deviation_pct: 4.15,
         contract_deviation: null, margin_explanation: '' }],
      10
    );

    // Check no price-related advice words
    const adviceWords = ['verhoog', 'verlaag', 'advies', 'aanbeveling', 'actie', 'moet', 'should'];
    for (const word of adviceWords) {
      expect(explanation1.toLowerCase()).not.toContain(word);
      expect(explanation2.toLowerCase()).not.toContain(word);
      expect(explanation3.toLowerCase()).not.toContain(word);
    }
  });

  it('should NOT rank or score customers in explanations', () => {
    const explanation = generateOverallExplanation(
      mockMarginData.map(m => ({
        customer_id: m.customer_id,
        customer_name: m.customer_name,
        part_code: m.part_code,
        margin_eur: m.margin_eur,
        margin_pct: m.margin_pct,
        customer_share_pct: m.customer_share_pct,
        carcass_share_pct: 35.85,
        alignment_deviation_pct: 4.15,
        contract_deviation: null,
        margin_explanation: '',
      })),
      30
    );

    // Check no ranking words
    const rankingWords = ['beste', 'slechtste', 'top', 'bottom', 'rank', 'score'];
    for (const word of rankingWords) {
      expect(explanation.toLowerCase()).not.toContain(word);
    }
  });

  it('should always link margin to carcass context', () => {
    const result = calculatePartMarginContext(mockMarginData[0], null);

    // Must have carcass share
    expect(result.carcass_share_pct).toBeDefined();
    expect(result.carcass_share_pct).toBeGreaterThan(0);

    // Must have alignment deviation when customer share exists
    expect(result.alignment_deviation_pct).toBeDefined();
  });

  it('should make all deviations explainable', () => {
    const result = calculatePartMarginContext(mockMarginData[0], mockContracts[0]);

    // Contract deviation must have explanation
    expect(result.contract_deviation?.explanation).toBeDefined();
    expect(result.contract_deviation?.explanation.length).toBeGreaterThan(0);

    // Margin must have explanation
    expect(result.margin_explanation).toBeDefined();
    expect(result.margin_explanation.length).toBeGreaterThan(0);
  });
});
