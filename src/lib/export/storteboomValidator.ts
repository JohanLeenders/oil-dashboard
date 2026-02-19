/**
 * Storteboom Excel validation — MVP level
 * Validates order schema data before export to ensure Storteboom compatibility
 *
 * REGRESSIE-CHECK:
 * - Pure function, no DB access
 * - Returns validation result with pass/fail and messages
 */
import type { OrderSchemaData } from '@/types/database';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateForStorteboom(schemaData: OrderSchemaData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check required data exists
  if (!schemaData.surplus_deficit || schemaData.surplus_deficit.length === 0) {
    errors.push('Geen producten in bestelschema');
  }

  if (!schemaData.orders || schemaData.orders.length === 0) {
    warnings.push('Geen orders in schema — export bevat alleen beschikbaarheid');
  }

  // 2. Validate numeric columns
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

  // 3. Check required column data (product_id must exist)
  for (const sd of schemaData.surplus_deficit || []) {
    if (!sd.product_id) {
      errors.push('Product ID ontbreekt in surplus/deficit entry');
    }
  }

  // 4. Warn on large deficits
  for (const sd of schemaData.surplus_deficit || []) {
    if (sd.delta_kg < -100) {
      warnings.push(`Groot deficit (${sd.delta_kg.toFixed(1)} kg) voor ${sd.product_id}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
