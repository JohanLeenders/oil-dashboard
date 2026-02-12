INSERT INTO batch_yields (batch_id, anatomical_part, actual_weight_kg, yield_pct, target_yield_min, target_yield_max, delta_from_target, measurement_source)
SELECT
  b.id,
  'breast_cap'::anatomical_part,
  1237.25,
  35.00,
  34.80,
  36.90,
  -0.85,
  'slaughter_report'
FROM production_batches b WHERE b.batch_ref = 'P2520210';
