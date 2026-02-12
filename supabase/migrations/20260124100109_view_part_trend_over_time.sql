-- =============================================================================
-- Sprint 6: Part Trend Over Time View
-- =============================================================================
-- Purpose: Show historical trends per anatomical part across periods.
-- Enables pattern recognition for yield, margin, and pressure over time.
--
-- IMPORTANT: Trends are DESCRIPTIVE, not predictive.
-- This view supports learning, not forecasting.
--
-- Aggregation levels: weekly, monthly, quarterly
-- =============================================================================

CREATE OR REPLACE VIEW v_part_trend_over_time AS
WITH
-- Get weekly yield data from batch_yields
weekly_yields AS (
  SELECT
    by_.anatomical_part AS part_code,
    DATE_TRUNC('week', pb.slaughter_date)::DATE AS period_start,
    'week' AS period_type,
    EXTRACT(WEEK FROM pb.slaughter_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM pb.slaughter_date)::INTEGER AS period_year,
    AVG(by_.yield_pct) AS avg_yield_pct,
    STDDEV(by_.yield_pct) AS yield_stddev,
    COUNT(DISTINCT pb.id) AS batch_count,
    SUM(by_.actual_weight_kg) AS total_weight_kg
  FROM batch_yields by_
  JOIN production_batches pb ON pb.id = by_.batch_id
  WHERE by_.is_correction = FALSE
    AND pb.slaughter_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    by_.anatomical_part,
    DATE_TRUNC('week', pb.slaughter_date),
    EXTRACT(WEEK FROM pb.slaughter_date),
    EXTRACT(YEAR FROM pb.slaughter_date)
),

-- Get monthly yield data
monthly_yields AS (
  SELECT
    by_.anatomical_part AS part_code,
    DATE_TRUNC('month', pb.slaughter_date)::DATE AS period_start,
    'month' AS period_type,
    EXTRACT(MONTH FROM pb.slaughter_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM pb.slaughter_date)::INTEGER AS period_year,
    AVG(by_.yield_pct) AS avg_yield_pct,
    STDDEV(by_.yield_pct) AS yield_stddev,
    COUNT(DISTINCT pb.id) AS batch_count,
    SUM(by_.actual_weight_kg) AS total_weight_kg
  FROM batch_yields by_
  JOIN production_batches pb ON pb.id = by_.batch_id
  WHERE by_.is_correction = FALSE
    AND pb.slaughter_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    by_.anatomical_part,
    DATE_TRUNC('month', pb.slaughter_date),
    EXTRACT(MONTH FROM pb.slaughter_date),
    EXTRACT(YEAR FROM pb.slaughter_date)
),

-- Get weekly sales/margin data from sales_transactions
weekly_sales AS (
  SELECT
    p.anatomical_part AS part_code,
    DATE_TRUNC('week', st.invoice_date)::DATE AS period_start,
    'week' AS period_type,
    EXTRACT(WEEK FROM st.invoice_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM st.invoice_date)::INTEGER AS period_year,
    SUM(st.quantity_kg) AS total_sold_kg,
    SUM(st.line_total) AS total_revenue_eur,
    SUM(COALESCE(st.allocated_cost, 0)) AS total_cost_eur,
    SUM(st.line_total - COALESCE(st.allocated_cost, 0)) AS total_margin_eur,
    CASE
      WHEN SUM(st.line_total) > 0
      THEN ROUND(((SUM(st.line_total - COALESCE(st.allocated_cost, 0)) / SUM(st.line_total)) * 100)::numeric, 2)
      ELSE NULL
    END AS avg_margin_pct,
    COUNT(*) AS transaction_count
  FROM sales_transactions st
  JOIN products p ON p.id = st.product_id
  WHERE p.anatomical_part IS NOT NULL
    AND st.is_credit = FALSE
    AND st.invoice_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    p.anatomical_part,
    DATE_TRUNC('week', st.invoice_date),
    EXTRACT(WEEK FROM st.invoice_date),
    EXTRACT(YEAR FROM st.invoice_date)
),

-- Get monthly sales data
monthly_sales AS (
  SELECT
    p.anatomical_part AS part_code,
    DATE_TRUNC('month', st.invoice_date)::DATE AS period_start,
    'month' AS period_type,
    EXTRACT(MONTH FROM st.invoice_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM st.invoice_date)::INTEGER AS period_year,
    SUM(st.quantity_kg) AS total_sold_kg,
    SUM(st.line_total) AS total_revenue_eur,
    SUM(COALESCE(st.allocated_cost, 0)) AS total_cost_eur,
    SUM(st.line_total - COALESCE(st.allocated_cost, 0)) AS total_margin_eur,
    CASE
      WHEN SUM(st.line_total) > 0
      THEN ROUND(((SUM(st.line_total - COALESCE(st.allocated_cost, 0)) / SUM(st.line_total)) * 100)::numeric, 2)
      ELSE NULL
    END AS avg_margin_pct,
    COUNT(*) AS transaction_count
  FROM sales_transactions st
  JOIN products p ON p.id = st.product_id
  WHERE p.anatomical_part IS NOT NULL
    AND st.is_credit = FALSE
    AND st.invoice_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    p.anatomical_part,
    DATE_TRUNC('month', st.invoice_date),
    EXTRACT(MONTH FROM st.invoice_date),
    EXTRACT(YEAR FROM st.invoice_date)
),

-- Get weekly DSI (inventory pressure) from pressure view
weekly_pressure AS (
  SELECT
    ip.part_code,
    DATE_TRUNC('week', ip.snapshot_date)::DATE AS period_start,
    'week' AS period_type,
    EXTRACT(WEEK FROM ip.snapshot_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM ip.snapshot_date)::INTEGER AS period_year,
    AVG(ip.quantity_kg) AS avg_inventory_kg
  FROM inventory_positions ip
  WHERE ip.snapshot_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    ip.part_code,
    DATE_TRUNC('week', ip.snapshot_date),
    EXTRACT(WEEK FROM ip.snapshot_date),
    EXTRACT(YEAR FROM ip.snapshot_date)
),

-- Combine weekly data
weekly_combined AS (
  SELECT
    COALESCE(wy.part_code::text, ws.part_code::text, wp.part_code) AS part_code,
    COALESCE(wy.period_start, ws.period_start, wp.period_start) AS period_start,
    'week' AS period_type,
    COALESCE(wy.period_number, ws.period_number, wp.period_number) AS period_number,
    COALESCE(wy.period_year, ws.period_year, wp.period_year) AS period_year,
    wy.avg_yield_pct,
    wy.yield_stddev,
    wy.batch_count,
    wy.total_weight_kg AS produced_kg,
    ws.total_sold_kg,
    ws.total_revenue_eur,
    ws.total_cost_eur,
    ws.total_margin_eur,
    ws.avg_margin_pct,
    ws.transaction_count,
    wp.avg_inventory_kg,
    CASE
      WHEN ws.total_sold_kg > 0 AND wp.avg_inventory_kg > 0
      THEN ROUND((wp.avg_inventory_kg / (ws.total_sold_kg / 7))::numeric, 1)
      ELSE NULL
    END AS avg_dsi
  FROM weekly_yields wy
  FULL OUTER JOIN weekly_sales ws
    ON ws.part_code = wy.part_code
    AND ws.period_start = wy.period_start
  FULL OUTER JOIN weekly_pressure wp
    ON wp.part_code = COALESCE(wy.part_code::text, ws.part_code::text)
    AND wp.period_start = COALESCE(wy.period_start, ws.period_start)
),

-- Combine monthly data
monthly_combined AS (
  SELECT
    COALESCE(my.part_code::text, ms.part_code::text) AS part_code,
    COALESCE(my.period_start, ms.period_start) AS period_start,
    'month' AS period_type,
    COALESCE(my.period_number, ms.period_number) AS period_number,
    COALESCE(my.period_year, ms.period_year) AS period_year,
    my.avg_yield_pct,
    my.yield_stddev,
    my.batch_count,
    my.total_weight_kg AS produced_kg,
    ms.total_sold_kg,
    ms.total_revenue_eur,
    ms.total_cost_eur,
    ms.total_margin_eur,
    ms.avg_margin_pct,
    ms.transaction_count,
    NULL::numeric AS avg_inventory_kg,
    NULL::numeric AS avg_dsi
  FROM monthly_yields my
  FULL OUTER JOIN monthly_sales ms
    ON ms.part_code = my.part_code
    AND ms.period_start = my.period_start
)

-- Final union
SELECT
  part_code,
  period_start,
  period_type,
  period_number,
  period_year,
  avg_yield_pct,
  yield_stddev,
  batch_count,
  produced_kg,
  total_sold_kg,
  total_revenue_eur,
  total_cost_eur,
  total_margin_eur,
  avg_margin_pct,
  transaction_count,
  avg_inventory_kg,
  avg_dsi,
  -- Data quality indicator
  CASE
    WHEN batch_count > 0 AND total_sold_kg > 0 THEN 'COMPLETE'
    WHEN batch_count > 0 OR total_sold_kg > 0 THEN 'PARTIAL'
    ELSE 'NO_DATA'
  END AS data_status,
  -- Data type label
  'HISTORICAL_TREND' AS data_type
FROM (
  SELECT * FROM weekly_combined
  UNION ALL
  SELECT * FROM monthly_combined
) combined
WHERE part_code IS NOT NULL
ORDER BY part_code, period_year DESC, period_number DESC;
