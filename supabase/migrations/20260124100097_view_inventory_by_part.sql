-- Sprint 3: v_inventory_by_part view
-- Aggregates latest inventory positions by part
-- Shows batch distribution for traceability

CREATE OR REPLACE VIEW v_inventory_by_part AS
WITH
  -- Get latest snapshot per batch/part/location
  latest_snapshots AS (
    SELECT DISTINCT ON (batch_id, part_code, location)
      id,
      batch_id,
      part_code,
      quantity_kg,
      location,
      snapshot_date,
      snapshot_timestamp,
      source
    FROM inventory_positions
    ORDER BY batch_id, part_code, location, snapshot_timestamp DESC
  ),

  -- Aggregate by part
  part_totals AS (
    SELECT
      part_code,
      SUM(quantity_kg) AS total_quantity_kg,
      COUNT(DISTINCT batch_id) AS batch_count,
      MAX(snapshot_date) AS latest_snapshot_date
    FROM latest_snapshots
    GROUP BY part_code
  ),

  -- Batch distribution per part (JSONB array)
  batch_distribution AS (
    SELECT
      ls.part_code,
      jsonb_agg(
        jsonb_build_object(
          'batch_id', ls.batch_id,
          'batch_ref', pb.batch_ref,
          'quantity_kg', ls.quantity_kg,
          'location', ls.location,
          'expiry_date', pb.expiry_date
        )
        ORDER BY pb.expiry_date ASC NULLS LAST
      ) AS batches
    FROM latest_snapshots ls
    JOIN production_batches pb ON pb.id = ls.batch_id
    WHERE ls.quantity_kg > 0
    GROUP BY ls.part_code
  )

SELECT
  pt.part_code,
  pt.total_quantity_kg,
  pt.batch_count,
  pt.latest_snapshot_date,
  COALESCE(bd.batches, '[]'::jsonb) AS batch_distribution,

  -- Data quality indicator
  CASE
    WHEN pt.total_quantity_kg IS NULL THEN 'NO_DATA'
    WHEN pt.total_quantity_kg = 0 THEN 'ZERO_STOCK'
    ELSE 'OK'
  END AS data_status

FROM part_totals pt
LEFT JOIN batch_distribution bd ON bd.part_code = pt.part_code
ORDER BY pt.part_code;
