-- Sprint 3: v_sales_pressure_score view
-- Main pressure indicator per anatomical part
-- DSI (Days Sales Inventory) is the key metric
-- OBSERVATIONAL ONLY - no actions, no advice

CREATE OR REPLACE VIEW v_sales_pressure_score AS
WITH
  -- Inventory data
  inventory AS (
    SELECT
      part_code,
      total_quantity_kg,
      batch_count,
      batch_distribution
    FROM v_inventory_by_part
  ),

  -- Velocity data
  velocity AS (
    SELECT
      part_code,
      avg_daily_sales_kg,
      avg_daily_sales_7d_kg,
      velocity_trend,
      data_status AS velocity_data_status
    FROM v_sales_velocity_by_part
  ),

  -- THT pressure from inventory batches
  -- Count batches by THT status
  tht_pressure AS (
    SELECT
      ip.part_code,
      COUNT(CASE
        WHEN pb.expiry_date IS NULL THEN NULL
        WHEN (CURRENT_DATE - pb.production_date) >=
             (pb.expiry_date - pb.production_date) * 0.9 THEN 1
      END) AS batches_red,
      COUNT(CASE
        WHEN pb.expiry_date IS NULL THEN NULL
        WHEN (CURRENT_DATE - pb.production_date) >=
             (pb.expiry_date - pb.production_date) * 0.7
         AND (CURRENT_DATE - pb.production_date) <
             (pb.expiry_date - pb.production_date) * 0.9 THEN 1
      END) AS batches_orange,
      COUNT(CASE
        WHEN pb.expiry_date IS NULL THEN NULL
        WHEN (CURRENT_DATE - pb.production_date) <
             (pb.expiry_date - pb.production_date) * 0.7 THEN 1
      END) AS batches_green
    FROM inventory_positions ip
    JOIN production_batches pb ON pb.id = ip.batch_id
    WHERE ip.quantity_kg > 0
    GROUP BY ip.part_code
  )

SELECT
  COALESCE(i.part_code, v.part_code) AS part_code,

  -- Inventory position
  COALESCE(i.total_quantity_kg, 0) AS inventory_kg,
  COALESCE(i.batch_count, 0) AS batch_count,

  -- Velocity
  COALESCE(v.avg_daily_sales_kg, 0) AS avg_daily_sales_kg,
  v.velocity_trend,

  -- DSI (Days Sales Inventory)
  -- Formula: inventory / avg_daily_sales
  CASE
    WHEN COALESCE(v.avg_daily_sales_kg, 0) <= 0 THEN NULL
    ELSE ROUND((COALESCE(i.total_quantity_kg, 0) / v.avg_daily_sales_kg)::numeric, 1)
  END AS days_sales_inventory,

  -- Pressure flag based on DSI thresholds
  -- Green: DSI < 14 days (fast moving)
  -- Orange: DSI 14-28 days (moderate)
  -- Red: DSI > 28 days (slow moving / overstocked)
  CASE
    WHEN COALESCE(i.total_quantity_kg, 0) = 0 THEN 'no_stock'
    WHEN COALESCE(v.avg_daily_sales_kg, 0) <= 0 THEN 'no_velocity'
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) < 14 THEN 'green'
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) < 28 THEN 'orange'
    ELSE 'red'
  END AS pressure_flag,

  -- THT pressure component
  COALESCE(tp.batches_red, 0) AS tht_batches_red,
  COALESCE(tp.batches_orange, 0) AS tht_batches_orange,
  COALESCE(tp.batches_green, 0) AS tht_batches_green,

  -- Combined pressure explanation (Dutch per Sprint 3 contract)
  CASE
    WHEN COALESCE(i.total_quantity_kg, 0) = 0 THEN
      'Geen voorraad beschikbaar.'
    WHEN COALESCE(v.avg_daily_sales_kg, 0) <= 0 THEN
      'Geen verkoopdata beschikbaar voor berekening verkoopdruk.'
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) < 14 THEN
      'Normale voorraaddruk. Voorraad reikt ca. ' ||
      ROUND((i.total_quantity_kg / v.avg_daily_sales_kg)::numeric, 0)::text ||
      ' dagen bij huidig tempo.'
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) < 28 THEN
      'Verhoogde voorraaddruk. Voorraad reikt ca. ' ||
      ROUND((i.total_quantity_kg / v.avg_daily_sales_kg)::numeric, 0)::text ||
      ' dagen. Let op THT-risico.'
    ELSE
      'Hoge voorraaddruk! Voorraad reikt ca. ' ||
      ROUND((i.total_quantity_kg / v.avg_daily_sales_kg)::numeric, 0)::text ||
      ' dagen. Actie vereist.'
  END AS explanation,

  -- Batch distribution for drill-down
  COALESCE(i.batch_distribution, '[]'::jsonb) AS batch_distribution,

  -- Data quality
  CASE
    WHEN i.total_quantity_kg IS NULL AND v.avg_daily_sales_kg IS NULL THEN 'NO_DATA'
    WHEN i.total_quantity_kg IS NULL THEN 'NO_INVENTORY_DATA'
    WHEN v.avg_daily_sales_kg IS NULL OR v.avg_daily_sales_kg <= 0 THEN 'NO_VELOCITY_DATA'
    ELSE 'OK'
  END AS data_status

FROM inventory i
FULL OUTER JOIN velocity v ON v.part_code = i.part_code
LEFT JOIN tht_pressure tp ON tp.part_code = COALESCE(i.part_code, v.part_code)
ORDER BY
  -- Sort by pressure: red first, then orange, then green
  CASE
    WHEN COALESCE(i.total_quantity_kg, 0) = 0 THEN 99
    WHEN COALESCE(v.avg_daily_sales_kg, 0) <= 0 THEN 98
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) >= 28 THEN 1
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) >= 14 THEN 2
    ELSE 3
  END,
  COALESCE(i.part_code, v.part_code);
