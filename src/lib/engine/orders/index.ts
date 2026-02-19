/**
 * Orders engine — barrel export
 *
 * REGRESSIE-CHECK:
 * - Export only, no side effects
 */

export { buildOrderSchema } from './buildOrderSchema';
export type { BuildOrderSchemaInput } from './buildOrderSchema';
export { computeSurplusDeficit } from './computeSurplusDeficit';
