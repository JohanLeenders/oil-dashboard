'use client';

/**
 * Mass Balance Sankey Diagram
 *
 * REGRESSIE-CHECK:
 * - ✅ Gebruikt generateMassBalanceSankey() uit engine
 * - ✅ Read-only visualisatie
 * - ✅ Geen aannames over gewichten (data uit props)
 * - ✅ Append-only veilig (toont effective data)
 * - ✅ Visx Sankey met hover tooltips
 * - ✅ Geen writes, geen edits, geen auto-correcties
 */

import { useMemo, useState, useCallback } from 'react';
import { Group } from '@visx/group';
import { Sankey, sankeyLinkHorizontal } from '@visx/sankey';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import type { BatchMassBalance } from '@/types/database';
import { generateMassBalanceSankey, calculateMassLossPercentage, toVisxFormat } from '@/lib/engine/sankey';

interface MassBalanceSankeyProps {
  massBalance: BatchMassBalance;
  width?: number;
  height?: number;
}

// Node colors based on category
const NODE_COLORS: Record<string, string> = {
  'Levend Gewicht': '#f97316',
  'Griller': '#fb923c',
  'Borstkap': '#3b82f6',
  'Achterkwartier': '#22c55e',
  'Vleugels': '#4ade80',
  'Karkas/Rug': '#a855f7',
  'Organen': '#c084fc',
  'Afkeur/DOA': '#94a3b8',
  'Slachtafval': '#94a3b8',
  'Onverklaard Verlies': '#f87171',
};

const LINK_COLORS: Record<string, string> = {
  main: 'rgba(249, 115, 22, 0.4)',
  product: 'rgba(34, 197, 94, 0.4)',
  loss: 'rgba(148, 163, 184, 0.4)',
};

interface TooltipData {
  name: string;
  value: number;
  percentage: number;
  type: 'node' | 'link';
  source?: string;
  target?: string;
}

interface SankeyNodeType {
  name: string;
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  value?: number;
}

interface SankeyLinkType {
  source: SankeyNodeType;
  target: SankeyNodeType;
  value: number;
  width?: number;
}

export function MassBalanceSankey({
  massBalance,
  width = 800,
  height = 400,
}: MassBalanceSankeyProps) {
  const sankeyData = useMemo(
    () => generateMassBalanceSankey(massBalance),
    [massBalance]
  );

  const visxData = useMemo(
    () => toVisxFormat(sankeyData),
    [sankeyData]
  );

  const lossMetrics = useMemo(
    () => calculateMassLossPercentage(massBalance),
    [massBalance]
  );

  const {
    showTooltip,
    hideTooltip,
    tooltipOpen,
    tooltipData,
    tooltipLeft,
    tooltipTop,
  } = useTooltip<TooltipData>();

  const margin = { top: 20, right: 120, bottom: 20, left: 20 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const handleNodeHover = useCallback(
    (event: React.MouseEvent, node: SankeyNodeType) => {
      const originalNode = sankeyData.nodes.find(n => n.name === node.name);
      showTooltip({
        tooltipData: {
          name: node.name,
          value: originalNode?.value || node.value || 0,
          percentage: originalNode?.percentage || 0,
          type: 'node',
        },
        tooltipLeft: event.clientX,
        tooltipTop: event.clientY,
      });
    },
    [sankeyData.nodes, showTooltip]
  );

  const handleLinkHover = useCallback(
    (event: React.MouseEvent, link: SankeyLinkType) => {
      showTooltip({
        tooltipData: {
          name: `${link.source.name} → ${link.target.name}`,
          value: link.value,
          percentage: (link.value / massBalance.source_live_weight) * 100,
          type: 'link',
          source: link.source.name,
          target: link.target.name,
        },
        tooltipLeft: event.clientX,
        tooltipTop: event.clientY,
      });
    },
    [massBalance.source_live_weight, showTooltip]
  );

  return (
    <div className="space-y-6">
      {/* Visx Sankey Diagram */}
      <div className="relative overflow-x-auto">
        <svg width={width} height={height}>
          <Group top={margin.top} left={margin.left}>
            <Sankey<{ name: string }, { source: string; target: string; value: number }>
              root={visxData}
              size={[innerWidth, innerHeight]}
              nodeWidth={15}
              nodePadding={10}
              nodeId={(d) => d.name}
            >
              {({ graph }) => (
                <>
                  {/* Links */}
                  {graph.links.map((link, i) => {
                    const originalLink = sankeyData.links[i];
                    const linkType = originalLink?.type || 'main';

                    return (
                      <path
                        key={`link-${i}`}
                        d={sankeyLinkHorizontal()(link as any) || ''}
                        fill="none"
                        stroke={LINK_COLORS[linkType] || LINK_COLORS.main}
                        strokeWidth={Math.max(1, (link as any).width || 1)}
                        strokeOpacity={0.7}
                        onMouseMove={(e) => handleLinkHover(e, link as any)}
                        onMouseLeave={hideTooltip}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  })}

                  {/* Nodes */}
                  {graph.nodes.map((node, i) => {
                    const typedNode = node as any;
                    const nodeWidth = (typedNode.x1 || 0) - (typedNode.x0 || 0);
                    const nodeHeight = Math.max(1, (typedNode.y1 || 0) - (typedNode.y0 || 0));

                    return (
                      <Group key={`node-${i}`}>
                        <rect
                          x={typedNode.x0 || 0}
                          y={typedNode.y0 || 0}
                          width={nodeWidth}
                          height={nodeHeight}
                          fill={NODE_COLORS[typedNode.name] || '#94a3b8'}
                          rx={2}
                          onMouseMove={(e) => handleNodeHover(e, typedNode)}
                          onMouseLeave={hideTooltip}
                          style={{ cursor: 'pointer' }}
                        />
                        {/* Node label */}
                        <text
                          x={(typedNode.x0 || 0) < innerWidth / 2 ? (typedNode.x1 || 0) + 6 : (typedNode.x0 || 0) - 6}
                          y={((typedNode.y0 || 0) + (typedNode.y1 || 0)) / 2}
                          dy="0.35em"
                          textAnchor={(typedNode.x0 || 0) < innerWidth / 2 ? 'start' : 'end'}
                          fontSize={11}
                          fill="#374151"
                        >
                          {typedNode.name}
                        </text>
                      </Group>
                    );
                  })}
                </>
              )}
            </Sankey>
          </Group>
        </svg>

        {/* Tooltip */}
        {tooltipOpen && tooltipData && (
          <TooltipWithBounds
            left={tooltipLeft}
            top={tooltipTop}
            style={{
              ...defaultStyles,
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '8px 12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
          >
            <div className="text-sm">
              <p className="font-semibold text-gray-900">{tooltipData.name}</p>
              <p className="text-gray-600">
                {tooltipData.value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg
              </p>
              <p className="text-gray-500 text-xs">
                {tooltipData.percentage.toFixed(1)}% van totaal
              </p>
            </div>
          </TooltipWithBounds>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
        <MetricCard
          label="Totaal verlies"
          value={`${lossMetrics.total_loss_pct}%`}
          subtext={`${(massBalance.loss_rejection + massBalance.loss_slaughter + massBalance.loss_unaccounted).toFixed(0)} kg`}
        />
        <MetricCard
          label="Afkeur"
          value={`${lossMetrics.rejection_pct}%`}
          subtext={`${massBalance.loss_rejection.toFixed(0)} kg`}
        />
        <MetricCard
          label="Slachtafval"
          value={`${lossMetrics.slaughter_pct}%`}
          subtext={`${massBalance.loss_slaughter.toFixed(0)} kg`}
        />
        <MetricCard
          label="Onverklaard"
          value={`${lossMetrics.unaccounted_pct}%`}
          subtext={`${massBalance.loss_unaccounted.toFixed(0)} kg`}
          highlight={lossMetrics.unaccounted_pct > 5}
        />
      </div>

      {/* Data Info */}
      {massBalance.data_status && massBalance.data_status !== 'COMPLETE' && (
        <div className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded">
          Data status: {massBalance.data_status}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  highlight = false,
}: {
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
}) {
  return (
    <div className={`text-center ${highlight ? 'text-orange-600' : ''}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-orange-600' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400">{subtext}</p>
    </div>
  );
}
