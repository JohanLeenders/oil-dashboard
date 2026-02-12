/**
 * True-Up (Nacalculatie) Engine
 *
 * TRD Hoofdstuk 3.2:
 * Vergelijkt geplande kosten/yields met gerealiseerde waarden.
 *
 * Acceptance Test:
 * - delta_yield correct volgens formule
 * - signaal bij negatieve delta
 */

// ============================================================================
// TYPES
// ============================================================================

export interface YieldDelta {
  part: string;
  forecast_pct: number;
  actual_pct: number;
  delta_pct: number;
  delta_kg: number;
  status: 'positive' | 'neutral' | 'negative';
  signal_required: boolean;
}

export interface CostDelta {
  cost_type: string;
  planned_amount: number;
  actual_amount: number;
  delta_amount: number;
  delta_pct: number;
  status: 'under' | 'on_target' | 'over';
}

export interface TrueUpResult {
  batch_id: string;
  batch_ref: string;

  // Yield analysis
  griller_yield_delta: YieldDelta;
  part_yield_deltas: YieldDelta[];

  // Cost analysis
  cost_deltas: CostDelta[];
  total_planned_cost: number;
  total_actual_cost: number;
  total_cost_delta: number;

  // Net impact
  net_margin_impact: number;
  margin_impact_pct: number;

  // Signals
  signals: TrueUpSignal[];
}

export interface TrueUpSignal {
  type: 'yield_negative' | 'yield_positive' | 'cost_overrun' | 'cost_savings';
  severity: 'info' | 'warning' | 'critical';
  part_or_type: string;
  message: string;
  delta_value: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Hubbard JA757 yield targets */
export const YIELD_TARGETS = {
  griller: { min: 70.7, max: 74.4, forecast: 70.7 },
  breast_cap: { min: 34.8, max: 36.9, forecast: 35.85 },
  leg_quarter: { min: 42.0, max: 44.8, forecast: 43.4 },
  wings: { min: 10.6, max: 10.8, forecast: 10.7 },
  back_carcass: { min: 7.0, max: 8.2, forecast: 7.6 },
} as const;

/** Threshold voor negatieve yield signaal (% onder forecast) */
const NEGATIVE_YIELD_THRESHOLD = -2.0;

/** Threshold voor cost overrun signaal (%) */
const COST_OVERRUN_THRESHOLD = 5.0;

// ============================================================================
// CORE ENGINE
// ============================================================================

/**
 * Bereken yield delta
 *
 * Formule: delta = actual_pct - forecast_pct
 * - Positieve delta = beter dan verwacht
 * - Negatieve delta = slechter dan verwacht (signaal!)
 */
export function calculateYieldDelta(
  part: string,
  forecastPct: number,
  actualPct: number,
  baseWeight: number
): YieldDelta {
  const deltaPct = actualPct - forecastPct;
  const deltaKg = (deltaPct / 100) * baseWeight;

  let status: 'positive' | 'neutral' | 'negative';
  if (deltaPct > 1) {
    status = 'positive';
  } else if (deltaPct < NEGATIVE_YIELD_THRESHOLD) {
    status = 'negative';
  } else {
    status = 'neutral';
  }

  return {
    part,
    forecast_pct: forecastPct,
    actual_pct: Number(actualPct.toFixed(2)),
    delta_pct: Number(deltaPct.toFixed(2)),
    delta_kg: Number(deltaKg.toFixed(2)),
    status,
    signal_required: deltaPct < NEGATIVE_YIELD_THRESHOLD,
  };
}

/**
 * Bereken cost delta
 */
export function calculateCostDelta(
  costType: string,
  plannedAmount: number,
  actualAmount: number
): CostDelta {
  const deltaAmount = actualAmount - plannedAmount;
  const deltaPct = plannedAmount > 0
    ? (deltaAmount / plannedAmount) * 100
    : 0;

  let status: 'under' | 'on_target' | 'over';
  if (deltaPct > COST_OVERRUN_THRESHOLD) {
    status = 'over';
  } else if (deltaPct < -COST_OVERRUN_THRESHOLD) {
    status = 'under';
  } else {
    status = 'on_target';
  }

  return {
    cost_type: costType,
    planned_amount: plannedAmount,
    actual_amount: actualAmount,
    delta_amount: Number(deltaAmount.toFixed(2)),
    delta_pct: Number(deltaPct.toFixed(2)),
    status,
  };
}

/**
 * Volledige True-Up analyse voor een batch
 */
export function calculateTrueUp(
  batchId: string,
  batchRef: string,
  data: {
    live_weight_kg: number;
    griller_weight_kg: number;
    forecast_griller_yield_pct: number;
    part_yields: Array<{
      part: string;
      actual_pct: number;
    }>;
    planned_costs: Array<{
      cost_type: string;
      amount: number;
    }>;
    actual_costs: Array<{
      cost_type: string;
      amount: number;
    }>;
    revenue?: number;
  }
): TrueUpResult {
  const signals: TrueUpSignal[] = [];

  // Griller yield delta
  const actualGrillerYield =
    (data.griller_weight_kg / data.live_weight_kg) * 100;

  const grillerDelta = calculateYieldDelta(
    'griller',
    data.forecast_griller_yield_pct,
    actualGrillerYield,
    data.live_weight_kg
  );

  if (grillerDelta.signal_required) {
    signals.push({
      type: 'yield_negative',
      severity: 'warning',
      part_or_type: 'griller',
      message: `Griller yield ${grillerDelta.delta_pct.toFixed(1)}% onder forecast. ` +
        `Dit vertegenwoordigt ${Math.abs(grillerDelta.delta_kg).toFixed(1)} kg verlies.`,
      delta_value: grillerDelta.delta_pct,
    });
  }

  // Part yield deltas
  const partDeltas: YieldDelta[] = data.part_yields.map(py => {
    const target = YIELD_TARGETS[py.part as keyof typeof YIELD_TARGETS];
    const forecastPct = target?.forecast || py.actual_pct;

    const delta = calculateYieldDelta(
      py.part,
      forecastPct,
      py.actual_pct,
      data.griller_weight_kg
    );

    if (delta.signal_required) {
      signals.push({
        type: 'yield_negative',
        severity: 'warning',
        part_or_type: py.part,
        message: `${py.part} yield ${delta.delta_pct.toFixed(1)}% onder forecast.`,
        delta_value: delta.delta_pct,
      });
    } else if (delta.status === 'positive') {
      signals.push({
        type: 'yield_positive',
        severity: 'info',
        part_or_type: py.part,
        message: `${py.part} yield ${delta.delta_pct.toFixed(1)}% boven forecast.`,
        delta_value: delta.delta_pct,
      });
    }

    return delta;
  });

  // Cost deltas
  const costDeltas: CostDelta[] = [];
  const plannedCostMap = new Map(
    data.planned_costs.map(c => [c.cost_type, c.amount])
  );
  const actualCostMap = new Map(
    data.actual_costs.map(c => [c.cost_type, c.amount])
  );

  // Combineer alle cost types
  const allCostTypes = new Set([
    ...plannedCostMap.keys(),
    ...actualCostMap.keys(),
  ]);

  for (const costType of allCostTypes) {
    const planned = plannedCostMap.get(costType) || 0;
    const actual = actualCostMap.get(costType) || 0;

    const delta = calculateCostDelta(costType, planned, actual);
    costDeltas.push(delta);

    if (delta.status === 'over') {
      signals.push({
        type: 'cost_overrun',
        severity: delta.delta_pct > 20 ? 'critical' : 'warning',
        part_or_type: costType,
        message: `${costType} kosten ${delta.delta_pct.toFixed(1)}% boven planning ` +
          `(€${delta.delta_amount.toFixed(2)} meer).`,
        delta_value: delta.delta_amount,
      });
    } else if (delta.status === 'under' && delta.delta_amount < -100) {
      signals.push({
        type: 'cost_savings',
        severity: 'info',
        part_or_type: costType,
        message: `${costType} kosten €${Math.abs(delta.delta_amount).toFixed(2)} onder planning.`,
        delta_value: delta.delta_amount,
      });
    }
  }

  // Totalen
  const totalPlannedCost = data.planned_costs.reduce((s, c) => s + c.amount, 0);
  const totalActualCost = data.actual_costs.reduce((s, c) => s + c.amount, 0);
  const totalCostDelta = totalActualCost - totalPlannedCost;

  // Net margin impact
  const revenue = data.revenue || 0;
  const plannedMargin = revenue - totalPlannedCost;
  const actualMargin = revenue - totalActualCost;
  const netMarginImpact = actualMargin - plannedMargin;
  const marginImpactPct = plannedMargin > 0
    ? (netMarginImpact / plannedMargin) * 100
    : 0;

  return {
    batch_id: batchId,
    batch_ref: batchRef,
    griller_yield_delta: grillerDelta,
    part_yield_deltas: partDeltas,
    cost_deltas: costDeltas,
    total_planned_cost: Number(totalPlannedCost.toFixed(2)),
    total_actual_cost: Number(totalActualCost.toFixed(2)),
    total_cost_delta: Number(totalCostDelta.toFixed(2)),
    net_margin_impact: Number(netMarginImpact.toFixed(2)),
    margin_impact_pct: Number(marginImpactPct.toFixed(2)),
    signals,
  };
}
