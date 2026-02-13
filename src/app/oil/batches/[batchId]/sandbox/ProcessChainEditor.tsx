'use client';

/**
 * Process Chain Editor — Sprint 12.2
 *
 * Form-based process chain builder for scenario sandbox.
 * All UI text from sandboxLabels (NL).
 * NO drag-and-drop canvas (deferred to v2+).
 */

import { useState } from 'react';
import type { ProcessChain, ProcessNode, ProcessEdge, NodeType, Entity } from '@/lib/engine/chain';
import { validateProcessChain } from '@/lib/engine/chain';
import { CHAIN, NODE_TYPES, ENTITY_TYPES, partName } from '@/lib/ui/sandboxLabels';

interface ProcessChainEditorProps {
  enabled: boolean;
  chain: ProcessChain | null;
  onChange: (chain: ProcessChain | null) => void;
  onValidationChange: (isValid: boolean, errors: string[]) => void;
}

export function ProcessChainEditor({
  enabled,
  chain,
  onChange,
  onValidationChange,
}: ProcessChainEditorProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Handle toggle
  const handleToggle = (isEnabled: boolean) => {
    if (!isEnabled) {
      onChange(null);
      setValidationErrors([]);
      onValidationChange(true, []);
    } else {
      // Initialize empty chain
      const newChain: ProcessChain = {
        version: '1.0.0',
        nodes: [],
        edges: [],
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString(),
      };
      onChange(newChain);
    }
  };

  // Add node
  const handleAddNode = () => {
    if (!chain) return;

    const newNode: ProcessNode = {
      id: `node-${Date.now()}`,
      type: 'primal_cut',
      label: CHAIN.newNodeLabel,
      entity: 'internal',
      inputs: [{ part_code: 'griller', required_kg: null }],
      outputs: [{ part_code: 'output', yield_pct: 100, is_by_product: false }],
      variable_cost_per_kg: 0,
      fixed_cost_per_execution: 0,
      is_valid: true,
      validation_errors: [],
    };

    const updatedChain: ProcessChain = {
      ...chain,
      nodes: [...chain.nodes, newNode],
      last_modified: new Date().toISOString(),
    };

    onChange(updatedChain);
    setSelectedNodeId(newNode.id);
  };

  // Remove node
  const handleRemoveNode = (nodeId: string) => {
    if (!chain) return;

    const updatedChain: ProcessChain = {
      ...chain,
      nodes: chain.nodes.filter((n) => n.id !== nodeId),
      edges: chain.edges.filter((e) => e.source_node_id !== nodeId && e.target_node_id !== nodeId),
      last_modified: new Date().toISOString(),
    };

    onChange(updatedChain);
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Update node
  const handleUpdateNode = (nodeId: string, updates: Partial<ProcessNode>) => {
    if (!chain) return;

    const updatedChain: ProcessChain = {
      ...chain,
      nodes: chain.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
      last_modified: new Date().toISOString(),
    };

    onChange(updatedChain);
  };

  // Add edge
  const handleAddEdge = (sourceNodeId: string, targetNodeId: string, partCode: string) => {
    if (!chain) return;

    const newEdge: ProcessEdge = {
      id: `edge-${Date.now()}`,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      part_code: partCode,
      flow_kg: null,
      is_valid: true,
      validation_errors: [],
    };

    const updatedChain: ProcessChain = {
      ...chain,
      edges: [...chain.edges, newEdge],
      last_modified: new Date().toISOString(),
    };

    onChange(updatedChain);
  };

  // Remove edge
  const handleRemoveEdge = (edgeId: string) => {
    if (!chain) return;

    const updatedChain: ProcessChain = {
      ...chain,
      edges: chain.edges.filter((e) => e.id !== edgeId),
      last_modified: new Date().toISOString(),
    };

    onChange(updatedChain);
  };

  // Validate chain
  const handleValidate = () => {
    if (!chain) {
      setValidationErrors([]);
      onValidationChange(true, []);
      return;
    }

    const result = validateProcessChain(chain);

    if (result.valid) {
      setValidationErrors([]);
      onValidationChange(true, []);
    } else {
      const errors = result.error ? [result.error] : [];
      setValidationErrors(errors);
      onValidationChange(false, errors);
    }
  };

  // Auto-validate on change
  useState(() => {
    if (chain) {
      handleValidate();
    }
  });

  if (!enabled) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{CHAIN.chainDisabledTitle}</h4>
            <p className="text-xs text-gray-600 mt-1">
              {CHAIN.chainDisabledDescription}
            </p>
          </div>
          <button
            onClick={() => handleToggle(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {CHAIN.enable}
          </button>
        </div>
      </div>
    );
  }

  const selectedNode = chain?.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="space-y-4">
      {/* Header with toggle */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-blue-900">
              {CHAIN.heading}
            </h4>
            <p className="text-xs text-blue-700 mt-1">
              cost_method: <span className="font-mono">chain_yield_proportional</span>
            </p>
          </div>
          <button
            onClick={() => handleToggle(false)}
            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            {CHAIN.disable}
          </button>
        </div>
      </div>

      {/* Validation Panel */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-red-900 mb-2">{CHAIN.validationErrors}</h5>
          <ul className="text-xs text-red-800 space-y-1">
            {validationErrors.map((error, idx) => (
              <li key={idx}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Two-column layout: Nodes list + Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: Nodes List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-semibold text-gray-900">{CHAIN.nodes} ({chain?.nodes.length || 0})</h5>
            <button
              onClick={handleAddNode}
              className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
            >
              {CHAIN.addNode}
            </button>
          </div>

          <div className="space-y-2">
            {chain?.nodes.map((node) => {
              const derivedLoss = 100 - node.outputs.reduce((sum, o) => sum + o.yield_pct, 0);
              const isSelected = selectedNodeId === node.id;

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{node.label}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {CHAIN.nodeType}: <span className="font-mono">{NODE_TYPES[node.type] ?? node.type}</span> | {CHAIN.entity}:{' '}
                        {ENTITY_TYPES[node.entity] ?? node.entity}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {CHAIN.lossDerived}: {derivedLoss.toFixed(1)}%
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveNode(node.id);
                      }}
                      className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition-colors"
                    >
                      {CHAIN.remove}
                    </button>
                  </div>
                </div>
              );
            })}

            {(!chain?.nodes || chain.nodes.length === 0) && (
              <p className="text-sm text-gray-500 italic">{CHAIN.noNodesYet}</p>
            )}
          </div>
        </div>

        {/* RIGHT: Node Editor */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {selectedNode ? (
            <div className="space-y-4">
              <h5 className="text-sm font-semibold text-gray-900">{CHAIN.editNode}</h5>

              {/* Label */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{CHAIN.label}</label>
                <input
                  type="text"
                  value={selectedNode.label}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>

              {/* Node Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{CHAIN.nodeType}</label>
                <select
                  value={selectedNode.type}
                  onChange={(e) =>
                    handleUpdateNode(selectedNode.id, { type: e.target.value as NodeType })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {Object.entries(NODE_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Entity */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{CHAIN.entity}</label>
                <select
                  value={selectedNode.entity}
                  onChange={(e) =>
                    handleUpdateNode(selectedNode.id, { entity: e.target.value as Entity })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {Object.entries(ENTITY_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Costs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {CHAIN.variableCost}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedNode.variable_cost_per_kg}
                    onChange={(e) =>
                      handleUpdateNode(selectedNode.id, {
                        variable_cost_per_kg: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {CHAIN.fixedCost}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedNode.fixed_cost_per_execution}
                    onChange={(e) =>
                      handleUpdateNode(selectedNode.id, {
                        fixed_cost_per_execution: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Input (single input only) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {CHAIN.inputPartCode}
                </label>
                <input
                  type="text"
                  value={selectedNode.inputs[0]?.part_code || ''}
                  onChange={(e) =>
                    handleUpdateNode(selectedNode.id, {
                      inputs: [{ part_code: e.target.value, required_kg: null }],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="griller, breast_cap"
                />
              </div>

              {/* Outputs */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  {CHAIN.outputsHeading}
                </label>
                <div className="space-y-2">
                  {selectedNode.outputs.map((output, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={output.part_code}
                        onChange={(e) => {
                          const newOutputs = [...selectedNode.outputs];
                          newOutputs[idx] = { ...newOutputs[idx], part_code: e.target.value };
                          handleUpdateNode(selectedNode.id, { outputs: newOutputs });
                        }}
                        className="col-span-5 px-2 py-1 border border-gray-300 rounded text-xs"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={output.yield_pct}
                        onChange={(e) => {
                          const newOutputs = [...selectedNode.outputs];
                          newOutputs[idx] = {
                            ...newOutputs[idx],
                            yield_pct: parseFloat(e.target.value) || 0,
                          };
                          handleUpdateNode(selectedNode.id, { outputs: newOutputs });
                        }}
                        className="col-span-3 px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="%"
                      />
                      <label className="col-span-3 flex items-center text-xs">
                        <input
                          type="checkbox"
                          checked={output.is_by_product}
                          onChange={(e) => {
                            const newOutputs = [...selectedNode.outputs];
                            newOutputs[idx] = {
                              ...newOutputs[idx],
                              is_by_product: e.target.checked,
                            };
                            handleUpdateNode(selectedNode.id, { outputs: newOutputs });
                          }}
                          className="mr-1"
                        />
                        <span className="text-gray-700">{CHAIN.byProduct}</span>
                      </label>
                      <button
                        onClick={() => {
                          const newOutputs = selectedNode.outputs.filter((_, i) => i !== idx);
                          handleUpdateNode(selectedNode.id, { outputs: newOutputs });
                        }}
                        className="col-span-1 px-1 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const newOutputs = [
                      ...selectedNode.outputs,
                      { part_code: 'new_output', yield_pct: 0, is_by_product: false },
                    ];
                    handleUpdateNode(selectedNode.id, { outputs: newOutputs });
                  }}
                  className="mt-2 px-3 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                >
                  {CHAIN.addOutput}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">{CHAIN.selectNodeHint}</p>
          )}
        </div>
      </div>

      {/* Edges Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h5 className="text-sm font-semibold text-gray-900 mb-3">
          {CHAIN.edges} ({chain?.edges.length || 0})
        </h5>

        <div className="space-y-2">
          {chain?.edges.map((edge) => {
            const sourceNode = chain.nodes.find((n) => n.id === edge.source_node_id);
            const targetNode = chain.nodes.find((n) => n.id === edge.target_node_id);

            return (
              <div
                key={edge.id}
                className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded"
              >
                <p className="text-xs text-gray-700">
                  <span className="font-medium">{sourceNode?.label || '?'}</span> →{' '}
                  <span className="font-medium">{targetNode?.label || '?'}</span>
                  <span className="text-gray-500 ml-2">({partName(edge.part_code)})</span>
                </p>
                <button
                  onClick={() => handleRemoveEdge(edge.id)}
                  className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200"
                >
                  {CHAIN.remove}
                </button>
              </div>
            );
          })}

          {(!chain?.edges || chain.edges.length === 0) && (
            <p className="text-sm text-gray-500 italic">{CHAIN.noEdgesYet}</p>
          )}
        </div>

        {/* Simple edge adder */}
        {chain && chain.nodes.length >= 2 && (
          <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-2">{CHAIN.addEdge}</p>
            <p className="text-xs text-gray-500 italic">
              {CHAIN.noEdgesYet}
            </p>
          </div>
        )}
      </div>

      {/* Validate Button */}
      <button
        onClick={handleValidate}
        className="w-full px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
      >
        {CHAIN.validate}
      </button>
    </div>
  );
}
