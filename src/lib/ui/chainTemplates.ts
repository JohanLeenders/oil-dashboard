/**
 * Chain Templates — Sprint 12.3
 *
 * Pre-configured ProcessChain objects for common use cases.
 * Templates are validated at load time via validateProcessChain().
 */

import type { ProcessChain } from '@/lib/engine/chain';

export interface ChainTemplate {
  id: string;
  label: string;
  description: string;
  chain: ProcessChain;
}

/**
 * Template: Standaard uitsnij (alles intern)
 *
 * Single primal_cut node: griller → breast_cap (45%) + legs (30%) + wings (5%) + back_carcass (20%)
 * These are approximate industry-standard yields for griller cut-up.
 * Loss is 0% in this template — all input becomes output.
 */
export const STANDARD_CUT_TEMPLATE: ChainTemplate = {
  id: 'standard_cut_internal',
  label: 'Standaard Uitsnij (intern)',
  description: 'Eén verwerkingsstap: griller → borst, poten, vleugels, rugkarkas',
  chain: {
    version: '1.0.0',
    nodes: [
      {
        id: 'node-template-primal',
        type: 'primal_cut',
        label: 'Primaire Uitsnij',
        entity: 'internal',
        inputs: [{ part_code: 'griller', required_kg: null }],
        outputs: [
          { part_code: 'breast_cap', yield_pct: 45, is_by_product: false },
          { part_code: 'legs', yield_pct: 30, is_by_product: false },
          { part_code: 'wings', yield_pct: 5, is_by_product: false },
          { part_code: 'back_carcass', yield_pct: 20, is_by_product: true },
        ],
        variable_cost_per_kg: 0.50,
        fixed_cost_per_execution: 0,
        is_valid: true,
        validation_errors: [],
      },
    ],
    edges: [],
    created_at: new Date().toISOString(),
    last_modified: new Date().toISOString(),
  },
};

/** All available templates */
export const CHAIN_TEMPLATES: ChainTemplate[] = [
  STANDARD_CUT_TEMPLATE,
];
