/**
 * Process Chain Engine Types — Sprint 11B.1
 *
 * TypeScript interfaces for process chain modeling with multi-step transformations,
 * multi-entity costing, and mass balance validation.
 *
 * CRITICAL CONSTRAINTS:
 * - cost_method MUST be 'chain_yield_proportional' (NOT 'svaso')
 * - loss_pct is DERIVED only (100 - Σ yields)
 * - required_kg and flow_kg are number | null (JSON-safe, no string sentinels)
 * - processable_byproduct defaults to false
 */

// ========== Core Chain Schema ==========

export interface ProcessChain {
  version: '1.0.0'; // Semantic versioning for backward compatibility
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  created_at: string; // ISO 8601
  last_modified: string; // ISO 8601
}

export interface ProcessNode {
  id: string; // UUID
  type: NodeType;

  // Visual layout (optional in v1, required in v2 for canvas)
  position?: { x: number; y: number };

  // Processing definition
  label: string; // User-friendly name
  entity: Entity;

  inputs: PartReference[]; // Input parts (from upstream nodes or baseline)
  outputs: PartOutput[]; // Output parts (with yields)

  // Costing
  variable_cost_per_kg: number; // € per kg OUTPUT
  fixed_cost_per_execution: number; // € flat fee per node execution

  // Validation metadata
  is_valid: boolean;
  validation_errors: string[];
}

export type NodeType =
  | 'slaughter' // Live → griller + by-products (usually baseline, not chain)
  | 'primal_cut' // Griller → breast_cap/legs/wings/back
  | 'sub_cut' // breast_cap → filet + rest
  | 'packaging' // Part → packaged SKU (adds packaging cost)
  | 'logistics' // Transport/storage (adds logistics cost)
  | 'external_service'; // Generic external processing

export type Entity = 'internal' | 'contractor_a' | 'contractor_b' | 'contractor_c';

export interface PartReference {
  part_code: string; // References anatomical part or sub-cut
  required_kg: number | null; // How much needed, or null = use all available from upstream
  // JSON-safe: no string sentinel 'all' — null is explicit and type-safe
}

export interface PartOutput {
  part_code: string; // Output part code
  yield_pct: number; // % of input that becomes this output (0-100)
  is_by_product: boolean; // True if waste/offal/etc
  processable_byproduct?: boolean; // If true, this by-product can be further processed (default: false)
}

export interface ProcessEdge {
  id: string; // UUID
  source_node_id: string;
  target_node_id: string;

  // Flow specification
  part_code: string; // Which part flows along this edge
  flow_kg: number | null; // Computed during execution; null before execution

  // Validation
  is_valid: boolean;
  validation_errors: string[];
}

// ========== Validation Results ==========

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface MassBalanceValidation {
  valid: boolean;
  error?: string;
  details?: {
    node_id?: string;
    total_output_yield?: number;
    expected_output?: number;
    actual_output?: number;
    relative_error?: number;
  };
}

// ========== Execution Results ==========

export interface ChainExecutionResult {
  success: boolean;
  error: string | null;

  cost_method: 'chain_yield_proportional'; // DISCRIMINANT (NOT 'svaso')

  node_results: NodeExecutionResult[]; // Per-node costs and outputs
  final_outputs: FinalOutput[]; // Terminal outputs

  total_chain_cost_eur: number;
  total_chain_variable_cost_eur: number;
  total_chain_fixed_cost_eur: number;

  mass_balance_check: ChainMassBalanceCheck;
}

export interface NodeExecutionResult {
  node_id: string;
  node_label: string;
  input_kg: number;
  output_kg: number;
  loss_kg: number;
  loss_pct: number; // DERIVED: 100 - Σ(output.yield_pct)
  variable_cost_eur: number;
  fixed_cost_eur: number;
  total_cost_eur: number;
  outputs: NodeOutputAllocation[];
}

export interface NodeOutputAllocation {
  part_code: string;
  weight_kg: number;
  allocated_cost_eur: number;
  cost_per_kg: number;
  is_by_product: boolean;
  processable_byproduct: boolean;
}

export interface FinalOutput {
  part_code: string;
  weight_kg: number;
  cumulative_cost_eur: number; // Total cost along path from baseline to this output
  cost_per_kg: number;
  is_by_product: boolean;
}

export interface ChainMassBalanceCheck {
  valid: boolean;
  total_input_kg: number;
  total_output_kg: number;
  total_loss_kg: number;
  relative_error: number;
  tolerance: number; // SANDBOX_MASS_BALANCE_TOLERANCE = 0.001
}

// ========== Constants ==========

export const MAX_CHAIN_DEPTH = 10;
export const CHAIN_MASS_BALANCE_TOLERANCE = 0.001; // 0.1% relative tolerance
export const ALLOCATION_RECONCILIATION_TOLERANCE_EUR = 0.01; // 1 cent tolerance

// ========== Transition Matrix ==========

// Allowed transitions between node types (from spec section 4)
export const ALLOWED_TRANSITIONS: Record<NodeType, NodeType[]> = {
  slaughter: ['primal_cut'],
  primal_cut: ['sub_cut', 'packaging', 'logistics', 'external_service'],
  sub_cut: ['sub_cut', 'packaging', 'logistics', 'external_service'],
  packaging: ['logistics'],
  logistics: [],
  external_service: ['sub_cut', 'packaging', 'logistics', 'external_service'],
};
