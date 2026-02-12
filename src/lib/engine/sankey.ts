/**
 * Sankey Diagram Data Generator voor Massabalans
 *
 * TRD Hoofdstuk 5.1:
 * Flow: Levend -> Griller -> Snijdelen -> Klant
 * Inzicht: Visueel maken van "Mass Loss" en "Commercial Loss"
 *
 * Prepared for Visx Sankey component
 */

import type { BatchMassBalance, AnatomicalPart } from '@/types/database';

// ============================================================================
// TYPES (Compatible met @visx/sankey)
// ============================================================================

export interface SankeyNode {
  name: string;
  /** Node category voor kleuring */
  category: 'source' | 'loss' | 'product' | 'destination';
  /** Gewicht in kg (voor labels) */
  value?: number;
  /** Percentage van bron */
  percentage?: number;
  /** Kleur override */
  color?: string;
}

export interface SankeyLink {
  source: number; // Index in nodes array
  target: number; // Index in nodes array
  value: number;  // Gewicht in kg
  /** Link type voor styling */
  type?: 'main' | 'loss' | 'product';
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface MassBalanceSankeyOptions {
  /** Include offal in visualization */
  includeOffal?: boolean;
  /** Include unaccounted loss */
  includeUnaccounted?: boolean;
  /** Minimum value to show (filter small flows) */
  minValue?: number;
  /** Custom colors */
  colors?: {
    source?: string;
    loss?: string;
    product?: string;
    premium?: string;
    rest?: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_COLORS = {
  source: '#f97316',      // Oranje (brand)
  loss: '#94a3b8',        // Grijs (verlies)
  product: '#22c55e',     // Groen (verkoopbaar)
  premium: '#3b82f6',     // Blauw (premium: filet)
  rest: '#a855f7',        // Paars (rest: karkas)
};

const PART_LABELS: Record<string, string> = {
  breast_cap: 'Borstkap',
  leg_quarter: 'Achterkwartier',
  wings: 'Vleugels',
  back_carcass: 'Karkas/Rug',
  offal: 'Organen',
};

// ============================================================================
// CORE GENERATOR
// ============================================================================

/**
 * Genereer Sankey data voor massabalans visualisatie
 *
 * @param massBalance - Batch mass balance data uit v_batch_mass_balance view
 * @param options - Configuratie opties
 *
 * @example
 * ```tsx
 * const sankeyData = generateMassBalanceSankey(batchBalance);
 *
 * <Sankey
 *   data={sankeyData}
 *   width={800}
 *   height={400}
 * />
 * ```
 */
export function generateMassBalanceSankey(
  massBalance: BatchMassBalance,
  options: MassBalanceSankeyOptions = {}
): SankeyData {
  const {
    includeOffal = true,
    includeUnaccounted = true,
    minValue = 0.5,
    colors = DEFAULT_COLORS,
  } = options;

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  // Helper om node index te krijgen
  const getNodeIndex = (name: string): number => {
    const idx = nodes.findIndex(n => n.name === name);
    if (idx === -1) {
      throw new Error(`Node not found: ${name}`);
    }
    return idx;
  };

  // =========================================================================
  // NIVEAU 1: Levend -> Griller (+ verliezen)
  // =========================================================================

  // Node 0: Levend gewicht (bron)
  nodes.push({
    name: 'Levend Gewicht',
    category: 'source',
    value: massBalance.source_live_weight,
    percentage: 100,
    color: colors.source,
  });

  // Node 1: Afkeur/DOA (verlies)
  if (massBalance.loss_rejection > minValue) {
    nodes.push({
      name: 'Afkeur/DOA',
      category: 'loss',
      value: massBalance.loss_rejection,
      percentage: (massBalance.loss_rejection / massBalance.source_live_weight) * 100,
      color: colors.loss,
    });
  }

  // Node 2: Slachtafval (verlies)
  if (massBalance.loss_slaughter > minValue) {
    nodes.push({
      name: 'Slachtafval',
      category: 'loss',
      value: massBalance.loss_slaughter,
      percentage: (massBalance.loss_slaughter / massBalance.source_live_weight) * 100,
      color: colors.loss,
    });
  }

  // Node 3: Griller (tussenproduct)
  nodes.push({
    name: 'Griller',
    category: 'product',
    value: massBalance.node_griller,
    percentage: (massBalance.node_griller / massBalance.source_live_weight) * 100,
    color: colors.source,
  });

  // Links van Levend naar verliezen en Griller
  const levendIdx = 0;

  if (massBalance.loss_rejection > minValue) {
    links.push({
      source: levendIdx,
      target: getNodeIndex('Afkeur/DOA'),
      value: massBalance.loss_rejection,
      type: 'loss',
    });
  }

  if (massBalance.loss_slaughter > minValue) {
    links.push({
      source: levendIdx,
      target: getNodeIndex('Slachtafval'),
      value: massBalance.loss_slaughter,
      type: 'loss',
    });
  }

  links.push({
    source: levendIdx,
    target: getNodeIndex('Griller'),
    value: massBalance.node_griller,
    type: 'main',
  });

  // =========================================================================
  // NIVEAU 2: Griller -> Snijdelen
  // =========================================================================

  const grillerIdx = getNodeIndex('Griller');
  const grillerWeight = massBalance.node_griller;

  // Borstkap (Premium)
  if (massBalance.node_breast_cap > minValue) {
    nodes.push({
      name: PART_LABELS.breast_cap,
      category: 'product',
      value: massBalance.node_breast_cap,
      percentage: (massBalance.node_breast_cap / grillerWeight) * 100,
      color: colors.premium,
    });
    links.push({
      source: grillerIdx,
      target: getNodeIndex(PART_LABELS.breast_cap),
      value: massBalance.node_breast_cap,
      type: 'product',
    });
  }

  // Achterkwartier
  if (massBalance.node_leg_quarter > minValue) {
    nodes.push({
      name: PART_LABELS.leg_quarter,
      category: 'product',
      value: massBalance.node_leg_quarter,
      percentage: (massBalance.node_leg_quarter / grillerWeight) * 100,
      color: colors.product,
    });
    links.push({
      source: grillerIdx,
      target: getNodeIndex(PART_LABELS.leg_quarter),
      value: massBalance.node_leg_quarter,
      type: 'product',
    });
  }

  // Vleugels
  if (massBalance.node_wings > minValue) {
    nodes.push({
      name: PART_LABELS.wings,
      category: 'product',
      value: massBalance.node_wings,
      percentage: (massBalance.node_wings / grillerWeight) * 100,
      color: colors.product,
    });
    links.push({
      source: grillerIdx,
      target: getNodeIndex(PART_LABELS.wings),
      value: massBalance.node_wings,
      type: 'product',
    });
  }

  // Karkas/Rug (Rest)
  if (massBalance.node_back_carcass > minValue) {
    nodes.push({
      name: PART_LABELS.back_carcass,
      category: 'product',
      value: massBalance.node_back_carcass,
      percentage: (massBalance.node_back_carcass / grillerWeight) * 100,
      color: colors.rest,
    });
    links.push({
      source: grillerIdx,
      target: getNodeIndex(PART_LABELS.back_carcass),
      value: massBalance.node_back_carcass,
      type: 'product',
    });
  }

  // Organen (optioneel)
  if (includeOffal && massBalance.node_offal > minValue) {
    nodes.push({
      name: PART_LABELS.offal,
      category: 'product',
      value: massBalance.node_offal,
      percentage: (massBalance.node_offal / grillerWeight) * 100,
      color: colors.rest,
    });
    links.push({
      source: grillerIdx,
      target: getNodeIndex(PART_LABELS.offal),
      value: massBalance.node_offal,
      type: 'product',
    });
  }

  // Onverklaard verlies (optioneel)
  if (includeUnaccounted && massBalance.loss_unaccounted > minValue) {
    nodes.push({
      name: 'Onverklaard Verlies',
      category: 'loss',
      value: massBalance.loss_unaccounted,
      percentage: (massBalance.loss_unaccounted / grillerWeight) * 100,
      color: colors.loss,
    });
    links.push({
      source: grillerIdx,
      target: getNodeIndex('Onverklaard Verlies'),
      value: massBalance.loss_unaccounted,
      type: 'loss',
    });
  }

  return { nodes, links };
}

/**
 * Genereer Sankey data voor meerdere batches (geaggregeerd)
 */
export function generateAggregatedSankey(
  massBalances: BatchMassBalance[],
  options: MassBalanceSankeyOptions = {}
): SankeyData {
  // Aggregeer alle waarden
  const aggregated: BatchMassBalance = {
    batch_id: 'aggregated',
    batch_ref: 'Alle Batches',
    slaughter_date: '',
    source_live_weight: 0,
    loss_rejection: 0,
    loss_slaughter: 0,
    node_griller: 0,
    node_breast_cap: 0,
    node_leg_quarter: 0,
    node_wings: 0,
    node_back_carcass: 0,
    node_offal: 0,
    loss_unaccounted: 0,
  };

  for (const mb of massBalances) {
    aggregated.source_live_weight += mb.source_live_weight;
    aggregated.loss_rejection += mb.loss_rejection;
    aggregated.loss_slaughter += mb.loss_slaughter;
    aggregated.node_griller += mb.node_griller;
    aggregated.node_breast_cap += mb.node_breast_cap;
    aggregated.node_leg_quarter += mb.node_leg_quarter;
    aggregated.node_wings += mb.node_wings;
    aggregated.node_back_carcass += mb.node_back_carcass;
    aggregated.node_offal += mb.node_offal;
    aggregated.loss_unaccounted += mb.loss_unaccounted;
  }

  return generateMassBalanceSankey(aggregated, options);
}

/**
 * Converteer Sankey data naar Visx-compatible format
 * (Visx gebruikt { source: string, target: string } ipv indices)
 */
export function toVisxFormat(data: SankeyData): {
  nodes: Array<{ name: string }>;
  links: Array<{ source: string; target: string; value: number }>;
} {
  return {
    nodes: data.nodes.map(n => ({ name: n.name })),
    links: data.links.map(l => ({
      source: data.nodes[l.source].name,
      target: data.nodes[l.target].name,
      value: l.value,
    })),
  };
}

/**
 * Bereken totale mass loss percentage
 */
export function calculateMassLossPercentage(
  massBalance: BatchMassBalance
): {
  total_loss_pct: number;
  rejection_pct: number;
  slaughter_pct: number;
  unaccounted_pct: number;
} {
  const liveWeight = massBalance.source_live_weight;

  return {
    total_loss_pct: Number(
      (((massBalance.loss_rejection + massBalance.loss_slaughter + massBalance.loss_unaccounted) /
        liveWeight) * 100).toFixed(2)
    ),
    rejection_pct: Number(
      ((massBalance.loss_rejection / liveWeight) * 100).toFixed(2)
    ),
    slaughter_pct: Number(
      ((massBalance.loss_slaughter / liveWeight) * 100).toFixed(2)
    ),
    unaccounted_pct: Number(
      ((massBalance.loss_unaccounted / massBalance.node_griller) * 100).toFixed(2)
    ),
  };
}
