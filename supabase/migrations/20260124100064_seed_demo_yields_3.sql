INSERT INTO batch_yields (batch_id, anatomical_part, actual_weight_kg, yield_pct, target_yield_min, target_yield_max, delta_from_target, measurement_source)
SELECT
  b.id,
  'wings'::anatomical_part,
  379.26,
  10.73,
  10.60,
  10.80,
  0.03,
  'slaughter_report'
FROM production_batches b WHERE b.batch_ref = 'P2520210';
