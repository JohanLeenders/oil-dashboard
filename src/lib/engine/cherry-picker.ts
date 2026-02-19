/**
 * Cherry-Picker Detectie Engine
 *
 * Een kip heeft vaste anatomische verhoudingen (biologische realiteit).
 * Normen gebaseerd op werkelijke Oranjehoen griller rendementen
 * (bron: "rendementen van product uit griller.xlsx", kolom I).
 *
 * Oranjehoen griller rendementen (Sprint 16D gecorrigeerd):
 * - Filet: 22.0% (20.5% gemeten + 1.5% correctie naar 100%)
 * - Haas: ~2.5%
 * - Dij: 15% (dijfilet, ontbeend — gemeten uit griller)
 * - Drumstick: 14% (hele drumstick, mét bot)
 * - Drumvlees: 8.75% (14% drumstick × 62.5% yield)
 * - Vleugels: 9.2%
 * - Vel: 2.25% (2% gemeten + 0.25% correctie naar 100%)
 * - Karkas: 21.3%
 * - Organen: ~5%
 *
 * Een "Cherry Picker" is een klant die disproportioneel premium delen (filet)
 * afneemt zonder de rest te compenseren. Dit verstoort de vierkantsverwaarding.
 *
 * Detectie criteria:
 * 1. Klant omzet > €10.000
 * 2. Filet afname > 28% van totaalvolume (terwijl anatomisch 23.5% beschikbaar)
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
 * Gebaseerd op werkelijke Oranjehoen griller rendementen
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

  /** Opportunity cost breakdown per surplus-categorie */
  opportunity_cost_breakdown: OpportunityCostBreakdown[];

  /** Aantal kippen nodig (bepaald door leading category) */
  kippen_nodig: number;

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

/**
 * Opportunity cost breakdown per categorie.
 * Toont per surplus-categorie hoeveel kg onverkocht is en wat dat kost.
 */
export interface OpportunityCostBreakdown {
  category: ProductCategory;
  /** Surplus kg: productie - afname (alleen categorieën met surplus > 0) */
  surplus_kg: number;
  /** Echte kg-prijs uit import, of €0.20 voor karkas */
  kg_prijs: number;
  /** surplus_kg × kg_prijs */
  opportunity_cost: number;
}

// ============================================================================
// CONSTANTS: Anatomische Normen (Oranjehoen Griller Rendementen)
//
// Bronnen:
//   Blad1: "rendementen van product uit griller.xlsx" — kolom I (directe yields)
//   Filet-dijvlees: "Opdelen hele kip" — volledige yield-tree
//
// Rendementen t.o.v. de griller (Nijkerk/Putten).
// NB: griller = kip zonder vet, bloed, veren — organen apart.
//
// Dij = dijfilet (ontbeend, ZONDER bot) — 15% gemeten uit griller.
// Drumstick = hele drumstick MÉT bot — 14%.
// Drumvlees = ontbeend drumvlees, 62.5% yield uit drumstick → 8.75%.
//
// Karkas = rug voor (7.9%) + rug achter (12.62%) + staart (0.78%) = 21.3%
// (berekend uit Filet-dijvlees tabblad: bout-met-rug opdeling)
//
// Totaal excl. hele_kip: 100%
//   filet +1.5% boven directe meting, vel +0.25% correctie
//
// Cherry-picker threshold = norm + ~5-6pp marge, afgerond.
// ============================================================================

export const ANATOMICAL_NORMS: AnatomicalNorm[] = [
  {
    category: 'filet',
    anatomical_part: 'breast_cap',
    ratio_pct: 22.0,    // OH flt half (20.5% Blad1) + 1.5% correctie naar 100%
    cherry_picker_threshold_pct: 28.0,
  },
  {
    category: 'haas',
    anatomical_part: 'breast_cap',
    ratio_pct: 2.5,     // Afgeleid: filet+haas=66% van borst(34.89%) = 23% → haas ≈ 2.5%
    cherry_picker_threshold_pct: 5.0,
  },
  {
    category: 'dij',
    anatomical_part: 'leg_quarter',
    ratio_pct: 15.0,    // Dijfilet (ontbeend, zonder bot) — gemeten uit griller (Blad1)
    cherry_picker_threshold_pct: 21.0,
  },
  {
    category: 'drumstick',
    anatomical_part: 'leg_quarter',
    ratio_pct: 14.0,    // Hele drumstick mét bot (Blad1)
    cherry_picker_threshold_pct: 20.0,
  },
  {
    category: 'drumvlees',
    anatomical_part: 'leg_quarter',
    ratio_pct: 8.75,    // Drumvlees = 14% drumstick × 62.5% yield = 8.75%
    cherry_picker_threshold_pct: 13.0,
  },
  {
    category: 'vleugels',
    anatomical_part: 'wings',
    ratio_pct: 9.2,     // Vleugels mix / z tip (Blad1)
    cherry_picker_threshold_pct: 14.0,
  },
  {
    category: 'karkas',
    anatomical_part: 'back_carcass',
    ratio_pct: 21.3,    // Rug voor (7.9%) + rug achter (12.62%) + staart (0.78%)
    cherry_picker_threshold_pct: 30.0,
  },
  {
    category: 'organen',
    anatomical_part: 'offal',
    ratio_pct: 5.0,     // Niet apart gemeten, schatting
    cherry_picker_threshold_pct: 8.0,
  },
  {
    category: 'vel',
    anatomical_part: 'breast_cap',
    ratio_pct: 2.25,    // ~2% los vel + 0.25% correctie naar 100%
    cherry_picker_threshold_pct: 5.0,
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
    'drumvlees', 'vleugels', 'karkas', 'organen', 'vel',
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
      opportunity_cost_breakdown: [],
      kippen_nodig: 0,
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

  // Check cherry picker status: filet > 28% (norm 20.5%, threshold 28%)
  const filetBreakdown = categoryBreakdown.find(c => c.category === 'filet');
  const filetThreshold = customNorms.find(n => n.category === 'filet')?.cherry_picker_threshold_pct ?? 28;
  const isCherryPicker = filetBreakdown
    ? filetBreakdown.percentage_of_total > filetThreshold
    : false;

  // Bereken opportunity cost (via vierkantsverwaarding surplus)
  const oppResult = calculateOpportunityCost(
    categoryBreakdown,
    totalKg,
    customNorms,
    filteredMix
  );

  // Genereer aanbeveling
  const recommendation = generateRecommendation(
    isCherryPicker,
    balanceScore,
    categoryBreakdown,
    oppResult.total
  );

  return {
    customer_id: customerId,
    customer_name: customerName,
    total_revenue: Number(totalRevenue.toFixed(2)),
    total_kg: Number(totalKg.toFixed(2)),
    balance_score: balanceScore,
    is_cherry_picker: isCherryPicker,
    category_breakdown: categoryBreakdown,
    opportunity_cost: Number(oppResult.total.toFixed(2)),
    opportunity_cost_breakdown: oppResult.breakdown,
    kippen_nodig: Number(oppResult.kippenNodig.toFixed(0)),
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

/** Karkas byproduct prijs: €0,20/kg (afval/restwaarde) */
export const KARKAS_BYPRODUCT_PRICE = 0.20;

/** Default grillergewicht — synced met chicken-equivalent.ts */
const OPP_COST_GRILLER_KG = 1.96;

/**
 * Bereken opportunity cost via vierkantsverwaarding (chicken-equivalent surplus).
 *
 * Logica: als een klant X kippen nodig heeft voor zijn leading-category,
 * produceren die kippen ook alle andere delen. Delen die de klant NIET
 * afneemt (surplus) zijn "onverkocht" en vormen de opportunity cost.
 *
 * Per surplus-categorie: surplus_kg × echte kg-prijs.
 * Karkas = byproduct, vast €0,20/kg.
 *
 * NB: Inline chicken-equivalent berekening (geen import) om circulaire
 * dependency te voorkomen. Volgt exact dezelfde logica als
 * calculateChickenEquivalent() uit chicken-equivalent.ts.
 */
interface OpportunityCostResult {
  total: number;
  breakdown: OpportunityCostBreakdown[];
  kippenNodig: number;
}

function calculateOpportunityCost(
  breakdown: CategoryBreakdown[],
  totalKg: number,
  _norms: AnatomicalNorm[],
  productMix: CustomerProductMix[]
): OpportunityCostResult {
  const EMPTY: OpportunityCostResult = { total: 0, breakdown: [], kippenNodig: 0 };
  if (totalKg === 0) return EMPTY;

  // --- Inline chicken-equivalent: bepaal leading category en surplus ---

  // Norm-map zonder hele_kip
  const normMap = new Map<ProductCategory, number>(
    ANATOMICAL_NORMS
      .filter(n => n.category !== 'hele_kip')
      .map(n => [n.category, n.ratio_pct])
  );

  // Per categorie: hoeveel kippen nodig?
  let maxKippen = 0;
  const klantKgMap = new Map<ProductCategory, number>();

  for (const item of breakdown) {
    if (item.category === 'hele_kip') continue;
    if (item.quantity_kg <= 0) continue;

    const normPct = normMap.get(item.category);
    if (!normPct || normPct <= 0) continue;

    klantKgMap.set(item.category, item.quantity_kg);
    const yieldPerChicken = (normPct / 100) * OPP_COST_GRILLER_KG;
    const kippenNodig = item.quantity_kg / yieldPerChicken;
    if (kippenNodig > maxKippen) maxKippen = kippenNodig;
  }

  if (maxKippen === 0) return EMPTY;

  // --- Echte kg-prijzen uit de import ---
  const kgPrices = new Map<ProductCategory, number>();
  for (const item of productMix) {
    if (item.quantity_kg > 0) {
      kgPrices.set(item.category, item.revenue / item.quantity_kg);
    }
  }

  // Gemiddelde kg-prijs als fallback voor categorieën die de klant niet koopt
  const allPrices = Array.from(kgPrices.values());
  const avgKgPrice = allPrices.length > 0
    ? allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length
    : 0;

  // --- Bereken surplus per categorie en waardeer ---
  let total = 0;
  const oppBreakdown: OpportunityCostBreakdown[] = [];

  for (const [category, normPct] of normMap) {
    const klantKg = klantKgMap.get(category) ?? 0;
    const productie = maxKippen * (normPct / 100) * OPP_COST_GRILLER_KG;
    const surplus = productie - klantKg;

    // Alleen surplus (> 0) telt als opportunity cost
    if (surplus <= 0) continue;

    // Karkas = byproduct, vaste prijs €0,20/kg
    const prijs = category === 'karkas'
      ? KARKAS_BYPRODUCT_PRICE
      : (kgPrices.get(category) ?? avgKgPrice);

    const cost = surplus * prijs;
    total += cost;

    oppBreakdown.push({
      category,
      surplus_kg: Number(surplus.toFixed(2)),
      kg_prijs: Number(prijs.toFixed(2)),
      opportunity_cost: Number(cost.toFixed(2)),
    });
  }

  // Sorteer: hoogste opportunity cost eerst
  oppBreakdown.sort((a, b) => b.opportunity_cost - a.opportunity_cost);

  return { total, breakdown: oppBreakdown, kippenNodig: maxKippen };
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
        `Filet afname: ${filetPct.toFixed(1)}% (max 28%). ` +
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
