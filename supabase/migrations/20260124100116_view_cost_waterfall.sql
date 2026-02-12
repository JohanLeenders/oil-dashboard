-- =============================================================================
-- Sprint 7: Cost Waterfall View (Canonical Cost Engine)
-- =============================================================================
-- Purpose: Visualize the complete cost flow from Live to SKU.
--
-- Per canonical document Section 8:
-- "The dashboard must clearly show the Waterfall of costs:
--  Live Cost → Yield Loss → Processing Cost → Variance → Final SKU Cost"
-- =============================================================================

CREATE OR REPLACE VIEW v_cost_waterfall AS
SELECT
  bv.batch_id,
  bv.batch_ref,

  -- Level 0: Landed Cost
  bv.input_live_kg,
  bv.input_count,
  bv.live_price_per_kg,
  bv.landed_cost_eur AS level_0_landed_cost_eur,
  bv.landed_cost_per_kg AS level_0_cost_per_kg,

  -- Level 0 → Level 1 Transformation
  bv.slaughter_fee_eur,
  bv.by_product_credit_eur,
  bv.net_slaughter_cost_eur,

  -- Level 1: Griller Cost
  bv.griller_weight_kg,
  bv.griller_yield_pct,
  bv.griller_cost_per_kg AS level_1_cost_per_kg,
  bv.griller_cost_total_eur AS level_1_griller_cost_eur,

  -- Yield Loss (cost impact of material loss)
  ROUND((bv.usable_live_kg - bv.griller_weight_kg) * bv.live_price_per_kg, 2) AS level_1_yield_loss_eur,

  -- Level 2: SVASO Allocation
  bv.total_market_value_eur AS level_2_tmv_eur,
  bv.k_factor AS level_2_k_factor,
  bv.k_factor_interpretation,

  -- Primal allocations (aggregated)
  (
    SELECT COALESCE(SUM(pv.allocated_cost_total_eur), 0)
    FROM part_valuation pv
    WHERE pv.batch_id = bv.batch_id AND pv.cost_level = 2
  ) AS level_2_primal_cost_eur,

  -- Variances
  bv.abnormal_doa_variance_eur AS variance_doa_eur,

  -- Cost multiplier (live to griller)
  CASE
    WHEN bv.live_price_per_kg > 0
    THEN ROUND((bv.griller_cost_per_kg / bv.live_price_per_kg)::numeric, 2)
    ELSE NULL
  END AS live_to_griller_multiplier,

  -- Cost multiplier estimate (live to meat, ~2.2x per canonical)
  CASE
    WHEN bv.live_price_per_kg > 0
    THEN ROUND((bv.griller_cost_per_kg / bv.live_price_per_kg / 0.625)::numeric, 2)
    ELSE NULL
  END AS live_to_meat_multiplier_est,

  -- Validation
  bv.is_valid,
  bv.sum_allocation_factors,

  -- Metadata
  bv.calculation_version,
  bv.calculated_at,

  -- Data type label
  'COST_WATERFALL' AS data_type

FROM batch_valuation bv
WHERE bv.is_valid = TRUE
ORDER BY bv.calculated_at DESC;
