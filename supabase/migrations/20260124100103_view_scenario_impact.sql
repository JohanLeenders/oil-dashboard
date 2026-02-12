-- Sprint 4: v_scenario_impact view
-- Projects impact of price elasticity scenarios on carcass balance
-- CRITICAL: Scenarios are ASSUMPTIONS, explicitly labeled as non-binding

CREATE OR REPLACE VIEW v_scenario_impact AS
WITH
  -- Current velocity from Sprint 3
  current_velocity AS (
    SELECT
      part_code,
      avg_daily_sales_kg,
      total_sales_30d_kg
    FROM v_sales_velocity_by_part
  ),

  -- Active elasticity assumptions
  active_assumptions AS (
    SELECT
      scenario_id,
      scenario_name,
      scenario_description,
      part_code,
      price_change_pct,
      expected_volume_change_pct,
      assumption_source,
      assumption_note
    FROM elasticity_assumptions
    WHERE (valid_until IS NULL OR valid_until >= CURRENT_DATE)
      AND valid_from <= CURRENT_DATE
  ),

  -- Calculate projected impact
  scenario_projections AS (
    SELECT
      aa.scenario_id,
      aa.scenario_name,
      aa.scenario_description,
      aa.part_code,
      aa.price_change_pct,
      aa.expected_volume_change_pct,
      aa.assumption_source,
      aa.assumption_note,

      -- Current baseline
      cv.avg_daily_sales_kg AS current_daily_kg,
      cv.total_sales_30d_kg AS current_30d_kg,

      -- Projected volume change
      ROUND(
        (cv.avg_daily_sales_kg * (1 + aa.expected_volume_change_pct / 100))::numeric,
        2
      ) AS projected_daily_kg,

      -- Volume delta
      ROUND(
        (cv.avg_daily_sales_kg * aa.expected_volume_change_pct / 100)::numeric,
        2
      ) AS volume_change_daily_kg,

      -- 30-day projection
      ROUND(
        (cv.total_sales_30d_kg * (1 + aa.expected_volume_change_pct / 100))::numeric,
        2
      ) AS projected_30d_kg

    FROM active_assumptions aa
    LEFT JOIN current_velocity cv ON cv.part_code = aa.part_code
  ),

  -- JA757 carcass reference for balance impact
  carcass_reference AS (
    SELECT 'breast_cap' AS part_code, 35.85 AS carcass_share_pct UNION ALL
    SELECT 'leg_quarter', 43.40 UNION ALL
    SELECT 'wings', 10.70 UNION ALL
    SELECT 'back_carcass', 7.60 UNION ALL
    SELECT 'offal', 4.00
  ),

  -- Calculate impact on carcass balance
  balance_impact AS (
    SELECT
      sp.scenario_id,
      sp.part_code,
      sp.current_daily_kg,
      sp.projected_daily_kg,
      cr.carcass_share_pct,

      -- If volume changes, how does it affect balance?
      -- Positive impact = moving toward carcass balance
      -- Negative impact = moving away from carcass balance
      CASE
        WHEN sp.current_daily_kg IS NULL OR sp.current_daily_kg = 0 THEN 'NO_BASELINE'
        WHEN ABS(sp.volume_change_daily_kg) < 0.01 THEN 'NEUTRAL'
        ELSE 'CHANGES_BALANCE'
      END AS balance_effect

    FROM scenario_projections sp
    LEFT JOIN carcass_reference cr ON cr.part_code = sp.part_code
  )

SELECT
  sp.scenario_id,
  sp.scenario_name,
  sp.scenario_description,
  sp.part_code,

  -- Price assumption
  sp.price_change_pct,

  -- Volume projection
  sp.expected_volume_change_pct,
  ROUND(sp.current_daily_kg::numeric, 2) AS current_daily_kg,
  sp.projected_daily_kg,
  sp.volume_change_daily_kg,
  sp.projected_30d_kg,

  -- Balance impact
  bi.balance_effect,

  -- Assumption transparency (CRITICAL)
  sp.assumption_source,
  sp.assumption_note,

  -- Explicit non-binding label
  'SCENARIO_ASSUMPTION' AS data_type,
  'This projection is based on assumptions and is NOT a prediction or recommendation.' AS disclaimer,

  -- Reference
  'JA757' AS carcass_reference,
  CURRENT_DATE AS projection_date

FROM scenario_projections sp
LEFT JOIN balance_impact bi ON bi.scenario_id = sp.scenario_id AND bi.part_code = sp.part_code
ORDER BY sp.scenario_id, sp.part_code;
