CREATE OR REPLACE VIEW v_batch_mass_balance AS
SELECT
  pb.id AS batch_id,
  pb.batch_ref,
  pb.slaughter_date,
  pb.live_weight_kg AS source_live_weight,
  pb.rejection_kg AS loss_rejection,
  pb.slaughter_waste_kg AS loss_slaughter,
  pb.griller_weight_kg AS node_griller,
  COALESCE(y.breast_cap_kg, 0) AS node_breast_cap,
  COALESCE(y.leg_quarter_kg, 0) AS node_leg_quarter,
  COALESCE(y.wings_kg, 0) AS node_wings,
  COALESCE(y.back_carcass_kg, 0) AS node_back_carcass,
  COALESCE(y.offal_kg, 0) AS node_offal,
  pb.griller_weight_kg - (
    COALESCE(y.breast_cap_kg, 0) +
    COALESCE(y.leg_quarter_kg, 0) +
    COALESCE(y.wings_kg, 0) +
    COALESCE(y.back_carcass_kg, 0) +
    COALESCE(y.offal_kg, 0)
  ) AS loss_unaccounted,
  CASE
    WHEN y.yield_count < 5 THEN 'NEEDS_REVIEW'
    WHEN y.has_corrections THEN 'HAS_CORRECTIONS'
    ELSE 'COMPLETE'
  END AS data_status
FROM production_batches pb
LEFT JOIN LATERAL (
  SELECT
    SUM(CASE WHEN anatomical_part = 'breast_cap' THEN actual_weight_kg END) AS breast_cap_kg,
    SUM(CASE WHEN anatomical_part = 'leg_quarter' THEN actual_weight_kg END) AS leg_quarter_kg,
    SUM(CASE WHEN anatomical_part = 'wings' THEN actual_weight_kg END) AS wings_kg,
    SUM(CASE WHEN anatomical_part = 'back_carcass' THEN actual_weight_kg END) AS back_carcass_kg,
    SUM(CASE WHEN anatomical_part = 'offal' THEN actual_weight_kg END) AS offal_kg,
    COUNT(*) AS yield_count,
    BOOL_OR(is_correction) AS has_corrections
  FROM v_effective_batch_yields evy
  WHERE evy.batch_id = pb.id
) y ON true;
