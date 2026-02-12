-- Sprint 2: v_batch_nrv_by_sku view
-- Net Realizable Value cost per SKU
-- NRV = allocated_joint_cost + processing_costs (applied AFTER split-off)

CREATE OR REPLACE VIEW v_batch_nrv_by_sku AS
WITH
  -- Get applicable processing costs per part
  -- Aggregates all processing steps for each part
  processing_by_part AS (
    SELECT
      COALESCE(applies_to_part_code, 'all') AS part_code_match,
      COALESCE(applies_to_sku, 'all') AS sku_match,
      process_step,
      cost_per_kg,
      source AS cost_source
    FROM processing_costs
    WHERE valid_from <= CURRENT_DATE
      AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  ),

  -- Get part costs from split-off allocation
  part_costs AS (
    SELECT
      bpc.batch_id,
      bpc.batch_ref,
      bpc.slaughter_date,
      bpc.part_code,
      bpc.weight_kg,
      bpc.allocated_joint_cost_eur,
      bpc.cost_per_kg_splitoff
    FROM v_batch_part_cost bpc
  )

-- Join with products to get SKU-level view
SELECT
  pc.batch_id,
  pc.batch_ref,
  pc.slaughter_date,
  p.sku_code AS sku,
  p.description AS sku_description,
  pc.part_code,

  -- Allocated joint cost at split-off
  pc.allocated_joint_cost_eur,
  pc.cost_per_kg_splitoff,

  -- Processing costs (sum of all applicable steps)
  COALESCE(
    (SELECT SUM(pbp.cost_per_kg)
     FROM processing_by_part pbp
     WHERE (pbp.part_code_match = 'all' OR pbp.part_code_match = pc.part_code)
       AND (pbp.sku_match = 'all' OR pbp.sku_match = p.sku_code)),
    0
  ) AS extra_processing_cost_per_kg,

  -- NRV cost per kg
  -- Formula: cost_per_kg_splitoff + extra_processing_cost_per_kg
  pc.cost_per_kg_splitoff + COALESCE(
    (SELECT SUM(pbp.cost_per_kg)
     FROM processing_by_part pbp
     WHERE (pbp.part_code_match = 'all' OR pbp.part_code_match = pc.part_code)
       AND (pbp.sku_match = 'all' OR pbp.sku_match = p.sku_code)),
    0
  ) AS nrv_cost_per_kg,

  -- Total NRV for this part/SKU in batch
  -- Formula: weight_kg × nrv_cost_per_kg
  ROUND(
    (pc.weight_kg * (
      pc.cost_per_kg_splitoff + COALESCE(
        (SELECT SUM(pbp.cost_per_kg)
         FROM processing_by_part pbp
         WHERE (pbp.part_code_match = 'all' OR pbp.part_code_match = pc.part_code)
           AND (pbp.sku_match = 'all' OR pbp.sku_match = p.sku_code)),
        0
      )
    ))::numeric,
    2
  ) AS nrv_total_eur,

  -- Cost breakdown for transparency
  'SVASO' AS allocation_method,
  'NRV' AS costing_method

FROM part_costs pc
LEFT JOIN products p ON p.anatomical_part::text = pc.part_code AND p.is_active = true
ORDER BY pc.slaughter_date DESC, pc.batch_ref, pc.part_code, p.sku_code;
