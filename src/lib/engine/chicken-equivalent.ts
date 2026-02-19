/**
 * Kip-Overzicht (Chicken Equivalent) Engine
 *
 * Inverse berekening: gegeven klantafname per categorie,
 * hoeveel hele kippen zijn daarvoor nodig, en wat is de
 * natuurlijke productie van die kippen over ALLE delen?
 *
 * Doel: visualiseren van het "surplus probleem" —
 * als een klant X kg filet koopt, hoeveel dij/drumstick/etc
 * moeten daar onvermijdelijk bij geproduceerd worden?
 *
 * REGRESSIE-CHECK:
 * - Pure functie, geen side-effects
 * - Hergebruikt ANATOMICAL_NORMS uit cherry-picker.ts
 * - hele_kip uitgesloten (per definitie gebalanceerd)
 * - Griller gewicht configureerbaar (default: 1.96 kg)
 */

import type { ProductCategory } from '@/types/database';
import {
  ANATOMICAL_NORMS,
  type CategoryBreakdown,
} from './cherry-picker';

// ============================================================================
// TYPES
// ============================================================================

/** Configuratie voor de berekening */
export interface ChickenEquivalentConfig {
  /** Gemiddeld grillergewicht in kg */
  avg_griller_weight_kg: number;
  /**
   * Optioneel: bekijk vanuit een specifiek perspectief.
   * Als opgegeven: bereken kippen nodig puur voor deze categorie
   * (ipv de categorie die het meeste kippen nodig heeft).
   * Als undefined: auto-detect leading (= max kippen nodig).
   */
  perspective_category?: ProductCategory;
}

/** Resultaat per productcategorie */
export interface CategoryChickenDemand {
  category: ProductCategory;
  /** Kg door klant afgenomen */
  klant_afname_kg: number;
  /** Kg die de kippen natuurlijk produceren */
  natuurlijke_productie_kg: number;
  /** Surplus (positief) of tekort (negatief) */
  delta_kg: number;
  /** Anatomische norm percentage */
  norm_pct: number;
  /** Hoeveel kippen nodig PUUR voor deze categorie */
  kippen_nodig_voor_categorie: number;
}

/** Totaalresultaat van kip-overzicht berekening */
export interface ChickenEquivalentResult {
  /** De categorie die het meeste kippen "eist" (de bottleneck) */
  leading_category: ProductCategory;
  /** Totaal aantal kippen nodig (bepaald door leading category) */
  totaal_kippen_nodig: number;
  /** Totaal grillergewicht in kg */
  totaal_griller_kg: number;
  /** Breakdown per categorie */
  categories: CategoryChickenDemand[];
  /** Totaal surplus kg (som van alle positieve delta's) */
  totaal_surplus_kg: number;
  /** Totaal tekort kg (som van alle negatieve delta's, als positief getal) */
  totaal_tekort_kg: number;
  /** Gemiddeld grillergewicht gebruikt */
  avg_griller_weight_kg: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default grillergewicht voor Oranjehoen.
 *
 * Oranjehoen kippen (Sasso ras):
 * - Levend gewicht: 2,6 – 2,85 kg (afhankelijk van batch)
 * - Grillergewicht = 72% van levend gewicht
 * - Bereik: 1,87 – 2,05 kg → gemiddeld ~1,96 kg
 *
 * Bron: Oranjehoen slachtrapporten
 */
export const DEFAULT_GRILLER_WEIGHT_KG = 1.96;

export const DEFAULT_CHICKEN_EQUIVALENT_CONFIG: ChickenEquivalentConfig = {
  avg_griller_weight_kg: DEFAULT_GRILLER_WEIGHT_KG,
};

// ============================================================================
// CORE ENGINE
// ============================================================================

/**
 * Bereken het kip-equivalent overzicht.
 *
 * Algoritme:
 * 1. Filter hele_kip en categorieën met 0 kg uit
 * 2. Voor elke categorie: kippen_nodig = klant_kg / (norm_pct/100 * griller_gewicht)
 * 3. Leading category:
 *    - Als perspective_category opgegeven → gebruik die
 *    - Anders → categorie met het HOOGSTE kippen_nodig (auto-detect)
 * 4. Voor ALLE categorieën: natuurlijke_productie = totaal_kippen * norm_pct/100 * griller_gewicht
 * 5. Delta = natuurlijke_productie - klant_afname
 *    Positief = surplus (onverkocht), Negatief = tekort (klant wil meer dan beschikbaar)
 *
 * @param categoryBreakdown - Breakdown per categorie uit cherry-picker analyse
 * @param config - Configuratie (grillergewicht)
 */
export function calculateChickenEquivalent(
  categoryBreakdown: CategoryBreakdown[],
  config: ChickenEquivalentConfig = DEFAULT_CHICKEN_EQUIVALENT_CONFIG,
): ChickenEquivalentResult {
  const { avg_griller_weight_kg } = config;

  // Bouw norm-map vanuit ANATOMICAL_NORMS (canonical source)
  // Filter hele_kip eruit — per definitie gebalanceerd
  const normMap = new Map<ProductCategory, number>(
    ANATOMICAL_NORMS
      .filter(n => n.category !== 'hele_kip')
      .map(n => [n.category, n.ratio_pct])
  );

  // Stap 1 & 2: Voor elke categorie die de klant afneemt, bereken kippen nodig
  const demands: Array<{
    category: ProductCategory;
    klant_kg: number;
    norm_pct: number;
    kippen_nodig: number;
  }> = [];

  for (const item of categoryBreakdown) {
    if (item.category === 'hele_kip') continue;
    if (item.quantity_kg <= 0) continue;

    const normPct = normMap.get(item.category);
    if (!normPct || normPct <= 0) continue;

    // Hoeveel kg levert één kip van deze categorie?
    const yieldPerChicken = (normPct / 100) * avg_griller_weight_kg;
    const kippenNodig = item.quantity_kg / yieldPerChicken;

    demands.push({
      category: item.category,
      klant_kg: item.quantity_kg,
      norm_pct: normPct,
      kippen_nodig: kippenNodig,
    });
  }

  // Edge case: geen data
  if (demands.length === 0) {
    return {
      leading_category: 'filet',
      totaal_kippen_nodig: 0,
      totaal_griller_kg: 0,
      categories: [],
      totaal_surplus_kg: 0,
      totaal_tekort_kg: 0,
      avg_griller_weight_kg,
    };
  }

  // Stap 3: Leading category bepalen
  // Als perspective_category is opgegeven → gebruik die als basis
  // Anders → auto-detect: de categorie met de meeste kippen nodig
  const { perspective_category } = config;

  let leading: typeof demands[number];
  if (perspective_category) {
    const perspectiveDemand = demands.find(d => d.category === perspective_category);
    if (perspectiveDemand) {
      leading = perspectiveDemand;
    } else {
      // Perspective-categorie niet in klantafname → bereken kippen voor 0 kg
      // (fallback: norm is bekend maar klant neemt niks af → 0 kippen)
      const normPct = normMap.get(perspective_category);
      leading = {
        category: perspective_category,
        klant_kg: 0,
        norm_pct: normPct ?? 0,
        kippen_nodig: 0,
      };
    }
  } else {
    leading = demands.reduce((max, d) =>
      d.kippen_nodig > max.kippen_nodig ? d : max
    );
  }

  const totaalKippen = leading.kippen_nodig;
  const totaalGrillerKg = totaalKippen * avg_griller_weight_kg;

  // Stap 4 & 5: Bereken natuurlijke productie en delta voor ALLE norm-categorieën
  const categories: CategoryChickenDemand[] = [];
  let totaalSurplus = 0;
  let totaalTekort = 0;

  for (const [category, normPct] of normMap) {
    const klantItem = demands.find(d => d.category === category);
    const klantKg = klantItem?.klant_kg ?? 0;
    const natuurlijkeProductie = totaalKippen * (normPct / 100) * avg_griller_weight_kg;
    const delta = natuurlijkeProductie - klantKg;

    if (delta > 0) totaalSurplus += delta;
    if (delta < 0) totaalTekort += Math.abs(delta);

    categories.push({
      category,
      klant_afname_kg: Number(klantKg.toFixed(2)),
      natuurlijke_productie_kg: Number(natuurlijkeProductie.toFixed(2)),
      delta_kg: Number(delta.toFixed(2)),
      norm_pct: normPct,
      kippen_nodig_voor_categorie: Number((klantItem?.kippen_nodig ?? 0).toFixed(2)),
    });
  }

  // Sorteer: leading category eerst, dan op delta (grootste surplus eerst)
  categories.sort((a, b) => {
    if (a.category === leading.category) return -1;
    if (b.category === leading.category) return 1;
    return b.delta_kg - a.delta_kg;
  });

  return {
    leading_category: leading.category,
    totaal_kippen_nodig: Number(totaalKippen.toFixed(2)),
    totaal_griller_kg: Number(totaalGrillerKg.toFixed(2)),
    categories,
    totaal_surplus_kg: Number(totaalSurplus.toFixed(2)),
    totaal_tekort_kg: Number(totaalTekort.toFixed(2)),
    avg_griller_weight_kg,
  };
}
