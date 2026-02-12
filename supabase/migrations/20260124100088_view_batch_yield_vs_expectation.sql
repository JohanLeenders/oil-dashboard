-- Sprint 1: v_batch_yield_vs_expectation view
-- Shows realized yield % per part vs expectation bands
-- JA757 is NORMATIVE (used for delta calculation)
-- Ross308 is INDICATIVE ONLY (labeled, not used for calculations)

CREATE OR REPLACE VIEW v_batch_yield_vs_expectation AS
SELECT
  evy.id AS yield_id,
  evy.batch_id,
  evy.batch_ref,
  pb.slaughter_date,
  evy.anatomical_part,

  -- Realized values
  evy.actual_weight_kg,
  evy.yield_pct AS realized_yield_pct,

  -- JA757 expectation band (NORMATIVE - Hubbard JA757 spec sheet)
  -- These are the authoritative targets
  CASE evy.anatomical_part
    WHEN 'breast_cap' THEN 34.8
    WHEN 'leg_quarter' THEN 42.0
    WHEN 'wings' THEN 10.6
    WHEN 'back_carcass' THEN 7.0
    WHEN 'offal' THEN 3.0  -- Estimated, not in original spec
  END AS ja757_min_pct,

  CASE evy.anatomical_part
    WHEN 'breast_cap' THEN 36.9
    WHEN 'leg_quarter' THEN 44.8
    WHEN 'wings' THEN 10.8
    WHEN 'back_carcass' THEN 8.2
    WHEN 'offal' THEN 5.0  -- Estimated, not in original spec
  END AS ja757_max_pct,

  -- JA757 midpoint (used for delta calculation)
  CASE evy.anatomical_part
    WHEN 'breast_cap' THEN (34.8 + 36.9) / 2
    WHEN 'leg_quarter' THEN (42.0 + 44.8) / 2
    WHEN 'wings' THEN (10.6 + 10.8) / 2
    WHEN 'back_carcass' THEN (7.0 + 8.2) / 2
    WHEN 'offal' THEN (3.0 + 5.0) / 2
  END AS ja757_midpoint_pct,

  -- Delta from JA757 midpoint (NORMATIVE calculation)
  CASE
    WHEN evy.yield_pct IS NOT NULL THEN
      ROUND((evy.yield_pct - CASE evy.anatomical_part
        WHEN 'breast_cap' THEN (34.8 + 36.9) / 2
        WHEN 'leg_quarter' THEN (42.0 + 44.8) / 2
        WHEN 'wings' THEN (10.6 + 10.8) / 2
        WHEN 'back_carcass' THEN (7.0 + 8.2) / 2
        WHEN 'offal' THEN (3.0 + 5.0) / 2
      END)::numeric, 2)
    ELSE NULL
  END AS delta_from_ja757_pct,

  -- Status based on JA757 (NORMATIVE)
  CASE
    WHEN evy.yield_pct IS NULL THEN 'NO_DATA'
    WHEN evy.yield_pct >= CASE evy.anatomical_part
        WHEN 'breast_cap' THEN 34.8
        WHEN 'leg_quarter' THEN 42.0
        WHEN 'wings' THEN 10.6
        WHEN 'back_carcass' THEN 7.0
        WHEN 'offal' THEN 3.0
      END
      AND evy.yield_pct <= CASE evy.anatomical_part
        WHEN 'breast_cap' THEN 36.9
        WHEN 'leg_quarter' THEN 44.8
        WHEN 'wings' THEN 10.8
        WHEN 'back_carcass' THEN 8.2
        WHEN 'offal' THEN 5.0
      END
      THEN 'IN_RANGE'
    WHEN evy.yield_pct < CASE evy.anatomical_part
        WHEN 'breast_cap' THEN 34.8
        WHEN 'leg_quarter' THEN 42.0
        WHEN 'wings' THEN 10.6
        WHEN 'back_carcass' THEN 7.0
        WHEN 'offal' THEN 3.0
      END
      THEN 'BELOW_TARGET'
    ELSE 'ABOVE_TARGET'
  END AS yield_status,

  -- ============================================================
  -- Ross308 reference (INDICATIVE ONLY - labeled as such)
  -- These values are for reference comparison only
  -- ============================================================
  CASE evy.anatomical_part
    WHEN 'breast_cap' THEN 32.0
    WHEN 'leg_quarter' THEN 40.0
    WHEN 'wings' THEN 11.0
    WHEN 'back_carcass' THEN 8.0
    WHEN 'offal' THEN 4.0
  END AS ross308_indicative_min_pct,

  CASE evy.anatomical_part
    WHEN 'breast_cap' THEN 34.0
    WHEN 'leg_quarter' THEN 42.0
    WHEN 'wings' THEN 11.5
    WHEN 'back_carcass' THEN 9.0
    WHEN 'offal' THEN 5.5
  END AS ross308_indicative_max_pct,

  -- Explicit label that Ross308 is indicative only
  'INDICATIVE_ONLY' AS ross308_usage_label,

  -- Data quality from effective yields
  evy.data_status,
  evy.is_correction,
  evy.measurement_source

FROM v_effective_batch_yields evy
JOIN production_batches pb ON pb.id = evy.batch_id
ORDER BY pb.slaughter_date DESC, pb.batch_ref, evy.anatomical_part;
