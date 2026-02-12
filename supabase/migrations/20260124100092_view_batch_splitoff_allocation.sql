-- Sprint 2: v_batch_splitoff_allocation view
-- Shows joint cost allocation per batch/part using Sales Value at Split-Off
-- Allocation is ONLY via market value proportion, NOT weight

CREATE OR REPLACE VIEW v_batch_splitoff_allocation AS
WITH
  -- Get total sales value per batch
  batch_totals AS (
    SELECT
      batch_id,
      SUM(sales_value_eur) AS total_sales_value_eur
    FROM batch_splitoff_values
    GROUP BY batch_id
  ),

  -- Get joint cost per batch
  batch_joint_costs AS (
    SELECT
      batch_id,
      SUM(amount_eur) AS joint_cost_eur
    FROM joint_costs
    WHERE cost_type = 'live_bird_purchase'
    GROUP BY batch_id
  )

SELECT
  bsv.id AS splitoff_value_id,
  bsv.batch_id,
  pb.batch_ref,
  pb.slaughter_date,
  bsv.part_code,

  -- Weight and price inputs
  bsv.weight_kg,
  bsv.price_per_kg,
  bsv.price_source,

  -- Sales value at split-off
  bsv.sales_value_eur,

  -- Total sales value for batch
  bt.total_sales_value_eur,

  -- Allocation percentage (Sales Value at Split-Off method)
  -- Formula: part_sales_value / total_sales_value
  CASE
    WHEN bt.total_sales_value_eur > 0 THEN
      ROUND((bsv.sales_value_eur / bt.total_sales_value_eur * 100)::numeric, 4)
    ELSE 0
  END AS allocation_pct,

  -- Joint cost for batch
  COALESCE(bjc.joint_cost_eur, 0) AS batch_joint_cost_eur,

  -- Allocated joint cost to this part
  -- Formula: joint_cost × (part_sales_value / total_sales_value)
  CASE
    WHEN bt.total_sales_value_eur > 0 THEN
      ROUND((COALESCE(bjc.joint_cost_eur, 0) * bsv.sales_value_eur / bt.total_sales_value_eur)::numeric, 2)
    ELSE 0
  END AS allocated_joint_cost_eur,

  -- Validation: allocation factor (must sum to 1.0 per batch)
  CASE
    WHEN bt.total_sales_value_eur > 0 THEN
      ROUND((bsv.sales_value_eur / bt.total_sales_value_eur)::numeric, 6)
    ELSE 0
  END AS allocation_factor

FROM batch_splitoff_values bsv
JOIN production_batches pb ON pb.id = bsv.batch_id
LEFT JOIN batch_totals bt ON bt.batch_id = bsv.batch_id
LEFT JOIN batch_joint_costs bjc ON bjc.batch_id = bsv.batch_id
ORDER BY pb.slaughter_date DESC, pb.batch_ref, bsv.part_code;
