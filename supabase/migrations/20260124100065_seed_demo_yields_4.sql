INSERT INTO batch_yields (batch_id, anatomical_part, actual_weight_kg, yield_pct, target_yield_min, target_yield_max, delta_from_target, measurement_source)
SELECT
  b.id,
  'back_carcass'::anatomical_part,
  265.13,
  7.50,
  7.00,
  8.20,
  -0.10,
  'slaughter_report'
FROM production_batches b WHERE b.batch_ref = 'P2520210';
