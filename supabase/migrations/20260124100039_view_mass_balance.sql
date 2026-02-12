CREATE VIEW v_batch_mass_balance AS
SELECT
  b.id AS batch_id,
  b.batch_ref,
  b.slaughter_date,
  b.live_weight_kg AS source_live_weight,
  b.rejection_kg AS loss_rejection,
  b.slaughter_waste_kg AS loss_slaughter,
  b.griller_weight_kg AS node_griller,
  COALESCE(y.breast_cap_kg, 0) AS node_breast_cap,
  COALESCE(y.leg_quarter_kg, 0) AS node_leg_quarter,
  COALESCE(y.wings_kg, 0) AS node_wings,
  COALESCE(y.back_carcass_kg, 0) AS node_back_carcass,
  COALESCE(y.offal_kg, 0) AS node_offal,
  b.griller_weight_kg - (
    COALESCE(y.breast_cap_kg, 0) +
    COALESCE(y.leg_quarter_kg, 0) +
    COALESCE(y.wings_kg, 0) +
    COALESCE(y.back_carcass_kg, 0) +
    COALESCE(y.offal_kg, 0)
  ) AS loss_unaccounted
FROM production_batches b
LEFT JOIN LATERAL (
  SELECT
    SUM(CASE WHEN anatomical_part = 'breast_cap' THEN actual_weight_kg END) AS breast_cap_kg,
    SUM(CASE WHEN anatomical_part = 'leg_quarter' THEN actual_weight_kg END) AS leg_quarter_kg,
    SUM(CASE WHEN anatomical_part = 'wings' THEN actual_weight_kg END) AS wings_kg,
    SUM(CASE WHEN anatomical_part = 'back_carcass' THEN actual_weight_kg END) AS back_carcass_kg,
    SUM(CASE WHEN anatomical_part = 'offal' THEN actual_weight_kg END) AS offal_kg
  FROM batch_yields by2
  WHERE by2.batch_id = b.id
    AND by2.is_correction = false
  GROUP BY by2.batch_id
) y ON true;
