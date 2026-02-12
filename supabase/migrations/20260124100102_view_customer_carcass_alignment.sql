-- Sprint 4: v_customer_carcass_alignment view
-- Compares customer intake profile against carcass balance (vierkantsverwaarding)
-- Shows deviation per part - ANALYTICAL, not prescriptive

CREATE OR REPLACE VIEW v_customer_carcass_alignment AS
WITH
  -- JA757 anatomical reference ratios (from KPI_DEFINITIONS.md)
  -- These represent the natural carcass composition
  carcass_reference AS (
    SELECT 'breast_cap' AS part_code, 35.85 AS carcass_share_pct UNION ALL  -- (34.8 + 36.9) / 2
    SELECT 'leg_quarter', 43.40 UNION ALL                                   -- (42.0 + 44.8) / 2
    SELECT 'wings', 10.70 UNION ALL                                         -- (10.6 + 10.8) / 2
    SELECT 'back_carcass', 7.60 UNION ALL                                   -- (7.0 + 8.2) / 2
    SELECT 'offal', 4.00                                                    -- (3.0 + 5.0) / 2
  ),

  -- Customer intake from profile view
  customer_intake AS (
    SELECT
      customer_id,
      customer_name,
      customer_code,
      part_code,
      quantity_kg,
      share_of_total_pct,
      customer_total_kg
    FROM v_customer_intake_profile
  ),

  -- Deviation calculation per customer/part
  deviation_calc AS (
    SELECT
      ci.customer_id,
      ci.customer_name,
      ci.customer_code,
      ci.part_code,
      ci.quantity_kg,
      ci.share_of_total_pct AS customer_share_pct,
      cr.carcass_share_pct,
      ci.customer_total_kg,

      -- Deviation from carcass balance
      -- Positive = over-uptake (buying more than carcass proportion)
      -- Negative = under-uptake (buying less than carcass proportion)
      ROUND(
        (ci.share_of_total_pct - cr.carcass_share_pct)::numeric,
        2
      ) AS deviation_pct,

      -- Absolute deviation for scoring
      ABS(ci.share_of_total_pct - cr.carcass_share_pct) AS abs_deviation_pct

    FROM customer_intake ci
    JOIN carcass_reference cr ON cr.part_code = ci.part_code::text
  ),

  -- Alignment score per customer (lower = better aligned)
  -- Score is average absolute deviation from carcass balance
  customer_scores AS (
    SELECT
      customer_id,
      ROUND(AVG(abs_deviation_pct)::numeric, 2) AS avg_abs_deviation_pct,
      ROUND(MAX(abs_deviation_pct)::numeric, 2) AS max_deviation_pct,
      COUNT(DISTINCT part_code) AS parts_purchased
    FROM deviation_calc
    GROUP BY customer_id
  )

SELECT
  dc.customer_id,
  dc.customer_name,
  dc.customer_code,
  dc.part_code,
  dc.quantity_kg,
  dc.customer_share_pct,
  dc.carcass_share_pct,
  dc.deviation_pct,
  dc.customer_total_kg,

  -- Alignment score (inverted: 100 = perfect alignment, 0 = maximum deviation)
  -- Based on avg absolute deviation, max 25% deviation = 0 score
  GREATEST(0, ROUND(
    (100 - (cs.avg_abs_deviation_pct * 4))::numeric,
    1
  )) AS alignment_score,

  -- Deviation category per part
  CASE
    WHEN dc.deviation_pct > 10 THEN 'OVER_UPTAKE_HIGH'
    WHEN dc.deviation_pct > 5 THEN 'OVER_UPTAKE_MODERATE'
    WHEN dc.deviation_pct < -10 THEN 'UNDER_UPTAKE_HIGH'
    WHEN dc.deviation_pct < -5 THEN 'UNDER_UPTAKE_MODERATE'
    ELSE 'BALANCED'
  END AS deviation_category,

  -- Customer metrics
  cs.avg_abs_deviation_pct,
  cs.max_deviation_pct,
  cs.parts_purchased,

  -- Reference info
  'JA757' AS carcass_reference_source,
  '90_days' AS reference_period

FROM deviation_calc dc
JOIN customer_scores cs ON cs.customer_id = dc.customer_id
ORDER BY dc.customer_id, dc.part_code;
