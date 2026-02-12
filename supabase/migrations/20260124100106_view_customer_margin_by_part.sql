-- =============================================================================
-- Sprint 5: Customer Margin by Part View
-- =============================================================================
-- Purpose: Calculate margin per customer per anatomical part.
-- Joins sales transactions with NRV costs (Sprint 2) to show margin in context.
--
-- IMPORTANT: This view provides ANALYTICAL data for understanding margin.
-- It does NOT provide price advice or customer scoring.
--
-- Sources:
-- - sales_transactions (revenue)
-- - v_batch_nrv_by_sku (cost from Sprint 2)
-- - sku_part_mapping (SKU to part linkage)
-- =============================================================================

CREATE OR REPLACE VIEW v_customer_margin_by_part AS
WITH
-- Get sales by customer/SKU with part mapping
customer_sales AS (
  SELECT
    st.customer_id,
    c.name AS customer_name,
    c.customer_code,
    spm.part_code,
    st.quantity_kg,
    st.line_total AS revenue_eur,
    st.allocated_cost,
    st.invoice_date,
    st.batch_id
  FROM sales_transactions st
  JOIN customers c ON c.id = st.customer_id
  JOIN products p ON p.id = st.product_id
  LEFT JOIN sku_part_mapping spm ON spm.sku = p.sku_code AND spm.is_active = TRUE
  WHERE st.is_credit = FALSE
    AND st.invoice_date >= CURRENT_DATE - INTERVAL '90 days'
),

-- Aggregate by customer/part
customer_part_totals AS (
  SELECT
    customer_id,
    customer_name,
    customer_code,
    part_code,
    SUM(quantity_kg) AS quantity_kg,
    SUM(revenue_eur) AS revenue_eur,
    SUM(COALESCE(allocated_cost, 0)) AS cost_eur,
    COUNT(*) AS transaction_count,
    MIN(invoice_date) AS first_sale_date,
    MAX(invoice_date) AS last_sale_date
  FROM customer_sales
  WHERE part_code IS NOT NULL
  GROUP BY customer_id, customer_name, customer_code, part_code
),

-- Calculate customer totals for share calculation
customer_totals AS (
  SELECT
    customer_id,
    SUM(quantity_kg) AS total_kg,
    SUM(revenue_eur) AS total_revenue_eur,
    SUM(cost_eur) AS total_cost_eur
  FROM customer_part_totals
  GROUP BY customer_id
)

SELECT
  cpt.customer_id,
  cpt.customer_name,
  cpt.customer_code,
  cpt.part_code,

  -- Volume and revenue
  cpt.quantity_kg,
  cpt.revenue_eur,
  cpt.cost_eur,

  -- Margin calculation
  (cpt.revenue_eur - cpt.cost_eur) AS margin_eur,
  CASE
    WHEN cpt.revenue_eur > 0
    THEN ROUND(((cpt.revenue_eur - cpt.cost_eur) / cpt.revenue_eur * 100)::numeric, 2)
    ELSE NULL
  END AS margin_pct,

  -- Customer context
  CASE
    WHEN ct.total_kg > 0
    THEN ROUND((cpt.quantity_kg / ct.total_kg * 100)::numeric, 2)
    ELSE NULL
  END AS customer_share_pct,
  ct.total_kg AS customer_total_kg,
  ct.total_revenue_eur AS customer_total_revenue_eur,
  ct.total_cost_eur AS customer_total_cost_eur,

  -- Transaction metrics
  cpt.transaction_count,
  cpt.first_sale_date,
  cpt.last_sale_date,

  -- Data quality
  CASE
    WHEN cpt.cost_eur > 0 THEN 'COST_AVAILABLE'
    ELSE 'NO_COST_DATA'
  END AS cost_data_status,

  -- Reference period
  '90_days' AS reference_period

FROM customer_part_totals cpt
JOIN customer_totals ct ON ct.customer_id = cpt.customer_id
WHERE cpt.quantity_kg > 0
ORDER BY cpt.customer_name, cpt.part_code;
