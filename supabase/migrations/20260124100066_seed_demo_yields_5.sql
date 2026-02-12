INSERT INTO batch_yields (batch_id, anatomical_part, actual_weight_kg, yield_pct, target_yield_min, target_yield_max, delta_from_target, measurement_source)
SELECT
  b.id,
  'offal'::anatomical_part,
  133.31,
  3.77,
  NULL,
  NULL,
  NULL,
  'slaughter_report'
FROM production_batches b WHERE b.batch_ref = 'P2520210';
