-- Sprint 3: v_sales_velocity_by_part view
-- Calculates average daily sales per anatomical part
-- Uses configurable reference periods

CREATE OR REPLACE VIEW v_sales_velocity_by_part AS
WITH
  -- Reference periods
  reference_config AS (
    SELECT
      30 AS days_short_term,   -- Last 30 days for primary velocity
      90 AS days_medium_term,  -- Last 90 days for smoothed velocity
      7 AS days_recent         -- Last 7 days for trend detection
  ),

  -- Sales by part in last 90 days
  sales_90d AS (
    SELECT
      part_code,
      sale_date,
      SUM(quantity_kg) AS daily_sales_kg
    FROM v_sales_by_part
    WHERE sale_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY part_code, sale_date
  ),

  -- Calculate velocities
  velocity_calc AS (
    SELECT
      s.part_code,

      -- 30-day average (primary)
      COALESCE(
        SUM(CASE WHEN s.sale_date >= CURRENT_DATE - INTERVAL '30 days' THEN s.daily_sales_kg END) /
          NULLIF(30, 0),
        0
      ) AS avg_daily_sales_30d,

      -- 90-day average (smoothed)
      COALESCE(
        SUM(s.daily_sales_kg) / NULLIF(90, 0),
        0
      ) AS avg_daily_sales_90d,

      -- 7-day average (recent trend)
      COALESCE(
        SUM(CASE WHEN s.sale_date >= CURRENT_DATE - INTERVAL '7 days' THEN s.daily_sales_kg END) /
          NULLIF(7, 0),
        0
      ) AS avg_daily_sales_7d,

      -- Total sales in period
      SUM(CASE WHEN s.sale_date >= CURRENT_DATE - INTERVAL '30 days' THEN s.daily_sales_kg END) AS total_sales_30d_kg,
      SUM(s.daily_sales_kg) AS total_sales_90d_kg,

      -- Days with sales
      COUNT(CASE WHEN s.sale_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) AS days_with_sales_30d

    FROM sales_90d s
    GROUP BY s.part_code
  )

SELECT
  vc.part_code,

  -- Primary velocity (30-day average)
  ROUND(vc.avg_daily_sales_30d::numeric, 2) AS avg_daily_sales_kg,

  -- Reference period
  '30_days' AS reference_period,

  -- Additional velocities for context
  ROUND(vc.avg_daily_sales_90d::numeric, 2) AS avg_daily_sales_90d_kg,
  ROUND(vc.avg_daily_sales_7d::numeric, 2) AS avg_daily_sales_7d_kg,

  -- Volume context
  ROUND(vc.total_sales_30d_kg::numeric, 2) AS total_sales_30d_kg,
  vc.days_with_sales_30d,

  -- Trend indicator
  -- Comparing recent (7d) vs medium-term (30d) velocity
  CASE
    WHEN vc.avg_daily_sales_30d = 0 THEN 'NO_DATA'
    WHEN vc.avg_daily_sales_7d > vc.avg_daily_sales_30d * 1.2 THEN 'ACCELERATING'
    WHEN vc.avg_daily_sales_7d < vc.avg_daily_sales_30d * 0.8 THEN 'DECELERATING'
    ELSE 'STABLE'
  END AS velocity_trend,

  -- Data quality
  CASE
    WHEN vc.avg_daily_sales_30d = 0 AND vc.avg_daily_sales_90d = 0 THEN 'NO_SALES_DATA'
    WHEN vc.days_with_sales_30d < 10 THEN 'LIMITED_DATA'
    ELSE 'OK'
  END AS data_status

FROM velocity_calc vc
ORDER BY vc.avg_daily_sales_30d DESC;
