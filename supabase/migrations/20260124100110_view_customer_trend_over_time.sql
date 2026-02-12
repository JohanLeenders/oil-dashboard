-- =============================================================================
-- Sprint 6: Customer Trend Over Time View
-- =============================================================================
-- Purpose: Show historical trends per customer across periods.
-- Enables pattern recognition for alignment, margin, and volume over time.
--
-- IMPORTANT: Trends are DESCRIPTIVE, not predictive.
-- This view supports learning, not forecasting.
--
-- Aggregation levels: monthly only (weekly too granular for customer analysis)
-- =============================================================================

CREATE OR REPLACE VIEW v_customer_trend_over_time AS
WITH
-- Get monthly customer sales with alignment data
monthly_customer_sales AS (
  SELECT
    st.customer_id,
    c.name AS customer_name,
    c.customer_code,
    DATE_TRUNC('month', st.invoice_date)::DATE AS period_start,
    'month' AS period_type,
    EXTRACT(MONTH FROM st.invoice_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM st.invoice_date)::INTEGER AS period_year,

    -- Volume metrics
    SUM(st.quantity_kg) AS total_kg,
    SUM(st.line_total) AS total_revenue_eur,
    SUM(COALESCE(st.allocated_cost, 0)) AS total_cost_eur,
    SUM(st.line_total - COALESCE(st.allocated_cost, 0)) AS total_margin_eur,
    CASE
      WHEN SUM(st.line_total) > 0
      THEN ROUND(((SUM(st.line_total - COALESCE(st.allocated_cost, 0)) / SUM(st.line_total)) * 100)::numeric, 2)
      ELSE NULL
    END AS margin_pct,
    COUNT(*) AS transaction_count

  FROM sales_transactions st
  JOIN customers c ON c.id = st.customer_id
  WHERE st.is_credit = FALSE
    AND st.invoice_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    st.customer_id,
    c.name,
    c.customer_code,
    DATE_TRUNC('month', st.invoice_date),
    EXTRACT(MONTH FROM st.invoice_date),
    EXTRACT(YEAR FROM st.invoice_date)
),

-- Get monthly customer alignment (via intake profile)
monthly_customer_alignment AS (
  SELECT
    st.customer_id,
    DATE_TRUNC('month', st.invoice_date)::DATE AS period_start,
    p.anatomical_part AS part_code,
    SUM(st.quantity_kg) AS part_kg,
    SUM(SUM(st.quantity_kg)) OVER (PARTITION BY st.customer_id, DATE_TRUNC('month', st.invoice_date)) AS customer_total_kg
  FROM sales_transactions st
  JOIN products p ON p.id = st.product_id
  WHERE p.anatomical_part IS NOT NULL
    AND st.is_credit = FALSE
    AND st.invoice_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    st.customer_id,
    DATE_TRUNC('month', st.invoice_date),
    p.anatomical_part
),

-- Calculate alignment score per month
-- Uses JA757 reference (midpoints)
monthly_alignment_score AS (
  SELECT
    mca.customer_id,
    mca.period_start,
    -- Calculate average absolute deviation from carcass proportions
    -- JA757 midpoints: breast_cap=35.85, leg_quarter=43.40, wings=10.70, back_carcass=7.60, offal=4.00
    AVG(ABS(
      CASE mca.part_code
        WHEN 'breast_cap' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 35.85
        WHEN 'leg_quarter' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 43.40
        WHEN 'wings' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 10.70
        WHEN 'back_carcass' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 7.60
        WHEN 'offal' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 4.00
        ELSE 0
      END
    )) AS avg_abs_deviation,
    -- Alignment score = 100 - (avg_abs_deviation * 4)
    GREATEST(0, 100 - (AVG(ABS(
      CASE mca.part_code
        WHEN 'breast_cap' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 35.85
        WHEN 'leg_quarter' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 43.40
        WHEN 'wings' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 10.70
        WHEN 'back_carcass' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 7.60
        WHEN 'offal' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 4.00
        ELSE 0
      END
    )) * 4)) AS alignment_score,
    COUNT(DISTINCT mca.part_code) AS parts_purchased
  FROM monthly_customer_alignment mca
  WHERE mca.customer_total_kg > 0
  GROUP BY mca.customer_id, mca.period_start
)

-- Final output
SELECT
  mcs.customer_id,
  mcs.customer_name,
  mcs.customer_code,
  mcs.period_start,
  mcs.period_type,
  mcs.period_number,
  mcs.period_year,

  -- Volume metrics
  mcs.total_kg,
  mcs.total_revenue_eur,
  mcs.total_cost_eur,
  mcs.total_margin_eur,
  mcs.margin_pct,
  mcs.transaction_count,

  -- Alignment metrics
  ROUND(mas.alignment_score::numeric, 1) AS alignment_score,
  ROUND(mas.avg_abs_deviation::numeric, 2) AS avg_abs_deviation,
  mas.parts_purchased,

  -- Trend indicators (compare to previous period)
  LAG(mcs.total_kg) OVER (
    PARTITION BY mcs.customer_id ORDER BY mcs.period_start
  ) AS prev_period_kg,
  LAG(mcs.margin_pct) OVER (
    PARTITION BY mcs.customer_id ORDER BY mcs.period_start
  ) AS prev_period_margin_pct,
  LAG(mas.alignment_score) OVER (
    PARTITION BY mcs.customer_id ORDER BY mcs.period_start
  ) AS prev_period_alignment,

  -- Volume change
  CASE
    WHEN LAG(mcs.total_kg) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start) > 0
    THEN ROUND(((mcs.total_kg - LAG(mcs.total_kg) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start))
           / LAG(mcs.total_kg) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start) * 100)::numeric, 1)
    ELSE NULL
  END AS volume_change_pct,

  -- Margin change
  CASE
    WHEN LAG(mcs.margin_pct) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start) IS NOT NULL
    THEN ROUND((mcs.margin_pct - LAG(mcs.margin_pct) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start))::numeric, 2)
    ELSE NULL
  END AS margin_change_pct,

  -- Alignment change
  CASE
    WHEN LAG(mas.alignment_score) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start) IS NOT NULL
    THEN ROUND((mas.alignment_score - LAG(mas.alignment_score) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start))::numeric, 1)
    ELSE NULL
  END AS alignment_change,

  -- Data quality
  CASE
    WHEN mcs.total_kg > 0 AND mas.alignment_score IS NOT NULL THEN 'COMPLETE'
    WHEN mcs.total_kg > 0 THEN 'PARTIAL'
    ELSE 'NO_DATA'
  END AS data_status,

  -- Data type label
  'HISTORICAL_TREND' AS data_type,

  -- Carcass reference
  'JA757' AS carcass_reference

FROM monthly_customer_sales mcs
LEFT JOIN monthly_alignment_score mas
  ON mas.customer_id = mcs.customer_id
  AND mas.period_start = mcs.period_start
ORDER BY mcs.customer_name, mcs.period_year DESC, mcs.period_number DESC;
