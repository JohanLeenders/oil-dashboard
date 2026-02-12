-- Sprint 4: v_customer_intake_profile view
-- Shows each customer's intake profile by anatomical part
-- For comparison against carcass balance (vierkantsverwaarding)

CREATE OR REPLACE VIEW v_customer_intake_profile AS
WITH
  -- Sales aggregated by customer and part (last 90 days for relevance)
  customer_part_sales AS (
    SELECT
      st.customer_id,
      c.name AS customer_name,
      c.customer_code,
      p.anatomical_part AS part_code,
      SUM(st.quantity_kg) AS quantity_kg,
      SUM(st.line_total) AS revenue_eur,
      COUNT(DISTINCT st.invoice_number) AS transaction_count
    FROM sales_transactions st
    JOIN customers c ON c.id = st.customer_id
    JOIN products p ON p.id = st.product_id
    WHERE st.invoice_date >= CURRENT_DATE - INTERVAL '90 days'
      AND st.is_credit = false
      AND p.anatomical_part IS NOT NULL
    GROUP BY st.customer_id, c.name, c.customer_code, p.anatomical_part
  ),

  -- Total per customer for share calculation
  customer_totals AS (
    SELECT
      customer_id,
      SUM(quantity_kg) AS total_quantity_kg,
      SUM(revenue_eur) AS total_revenue_eur
    FROM customer_part_sales
    GROUP BY customer_id
  )

SELECT
  cps.customer_id,
  cps.customer_name,
  cps.customer_code,
  cps.part_code,
  ROUND(cps.quantity_kg::numeric, 2) AS quantity_kg,
  ROUND(cps.revenue_eur::numeric, 2) AS revenue_eur,
  cps.transaction_count,

  -- Share of customer's total
  ROUND(
    (cps.quantity_kg / NULLIF(ct.total_quantity_kg, 0) * 100)::numeric,
    2
  ) AS share_of_total_pct,

  -- Customer total for context
  ROUND(ct.total_quantity_kg::numeric, 2) AS customer_total_kg,
  ROUND(ct.total_revenue_eur::numeric, 2) AS customer_total_revenue_eur,

  -- Reference period
  '90_days' AS reference_period

FROM customer_part_sales cps
JOIN customer_totals ct ON ct.customer_id = cps.customer_id
ORDER BY cps.customer_id, cps.quantity_kg DESC;
