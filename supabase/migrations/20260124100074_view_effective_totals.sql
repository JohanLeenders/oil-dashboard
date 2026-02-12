CREATE OR REPLACE VIEW v_effective_batch_totals AS
SELECT
  pb.id AS batch_id,
  pb.batch_ref,
  pb.slaughter_date,
  pb.live_weight_kg,
  pb.griller_weight_kg,
  pb.griller_yield_pct,
  COALESCE(y.total_yield_kg, 0) AS total_cut_up_kg,
  COALESCE(y.breast_cap_kg, 0) AS breast_cap_kg,
  COALESCE(y.leg_quarter_kg, 0) AS leg_quarter_kg,
  COALESCE(y.wings_kg, 0) AS wings_kg,
  COALESCE(y.back_carcass_kg, 0) AS back_carcass_kg,
  COALESCE(y.offal_kg, 0) AS offal_kg,
  COALESCE(c.total_cost, 0) AS total_batch_cost,
  COALESCE(c.slaughter_cost, 0) AS slaughter_cost,
  COALESCE(c.cutting_cost, 0) AS cutting_cost,
  COALESCE(c.other_cost, 0) AS other_cost,
  CASE
    WHEN y.has_corrections THEN 'HAS_CORRECTIONS'
    WHEN y.total_yield_kg IS NULL THEN 'MISSING_YIELDS'
    ELSE 'COMPLETE'
  END AS yield_data_status,
  CASE
    WHEN c.has_adjustments THEN 'HAS_ADJUSTMENTS'
    WHEN c.total_cost IS NULL THEN 'MISSING_COSTS'
    ELSE 'COMPLETE'
  END AS cost_data_status
FROM production_batches pb
LEFT JOIN LATERAL (
  SELECT
    SUM(actual_weight_kg) AS total_yield_kg,
    SUM(CASE WHEN anatomical_part = 'breast_cap' THEN actual_weight_kg END) AS breast_cap_kg,
    SUM(CASE WHEN anatomical_part = 'leg_quarter' THEN actual_weight_kg END) AS leg_quarter_kg,
    SUM(CASE WHEN anatomical_part = 'wings' THEN actual_weight_kg END) AS wings_kg,
    SUM(CASE WHEN anatomical_part = 'back_carcass' THEN actual_weight_kg END) AS back_carcass_kg,
    SUM(CASE WHEN anatomical_part = 'offal' THEN actual_weight_kg END) AS offal_kg,
    BOOL_OR(is_correction) AS has_corrections
  FROM v_effective_batch_yields evy
  WHERE evy.batch_id = pb.id
) y ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(amount) AS total_cost,
    SUM(CASE WHEN cost_type = 'slaughter' THEN amount END) AS slaughter_cost,
    SUM(CASE WHEN cost_type = 'cutting' THEN amount END) AS cutting_cost,
    SUM(CASE WHEN cost_type NOT IN ('slaughter', 'cutting') THEN amount END) AS other_cost,
    BOOL_OR(is_adjustment) AS has_adjustments
  FROM v_effective_batch_costs ebc
  WHERE ebc.batch_id = pb.id
) c ON true;
