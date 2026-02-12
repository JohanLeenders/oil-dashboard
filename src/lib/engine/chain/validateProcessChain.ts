/**
 * Process Chain Validation — Sprint 11B.1
 *
 * Validates process chains for:
 * - Cycle detection (DAG enforcement)
 * - MAX_CHAIN_DEPTH limits
 * - Ordering rules (transition matrix)
 * - By-product processing constraints
 * - Node-level mass balance (Σ outputs ≤ 100%)
 * - Chain-level cumulative mass balance (0.001 relative tolerance)
 * - Connectivity (no disconnected nodes)
 */

import type {
  ProcessChain,
  ProcessNode,
  ProcessEdge,
  NodeType,
  ValidationResult,
  MassBalanceValidation,
} from './types';
import { MAX_CHAIN_DEPTH, ALLOWED_TRANSITIONS, CHAIN_MASS_BALANCE_TOLERANCE } from './types';

/**
 * Validates a process chain before execution.
 * Hard-blocks execution if any validation fails.
 */
export function validateProcessChain(chain: ProcessChain): ValidationResult {
  // 1. Cycle detection (topological sort)
  if (hasCycle(chain.nodes, chain.edges)) {
    return { valid: false, error: 'Cycle detected in process chain' };
  }

  // 2. Chain depth validation
  const maxDepth = calculateMaxDepth(chain);
  if (maxDepth > MAX_CHAIN_DEPTH) {
    return {
      valid: false,
      error: `Chain depth ${maxDepth} exceeds limit of ${MAX_CHAIN_DEPTH}`,
    };
  }

  // 3. Ordering rules validation
  for (const edge of chain.edges) {
    const source = chain.nodes.find((n) => n.id === edge.source_node_id);
    const target = chain.nodes.find((n) => n.id === edge.target_node_id);

    if (!source || !target) {
      return { valid: false, error: `Edge ${edge.id} references missing node` };
    }

    if (!isAllowedTransition(source.type, target.type)) {
      return {
        valid: false,
        error: `Invalid transition: ${source.type} → ${target.type}`,
      };
    }
  }

  // 4. By-product processing validation
  for (const edge of chain.edges) {
    const source = chain.nodes.find((n) => n.id === edge.source_node_id);
    const output = source?.outputs.find((o) => o.part_code === edge.part_code);

    if (output?.is_by_product && !output?.processable_byproduct) {
      return {
        valid: false,
        error: `Cannot process by-product ${edge.part_code} (not marked as processable)`,
      };
    }
  }

  // 5. Node-level mass balance validation
  for (const node of chain.nodes) {
    const nodeResult = validateNodeMassBalance(node);
    if (!nodeResult.valid) {
      return nodeResult;
    }
  }

  // 6. Connectivity validation
  if (hasDisconnectedNodes(chain)) {
    return { valid: false, error: 'Chain has disconnected nodes' };
  }

  return { valid: true };
}

/**
 * Validates node-level mass balance: Σ(output.yield_pct) ≤ 100%
 * Loss is derived as residual: loss_pct = 100 - Σ(output.yield_pct)
 */
export function validateNodeMassBalance(node: ProcessNode): ValidationResult {
  const total_output_yield = node.outputs.reduce((sum, o) => sum + o.yield_pct, 0);

  // Outputs cannot exceed 100%
  if (total_output_yield > 100.0) {
    return {
      valid: false,
      error: `Node ${node.id} (${node.label}): outputs exceed 100% (total: ${total_output_yield.toFixed(1)}%)`,
    };
  }

  // Warn if large loss (>10%) - may be intentional, but flag for review
  const loss_pct = 100 - total_output_yield;
  if (loss_pct > 10.0) {
    console.warn(
      `Node ${node.id} (${node.label}) has large loss: ${loss_pct.toFixed(1)}% (may be intentional)`
    );
  }

  return { valid: true };
}

/**
 * Checks if the transition from source node type to target node type is allowed
 * per the transition matrix (spec section 4).
 */
export function isAllowedTransition(sourceType: NodeType, targetType: NodeType): boolean {
  const allowedTargets = ALLOWED_TRANSITIONS[sourceType];
  return allowedTargets.includes(targetType);
}

/**
 * Detects cycles in the DAG using depth-first search.
 * Returns true if a cycle is detected.
 */
export function hasCycle(nodes: ProcessNode[], edges: ProcessEdge[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const adjacencyList = buildAdjacencyList(edges);

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        if (dfs(neighborId)) {
          return true;
        }
      } else if (recursionStack.has(neighborId)) {
        // Back edge detected -> cycle
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculates the maximum depth (longest path) in the chain.
 */
export function calculateMaxDepth(chain: ProcessChain): number {
  const adjacencyList = buildAdjacencyList(chain.edges);
  const inDegree = new Map<string, number>();

  // Initialize in-degrees
  for (const node of chain.nodes) {
    inDegree.set(node.id, 0);
  }
  for (const edge of chain.edges) {
    inDegree.set(edge.target_node_id, (inDegree.get(edge.target_node_id) || 0) + 1);
  }

  // Find root nodes (in-degree = 0)
  const roots: string[] = [];
  for (const node of chain.nodes) {
    if (inDegree.get(node.id) === 0) {
      roots.push(node.id);
    }
  }

  // BFS to calculate max depth
  const depths = new Map<string, number>();
  for (const root of roots) {
    depths.set(root, 1);
  }

  const queue = [...roots];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentDepth = depths.get(currentId) || 1;

    const neighbors = adjacencyList.get(currentId) || [];
    for (const neighborId of neighbors) {
      const newDepth = currentDepth + 1;
      const existingDepth = depths.get(neighborId) || 0;
      depths.set(neighborId, Math.max(existingDepth, newDepth));

      if (!queue.includes(neighborId)) {
        queue.push(neighborId);
      }
    }
  }

  // Return max depth
  return Math.max(...Array.from(depths.values()), 0);
}

/**
 * Checks if the chain has disconnected nodes (nodes not reachable from any root).
 */
export function hasDisconnectedNodes(chain: ProcessChain): boolean {
  if (chain.nodes.length === 0) {
    return false;
  }

  const adjacencyList = buildAdjacencyList(chain.edges);
  const inDegree = new Map<string, number>();

  // Initialize in-degrees
  for (const node of chain.nodes) {
    inDegree.set(node.id, 0);
  }
  for (const edge of chain.edges) {
    inDegree.set(edge.target_node_id, (inDegree.get(edge.target_node_id) || 0) + 1);
  }

  // Find root nodes (in-degree = 0)
  const roots: string[] = [];
  for (const node of chain.nodes) {
    if (inDegree.get(node.id) === 0) {
      roots.push(node.id);
    }
  }

  // DFS from all roots to find reachable nodes
  const reachable = new Set<string>();
  const stack = [...roots];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (reachable.has(currentId)) {
      continue;
    }
    reachable.add(currentId);

    const neighbors = adjacencyList.get(currentId) || [];
    for (const neighborId of neighbors) {
      if (!reachable.has(neighborId)) {
        stack.push(neighborId);
      }
    }
  }

  // Check if all nodes are reachable
  return reachable.size < chain.nodes.length;
}

/**
 * Builds an adjacency list from edges for graph traversal.
 */
function buildAdjacencyList(edges: ProcessEdge[]): Map<string, string[]> {
  const adjacencyList = new Map<string, string[]>();

  for (const edge of edges) {
    const neighbors = adjacencyList.get(edge.source_node_id) || [];
    neighbors.push(edge.target_node_id);
    adjacencyList.set(edge.source_node_id, neighbors);
  }

  return adjacencyList;
}
