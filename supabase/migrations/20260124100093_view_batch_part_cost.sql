-- Sprint 2: v_batch_part_cost view
-- Shows cost per kg per part at split-off point
-- This is the allocated joint cost divided by weight

CREATE OR REPLACE VIEW v_batch_part_cost AS
SELECT
  bsa.splitoff_value_id,
  bsa.batch_id,
  bsa.batch_ref,
  bsa.slaughter_date,
  bsa.part_code,

  -- Weight at split-off
  bsa.weight_kg,

  -- Allocated joint cost (from SVASO allocation)
  bsa.allocated_joint_cost_eur,

  -- Cost per kg at split-off
  -- Formula: allocated_joint_cost / weight_kg
  CASE
    WHEN bsa.weight_kg > 0 THEN
      ROUND((bsa.allocated_joint_cost_eur / bsa.weight_kg)::numeric, 4)
    ELSE 0
  END AS cost_per_kg_splitoff,

  -- Allocation details for traceability
  bsa.allocation_pct,
  bsa.allocation_factor,
  bsa.batch_joint_cost_eur,

  -- Market price used for allocation (for transparency)
  bsa.price_per_kg AS market_price_per_kg,
  bsa.price_source,

  -- Validation flag
  CASE
    WHEN bsa.weight_kg <= 0 THEN 'INVALID_WEIGHT'
    WHEN bsa.allocated_joint_cost_eur <= 0 THEN 'NO_COST_ALLOCATED'
    ELSE 'OK'
  END AS validation_status

FROM v_batch_splitoff_allocation bsa
ORDER BY bsa.slaughter_date DESC, bsa.batch_ref, bsa.part_code;
