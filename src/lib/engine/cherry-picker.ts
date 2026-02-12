/**
 * Cherry-Picker Detectie Engine
 *
 * Kernlogica uit TRD Hoofdstuk 3.3:
 *
 * Een kip heeft vaste anatomische verhoudingen (biologische realiteit):
 * - Filet: ~24% van levend gewicht
 * - Dij: ~14%
 * - Drumstick: ~12%
 * - etc.
 *
 * Een "Cherry Picker" is een klant die disproportioneel premium delen (filet)
 * afneemt zonder de rest te compenseren. Dit verstoort de vierkantsverwaarding.
 *
 * Detectie criteria:
 * 1. Klant omzet > €10.000
 * 2. Filet afname > 30% van totaalvolume (terwijl anatomisch ~24% beschikbaar)
 *
 * Balance Score:
 * - 100 = Perfecte anatomische mix
 * - 50 = Gemiddeld scheef
 * - 0 = Extreme cherry picker
 */

import type { ProductCategory, AnatomicalPart } from '@/types/database';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Anatomische ratio's per productcategorie
 * Gebaseerd op Hubbard JA757 data uit TRD
 */
export interface AnatomicalNorm {
  category: ProductCategory;
  anatomical_part: AnatomicalPart;
  /** Percentage van totaal beschikbaar gewicht */
  ratio_pct: number;
  /** Threshold voor cherry picker alert */
  cherry_picker_threshold_pct: number;
}

/**
 * Klant afname per productcategorie
 */
export interface CustomerProductMix {
  category: ProductCategory;
  quantity_kg: number;
  revenue: number;
}

/**
 * Resultaat van cherry picker analyse
 */
export interface CherryPickerAnalysis {
  customer_id: string;
  customer_name: string;
  total_revenue: number;
  total_kg: number;

  /** Balance score (0-100, hoger = beter gebalanceerd) */
  balance_score: number;

  /** Is deze klant een cherry picker? */
  is_cherry_picker: boolean;

  /** Breakdown per categorie */
  category_breakdown: CategoryBreakdown[];

  /** Opportunity cost: geschatte impact op vierkantsverwaarding */
  opportunity_cost: number;

  /** Aanbeveling voor sales team */
  recommendation: string;

  /** Warnings/alerts */
  alerts: CherryPickerAlert[];
}

export interface CategoryBreakdown {
  category: ProductCategory;
  quantity_kg: number;
  percentage_of_total: number;
  anatomical_ratio: number;
  deviation: number; // Afwijking van norm (positief = te veel, negatief = te weinig)
  status: 'balanced' | 'over' | 'under';
}

export interface CherryPickerAlert {
  severity: 'info' | 'warning' | 'critical';
  category: ProductCategory;
  message: string;
  deviation_pct: number;
}

// ============================================================================
// CONSTANTS: Anatomische Normen (Hubbard JA757)
// ============================================================================

export const ANATOMICAL_NORMS: AnatomicalNorm[] = [
  {
    category: 'filet',
    anatomical_part: 'breast_cap',
    ratio_pct: 24.0,
    cherry_picker_threshold_pct: 30.0,
  },
  {
    category: 'haas',
    anatomical_part: 'breast_cap',
    ratio_pct: 2.5,
    cherry_picker_threshold_pct: 5.0,
  },
  {
    category: 'dij',
    anatomical_part: 'leg_quarter',
    ratio_pct: 14.0,
    cherry_picker_threshold_pct: 20.0,
  },
  {
    category: 'drumstick',
    anatomical_part: 'leg_quarter',
    ratio_pct: 12.0,
    cherry_picker_threshold_pct: 18.0,
  },
  {
    category: 'drumvlees',
    anatomical_part: 'leg_quarter',
    ratio_pct: 7.5,
    cherry_picker_threshold_pct: 12.0,
  },
  {
    category: 'vleugels',
    anatomical_part: 'wings',
    ratio_pct: 10.7,
    cherry_picker_threshold_pct: 15.0,
  },
  {
    category: 'karkas',
    anatomical_part: 'back_carcass',
    ratio_pct: 7.5,
    cherry_picker_threshold_pct: 12.0,
  },
  {
    category: 'organen',
    anatomical_part: 'offal',
    ratio_pct: 5.0,
    cherry_picker_threshold_pct: 8.0,
  },
  {
    category: 'hele_kip',
    anatomical_part: 'breast_cap', // Fictief, hele kip is balanced by definition
    ratio_pct: 100.0,
    cherry_picker_threshold_pct: 100.0,
  },
];

/** Minimum omzet voor cherry picker analyse (TRD: €10.000) */
export const MINIMUM_REVENUE_THRESHOLD = 10000;

/** Premium categorieën die cherry picking indiceren */
export const PREMIUM_CATEGORIES: ProductCategory[] = ['filet', 'haas'];

// ============================================================================
// CORE ENGINE
// ============================================================================

/**
 * Analyseer of een klant een cherry picker is
 *
 * @param customerId - Klant ID
 * @param customerName - Klant naam
 * @param productMix - Afname per productcategorie
 * @param options - Configuratie opties
 */
export function analyzeCherryPicker(
  customerId: string,
  customerName: string,
  productMix: CustomerProductMix[],
  options: {
    /** Minimum omzet voor analyse (default: 10000) */
    minRevenue?: number;
    /** Custom anatomische normen */
    customNorms?: AnatomicalNorm[];
  } = {}
): CherryPickerAnalysis {
  const {
    minRevenue = MINIMUM_REVENUE_THRESHOLD,
    customNorms = ANATOMICAL_NORMS,
  } = options;

  // Bereken totalen
  const totalRevenue = productMix.reduce((sum, p) => sum + p.revenue, 0);
  const totalKg = productMix.reduce((sum, p) => sum + p.quantity_kg, 0);

  // Filter niet-verkoopbare categorieën
  const saleableCategories: ProductCategory[] = [
    'hele_kip', 'filet', 'haas', 'dij', 'drumstick',
    'drumvlees', 'vleugels', 'karkas', 'organen',
  ];

  const filteredMix = productMix.filter(p =>
    saleableCategories.includes(p.category)
  );

  // Als totale omzet onder threshold, geen volledige analyse
  if (totalRevenue < minRevenue) {
    return {
      customer_id: customerId,
      customer_name: customerName,
      total_revenue: totalRevenue,
      total_kg: totalKg,
      balance_score: 100, // Default: geen data = geen oordeel
      is_cherry_picker: false,
      category_breakdown: [],
      opportunity_cost: 0,
      recommendation: `Omzet (€${totalRevenue.toFixed(2)}) onder drempel (€${minRevenue}). Geen cherry picker analyse.`,
      alerts: [],
    };
  }

  // Bereken breakdown per categorie
  const categoryBreakdown: CategoryBreakdown[] = [];
  const alerts: CherryPickerAlert[] = [];

  for (const norm of customNorms) {
    const customerData = filteredMix.find(p => p.category === norm.category);
    const quantity_kg = customerData?.quantity_kg || 0;
    const percentage = totalKg > 0 ? (quantity_kg / totalKg) * 100 : 0;
    const deviation = percentage - norm.ratio_pct;

    let status: 'balanced' | 'over' | 'under' = 'balanced';
    if (deviation > 5) status = 'over';
    else if (deviation < -5) status = 'under';

    categoryBreakdown.push({
      category: norm.category,
      quantity_kg,
      percentage_of_total: Number(percentage.toFixed(2)),
      anatomical_ratio: norm.ratio_pct,
      deviation: Number(deviation.toFixed(2)),
      status,
    });

    // Check voor alerts
    if (percentage > norm.cherry_picker_threshold_pct) {
      const severity = PREMIUM_CATEGORIES.includes(norm.category)
        ? 'critical'
        : 'warning';

      alerts.push({
        severity,
        category: norm.category,
        message: `${norm.category} afname (${percentage.toFixed(1)}%) overschrijdt threshold (${norm.cherry_picker_threshold_pct}%)`,
        deviation_pct: Number(deviation.toFixed(2)),
      });
    }
  }

  // Bereken balance score
  const balanceScore = calculateBalanceScore(categoryBreakdown);

  // Check cherry picker status (TRD: filet > 30%)
  const filetBreakdown = categoryBreakdown.find(c => c.category === 'filet');
  const isCherryPicker = filetBreakdown
    ? filetBreakdown.percentage_of_total > 30
    : false;

  // Bereken opportunity cost
  const opportunityCost = calculateOpportunityCost(
    categoryBreakdown,
    totalKg,
    customNorms
  );

  // Genereer aanbeveling
  const recommendation = generateRecommendation(
    isCherryPicker,
    balanceScore,
    categoryBreakdown,
    opportunityCost
  );

  return {
    customer_id: customerId,
    customer_name: customerName,
    total_revenue: Number(totalRevenue.toFixed(2)),
    total_kg: Number(totalKg.toFixed(2)),
    balance_score: balanceScore,
    is_cherry_picker: isCherryPicker,
    category_breakdown: categoryBreakdown,
    opportunity_cost: Number(opportunityCost.toFixed(2)),
    recommendation,
    alerts,
  };
}

/**
 * Bereken balance score (0-100)
 *
 * Score berekening:
 * - Start bij 100
 * - Trek punten af voor afwijkingen van anatomische ratio
 * - Premium categorieën (filet, haas) wegen zwaarder
 */
function calculateBalanceScore(breakdown: CategoryBreakdown[]): number {
  let score = 100;
  const premiumWeight = 2.0;
  const normalWeight = 1.0;

  for (const item of breakdown) {
    if (item.quantity_kg === 0) continue;

    const weight = PREMIUM_CATEGORIES.includes(item.category)
      ? premiumWeight
      : normalWeight;

    // Absolute afwijking, gewogen
    const penalty = Math.abs(item.deviation) * weight * 0.5;
    score -= penalty;
  }

  // Clamp tussen 0 en 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Bereken opportunity cost
 *
 * Dit is de geschatte waarde van onverkochte "rest" delen
 * die overblijven door disproportionele premium afname.
 */
function calculateOpportunityCost(
  breakdown: CategoryBreakdown[],
  totalKg: number,
  norms: AnatomicalNorm[]
): number {
  let opportunityCost = 0;

  // Gemiddelde marktprijzen per categorie (vereenvoudigd)
  const avgPrices: Partial<Record<ProductCategory, number>> = {
    filet: 9.50,
    haas: 11.00,
    dij: 7.25,
    drumstick: 6.90,
    drumvlees: 7.90,
    vleugels: 5.50,
    karkas: 2.25,
    organen: 3.50,
  };

  for (const item of breakdown) {
    // Als klant te veel premium neemt, berekenen we de "gedwongen rest"
    if (item.deviation > 0 && PREMIUM_CATEGORIES.includes(item.category)) {
      // Hoeveel kg heeft klant te veel genomen?
      const excessKg = (item.deviation / 100) * totalKg;

      // Dit creëert een overschot aan rest-delen
      // Vereenvoudigd: we nemen aan dat dit karkas/rest wordt
      const restPrice = avgPrices.karkas || 2.25;
      const premiumPrice = avgPrices[item.category] || 9.50;

      // Opportunity cost = verschil in waarde
      opportunityCost += excessKg * (premiumPrice - restPrice) * 0.5;
    }
  }

  return opportunityCost;
}

/**
 * Genereer aanbeveling voor sales team
 */
function generateRecommendation(
  isCherryPicker: boolean,
  balanceScore: number,
  breakdown: CategoryBreakdown[],
  opportunityCost: number
): string {
  if (!isCherryPicker && balanceScore >= 80) {
    return 'Klant heeft een gebalanceerde afname. Geen actie nodig.';
  }

  if (isCherryPicker) {
    const filet = breakdown.find(c => c.category === 'filet');
    const filetPct = filet?.percentage_of_total || 0;

    if (opportunityCost > 500) {
      return `ACTIE VEREIST: Cherry picker met €${opportunityCost.toFixed(0)} opportunity cost. ` +
        `Filet afname: ${filetPct.toFixed(1)}% (max 30%). ` +
        `Bespreek vierkantsverwaarding of pas pricing aan.`;
    }

    return `Cherry picker gedetecteerd (filet: ${filetPct.toFixed(1)}%). ` +
      `Overweeg package deals met dark meat.`;
  }

  if (balanceScore < 50) {
    const overCategories = breakdown
      .filter(c => c.status === 'over')
      .map(c => c.category)
      .join(', ');

    return `Scheve afname: focus op ${overCategories}. ` +
      `Balance score: ${balanceScore}/100. Bespreek productmix.`;
  }

  return `Balance score: ${balanceScore}/100. Monitor afname patroon.`;
}

// ============================================================================
// BULK ANALYSIS
// ============================================================================

/**
 * Analyseer alle klanten en sorteer op cherry picker risico
 */
export function analyzeAllCustomers(
  customers: Array<{
    id: string;
    name: string;
    productMix: CustomerProductMix[];
  }>
): CherryPickerAnalysis[] {
  return customers
    .map(c => analyzeCherryPicker(c.id, c.name, c.productMix))
    .sort((a, b) => {
      // Cherry pickers eerst
      if (a.is_cherry_picker && !b.is_cherry_picker) return -1;
      if (!a.is_cherry_picker && b.is_cherry_picker) return 1;
      // Dan op balance score (laag = slecht)
      return a.balance_score - b.balance_score;
    });
}
