/**
 * Orders engine — barrel export
 *
 * REGRESSIE-CHECK:
 * - Export only, no side effects
 */

export { buildOrderSchema } from './buildOrderSchema';
export type { BuildOrderSchemaInput } from './buildOrderSchema';
export { computeSurplusDeficit } from './computeSurplusDeficit';
export { captureFullAvailability } from './captureFullAvailability';
export type { AvailabilitySuggestion } from './captureFullAvailability';
export { distributeByBirds } from './distributeByBirds';
export type { DistributionPreview, DistributionLine } from './distributeByBirds';
