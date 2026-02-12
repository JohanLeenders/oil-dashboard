# Sprint 11B: Process Chain Editor v1 — Design Specification

**Status**: DESIGNED (not implemented)
**Created**: 2026-02-12
**Prerequisites**: Sprint 11A COMPLETE
**Scope Level**: B (transformations with losses), C (multi-entity costing)

---

## 1. Objective & Non-Goals

### Objective

Enable scenario-based experimentation with custom processing chains that model transformations between anatomical parts and sub-cuts, with per-step losses, multi-entity costs, and mass balance validation.

**Key Goals**:
- Visual drag-and-drop process chain builder for what-if analysis
- Model transformations: anatomical parts → sub-cuts → SKUs
- Multi-entity costing: steps can be performed by different entities (internal/external)
- Cost types: variable (€/kg) + fixed (€ per entity per step)
- Hard-block invalid step ordering (ordering constraints enforcement)
- Absolute mass balance guarantee (node-level + cumulative)
- Integration with Sprint 11A sandbox for L4-L7 scenario analysis

### Explicit Non-Goals (OUT OF SCOPE)

❌ **NOT a replacement for canonical engine** — canonical remains the source of truth for actual batches
❌ **NOT for production planning** — this is scenario/what-if analysis only
❌ **NOT a workflow orchestration system** — no actual batch processing control
❌ **NOT multi-batch optimization** — chains are per-scenario, not fleet-wide
❌ **NOT real-time costing** — scenarios are computed on-demand (user clicks "Run")
❌ **NOT collaborative editing** — single-user scenarios only (v1)
❌ **NOT version control / diff / merge** — scenarios are immutable snapshots
❌ **NOT modifying canonical-cost.ts** — canon engine remains untouched

---

## 2. UX v1: User Capabilities

### What the User CAN Do (v1)

**Chain Building**:
- ✅ Add nodes from a palette using a form/list-based builder
- ✅ Connect nodes with directed edges (input → output) via dropdown selectors
- ✅ Configure node properties:
  - Node type (slaughter, primal_cut, sub_cut, packaging, logistics)
  - Entity (internal, external contractor A/B/C)
  - Input part(s) and output part(s)
  - Yield % (or loss %)
  - Variable cost (€/kg output)
  - Fixed cost (€ per execution)
- ✅ Delete nodes/edges
- ✅ Validate chain (ordering rules, mass balance, cycles)
- ✅ Run scenario with custom chain (computes L4-L7 via chain)
- ✅ Compare baseline (canonical L0-L3) vs scenario (L0-L3 + chain L4-L7)
- ✅ Save/load chain configurations as part of sandbox scenarios

**Constraints Enforced**:
- ✅ Hard-block invalid step order (e.g., cannot package before cutting)
- ✅ Hard-block mass balance violations (node-level + cumulative)
- ✅ Hard-block cycles in DAG
- ✅ Warn on disconnected nodes

### What is DEFERRED (Future Sprints)

⏸️ **Drag-and-drop canvas**: v1 uses form/list-based builder; visual canvas deferred to v2+
⏸️ **Templates/Presets**: No predefined chain templates (user builds from scratch)
⏸️ **Auto-layout**: Manual positioning deferred (not needed for form-based v1)
⏸️ **Undo/Redo**: No action history (delete and rebuild instead)
⏸️ **Collaborative editing**: Single-user only
⏸️ **Chain-to-chain comparison**: Compare single chain to baseline only
⏸️ **Entity capacity constraints**: No entity throughput limits
⏸️ **Time/scheduling**: No temporal modeling (all costs are per-kg or per-step)
⏸️ **Quality/grading**: No product quality tiers
⏸️ **Batch splitting**: One input batch → one output (no parallelization)

---

## 3. Data Model: Process DAG JSON Schema

### Storage Decision

**CHOSEN APPROACH**: Store in `sandbox_scenarios.inputs_json` under new top-level key `process_chain`.

**Rationale**:
- ✅ Minimal schema change (no new columns/tables)
- ✅ Chain is part of scenario definition (inputs)
- ✅ Naturally versioned with scenario
- ✅ Easy to save/load with existing `createScenario` / `readScenario` actions

**Schema Change**: NONE (use existing JSONB column)

### JSON Schema: ProcessChain

```typescript
interface ProcessChain {
  version: '1.0.0';  // Semantic versioning for backward compatibility

  nodes: ProcessNode[];
  edges: ProcessEdge[];

  // Metadata
  created_at: string;  // ISO 8601
  last_modified: string;  // ISO 8601
}

interface ProcessNode {
  id: string;  // UUID
  type: NodeType;

  // Visual layout (for canvas — v2+, optional in v1)
  position?: { x: number; y: number };

  // Processing definition
  label: string;  // User-friendly name
  entity: Entity;

  inputs: PartReference[];  // Input parts (from upstream nodes or baseline)
  outputs: PartOutput[];    // Output parts (with yields)

  // Costing
  variable_cost_per_kg: number;  // € per kg OUTPUT
  fixed_cost_per_execution: number;  // € flat fee per node execution

  // Mass balance
  // NOTE: loss_pct is DERIVED (read-only): loss_pct = 100 - Σ(output.yield_pct)
  // No editable total_loss_pct field — loss is the residual after accounting for all outputs

  // Validation metadata
  is_valid: boolean;
  validation_errors: string[];
}

type NodeType =
  | 'slaughter'       // Live → griller + by-products (usually baseline, not chain)
  | 'primal_cut'      // Griller → breast_cap/legs/wings/back
  | 'sub_cut'         // breast_cap → filet + rest
  | 'packaging'       // Part → packaged SKU (adds packaging cost)
  | 'logistics'       // Transport/storage (adds logistics cost)
  | 'external_service';  // Generic external processing

type Entity =
  | 'internal'
  | 'contractor_a'
  | 'contractor_b'
  | 'contractor_c';

interface PartReference {
  part_code: string;  // References anatomical part or sub-cut
  required_kg: number | null;  // How much needed, or null = use all available from upstream
  // JSON-safe: no string sentinel 'all' — null is explicit and type-safe
}

interface PartOutput {
  part_code: string;  // Output part code
  yield_pct: number;  // % of input that becomes this output (0-100)
  is_by_product: boolean;  // True if waste/offal/etc
  processable_byproduct?: boolean;  // If true, this by-product can be further processed (default: false)
}

interface ProcessEdge {
  id: string;  // UUID
  source_node_id: string;
  target_node_id: string;

  // Flow specification
  part_code: string;  // Which part flows along this edge
  flow_kg: number | null;  // Computed during execution; null before execution

  // Validation
  is_valid: boolean;
  validation_errors: string[];
}
```

### Example: Breast Filet Chain

```json
{
  "version": "1.0.0",
  "nodes": [
    {
      "id": "node-001",
      "type": "primal_cut",
      "label": "Primal Cut (Internal)",
      "entity": "internal",
      "inputs": [
        { "part_code": "griller", "required_kg": null }
      ],
      "outputs": [
        { "part_code": "breast_cap", "yield_pct": 35.0, "is_by_product": false },
        { "part_code": "legs", "yield_pct": 43.0, "is_by_product": false },
        { "part_code": "wings", "yield_pct": 10.4, "is_by_product": false },
        { "part_code": "back", "yield_pct": 11.6, "is_by_product": true, "processable_byproduct": false }
      ],
      "variable_cost_per_kg": 0.15,
      "fixed_cost_per_execution": 50.00,
      "is_valid": true,
      "validation_errors": []
    },
    {
      "id": "node-002",
      "type": "sub_cut",
      "label": "Filet Cut (Contractor A)",
      "entity": "contractor_a",
      "inputs": [
        { "part_code": "breast_cap", "required_kg": null }
      ],
      "outputs": [
        { "part_code": "filet", "yield_pct": 85.0, "is_by_product": false },
        { "part_code": "breast_rest", "yield_pct": 13.0, "is_by_product": true, "processable_byproduct": false }
      ],
      "variable_cost_per_kg": 0.50,
      "fixed_cost_per_execution": 25.00,
      "is_valid": true,
      "validation_errors": []
    }
  ],
  "edges": [
    {
      "id": "edge-001",
      "source_node_id": "node-001",
      "target_node_id": "node-002",
      "part_code": "breast_cap",
      "flow_kg": null,
      "is_valid": true,
      "validation_errors": []
    }
  ],
  "created_at": "2026-02-12T21:30:00Z",
  "last_modified": "2026-02-12T21:30:00Z"
}
```

### Versioning & Backward Compatibility

**Version Field**: `"version": "1.0.0"` (semantic versioning)

**Strategy**:
- v1.0.0 (initial): Current schema
- v1.1.0 (minor): Add optional fields (backward compatible)
- v2.0.0 (major): Breaking schema changes (migration required)

**Handling Old Scenarios**:
- If `process_chain` key missing → use canonical L0-L3 only (no chain)
- If `process_chain.version` < current → attempt migration or display warning
- If migration fails → mark scenario as "incompatible" and block execution

---

## 4. Hard Ordering Rules

### Allowed Transitions (Node Type → Node Type)

| From ↓ / To → | slaughter | primal_cut | sub_cut | packaging | logistics | external_service |
|---------------|-----------|------------|---------|-----------|-----------|------------------|
| **slaughter** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **primal_cut** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **sub_cut** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **packaging** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **logistics** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **external_service** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

**Rules**:
1. ✅ `slaughter` → `primal_cut` ONLY
2. ✅ `primal_cut` → `sub_cut`, `packaging`, `logistics`, `external_service`
3. ✅ `sub_cut` → `sub_cut` (nested cuts allowed), `packaging`, `logistics`, `external_service`
4. ✅ `packaging` → `logistics` ONLY
5. ❌ `logistics` → TERMINAL (no further processing)
6. ❌ **NO CYCLES** (DAG enforcement)

### Disallowed Transitions

❌ Cannot go backward (e.g., `packaging` → `sub_cut`)
❌ Cannot skip required steps (e.g., raw part → logistics without packaging)
❌ Cannot create cycles (detected via topological sort)
❌ Cannot have multiple slaughter nodes
❌ Cannot have disconnected subgraphs (all nodes must trace to baseline input)
❌ Cannot exceed MAX_CHAIN_DEPTH = 10 (prevents excessively deep chains)
❌ Cannot process by-products downstream unless marked `processable_byproduct: true` (default: false)

### Validation Strategy

**When**: On every node/edge add, before scenario execution

**Constants**:
```typescript
const MAX_CHAIN_DEPTH = 10;  // Maximum number of nodes in longest path
```

**Algorithm**:
```typescript
function validateChain(chain: ProcessChain): ValidationResult {
  // 1. Cycle detection (topological sort)
  if (hasCycle(chain.nodes, chain.edges)) {
    return { valid: false, error: 'Cycle detected in process chain' };
  }

  // 2. Chain depth validation
  const maxDepth = calculateMaxDepth(chain);
  if (maxDepth > MAX_CHAIN_DEPTH) {
    return { valid: false, error: `Chain depth ${maxDepth} exceeds limit of ${MAX_CHAIN_DEPTH}` };
  }

  // 3. Ordering rules validation
  for (const edge of chain.edges) {
    const source = chain.nodes.find(n => n.id === edge.source_node_id);
    const target = chain.nodes.find(n => n.id === edge.target_node_id);

    if (!isAllowedTransition(source.type, target.type)) {
      return { valid: false, error: `Invalid transition: ${source.type} → ${target.type}` };
    }
  }

  // 4. By-product processing validation
  for (const edge of chain.edges) {
    const source = chain.nodes.find(n => n.id === edge.source_node_id);
    const output = source?.outputs.find(o => o.part_code === edge.part_code);

    if (output?.is_by_product && !output?.processable_byproduct) {
      return { valid: false, error: `Cannot process by-product ${edge.part_code} (not marked as processable)` };
    }
  }

  // 5. Mass balance validation (see section 6)
  const mbResult = validateChainMassBalance(chain, baselineData);
  if (!mbResult.valid) {
    return mbResult;
  }

  // 6. Connectivity validation
  if (hasDisconnectedNodes(chain)) {
    return { valid: false, error: 'Chain has disconnected nodes' };
  }

  return { valid: true };
}
```

**Enforcement**: Hard-block scenario execution if `validateChain()` fails

**Partial Chains (v1)**:
- ✅ Chains need NOT model all parts — unmodeled parts retain canonical L3 costs and pass through unchanged
- ✅ Example: If chain only models breast_cap → filet, then legs/wings use canonical SVASO allocation
- ✅ Baseline griller weight remains the master; chain modifies only the specified paths

---

## 5. Costing Semantics

### Cost Types

**1. Variable Cost (€/kg)**:
- Applied per kg of **output** from the node
- Example: Cutting costs €0.50/kg filet produced

**2. Fixed Cost (€ per execution)**:
- Flat fee per node execution, regardless of throughput
- Example: Setup fee of €25 for contractor A to run filet line

### Cost Application Logic

```typescript
function computeNodeCost(node: ProcessNode, input_kg: number): NodeCostResult {
  // Compute total output yield (loss is derived as residual)
  const total_output_yield_pct = node.outputs.reduce((sum, o) => sum + o.yield_pct, 0);
  const loss_pct = 100 - total_output_yield_pct;  // DERIVED (read-only)
  const output_kg = input_kg * (total_output_yield_pct / 100);

  // Apply costs
  const variable_cost_eur = output_kg * node.variable_cost_per_kg;
  const fixed_cost_eur = node.fixed_cost_per_execution;
  const total_node_cost_eur = variable_cost_eur + fixed_cost_eur;

  // CRITICAL: Allocate to outputs based on their share of TOTAL_OUTPUT_YIELD (not /100)
  // This ensures costs are allocated by actual output kg, not input kg
  const output_allocations = node.outputs.map(output => {
    const output_share = output.yield_pct / total_output_yield_pct;  // FIX: denominator is total_output_yield_pct
    const output_weight_kg = input_kg * (output.yield_pct / 100);
    const allocated_cost_eur = total_node_cost_eur * output_share;
    const cost_per_kg = output_weight_kg > 0 ? allocated_cost_eur / output_weight_kg : 0;

    return {
      part_code: output.part_code,
      weight_kg: output_weight_kg,
      allocated_cost_eur,
      cost_per_kg,
    };
  });

  // RECONCILIATION INVARIANT: Σ(allocated_cost_eur) MUST equal total_node_cost_eur (within rounding tolerance)
  const total_allocated = output_allocations.reduce((sum, o) => sum + o.allocated_cost_eur, 0);
  const allocation_error = Math.abs(total_allocated - total_node_cost_eur);
  if (allocation_error > 0.01) {  // 1 cent tolerance for rounding
    throw new Error(`Cost allocation reconciliation failed: allocated ${total_allocated.toFixed(2)} vs expected ${total_node_cost_eur.toFixed(2)}`);
  }

  return {
    input_kg,
    output_kg,
    loss_kg: input_kg * (loss_pct / 100),
    loss_pct,  // DERIVED field for display
    variable_cost_eur,
    fixed_cost_eur,
    total_cost_eur: total_node_cost_eur,
    outputs: output_allocations,
  };
}
```

### Fixed Cost Allocation Strategy

**CHOSEN**: Allocate fixed costs proportionally to output yields (same as variable costs)

**Alternative Considered**: Allocate only to primary outputs (not by-products)
**Rejected**: Inconsistent with SVASO philosophy (all costs must be allocated)

**Example (Corrected)**:
- Input: 100 kg breast_cap
- Node: Filet cut (85% filet, 13% rest, 2% loss derived)
- Total output yield: 85% + 13% = 98%
- Loss (derived): 100% - 98% = 2%
- Output kg: 100 × 0.98 = 98 kg
- Variable cost: €0.50/kg × 98 kg output = €49.00
- Fixed cost: €25.00
- Total node cost: €74.00

**Allocation (by output share of total output yield)**:
- Filet share: 85 / 98 = 0.8673 (86.73%)
- Rest share: 13 / 98 = 0.1327 (13.27%)
- Filet: 85 kg → €64.18 (€74 × 0.8673) → €0.7550/kg
- Rest: 13 kg → €9.82 (€74 × 0.1327) → €0.7554/kg
- Loss: 2 kg → absorbed into costs (not allocated separately)
- Reconciliation: €64.18 + €9.82 = €74.00 ✅

### Roll-Up into L4+ Chain Layer

**CRITICAL SEMANTIC DISTINCTION**:

Chain outputs are **NOT SVASO-allocated** and must **NOT** be mapped into canonical L4 Mini-SVASO structures.

Instead, the chain produces an **additive "processing layer" (L4+ chain layer)** with its own semantics:

**Cost Method Discriminant**:
```typescript
interface ChainCostResult {
  cost_method: 'chain_yield_proportional';  // Explicit discriminant (NOT 'svaso')
  // ... chain-specific fields
}
```

**L0-L3 Remain Canonical**:
- Baseline waterfall (L0 Landed Cost, L1 Joint Cost Pool, L2 Net Joint Cost, L3 SVASO Allocation) is computed using canonical engine
- Chain does NOT modify L0-L3 calculations

**L4+ Chain Layer Semantics**:
- Chain execution produces its own costing layer with yield-proportional allocation
- Chain costs are cumulative: node costs roll up along paths
- Chain outputs have `cost_method: 'chain_yield_proportional'` to prevent confusion with SVASO
- Chain results are displayed separately from canonical L0-L3 waterfall

**NO Mapping to Canonical L4-L7**:
- Chain does NOT produce `MiniSVASOResult`, `ABCCostResult`, `FullSKUCostResult`, or `NRVAssessment`
- Chain produces its own result structure with explicit `cost_method` discriminant

**Implementation Strategy**:
```typescript
function computeChainWaterfall(
  baseline: BaselineBatchData,
  chain: ProcessChain
): ChainWaterfallResult {
  // 1. Execute chain (topological order)
  const chainResults = executeChain(chain, baseline);

  return {
    // L0-L3 from baseline (unchanged, canonical)
    baseline_waterfall: {
      l0_landed_cost: baseline.waterfall.l0_landed_cost,
      l1_joint_cost_pool: baseline.waterfall.l1_joint_cost_pool,
      l2_net_joint_cost: baseline.waterfall.l2_net_joint_cost,
      l3_svaso_allocation: baseline.waterfall.l3_svaso_allocation,
    },

    // L4+ chain layer (separate, NOT canonical L4-L7)
    chain_layer: {
      cost_method: 'chain_yield_proportional',  // DISCRIMINANT
      node_results: chainResults.node_results,
      final_outputs: chainResults.final_outputs,
      total_chain_cost_eur: chainResults.total_chain_cost_eur,
      total_chain_variable_cost_eur: chainResults.total_chain_variable_cost_eur,
      total_chain_fixed_cost_eur: chainResults.total_chain_fixed_cost_eur,
    },
  };
}
```

---

## 6. Mass Balance Semantics

### Node-Level Mass Conservation Rule

**INVARIANT**: For every node, `Σ(output.yield_pct) ≤ 100%`

**Loss is DERIVED (read-only)**:
```
loss_pct = 100 - Σ(output_i.yield_pct)
```

**Validation**:
```typescript
function validateNodeMassBalance(node: ProcessNode): boolean {
  const total_output_yield = node.outputs.reduce((sum, o) => sum + o.yield_pct, 0);

  // Outputs cannot exceed 100%
  if (total_output_yield > 100.0) {
    return false;
  }

  // Tolerance check: total should be close to 100% (within 0.1%)
  const tolerance = 0.1;  // 0.1% tolerance (matches SANDBOX_MASS_BALANCE_TOLERANCE * 100)
  const total_accounted = total_output_yield;

  // Allow up to 100%, warn if significantly less (suggests unintended loss)
  if (total_accounted < 90.0) {
    // Warning: large loss (>10%) — may be intentional, but flag for review
    console.warn(`Node ${node.id} has large loss: ${100 - total_accounted}%`);
  }

  return total_output_yield <= 100.0;
}
```

**Enforcement**: Hard-block node save if `Σ(outputs) > 100%`

**Display**: Show derived `loss_pct` as read-only field in UI

### Cumulative Yield/Loss Propagation

**Chain-Level Mass Balance**:
```
baseline_griller_kg × cumulative_yield_factor = final_output_kg + cumulative_loss_kg
```

**Cumulative Yield Factor**: Product of all node yields along path

**Example (Corrected)**:
- Start: 1728 kg griller
- Node 1 (primal cut): 35% breast_cap → 604.8 kg (total output 100%, loss 0%)
- Node 2 (filet cut): outputs = 85% filet + 13% rest = 98% total output, loss (derived) = 2%
- Cumulative yield for filet path: 35% × 85% = 29.75%
- Final filet output: 1728 × 0.2975 = 514.08 kg
- Cumulative loss: 1728 × 0.35 × 0.02 = 12.096 kg (from node 2)
- Final check: 514.08 kg filet + (1728 × 0.35 × 0.13) = 514.08 + 78.624 = 592.7 kg from breast path ✅

### Handling By-Products vs Cut-Up vs Waste

**Classification**:
1. **Joint Products**: Primary outputs (filet, legs, wings) — participate in cost allocation
2. **By-Products**: Secondary outputs (back, rest, trim) — receive allocated costs but marked as `is_by_product: true`
3. **Waste/Loss**: Does NOT become an output part — absorbed into costs of remaining outputs

**Mass Balance Treatment**:
- Joint products + by-products + waste/loss = 100% of input
- Only joint products and by-products create output edges
- Waste/loss is tracked in `total_loss_pct` but has no output part

**Validation Strategy**:
```typescript
function validateChainMassBalance(
  chain: ProcessChain,
  baseline: BaselineBatchData
): MassBalanceValidation {
  // 1. Node-level validation (outputs ≤ 100%)
  for (const node of chain.nodes) {
    if (!validateNodeMassBalance(node)) {
      return { valid: false, error: `Node ${node.id} outputs exceed 100%` };
    }
  }

  // 2. Path-level validation (trace each path from baseline to outputs)
  const paths = findAllPaths(chain, baseline);
  for (const path of paths) {
    // Compute cumulative yield (product of all output yields along path)
    const cumulative_yield = path.nodes.reduce((y, node, idx) => {
      const output = node.outputs.find(o => o.part_code === path.part_codes[idx]);
      return y * (output.yield_pct / 100);
    }, 1.0);

    const expected_output = baseline.griller_weight_kg * cumulative_yield;
    const actual_output = path.final_output_kg;

    const relative_error = expected_output > 0
      ? Math.abs(expected_output - actual_output) / expected_output
      : 0;

    if (relative_error > 0.001) { // 0.1% tolerance (matches SANDBOX_MASS_BALANCE_TOLERANCE)
      return {
        valid: false,
        error: `Path ${path.id} cumulative mass balance violated (${(relative_error * 100).toFixed(2)}% error)`
      };
    }
  }

  return { valid: true };
}
```

**Tolerance**: Use same `SANDBOX_MASS_BALANCE_TOLERANCE = 0.001` (0.1%) for cumulative path checks

**Hard-Block**: Scenario execution fails if any mass balance check fails

---

## 7. Integration with Sprint 11A Sandbox

### How runScenarioSandbox Calls the Chain Engine

**Current Flow (11A)**:
```
runScenarioSandbox(baseline, input)
  → mergeOverrides
  → validateScenarioMassBalance
  → compute L0-L3
  → return result
```

**Extended Flow (11B)**:
```
runScenarioSandbox(baseline, input)
  → mergeOverrides (respects yield_overrides for primal splits)
  → validateScenarioMassBalance (baseline level)
  → compute L0-L3 (unchanged, canonical)
  → IF input.process_chain exists:
      → validateChain(input.process_chain)
      → executeChain(input.process_chain, baseline)
      → produce chain_layer with cost_method='chain_yield_proportional'
    ELSE:
      → chain_layer remains undefined (backward compatible)
  → computeDeltas (extended for chain_layer)
  → return result
```

**Yield Override Relationship (SI-2)**:

**RULE (v1)**: Chain primal_cut yields are **derived from** `ScenarioInput.yield_overrides`.

- If `input.yield_overrides` specifies breast_cap/legs/wings yields, these are used as primal split
- Chain **cannot independently override** primal split yields
- Chain nodes that reference primal outputs (breast_cap, legs, wings) receive the merged yields from baseline + overrides
- Chain only controls **downstream transformations** (sub_cut, packaging, logistics)

**Example**:
```typescript
// Scenario input has:
input.yield_overrides = [
  { part_code: 'breast_cap', weight_kg: 620 }  // Override from baseline 604 kg
];

// Chain primal_cut node MUST use 620 kg breast_cap as input (not baseline 604 kg)
// Chain cannot have a separate yield override for primal split
```

**Validation**: Hard-block if chain attempts to override primal yields that conflict with `yield_overrides`

### Modified ScenarioInput Interface

```typescript
interface ScenarioInput {
  scenario_id: string;
  scenario_name: string;
  description?: string;
  batch_id: string;

  // Existing 11A overrides
  live_price_per_kg?: number;
  yield_overrides?: YieldOverride[];
  price_overrides?: PriceOverride[];

  // NEW: Process chain (11B)
  process_chain?: ProcessChain;  // Optional for backward compatibility
}
```

### Delta Computation for Chain Layer

**Interface Extension**:
```typescript
interface DeltaResult {
  // Existing L0-L3 deltas (unchanged)
  l0_landed_cost_delta_eur: number;
  l0_landed_cost_delta_pct: number;
  // ... (existing fields)

  // NEW: Chain layer deltas (11B)
  chain_deltas?: ChainDeltaResult;  // Only if process_chain exists
}

interface ChainDeltaResult {
  cost_method: 'chain_yield_proportional';  // DISCRIMINANT

  // Total chain cost delta
  baseline_chain_cost_eur: number | null;  // null if baseline has no chain
  scenario_chain_cost_eur: number;
  delta_chain_cost_eur: number;
  delta_chain_cost_pct: number;

  // Per-output deltas
  output_deltas: ChainOutputDelta[];
}

interface ChainOutputDelta {
  part_code: string;
  baseline_cost_per_kg: number | null;  // null if not in baseline chain
  scenario_cost_per_kg: number;
  delta_cost_per_kg: number;
  delta_cost_per_kg_pct: number | null;  // null if baseline was null
}
```

**Computation Strategy**:
- Chain deltas compare **chain layer only**, NOT against canonical L4-L7
- If baseline has no chain → all deltas are "new" (baseline = null)
- If baseline has chain → compare scenario chain vs baseline chain

### Chain Execution Engine

**New Module**: `src/lib/engine/chain/executeChain.ts`

**Signature**:
```typescript
export function executeChain(
  chain: ProcessChain,
  baseline: BaselineBatchData
): ChainExecutionResult;

interface ChainExecutionResult {
  success: boolean;
  error: string | null;

  cost_method: 'chain_yield_proportional';  // DISCRIMINANT

  node_results: NodeExecutionResult[];  // Per-node costs and outputs
  final_outputs: FinalOutput[];         // Terminal outputs

  total_chain_cost_eur: number;
  total_chain_variable_cost_eur: number;
  total_chain_fixed_cost_eur: number;

  mass_balance_check: ChainMassBalanceCheck;
}

interface NodeExecutionResult {
  node_id: string;
  input_kg: number;
  output_kg: number;
  loss_kg: number;
  loss_pct: number;  // DERIVED: 100 - Σ(output.yield_pct)
  variable_cost_eur: number;
  fixed_cost_eur: number;
  total_cost_eur: number;
  outputs: NodeOutputAllocation[];
}

interface NodeOutputAllocation {
  part_code: string;
  weight_kg: number;
  allocated_cost_eur: number;
  cost_per_kg: number;
  is_by_product: boolean;
  processable_byproduct: boolean;
}
```

---

## 8. Test Plan

### P0 Tests (Critical for GO/NO-GO)

**Mass Balance Tests**:
1. ✅ Single node: outputs + loss = 100% (within 0.1% tolerance)
2. ✅ Multi-node chain: cumulative yield matches final output
3. ✅ Hard-block: scenario execution fails if mass balance violated
4. ✅ Edge case: 100% yield (no loss) passes validation
5. ✅ Edge case: 50% loss passes if outputs + loss = 100%

**Ordering Rules Tests**:
6. ✅ Valid transition: slaughter → primal_cut → sub_cut → packaging → logistics
7. ✅ Invalid transition: packaging → sub_cut (blocked)
8. ✅ Cycle detection: A → B → C → A (blocked)
9. ✅ Disconnected nodes: isolated node without input edge (blocked)

**Fixed Cost Allocation Tests**:
10. ✅ Fixed cost allocated proportionally to output yields
11. ✅ Variable cost applied per kg output
12. ✅ Total node cost = variable + fixed
13. ✅ Zero-output node: cost allocated to non-zero outputs only

**Identity/Drift Tests**:
14. ✅ Chain with zero overrides produces same L0-L3 as baseline (drift prevention)
15. ✅ Empty chain (no nodes) = baseline L0-L3 only, no L4-L7
16. ✅ Saved chain → load → execute produces identical results (idempotency)

**Integration Tests**:
17. ✅ runScenarioSandbox with process_chain calls executeChain
18. ✅ runScenarioSandbox without process_chain skips chain (backward compatible)
19. ✅ Delta computation for L4-L7 when chain present
20. ✅ Export CSV includes chain results

### P1 Tests (Important but not blocking)

21. Multi-entity costing: different entities have different costs
22. By-product handling: by-products receive allocated costs
23. Nested sub-cuts: sub_cut → sub_cut → sub_cut (3 levels deep)
24. Large chain: 20+ nodes execute correctly
25. Rounding tolerance: cumulative rounding errors stay within 0.1%
26. Edge case: single-node chain (minimal processing)
27. Edge case: all outputs are by-products (no joint products)
28. Validation messages: clear error messages for each validation failure

---

## 9. Risks & Mitigations

### Risk 1: Graph Cycles

**Impact**: Infinite loop during execution, application hang
**Likelihood**: Medium (user error when connecting nodes)
**Mitigation**:
- ✅ Detect cycles using topological sort BEFORE execution
- ✅ Hard-block edge creation if it would create a cycle
- ✅ Show clear error message: "Cannot create edge: would form cycle A → B → C → A"

### Risk 2: Cumulative Rounding Errors

**Impact**: Mass balance validation fails due to floating-point drift
**Likelihood**: Medium (long chains with many decimal yields)
**Mitigation**:
- ✅ Use Decimal.js for all arithmetic (already in codebase)
- ✅ Set tolerance at 0.1% (same as SANDBOX_MASS_BALANCE_TOLERANCE)
- ✅ Test with pathological case: 10-node chain with 99.9% yields

### Risk 3: UX Complexity (Drag-and-Drop)

**Impact**: Difficult for users to build valid chains, frustration
**Likelihood**: High (graph editors are inherently complex)
**Mitigation**:
- ✅ Real-time validation feedback (red nodes/edges for errors)
- ✅ Guided mode: suggest valid next steps based on current selection
- ✅ Clear validation error messages with actionable fix instructions
- ✅ Auto-validation on every change (immediate feedback)
- ⏸️ DEFERRED: Templates/presets (future sprint)

### Risk 4: Performance (Large Chains)

**Impact**: Slow scenario execution for chains with 50+ nodes
**Likelihood**: Low (most scenarios will have <20 nodes)
**Mitigation**:
- ✅ Topological sort is O(V+E), acceptable for <100 nodes
- ✅ Execution is single-pass traversal, O(V)
- ⏸️ DEFERRED: Caching/memoization (if needed in future)

### Risk 5: Backward Compatibility

**Impact**: Old scenarios break when loading in new version
**Likelihood**: Medium (schema evolves over time)
**Mitigation**:
- ✅ Semantic versioning in ProcessChain.version
- ✅ Missing process_chain key → treat as "no chain" (backward compatible)
- ✅ Schema migrations for major version bumps
- ✅ Warning UI for incompatible scenarios

### Risk 6: Data Integrity (Invalid JSON in Database)

**Impact**: Scenario fails to load, user loses work
**Likelihood**: Low (JSONB validation by Postgres)
**Mitigation**:
- ✅ Server-side validation before saving scenario
- ✅ Try-catch during scenario load with clear error message
- ✅ Schema validation using Zod or similar (on load)

---

## 10. GO/NO-GO Gates for Starting Implementation (11B.1)

### MUST Gates (Blocking)

Before starting implementation of Sprint 11B.1, the following MUST be true:

✅ **Sprint 11A COMPLETE and STABLE**
- All 11A tests passing (382+ tests)
- No known critical bugs in sandbox UI
- No drift issues between batch data and baseline

✅ **Design Spec APPROVED**
- This design spec reviewed and approved by user
- No major design questions unresolved
- Data model schema finalized

✅ **No Canonical Engine Changes Required**
- Confirmed that chain can integrate without modifying canonical-cost.ts
- Mapping strategy for L4-L7 validated conceptually

✅ **Mass Balance Strategy VALIDATED**
- Node-level + cumulative validation strategy agreed upon
- Tolerance (0.1%) confirmed acceptable
- Hard-block approach confirmed

### SHOULD Gates (Recommended)

⚠️ **User Acceptance of UX Complexity**
- User acknowledges drag-and-drop graph editing is complex
- User accepts that v1 will have manual positioning (no auto-layout)

⚠️ **Multi-Entity Costing Semantics Clarified**
- Confirm: fixed costs allocated proportionally to yields (not just to joint products)
- Confirm: entity is metadata only (no capacity constraints in v1)

⚠️ **Test Coverage Target Agreed**
- Target: 20+ P0 tests for chain engine
- Target: 90%+ code coverage for chain execution logic

### Implementation Phasing

**Recommended Phases** (STOP-per-sprint after each):

**Phase 11B.1: Chain Engine Foundation**
- Data model implementation (ProcessChain types)
- Chain validation (ordering rules, cycles, mass balance)
- Chain execution engine (executeChain)
- P0 tests (mass balance, ordering, fixed costs, identity)

**Phase 11B.2: UI - Form/List Builder**
- Form/list-based chain builder component
- Node palette (list view with "Add Node" button)
- Node property editor (modal or inline form)
- Edge creation via dropdown selectors (source → target)

**Phase 11B.3: Integration & Export**
- Integrate chain with runScenarioSandbox
- Delta computation for L4-L7
- CSV export update (include chain results)
- Save/load chain scenarios

**Phase 11B.4: Polish & Validation UX**
- Real-time validation feedback
- Error message improvements
- Performance optimization
- User testing & iteration

---

## Appendix: Open Design Questions (Require Clarification)

### Q1: Should chains be reusable across scenarios?

**Option A**: Chain is part of scenario inputs (current design)
**Option B**: Chains are stored separately, scenarios reference chain_id

**Current Decision**: Option A (embedded in scenario)
**Rationale**: Simpler, no new table, naturally versioned
**Trade-off**: Chains are duplicated across scenarios (not DRY)

### Q2: How to handle entity capacity constraints?

**Option A**: No constraints (v1 — current design)
**Option B**: Add entity capacity fields (kg/hour, max concurrent batches)

**Current Decision**: Option A (no constraints)
**Deferred to**: Future sprint (11C or later)

### Q3: Should we support conditional edges (if-then logic)?

**Example**: "If breast weight > 600kg, route to contractor A, else internal"

**Option A**: No (v1 — current design, pure DAG)
**Option B**: Add conditional edge types

**Current Decision**: Option A (no conditionals)
**Deferred to**: Future sprint (advanced scenarios)

---

## Summary

**Sprint 11B v1** enables visual process chain editing for scenario-based what-if analysis with:
- ✅ Transformations between parts/sub-cuts with losses
- ✅ Multi-entity costing (variable + fixed)
- ✅ Hard ordering constraints (DAG enforcement)
- ✅ Absolute mass balance guarantee (0.1% tolerance)
- ✅ Integration with Sprint 11A sandbox (L4-L7 extension)
- ✅ Minimal schema change (use existing JSONB column)

**Critical Success Factors**:
1. Mass balance NEVER breaks (hard-block enforcement)
2. Canonical engine remains untouched (canon is truth for actuals)
3. UX complexity managed through real-time validation feedback
4. Backward compatibility maintained (old scenarios still work)

**Next Step**: Await GO/NO-GO for Sprint 11B.1 implementation.

---

**END OF DESIGN SPECIFICATION**
