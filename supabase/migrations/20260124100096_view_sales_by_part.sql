-- Sprint 3: v_sales_by_part view
-- Aggregates sales transactions by part_code for velocity calculations
-- Joins sales_transactions with products to get anatomical_part

CREATE OR REPLACE VIEW v_sales_by_part AS
SELECT
  st.id AS transaction_id,
  st.invoice_date AS sale_date,
  p.sku_code AS sku,
  COALESCE(p.anatomical_part::text, 'unknown') AS part_code,
  st.quantity_kg,
  st.customer_id,
  st.batch_id,
  p.category AS product_category,

  -- For velocity calculations
  st.line_total AS revenue_eur,

  -- Source traceability
  st.invoice_number,
  st.synced_from AS data_source

FROM sales_transactions st
JOIN products p ON p.id = st.product_id
WHERE st.is_credit = false  -- Exclude credits for velocity
ORDER BY st.invoice_date DESC;
