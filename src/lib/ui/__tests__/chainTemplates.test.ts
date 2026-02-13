/**
 * Chain Templates Tests — Sprint 12.3
 */

import { describe, it, expect } from 'vitest';
import { CHAIN_TEMPLATES, STANDARD_CUT_TEMPLATE } from '../chainTemplates';
import { validateProcessChain } from '@/lib/engine/chain';

describe('chainTemplates', () => {
  it('exports at least one template', () => {
    expect(CHAIN_TEMPLATES.length).toBeGreaterThanOrEqual(1);
  });

  it('STANDARD_CUT_TEMPLATE has required fields', () => {
    expect(STANDARD_CUT_TEMPLATE.id).toBe('standard_cut_internal');
    expect(STANDARD_CUT_TEMPLATE.label).toBeTruthy();
    expect(STANDARD_CUT_TEMPLATE.chain.version).toBe('1.0.0');
    expect(STANDARD_CUT_TEMPLATE.chain.nodes).toHaveLength(1);
  });

  it('STANDARD_CUT_TEMPLATE node has correct outputs', () => {
    const node = STANDARD_CUT_TEMPLATE.chain.nodes[0];
    expect(node.type).toBe('primal_cut');
    expect(node.entity).toBe('internal');
    expect(node.outputs).toHaveLength(4);

    const totalYield = node.outputs.reduce((sum, o) => sum + o.yield_pct, 0);
    expect(totalYield).toBe(100); // No loss in standard template
  });

  it('STANDARD_CUT_TEMPLATE passes chain validation', () => {
    const result = validateProcessChain(STANDARD_CUT_TEMPLATE.chain);
    expect(result.valid).toBe(true);
  });

  it('all templates pass chain validation', () => {
    for (const template of CHAIN_TEMPLATES) {
      const result = validateProcessChain(template.chain);
      expect(result.valid).toBe(true);
    }
  });
});
