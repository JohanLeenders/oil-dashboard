-- Sprint 1: v_batch_output_vs_pakbon view
-- Compares technical output (slaughter report) vs commercial output (pakbon)
-- Shows differences per part for mass balance reconciliation

CREATE OR REPLACE VIEW v_batch_output_vs_pakbon AS
WITH
  -- Technical output: aggregate yields from effective batch yields
  technical_output AS (
    SELECT
      batch_id,
      anatomical_part::text AS part_code,
      SUM(actual_weight_kg) AS technical_weight_kg
    FROM v_effective_batch_yields
    GROUP BY batch_id, anatomical_part
  ),

  -- Commercial output: aggregate delivery notes via SKU mapping
  commercial_output AS (
    SELECT
      dn.batch_id,
      COALESCE(spm.part_code, 'unmapped') AS part_code,
      SUM(dn.net_weight_kg) AS commercial_weight_kg
    FROM delivery_notes dn
    LEFT JOIN sku_part_mapping spm ON spm.sku = dn.sku AND spm.is_active = true
    WHERE dn.batch_id IS NOT NULL
    GROUP BY dn.batch_id, COALESCE(spm.part_code, 'unmapped')
  ),

  -- All part codes across both sources
  all_parts AS (
    SELECT batch_id, part_code FROM technical_output
    UNION
    SELECT batch_id, part_code FROM commercial_output
  )

SELECT
  pb.id AS batch_id,
  pb.batch_ref,
  pb.slaughter_date,
  ap.part_code,

  -- Technical output (slaughter report)
  COALESCE(t.technical_weight_kg, 0) AS technical_weight_kg,

  -- Commercial output (pakbon)
  COALESCE(c.commercial_weight_kg, 0) AS commercial_weight_kg,

  -- Delta: technical - commercial (positive = more produced than shipped)
  COALESCE(t.technical_weight_kg, 0) - COALESCE(c.commercial_weight_kg, 0) AS delta_kg,

  -- Delta as percentage of technical
  CASE
    WHEN COALESCE(t.technical_weight_kg, 0) > 0 THEN
      ROUND(
        ((COALESCE(t.technical_weight_kg, 0) - COALESCE(c.commercial_weight_kg, 0))
        / t.technical_weight_kg * 100)::numeric,
        2
      )
    ELSE NULL
  END AS delta_pct,

  -- Source flags
  CASE WHEN t.technical_weight_kg IS NOT NULL THEN 'slaughter_report' ELSE NULL END AS technical_source,
  CASE WHEN c.commercial_weight_kg IS NOT NULL THEN 'pakbon' ELSE NULL END AS commercial_source

FROM production_batches pb
CROSS JOIN (SELECT DISTINCT part_code FROM all_parts) ap
LEFT JOIN all_parts ap2 ON ap2.batch_id = pb.id AND ap2.part_code = ap.part_code
LEFT JOIN technical_output t ON t.batch_id = pb.id AND t.part_code = ap.part_code
LEFT JOIN commercial_output c ON c.batch_id = pb.id AND c.part_code = ap.part_code
WHERE ap2.batch_id IS NOT NULL -- Only include batches that have data
ORDER BY pb.slaughter_date DESC, pb.batch_ref, ap.part_code;
