/**
 * Storteboom Export Validator — Wave 8
 *
 * Validates StorteboomExportInput before generating Excel.
 * Returns errors (blocking) and warnings (informational).
 *
 * REGRESSIE-CHECK:
 * - Pure function, no DB access
 * - Returns ValidationResult with pass/fail and messages
 */
import type { StorteboomExportInput } from './orderSchemaExport';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateStorteboomExport(
  input: StorteboomExportInput
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Basic sanity checks
  if (!input.total_birds || input.total_birds <= 0) {
    errors.push('Totaal aantal kippen moet > 0 zijn');
  }
  if (!input.avg_live_weight_kg || input.avg_live_weight_kg <= 0) {
    errors.push('Gemiddeld levend gewicht moet > 0 zijn');
  }

  // 2. Griller yield sanity (between 60% and 80%)
  if (input.griller_yield_pct < 0.60 || input.griller_yield_pct > 0.80) {
    warnings.push(
      `Griller rendement ${(input.griller_yield_pct * 100).toFixed(1)}% valt buiten verwacht bereik (60-80%)`
    );
  }

  // 3. Slaughter date validation
  if (!input.slaughter_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.slaughter_date)) {
    errors.push('Ongeldige slachtdatum');
  }

  // 4. No duplicate product_ids within Putten or Nijkerk
  const puttenIds = input.putten_products.map((p) => p.product_id);
  const puttenDuplicates = puttenIds.filter((id, i) => puttenIds.indexOf(id) !== i);
  if (puttenDuplicates.length > 0) {
    errors.push(`Dubbele product IDs in Putten: ${puttenDuplicates.join(', ')}`);
  }

  const nijkerkIds = input.nijkerk_products.map((p) => p.product_id);
  const nijkerkDuplicates = nijkerkIds.filter((id, i) => nijkerkIds.indexOf(id) !== i);
  if (nijkerkDuplicates.length > 0) {
    errors.push(`Dubbele product IDs in Nijkerk: ${nijkerkDuplicates.join(', ')}`);
  }

  // 5. Article numbers check
  for (const prod of input.putten_products) {
    if (!prod.article_number_vacuum && !prod.article_number_niet_vacuum) {
      warnings.push(`Putten product "${prod.description}" heeft geen artikelnummer`);
    }
  }
  for (const prod of input.nijkerk_products) {
    if (!prod.article_number_vacuum && !prod.article_number_niet_vacuum) {
      warnings.push(`Nijkerk product "${prod.description}" heeft geen artikelnummer`);
    }
  }

  // 6. REST check (negative = tekort)
  for (const prod of input.putten_products) {
    const totalOrdered = input.customer_orders.reduce((total, co) => {
      return total + co.putten_lines
        .filter((l) => l.product_id === prod.product_id)
        .reduce((s, l) => s + l.quantity_kg, 0);
    }, 0);
    const rest = prod.kg_from_slaughter - totalOrdered;
    if (rest < 0) {
      warnings.push(
        `Tekort Putten "${prod.description}": ${Math.abs(rest).toFixed(1)} kg meer besteld dan beschikbaar`
      );
    }
  }

  for (const prod of input.nijkerk_products) {
    const totalOrdered = input.customer_orders.reduce((total, co) => {
      return total + co.nijkerk_lines
        .filter((l) => l.product_id === prod.product_id)
        .reduce((s, l) => s + l.quantity_kg, 0);
    }, 0);
    const rest = prod.kg_from_slaughter - totalOrdered;
    if (rest < 0) {
      warnings.push(
        `Tekort Nijkerk "${prod.description}": ${Math.abs(rest).toFixed(1)} kg meer besteld dan beschikbaar`
      );
    }
  }

  // 7. Mass balance: SOM(putten product kg) should not exceed remaining_griller_kg
  // Note: yields typically sum to ~82% (rest is processing loss: Cat2, Cat3, etc.)
  // So we check that total does not EXCEED griller_kg (oversupply = error)
  // and that it's at least 50% of griller_kg (sanity check for missing products)
  const totalPuttenKg = input.putten_products.reduce((s, p) => s + p.kg_from_slaughter, 0);
  if (input.remaining_griller_kg > 0 && totalPuttenKg > 0) {
    if (totalPuttenKg > input.remaining_griller_kg * 1.01) {
      errors.push(
        `Massabalans fout: SOM Putten producten (${totalPuttenKg.toFixed(0)} kg) > Griller kg (${input.remaining_griller_kg.toFixed(0)} kg)`
      );
    } else if (totalPuttenKg < input.remaining_griller_kg * 0.50) {
      warnings.push(
        `Massabalans waarschuwing: SOM Putten producten (${totalPuttenKg.toFixed(0)} kg) is minder dan 50% van Griller kg (${input.remaining_griller_kg.toFixed(0)} kg)`
      );
    }
  }

  // 8. Utilization check: total ordered vs total available (Wave 10 D4)
  // The user reported "Massabalans OK" at 25% utilization — that should NOT be OK.
  const totalAvailableKg =
    input.putten_products.reduce((s, p) => s + p.kg_from_slaughter, 0) +
    input.nijkerk_products.reduce((s, p) => s + p.kg_from_slaughter, 0);

  const totalOrderedKg =
    input.customer_orders.reduce((total, co) => {
      const puttenKg = co.putten_lines.reduce((s, l) => s + l.quantity_kg, 0);
      const nijkerkKg = co.nijkerk_lines.reduce((s, l) => s + l.quantity_kg, 0);
      return total + puttenKg + nijkerkKg;
    }, 0);

  if (totalAvailableKg > 0 && totalOrderedKg > 0) {
    const utilizationPct = totalOrderedKg / totalAvailableKg;
    if (utilizationPct < 0.50) {
      errors.push(
        `Massabalans: slechts ${(utilizationPct * 100).toFixed(0)}% benut (${totalOrderedKg.toFixed(0)} van ${totalAvailableKg.toFixed(0)} kg besteld — minimaal 50% vereist)`
      );
    } else if (utilizationPct < 0.80) {
      warnings.push(
        `Massabalans: ${(utilizationPct * 100).toFixed(0)}% benut (${totalOrderedKg.toFixed(0)} van ${totalAvailableKg.toFixed(0)} kg) — controleer of alle orders zijn ingevoerd`
      );
    }
  } else if (totalAvailableKg > 0 && totalOrderedKg === 0) {
    warnings.push('Geen orders ingevoerd — export bevat alleen beschikbaarheid');
  }

  // 9. Klant totaal check: SOM(klant kg) per product
  for (const prod of input.putten_products) {
    const perCustomer = input.customer_orders.map((co) => {
      return co.putten_lines
        .filter((l) => l.product_id === prod.product_id)
        .reduce((s, l) => s + l.quantity_kg, 0);
    });
    const customerTotal = perCustomer.reduce((s, v) => s + v, 0);
    // Totaal column should equal sum of all customer columns - this is always true by construction
    // But we verify no NaN values
    if (isNaN(customerTotal)) {
      errors.push(`NaN in klant-orders voor Putten product "${prod.description}"`);
    }
  }

  // 9. Delivery info check
  const customersWithOrders = new Set<string>();
  for (const co of input.customer_orders) {
    if (co.putten_lines.length > 0 || co.nijkerk_lines.length > 0) {
      customersWithOrders.add(co.customer_id);
    }
  }
  for (const co of input.customer_orders) {
    if (customersWithOrders.has(co.customer_id) && !co.delivery_address) {
      warnings.push(`Klant "${co.customer_name}" heeft geen afleveradres`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// BACKWARD COMPATIBILITY — Legacy validator for OrderSchemaData
// Used by: ExportButton.tsx, ExportList.tsx, integration tests
// Will be removed in a future wave.
// ============================================================================

import type { OrderSchemaData } from '@/types/database';

/**
 * @deprecated Use validateStorteboomExport() for new code
 */
export function validateForStorteboom(schemaData: OrderSchemaData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!schemaData.surplus_deficit || schemaData.surplus_deficit.length === 0) {
    errors.push('Geen producten in bestelschema');
  }
  if (!schemaData.orders || schemaData.orders.length === 0) {
    warnings.push('Geen orders in schema — export bevat alleen beschikbaarheid');
  }
  for (const sd of schemaData.surplus_deficit || []) {
    if (typeof sd.available_kg !== 'number' || isNaN(sd.available_kg)) {
      errors.push(`Ongeldig beschikbaar gewicht voor product ${sd.product_id}`);
    } else if (sd.available_kg < 0) {
      errors.push(`Negatief beschikbaar gewicht voor product ${sd.product_id}`);
    }
    if (typeof sd.ordered_kg !== 'number' || isNaN(sd.ordered_kg)) {
      errors.push(`Ongeldig besteld gewicht voor product ${sd.product_id}`);
    } else if (sd.ordered_kg < 0) {
      errors.push(`Negatief besteld gewicht voor product ${sd.product_id}`);
    }
  }
  for (const sd of schemaData.surplus_deficit || []) {
    if (!sd.product_id) errors.push('Product ID ontbreekt in surplus/deficit entry');
  }
  for (const sd of schemaData.surplus_deficit || []) {
    if (sd.delta_kg < -100) {
      warnings.push(`Groot deficit (${sd.delta_kg.toFixed(1)} kg) voor ${sd.product_id}`);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}
