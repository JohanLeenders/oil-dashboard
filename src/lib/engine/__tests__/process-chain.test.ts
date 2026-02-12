/**
 * Process Chain Engine Tests — Sprint 11B.1
 *
 * P0 tests for chain engine foundation:
 * - Cycle detection
 * - MAX_CHAIN_DEPTH enforcement
 * - By-product processing block
 * - Partial chain passthrough
 * - Allocation reconciliation (0.01 EUR tolerance)
 * - Decimal precision (no float drift)
 * - cost_method discriminator
 * - Mass balance validation (0.001 relative tolerance)
 */

import { describe, test, expect } from 'vitest';
import {
  validateProcessChain,
  hasCycle,
  calculateMaxDepth,
  validateNodeMassBalance,
  allocateNodeCosts,
  executeProcessChain,
  MAX_CHAIN_DEPTH,
  CHAIN_MASS_BALANCE_TOLERANCE,
  ALLOCATION_RECONCILIATION_TOLERANCE_EUR,
} from '@/lib/engine/chain';
import type { ProcessChain, ProcessNode, ProcessEdge } from '@/lib/engine/chain';

describe('Process Chain Engine — Sprint 11B.1', () => {
  // ========== P0 Test 1: Cycle Detection ==========

  test('P0: Cycle detection — hard-blocks cyclic chains', () => {
    const nodes: ProcessNode[] = [
      {
        id: 'node-a',
        type: 'primal_cut',
        label: 'Node A',
        entity: 'internal',
        inputs: [{ part_code: 'griller', required_kg: null }],
        outputs: [{ part_code: 'part_a', yield_pct: 100, is_by_product: false }],
        variable_cost_per_kg: 0.1,
        fixed_cost_per_execution: 10,
        is_valid: true,
        validation_errors: [],
      },
      {
        id: 'node-b',
        type: 'sub_cut',
        label: 'Node B',
        entity: 'internal',
        inputs: [{ part_code: 'part_a', required_kg: null }],
        outputs: [{ part_code: 'part_b', yield_pct: 100, is_by_product: false }],
        variable_cost_per_kg: 0.1,
        fixed_cost_per_execution: 10,
        is_valid: true,
        validation_errors: [],
      },
      {
        id: 'node-c',
        type: 'sub_cut',
        label: 'Node C',
        entity: 'internal',
        inputs: [{ part_code: 'part_b', required_kg: null }],
        outputs: [{ part_code: 'part_a', yield_pct: 100, is_by_product: false }],
        variable_cost_per_kg: 0.1,
        fixed_cost_per_execution: 10,
        is_valid: true,
        validation_errors: [],
      },
    ];

    const edges: ProcessEdge[] = [
      { id: 'edge-ab', source_node_id: 'node-a', target_node_id: 'node-b', part_code: 'part_a', flow_kg: null, is_valid: true, validation_errors: [] },
      { id: 'edge-bc', source_node_id: 'node-b', target_node_id: 'node-c', part_code: 'part_b', flow_kg: null, is_valid: true, validation_errors: [] },
      { id: 'edge-ca', source_node_id: 'node-c', target_node_id: 'node-a', part_code: 'part_a', flow_kg: null, is_valid: true, validation_errors: [] },
    ];

    const has_cycle = hasCycle(nodes, edges);
    expect(has_cycle).toBe(true);

    const chain: ProcessChain = {
      version: '1.0.0',
      nodes,
      edges,
      created_at: '2026-02-12T00:00:00Z',
      last_modified: '2026-02-12T00:00:00Z',
    };

    const result = validateProcessChain(chain);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cycle detected');
  });

  // ========== P0 Test 2: MAX_CHAIN_DEPTH Enforcement ==========

  test('P0: MAX_CHAIN_DEPTH — hard-blocks chains exceeding depth limit', () => {
    const nodes: ProcessNode[] = [];
    const edges: ProcessEdge[] = [];

    // Create a chain of depth 11 (exceeds MAX_CHAIN_DEPTH = 10)
    for (let i = 0; i <= 11; i++) {
      nodes.push({
        id: `node-${i}`,
        type: i === 0 ? 'primal_cut' : 'sub_cut',
        label: `Node ${i}`,
        entity: 'internal',
        inputs: [{ part_code: i === 0 ? 'griller' : `part_${i - 1}`, required_kg: null }],
        outputs: [{ part_code: `part_${i}`, yield_pct: 100, is_by_product: false }],
        variable_cost_per_kg: 0.1,
        fixed_cost_per_execution: 10,
        is_valid: true,
        validation_errors: [],
      });

      if (i > 0) {
        edges.push({
          id: `edge-${i - 1}-${i}`,
          source_node_id: `node-${i - 1}`,
          target_node_id: `node-${i}`,
          part_code: `part_${i - 1}`,
          flow_kg: null,
          is_valid: true,
          validation_errors: [],
        });
      }
    }

    const chain: ProcessChain = {
      version: '1.0.0',
      nodes,
      edges,
      created_at: '2026-02-12T00:00:00Z',
      last_modified: '2026-02-12T00:00:00Z',
    };

    const max_depth = calculateMaxDepth(chain);
    expect(max_depth).toBeGreaterThan(MAX_CHAIN_DEPTH);

    const result = validateProcessChain(chain);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Chain depth');
    expect(result.error).toContain(`exceeds limit of ${MAX_CHAIN_DEPTH}`);
  });

  // ========== P0 Test 3: By-product Processing Block ==========

  test('P0: By-product downstream — hard-blocks processing non-processable by-products', () => {
    const chain: ProcessChain = {
      version: '1.0.0',
      nodes: [
        {
          id: 'node-1',
          type: 'primal_cut',
          label: 'Primal Cut',
          entity: 'internal',
          inputs: [{ part_code: 'griller', required_kg: null }],
          outputs: [
            { part_code: 'breast_cap', yield_pct: 35, is_by_product: false },
            { part_code: 'back', yield_pct: 12, is_by_product: true, processable_byproduct: false },
          ],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
        {
          id: 'node-2',
          type: 'sub_cut',
          label: 'Back Processing (SHOULD FAIL)',
          entity: 'internal',
          inputs: [{ part_code: 'back', required_kg: null }],
          outputs: [{ part_code: 'back_meal', yield_pct: 100, is_by_product: false }],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source_node_id: 'node-1',
          target_node_id: 'node-2',
          part_code: 'back',
          flow_kg: null,
          is_valid: true,
          validation_errors: [],
        },
      ],
      created_at: '2026-02-12T00:00:00Z',
      last_modified: '2026-02-12T00:00:00Z',
    };

    const result = validateProcessChain(chain);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot process by-product');
    expect(result.error).toContain('back');
  });

  // ========== P0 Test 4: Partial Chain Passthrough ==========

  test('P0: Partial chain — unmodeled parts passthrough unchanged', () => {
    // Chain only models breast_cap → filet
    // Legs and wings should not be affected
    const chain: ProcessChain = {
      version: '1.0.0',
      nodes: [
        {
          id: 'node-1',
          type: 'primal_cut',
          label: 'Primal Cut',
          entity: 'internal',
          inputs: [{ part_code: 'griller', required_kg: null }],
          outputs: [
            { part_code: 'breast_cap', yield_pct: 35, is_by_product: false },
            { part_code: 'legs', yield_pct: 43, is_by_product: false },
            { part_code: 'wings', yield_pct: 10.4, is_by_product: false },
            { part_code: 'back', yield_pct: 11.6, is_by_product: true, processable_byproduct: false },
          ],
          variable_cost_per_kg: 0.15,
          fixed_cost_per_execution: 50,
          is_valid: true,
          validation_errors: [],
        },
        {
          id: 'node-2',
          type: 'sub_cut',
          label: 'Filet Cut',
          entity: 'contractor_a',
          inputs: [{ part_code: 'breast_cap', required_kg: null }],
          outputs: [
            { part_code: 'filet', yield_pct: 85, is_by_product: false },
            { part_code: 'breast_rest', yield_pct: 13, is_by_product: true, processable_byproduct: false },
          ],
          variable_cost_per_kg: 0.50,
          fixed_cost_per_execution: 25,
          is_valid: true,
          validation_errors: [],
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source_node_id: 'node-1',
          target_node_id: 'node-2',
          part_code: 'breast_cap',
          flow_kg: null,
          is_valid: true,
          validation_errors: [],
        },
      ],
      created_at: '2026-02-12T00:00:00Z',
      last_modified: '2026-02-12T00:00:00Z',
    };

    const result = executeProcessChain(chain, 1728);

    expect(result.success).toBe(true);
    expect(result.cost_method).toBe('chain_yield_proportional');

    // Final outputs should include: filet (modeled), breast_rest (modeled), legs (passthrough), wings (passthrough)
    expect(result.final_outputs.length).toBeGreaterThanOrEqual(2);

    const filet = result.final_outputs.find((o) => o.part_code === 'filet');
    expect(filet).toBeDefined();
    expect(filet!.weight_kg).toBeCloseTo(1728 * 0.35 * 0.85, 2);

    const legs = result.final_outputs.find((o) => o.part_code === 'legs');
    expect(legs).toBeDefined();
    expect(legs!.weight_kg).toBeCloseTo(1728 * 0.43, 2);
  });

  // ========== P0 Test 5: Allocation Reconciliation (0.01 EUR) ==========

  test('P0: Allocation reconciliation — enforces 0.01 EUR tolerance', () => {
    const node: ProcessNode = {
      id: 'test-node',
      type: 'sub_cut',
      label: 'Test Node',
      entity: 'internal',
      inputs: [{ part_code: 'input', required_kg: null }],
      outputs: [
        { part_code: 'output_a', yield_pct: 85, is_by_product: false },
        { part_code: 'output_b', yield_pct: 13, is_by_product: true, processable_byproduct: false },
      ],
      variable_cost_per_kg: 0.50,
      fixed_cost_per_execution: 25,
      is_valid: true,
      validation_errors: [],
    };

    const result = allocateNodeCosts(node, 100);

    // Verify reconciliation
    const total_allocated = result.outputs.reduce((sum, o) => sum + o.allocated_cost_eur, 0);
    const expected_total = result.total_cost_eur;
    const error = Math.abs(total_allocated - expected_total);

    expect(error).toBeLessThanOrEqual(ALLOCATION_RECONCILIATION_TOLERANCE_EUR);
  });

  // ========== P0 Test 6: Decimal Precision (No Float Drift) ==========

  test('P0: Decimal precision — no float drift in multi-node chain', () => {
    // Create 5-node chain with precise decimal yields
    const chain: ProcessChain = {
      version: '1.0.0',
      nodes: [
        {
          id: 'node-1',
          type: 'primal_cut',
          label: 'Node 1',
          entity: 'internal',
          inputs: [{ part_code: 'griller', required_kg: null }],
          outputs: [{ part_code: 'part_1', yield_pct: 33.333333, is_by_product: false }],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
        {
          id: 'node-2',
          type: 'sub_cut',
          label: 'Node 2',
          entity: 'internal',
          inputs: [{ part_code: 'part_1', required_kg: null }],
          outputs: [{ part_code: 'part_2', yield_pct: 50, is_by_product: false }],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
        {
          id: 'node-3',
          type: 'sub_cut',
          label: 'Node 3',
          entity: 'internal',
          inputs: [{ part_code: 'part_2', required_kg: null }],
          outputs: [{ part_code: 'part_3', yield_pct: 75, is_by_product: false }],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
        {
          id: 'node-4',
          type: 'sub_cut',
          label: 'Node 4',
          entity: 'internal',
          inputs: [{ part_code: 'part_3', required_kg: null }],
          outputs: [{ part_code: 'part_4', yield_pct: 90, is_by_product: false }],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
        {
          id: 'node-5',
          type: 'sub_cut',
          label: 'Node 5',
          entity: 'internal',
          inputs: [{ part_code: 'part_4', required_kg: null }],
          outputs: [{ part_code: 'part_5', yield_pct: 99, is_by_product: false }],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
      ],
      edges: [
        { id: 'e1', source_node_id: 'node-1', target_node_id: 'node-2', part_code: 'part_1', flow_kg: null, is_valid: true, validation_errors: [] },
        { id: 'e2', source_node_id: 'node-2', target_node_id: 'node-3', part_code: 'part_2', flow_kg: null, is_valid: true, validation_errors: [] },
        { id: 'e3', source_node_id: 'node-3', target_node_id: 'node-4', part_code: 'part_3', flow_kg: null, is_valid: true, validation_errors: [] },
        { id: 'e4', source_node_id: 'node-4', target_node_id: 'node-5', part_code: 'part_4', flow_kg: null, is_valid: true, validation_errors: [] },
      ],
      created_at: '2026-02-12T00:00:00Z',
      last_modified: '2026-02-12T00:00:00Z',
    };

    const result = executeProcessChain(chain, 1000);

    expect(result.success).toBe(true);

    // Verify all nodes have reconciled allocations (no accumulation of float errors)
    for (const nodeResult of result.node_results) {
      const total_allocated = nodeResult.outputs.reduce((sum, o) => sum + o.allocated_cost_eur, 0);
      const error = Math.abs(total_allocated - nodeResult.total_cost_eur);
      expect(error).toBeLessThanOrEqual(ALLOCATION_RECONCILIATION_TOLERANCE_EUR);
    }
  });

  // ========== P0 Test 7: cost_method Discriminator ==========

  test('P0: cost_method discriminator — always chain_yield_proportional', () => {
    const chain: ProcessChain = {
      version: '1.0.0',
      nodes: [
        {
          id: 'node-1',
          type: 'primal_cut',
          label: 'Test',
          entity: 'internal',
          inputs: [{ part_code: 'griller', required_kg: null }],
          outputs: [{ part_code: 'output', yield_pct: 100, is_by_product: false }],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
      ],
      edges: [],
      created_at: '2026-02-12T00:00:00Z',
      last_modified: '2026-02-12T00:00:00Z',
    };

    const result = executeProcessChain(chain, 1000);

    expect(result.cost_method).toBe('chain_yield_proportional');
    expect(result.cost_method).not.toBe('svaso');
  });

  // ========== P0 Test 8: Mass Balance Validation (0.001 Relative) ==========

  test('P0: Mass balance — hard-blocks violations at 0.001 relative tolerance', () => {
    // Create a chain with yields that sum to > 100% (should fail node validation)
    const chain: ProcessChain = {
      version: '1.0.0',
      nodes: [
        {
          id: 'node-bad',
          type: 'primal_cut',
          label: 'Bad Node',
          entity: 'internal',
          inputs: [{ part_code: 'griller', required_kg: null }],
          outputs: [
            { part_code: 'output_a', yield_pct: 60, is_by_product: false },
            { part_code: 'output_b', yield_pct: 50, is_by_product: false },
          ],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
      ],
      edges: [],
      created_at: '2026-02-12T00:00:00Z',
      last_modified: '2026-02-12T00:00:00Z',
    };

    const result = validateProcessChain(chain);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('outputs exceed 100%');
  });

  // ========== P0 Test 9: Node-level loss derivation ==========

  test('P0: loss_pct derived — computed as 100 - Σ(output.yield_pct)', () => {
    const node: ProcessNode = {
      id: 'test-node',
      type: 'sub_cut',
      label: 'Test Node',
      entity: 'internal',
      inputs: [{ part_code: 'input', required_kg: null }],
      outputs: [
        { part_code: 'output_a', yield_pct: 85, is_by_product: false },
        { part_code: 'output_b', yield_pct: 13, is_by_product: true, processable_byproduct: false },
      ],
      variable_cost_per_kg: 0.50,
      fixed_cost_per_execution: 25,
      is_valid: true,
      validation_errors: [],
    };

    const result = allocateNodeCosts(node, 100);

    const expected_loss_pct = 100 - (85 + 13);
    expect(result.loss_pct).toBe(expected_loss_pct);
    expect(result.loss_kg).toBeCloseTo(100 * (expected_loss_pct / 100), 2);
  });

  // ========== P0 Test 10: Ordering rules enforcement ==========

  test('P0: Ordering rules — blocks invalid transitions', () => {
    // Try to create packaging → sub_cut (invalid)
    const chain: ProcessChain = {
      version: '1.0.0',
      nodes: [
        {
          id: 'node-1',
          type: 'packaging',
          label: 'Package',
          entity: 'internal',
          inputs: [{ part_code: 'part', required_kg: null }],
          outputs: [{ part_code: 'packaged', yield_pct: 100, is_by_product: false }],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
        {
          id: 'node-2',
          type: 'sub_cut',
          label: 'Cut (SHOULD FAIL)',
          entity: 'internal',
          inputs: [{ part_code: 'packaged', required_kg: null }],
          outputs: [{ part_code: 'cut', yield_pct: 100, is_by_product: false }],
          variable_cost_per_kg: 0.1,
          fixed_cost_per_execution: 10,
          is_valid: true,
          validation_errors: [],
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source_node_id: 'node-1',
          target_node_id: 'node-2',
          part_code: 'packaged',
          flow_kg: null,
          is_valid: true,
          validation_errors: [],
        },
      ],
      created_at: '2026-02-12T00:00:00Z',
      last_modified: '2026-02-12T00:00:00Z',
    };

    const result = validateProcessChain(chain);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid transition');
    expect(result.error).toContain('packaging');
    expect(result.error).toContain('sub_cut');
  });
});
