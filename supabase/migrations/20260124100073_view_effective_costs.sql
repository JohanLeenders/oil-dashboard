CREATE OR REPLACE VIEW v_effective_batch_costs AS
WITH adjusted_costs AS (
  SELECT
    bc.id,
    bc.batch_id,
    bc.cost_type,
    bc.description,
    bc.amount,
    bc.per_unit,
    bc.quantity,
    bc.invoice_ref,
    bc.invoice_date,
    bc.is_adjustment,
    bc.adjusts_cost_id,
    bc.adjustment_reason,
    bc.created_at,
    EXISTS (
      SELECT 1 FROM batch_costs adj
      WHERE adj.adjusts_cost_id = bc.id
    ) AS has_adjustment
  FROM batch_costs bc
),
effective_costs AS (
  SELECT
    ac.*,
    CASE
      WHEN ac.is_adjustment THEN 'ADJUSTMENT'
      WHEN ac.has_adjustment THEN 'SUPERSEDED'
      ELSE 'ORIGINAL'
    END AS cost_status
  FROM adjusted_costs ac
  WHERE NOT ac.has_adjustment
)
SELECT
  ec.id,
  ec.batch_id,
  pb.batch_ref,
  ec.cost_type,
  ec.description,
  ec.amount,
  ec.per_unit,
  ec.quantity,
  ec.invoice_ref,
  ec.invoice_date,
  ec.is_adjustment,
  ec.adjustment_reason,
  ec.cost_status,
  ec.created_at
FROM effective_costs ec
JOIN production_batches pb ON pb.id = ec.batch_id;
