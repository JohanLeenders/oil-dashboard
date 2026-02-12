CREATE OR REPLACE VIEW v_effective_batch_yields AS
WITH latest_yields AS (
  SELECT DISTINCT ON (batch_id, anatomical_part)
    by1.id,
    by1.batch_id,
    by1.anatomical_part,
    by1.actual_weight_kg,
    by1.yield_pct,
    by1.target_yield_min,
    by1.target_yield_max,
    by1.delta_from_target,
    by1.measurement_source,
    by1.measured_at,
    by1.is_correction,
    by1.corrects_yield_id,
    by1.notes,
    by1.created_at
  FROM batch_yields by1
  WHERE NOT EXISTS (
    SELECT 1 FROM batch_yields by2
    WHERE by2.corrects_yield_id = by1.id
  )
  ORDER BY batch_id, anatomical_part, measured_at DESC
)
SELECT
  ly.id,
  ly.batch_id,
  pb.batch_ref,
  ly.anatomical_part,
  ly.actual_weight_kg,
  ly.yield_pct,
  ly.target_yield_min,
  ly.target_yield_max,
  ly.delta_from_target,
  ly.measurement_source,
  ly.measured_at,
  ly.is_correction,
  ly.notes,
  CASE WHEN ly.is_correction THEN 'CORRECTED' ELSE 'ORIGINAL' END AS data_status
FROM latest_yields ly
JOIN production_batches pb ON pb.id = ly.batch_id;
