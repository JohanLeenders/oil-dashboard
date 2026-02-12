INSERT INTO batch_yields (batch_id, anatomical_part, actual_weight_kg, yield_pct, target_yield_min, target_yield_max, delta_from_target, measurement_source)
SELECT
  b.id,
  'leg_quarter'::anatomical_part,
  1520.05,
  43.00,
  42.00,
  44.80,
  -0.40,
  'slaughter_report'
FROM production_batches b WHERE b.batch_ref = 'P2520210';
