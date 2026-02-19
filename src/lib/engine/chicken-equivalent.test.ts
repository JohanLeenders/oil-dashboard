/**
 * Unit Tests voor Kip-Overzicht (Chicken Equivalent) Engine
 *
 * Validatiecase: Zorg&Natuur BV (filet 34.2%, cherry picker)
 * Default grillergewicht: 1.96 kg
 */

import { describe, it, expect } from 'vitest';
import {
  calculateChickenEquivalent,
  DEFAULT_GRILLER_WEIGHT_KG,
  type ChickenEquivalentConfig,
} from './chicken-equivalent';
import type { CategoryBreakdown } from './cherry-picker';

// Helper: maak een CategoryBreakdown object
function makeBreakdown(
  category: string,
  quantity_kg: number,
  anatomical_ratio: number,
): CategoryBreakdown {
  const percentage_of_total = 0; // niet gebruikt in deze engine
  const deviation = percentage_of_total - anatomical_ratio;
  return {
    category: category as CategoryBreakdown['category'],
    quantity_kg,
    percentage_of_total,
    anatomical_ratio,
    deviation,
    status: deviation > 5 ? 'over' : deviation < -5 ? 'under' : 'balanced',
  };
}

describe('calculateChickenEquivalent', () => {
  it('P0: filet-only cherry picker — filet is leading category', () => {
    // Klant koopt alleen 1000 kg filet
    // kippen_nodig = 1000 / (0.22 * 1.96) = 1000 / 0.4312 = 2319.0
    const breakdown: CategoryBreakdown[] = [
      makeBreakdown('filet', 1000, 22.0),
    ];

    const result = calculateChickenEquivalent(breakdown);

    expect(result.leading_category).toBe('filet');
    expect(result.totaal_kippen_nodig).toBeCloseTo(2319.0, 0);

    // Filet delta moet ≈ 0 zijn (leading category produceert precies genoeg)
    const filet = result.categories.find(c => c.category === 'filet');
    expect(filet).toBeDefined();
    expect(Math.abs(filet!.delta_kg)).toBeLessThan(1);

    // Dij moet volledig surplus zijn (klant neemt 0 dij)
    const dij = result.categories.find(c => c.category === 'dij');
    expect(dij).toBeDefined();
    expect(dij!.klant_afname_kg).toBe(0);
    expect(dij!.delta_kg).toBeGreaterThan(650); // 2319 * 0.15 * 1.96 ≈ 681.8 kg
    expect(dij!.natuurlijke_productie_kg).toBeCloseTo(681.8, 0);

    // Karkas surplus (21.3% norm)
    const karkas = result.categories.find(c => c.category === 'karkas');
    expect(karkas!.delta_kg).toBeGreaterThan(950); // 2319 * 0.213 * 1.96 ≈ 967.7 kg

    // Totaal surplus moet groot zijn (bijna alles behalve filet)
    expect(result.totaal_surplus_kg).toBeGreaterThan(3500);
    expect(result.totaal_tekort_kg).toBe(0);
  });

  it('P0: gebalanceerde klant — alle delta\'s dicht bij nul', () => {
    // Product mix die exact de anatomische normen volgt (Sprint 16D)
    // Totaal: 10.000 kg, verdeeld naar ratio's
    const breakdown: CategoryBreakdown[] = [
      makeBreakdown('filet', 2200, 22.0),      // 22.0%
      makeBreakdown('haas', 250, 2.5),         // 2.5%
      makeBreakdown('dij', 1500, 15.0),        // 15%
      makeBreakdown('drumstick', 1400, 14.0),  // 14%
      makeBreakdown('drumvlees', 875, 8.75),   // 8.75%
      makeBreakdown('vleugels', 920, 9.2),     // 9.2%
      makeBreakdown('karkas', 2130, 21.3),     // 21.3%
      makeBreakdown('organen', 500, 5.0),      // 5%
      makeBreakdown('vel', 225, 2.25),         // 2.25%
    ];

    const result = calculateChickenEquivalent(breakdown);

    // Alle delta's moeten dicht bij 0 liggen
    for (const cat of result.categories) {
      expect(Math.abs(cat.delta_kg)).toBeLessThan(5);
    }

    // Surplus en tekort moeten minimaal zijn
    expect(result.totaal_surplus_kg).toBeLessThan(20);
    expect(result.totaal_tekort_kg).toBeLessThan(20);
  });

  it('P0: hele_kip wordt uitgesloten uit kippenberekening', () => {
    const breakdown: CategoryBreakdown[] = [
      makeBreakdown('hele_kip', 5000, 100.0),
      makeBreakdown('filet', 100, 22.0),
    ];

    const result = calculateChickenEquivalent(breakdown);

    // Leading moet filet zijn, niet hele_kip
    expect(result.leading_category).toBe('filet');

    // hele_kip mag niet in categories voorkomen
    expect(result.categories.find(c => c.category === 'hele_kip')).toBeUndefined();

    // Kippen nodig alleen op basis van filet
    // 100 / (0.22 * 1.96) = 100 / 0.4312 = 231.9
    expect(result.totaal_kippen_nodig).toBeCloseTo(231.9, 0);
  });

  it('P0: Zorg&Natuur scenario — dij is leading, ~35.666 kippen nodig', () => {
    // Echte Zorg&Natuur data na aggregatie (uit customer-import-store tests)
    // Sprint 16D: filet norm 22%, drumvlees 8.75%, vel 2.25%
    const breakdown: CategoryBreakdown[] = [
      makeBreakdown('filet', 12382, 22.0),
      makeBreakdown('dij', 10486, 15.0),
      makeBreakdown('drumstick', 4834, 14.0),
      makeBreakdown('vleugels', 3211, 9.2),
      makeBreakdown('hele_kip', 2875, 100.0),  // wordt uitgesloten
      makeBreakdown('organen', 1156, 5.0),
      makeBreakdown('drumvlees', 567, 8.75),
      makeBreakdown('karkas', 302, 21.3),
      makeBreakdown('vel', 268, 2.25),
    ];

    const result = calculateChickenEquivalent(breakdown);

    // Dij is de leading category!
    // Filet: 12382 / (0.22 * 1.96) = 12382 / 0.4312 = 28.715 kippen
    // Dij:   10486 / (0.15 * 1.96) = 10486 / 0.294  = 35.666 kippen ← meeste kippen nodig
    expect(result.leading_category).toBe('dij');

    // Kippen nodig: 10486 / (0.15 * 1.96) = 10486 / 0.294 ≈ 35.666
    expect(result.totaal_kippen_nodig).toBeCloseTo(35666, -1);

    // hele_kip uitgesloten
    expect(result.categories.find(c => c.category === 'hele_kip')).toBeUndefined();

    // Dij delta ≈ 0 (leading category)
    const dij = result.categories.find(c => c.category === 'dij');
    expect(Math.abs(dij!.delta_kg)).toBeLessThan(1);

    // Filet: klant neemt 12382 kg, maar productie = 35666 * 0.22 * 1.96 ≈ 15.379 kg
    const filet = result.categories.find(c => c.category === 'filet');
    expect(filet!.natuurlijke_productie_kg).toBeCloseTo(15379, -1);
    expect(filet!.delta_kg).toBeGreaterThan(2900); // surplus

    // Karkas: groot surplus (klant neemt maar 302 kg, productie ≈ 14.894 kg)
    const karkas = result.categories.find(c => c.category === 'karkas');
    expect(karkas!.natuurlijke_productie_kg).toBeCloseTo(14894, -1);
    expect(karkas!.delta_kg).toBeGreaterThan(14000);

    // Met dij als leading (35.666 kippen) is er ruim voldoende productie
    // voor alle categorieën → totaal surplus moet groot zijn
    expect(result.totaal_surplus_kg).toBeGreaterThan(20000);
    // Totaal tekort kan 0 zijn als de dij-driven productie genoeg is voor alles
    expect(result.totaal_tekort_kg).toBeGreaterThanOrEqual(0);
  });

  it('P1: lege breakdown geeft nul-resultaat', () => {
    const result = calculateChickenEquivalent([]);

    expect(result.totaal_kippen_nodig).toBe(0);
    expect(result.totaal_griller_kg).toBe(0);
    expect(result.categories).toHaveLength(0);
    expect(result.totaal_surplus_kg).toBe(0);
    expect(result.totaal_tekort_kg).toBe(0);
  });

  it('P1: custom grillergewicht — minder kippen bij zwaarder gewicht', () => {
    const breakdown: CategoryBreakdown[] = [
      makeBreakdown('filet', 1000, 22.0),
    ];

    const light = calculateChickenEquivalent(breakdown, { avg_griller_weight_kg: 1.00 });
    const heavy = calculateChickenEquivalent(breakdown, { avg_griller_weight_kg: 1.20 });

    // Lichtere kippen = meer kippen nodig
    expect(light.totaal_kippen_nodig).toBeGreaterThan(heavy.totaal_kippen_nodig);

    // Verhouding moet ~20% schelen
    const ratio = light.totaal_kippen_nodig / heavy.totaal_kippen_nodig;
    expect(ratio).toBeCloseTo(1.20, 1);
  });

  it('P1: dij als leading category wanneer dij domineert', () => {
    // Klant koopt voornamelijk dij
    const breakdown: CategoryBreakdown[] = [
      makeBreakdown('dij', 5000, 15.0),
      makeBreakdown('filet', 100, 22.0),
    ];

    const result = calculateChickenEquivalent(breakdown);

    expect(result.leading_category).toBe('dij');

    // Kippen nodig: 5000 / (0.15 * 1.96) = 5000 / 0.294 ≈ 17007
    expect(result.totaal_kippen_nodig).toBeCloseTo(17007, -1);

    // Filet surplus: klant neemt 100 kg, productie = 17007 * 0.22 * 1.96 ≈ 7333 kg
    const filet = result.categories.find(c => c.category === 'filet');
    expect(filet!.delta_kg).toBeGreaterThan(7000);
    expect(filet!.natuurlijke_productie_kg).toBeCloseTo(7333, -1);
  });
});

// ============================================================================
// PERSPECTIEF-TOGGLE TESTS (Sprint 16C)
// ============================================================================

describe('calculateChickenEquivalent — perspective_category', () => {
  // Herbruik Zorg&Natuur data (Sprint 16D: filet 22%, drumvlees 8.75%, vel 2.25%)
  const zorgNatuurBreakdown: CategoryBreakdown[] = [
    makeBreakdown('filet', 12382, 22.0),
    makeBreakdown('dij', 10486, 15.0),
    makeBreakdown('drumstick', 4834, 14.0),
    makeBreakdown('vleugels', 3211, 9.2),
    makeBreakdown('hele_kip', 2875, 100.0),
    makeBreakdown('organen', 1156, 5.0),
    makeBreakdown('drumvlees', 567, 8.75),
    makeBreakdown('karkas', 302, 21.3),
    makeBreakdown('vel', 268, 2.25),
  ];

  it('P0: filet-perspectief — minder kippen, tekort op dij', () => {
    // Vanuit filet: 12382 / (0.22 * 1.96) = 12382 / 0.4312 ≈ 28.715 kippen
    const result = calculateChickenEquivalent(zorgNatuurBreakdown, {
      avg_griller_weight_kg: 1.96,
      perspective_category: 'filet',
    });

    expect(result.leading_category).toBe('filet');
    expect(result.totaal_kippen_nodig).toBeCloseTo(28715, -1);

    // Filet delta ≈ 0 (perspectief-categorie)
    const filet = result.categories.find(c => c.category === 'filet');
    expect(Math.abs(filet!.delta_kg)).toBeLessThan(1);

    // Dij: productie = 28715 * 0.15 * 1.96 = 8442 kg, klant wil 10486 kg
    // → tekort ≈ 8442 - 10486 = -2044 kg
    const dij = result.categories.find(c => c.category === 'dij');
    expect(dij!.delta_kg).toBeLessThan(-2000); // groot tekort!
    expect(dij!.natuurlijke_productie_kg).toBeCloseTo(8442, -1);

    // Er moet nu WEL tekort zijn (vanuit filet-perspectief is dij onderbediend)
    expect(result.totaal_tekort_kg).toBeGreaterThan(2000);
  });

  it('P0: drumstick-perspectief — nog minder kippen, groot tekort overal', () => {
    // Vanuit drumstick: 4834 / (0.14 * 1.96) = 4834 / 0.2744 ≈ 17617 kippen
    const result = calculateChickenEquivalent(zorgNatuurBreakdown, {
      avg_griller_weight_kg: 1.96,
      perspective_category: 'drumstick',
    });

    expect(result.leading_category).toBe('drumstick');
    expect(result.totaal_kippen_nodig).toBeCloseTo(17617, -1);

    // Drumstick delta ≈ 0
    const drum = result.categories.find(c => c.category === 'drumstick');
    expect(Math.abs(drum!.delta_kg)).toBeLessThan(1);

    // Filet: productie = 17617 * 0.22 * 1.96 ≈ 7593 kg, klant wil 12382 kg
    // → tekort ≈ -4789 kg
    const filet = result.categories.find(c => c.category === 'filet');
    expect(filet!.delta_kg).toBeLessThan(-4000);

    // Dij: productie = 17617 * 0.15 * 1.96 ≈ 5179 kg, klant wil 10486 kg
    // → tekort ≈ -5307 kg
    const dij = result.categories.find(c => c.category === 'dij');
    expect(dij!.delta_kg).toBeLessThan(-5000);

    // Totaal tekort moet flink zijn
    expect(result.totaal_tekort_kg).toBeGreaterThan(9000);
  });

  it('P0: dij-perspectief (= auto-leading) — zelfde resultaat als zonder perspective', () => {
    const withPerspective = calculateChickenEquivalent(zorgNatuurBreakdown, {
      avg_griller_weight_kg: 1.96,
      perspective_category: 'dij', // dij is sowieso de auto-leading
    });

    const withoutPerspective = calculateChickenEquivalent(zorgNatuurBreakdown, {
      avg_griller_weight_kg: 1.96,
    });

    // Beide moeten exact hetzelfde resultaat geven
    expect(withPerspective.leading_category).toBe(withoutPerspective.leading_category);
    expect(withPerspective.totaal_kippen_nodig).toBe(withoutPerspective.totaal_kippen_nodig);
    expect(withPerspective.totaal_surplus_kg).toBe(withoutPerspective.totaal_surplus_kg);
    expect(withPerspective.totaal_tekort_kg).toBe(withoutPerspective.totaal_tekort_kg);
    expect(withPerspective.categories.length).toBe(withoutPerspective.categories.length);
  });
});
